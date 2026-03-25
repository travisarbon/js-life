import { parseKey, SPEED_DELAYS, MAX_POP_HISTORY, TRAIL_MAX_VALUE, MAX_TRAIL_MAP, TRAIL_PRUNE_THRESHOLD, MAX_UNDO_STACK } from './constants.js';
import { SimRunner } from './simulation.js';
import { InputHandler } from './input-handler.js';
import { LifeViewUtils } from './life-view-utils.js';
/**
 * Simulation control utilities for LifeBoard component.
 * Handles animation loop, stepping, undo/redo, and generation history.
 */
var LifeSimUtils = { // eslint-disable-line no-unused-vars

    // ── Animation loop ─────────────────────────────────────────────────

    _startLoop : function(stateRef, refs, dispatch){
        if(refs.loopRunning){ return; }
        refs.loopRunning = true;
        const tickId = ++refs.tickId;
        refs.rafId = requestAnimationFrame(function(){ LifeSimUtils.findNewStates(stateRef, refs, dispatch, tickId); });
    },

    findNewStates : function(stateRef, refs, dispatch, tickId){
        if(!refs.mounted){ refs.loopRunning = false; return; }
        if(tickId !== refs.tickId){ refs.loopRunning = false; return; }
        if(stateRef.current.running !== true){ refs.loopRunning = false; return; }

        const liveCells = stateRef.current.liveCells;
        const cols     = stateRef.current.cols;
        const rows     = stateRef.current.rows;
        const birth    = stateRef.current.birthRule;
        const survive  = stateRef.current.surviveRule;
        const boundary = stateRef.current.boundary;

        const newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            stateRef.current.regionMask, stateRef.current.regionComponents);
        LifeSimUtils._applyNewStates(stateRef, refs, dispatch, newLiveCells, tickId);
    },

    // Called by the worker response handler and the sync path.
    _applyNewStates : function(stateRef, refs, dispatch, newLiveCells, tickId){
        if(!refs.mounted){ refs.loopRunning = false; return; }
        if(tickId !== refs.tickId){ refs.loopRunning = false; return; }

        // While the user is mid-stroke in Live Paint mode, merge the
        // cells being painted so they aren't erased by the incoming
        // generation (which was computed from the pre-stroke snapshot).
        if(InputHandler._dragging && stateRef.current.livePaintMode){
            const painted = InputHandler._paintedCells;
            const paintKeys = Object.keys(painted);
            if(paintKeys.length > 0){
                for(let pi = 0; pi < paintKeys.length; pi++){
                    const k = paintKeys[pi];
                    if(painted[k] === 1){ newLiveCells.set(k, 1); }
                    else { newLiveCells.delete(k); }
                }
                SimRunner.invalidate();
            }
        }

        // Cell trail tracking: record recently-dead cells.
        if(refs.trailEnabled){
            const trailMap = refs.trailMap;
            const prevCells = stateRef.current.liveCells;
            // Cells that were alive but are now dead → add to trail.
            prevCells.forEach(function(age, key){
                if(!newLiveCells.has(key)){ trailMap.set(key, TRAIL_MAX_VALUE); }
            });
            // Single pass: decay values, collect expired/overwritten entries.
            const toDelete = [];
            trailMap.forEach(function(val, key){
                if(newLiveCells.has(key) || val <= 1){ toDelete.push(key); }
                else { trailMap.set(key, val - 1); }
            });
            for(let ti = 0; ti < toDelete.length; ti++){ trailMap.delete(toDelete[ti]); }
            // Prune if over limit — progressive eviction instead of full clear.
            if(trailMap.size > MAX_TRAIL_MAP){
                // First pass: remove entries at or below prune threshold.
                trailMap.forEach(function(val, key){
                    if(val <= TRAIL_PRUNE_THRESHOLD){ trailMap.delete(key); }
                });
                // If still over limit, remove entries at half-life value.
                if(trailMap.size > MAX_TRAIL_MAP){
                    const halfLife = Math.floor(TRAIL_MAX_VALUE / 2);
                    trailMap.forEach(function(val, key){
                        if(val <= halfLife){ trailMap.delete(key); }
                    });
                }
            }
        }

        // Generation history snapshot for step-backward.
        LifeSimUtils._pushGenHistory(stateRef, refs, dispatch);

        // Stability detection via O(n) order-independent hash (FNV-1a inspired).
        let _h1 = 0, _h2 = 0x811c9dc5, _h3 = 0, _hCount = 0;
        newLiveCells.forEach(function(age, key){
            const _krc = parseKey(key), kr = _krc[0], kc = _krc[1];
            const paired = kr >= kc ? kr * kr + kr + kc : kc * kc + kr;
            _h1 = (_h1 + paired) | 0;
            _h2 = Math.imul(_h2 ^ paired, 16777619) | 0;
            _h3 = (_h3 + Math.imul(paired, 2654435761)) | 0;
            _hCount++;
        });
        const boardHash = _hCount + '|' + _h1 + '|' + _h2 + '|' + _h3;
        const isStable  = (boardHash === refs.prevBoardHash);
        refs.prevBoardHash = boardHash;
        refs.stableCount = isStable ? refs.stableCount + 1 : 0;
        const hitStable = refs.stableCount >= 2 && stateRef.current.autoPauseOnStable;

        const newPop = newLiveCells.size;
        let newHistory = stateRef.current.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        const newSessionPeak = Math.max(stateRef.current.sessionPeakPop || 0, newPop);
        // Store last measured GPS so it persists briefly after pausing.
        refs.gpsDisplayUntil = refs.gpsDisplayUntil || 0;

        // Gen/sec tracking.
        const now = Date.now();
        refs.genTimestamps.push(now);
        if(refs.genTimestamps.length > 20){ refs.genTimestamps.shift(); }
        if(refs.genTimestamps.length >= 2){
            const ts = refs.genTimestamps;
            const dt = ts[ts.length - 1] - ts[0];
            if(dt > 0){ refs.measuredGps = (ts.length - 1) / dt * 1000; }
        }
        // Keep GPS visible for 3 s after pausing.
        refs.gpsDisplayUntil = now + 3000;

        refs.minimapDirty = true;
        const myTickId = tickId;
        dispatch({type:'MERGE', payload:{
            liveCells :      newLiveCells,
            generations :    stateRef.current.generations + 1,
            popHistory :     newHistory,
            sessionPeakPop : newSessionPeak,
            stable :         hitStable,
            running :        hitStable ? false : stateRef.current.running
        }});
        refs.drawPending = true;
        if(!refs.mounted){ return; }
        if(hitStable){ refs.loopRunning = false; LifeViewUtils._announce(stateRef, refs, dispatch, 'Stable pattern detected \u2014 simulation paused'); return; }
        const delay = SPEED_DELAYS[Math.max(0, Math.min(9, (stateRef.current.speed || 1) - 1))] || 0;
        refs.loopTimeout = setTimeout(function(){
            refs.rafId = requestAnimationFrame(function(){ LifeSimUtils.findNewStates(stateRef, refs, dispatch, myTickId); });
        }, delay);
    },

    stepGame : function(stateRef, refs, dispatch){
        LifeSimUtils.pushUndo(stateRef, refs, dispatch);
        const liveCells = stateRef.current.liveCells;
        const cols      = stateRef.current.cols;
        const rows      = stateRef.current.rows;
        const birth     = stateRef.current.birthRule;
        const survive   = stateRef.current.surviveRule;
        const boundary  = stateRef.current.boundary;
        const newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            stateRef.current.regionMask, stateRef.current.regionComponents);
        const newPop = newLiveCells.size;
        let newHistory = stateRef.current.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        const newSessionPeakStep = Math.max(stateRef.current.sessionPeakPop || 0, newPop);
        refs.minimapDirty = true;
        dispatch({type:'MERGE', payload:{
            liveCells :      newLiveCells,
            running :        false,
            generations :    stateRef.current.generations + 1,
            popHistory :     newHistory,
            sessionPeakPop : newSessionPeakStep,
            stable :         false
        }});
        refs.drawPending = true;
    },

    // ── Undo ──────────────────────────────────────────────────────────

    pushUndo : function(stateRef, refs, _dispatch){
        const s = stateRef.current;
        refs.undoStack.push({
            liveCells :        new Map(s.liveCells),
            generations :      s.generations,
            regionMask :       new Set(s.regionMask),
            regionComponents : s.regionComponents,
            regionBounds :     s.regionBounds,
            cols :             s.cols,
            rows :             s.rows
        });
        if(refs.undoStack.length > MAX_UNDO_STACK){ refs.undoStack.shift(); }
        refs.redoStack = [];
    },

    popUndo : function(_stateRef, refs, _dispatch){
        if(refs.undoStack && refs.undoStack.length > 0){
            return refs.undoStack.pop();
        }
        return null;
    },

    cancelDrawTool : function(stateRef, refs, dispatch){
        if(!InputHandler._drawToolStart){ return; }
        InputHandler._drawToolStart = null;
        InputHandler._drawPreviewCells = [];
        LifeSimUtils.popUndo(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    undo : function(stateRef, refs, dispatch){
        if(refs.undoStack.length === 0){ LifeViewUtils._announce(stateRef, refs, dispatch, 'Nothing to undo'); return; }
        // Save current state for redo before restoring.
        const s = stateRef.current;
        refs.redoStack.push({
            liveCells:        new Map(s.liveCells),
            generations:      s.generations,
            regionMask:       new Set(s.regionMask),
            regionComponents: s.regionComponents,
            regionBounds:     s.regionBounds,
            cols:             s.cols,
            rows:             s.rows
        });
        if(refs.redoStack.length > MAX_UNDO_STACK){ refs.redoStack.shift(); }
        const entry = refs.undoStack.pop();
        refs.tickId++;
        refs.loopRunning = false;
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        SimRunner.invalidate();
        const stateUpdate = {
            liveCells :   entry.liveCells,
            generations : entry.generations,
            running :     false,
            stable :      false
        };
        if(entry.regionMask){
            stateUpdate.regionMask = entry.regionMask;
            stateUpdate.regionComponents = entry.regionComponents;
            stateUpdate.regionBounds = entry.regionBounds;
            stateUpdate.cols = entry.cols;
            stateUpdate.rows = entry.rows;
            stateUpdate.pendingCols = entry.cols;
            stateUpdate.pendingRows = entry.rows;
        }
        dispatch({type:'MERGE', payload: stateUpdate});
        refs.drawPending = true;
    },

    redo : function(stateRef, refs, dispatch){
        if(refs.redoStack.length === 0){ LifeViewUtils._announce(stateRef, refs, dispatch, 'Nothing to redo'); return; }
        // Save current state for undo before applying redo.
        const s = stateRef.current;
        refs.undoStack.push({
            liveCells:        new Map(s.liveCells),
            generations:      s.generations,
            regionMask:       new Set(s.regionMask),
            regionComponents: s.regionComponents,
            regionBounds:     s.regionBounds,
            cols:             s.cols,
            rows:             s.rows
        });
        const entry = refs.redoStack.pop();
        refs.tickId++;
        refs.loopRunning = false;
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        SimRunner.invalidate();
        const stateUpdate = {
            liveCells :   entry.liveCells,
            generations : entry.generations,
            running :     false,
            stable :      false
        };
        if(entry.regionMask){
            stateUpdate.regionMask = entry.regionMask;
            stateUpdate.regionComponents = entry.regionComponents;
            stateUpdate.regionBounds = entry.regionBounds;
            stateUpdate.cols = entry.cols;
            stateUpdate.rows = entry.rows;
            stateUpdate.pendingCols = entry.cols;
            stateUpdate.pendingRows = entry.rows;
        }
        dispatch({type:'MERGE', payload: stateUpdate});
        refs.drawPending = true;
    },

    // Advance N generations at once via SimRunner.
    stepN : function(stateRef, refs, dispatch, n){
        if(!n || n < 1){ n = 1; }
        LifeSimUtils.pushUndo(stateRef, refs, dispatch);
        LifeSimUtils._pushGenHistory(stateRef, refs, dispatch);
        let liveCells = stateRef.current.liveCells;
        const cols      = stateRef.current.cols;
        const rows      = stateRef.current.rows;
        const birth     = stateRef.current.birthRule;
        const survive   = stateRef.current.surviveRule;
        const boundary  = stateRef.current.boundary;
        let gen = stateRef.current.generations;
        let popHistory = stateRef.current.popHistory.slice();
        let peak = stateRef.current.sessionPeakPop || 0;

        // Fast path: unbounded — SimRunner handles HashLife batch internally
        if(boundary === 'unbounded'){
            const batch = SimRunner.stepN(liveCells, cols, rows, birth, survive, boundary, n,
                stateRef.current.regionMask, stateRef.current.regionComponents);
            for(let p = 0; p < batch.pops.length; p++){
                popHistory.push(batch.pops[p]);
                if(popHistory.length > MAX_POP_HISTORY * 2){ popHistory = popHistory.slice(-MAX_POP_HISTORY); }
            }
            if(batch.peak > peak){ peak = batch.peak; }
            refs.minimapDirty = true;
            dispatch({type:'MERGE', payload:{
                liveCells: batch.liveCells,
                generations: gen + n,
                running: false,
                popHistory: popHistory,
                sessionPeakPop: peak,
                stable: false
            }});
            refs.drawPending = true;
            return;
        }

        // Toroidal / finite: chunked for UI responsiveness
        let done = 0;
        const CHUNK = 50;
        const doChunk = function(){
            const limit = Math.min(done + CHUNK, n);
            const _regionMask = stateRef.current.regionMask;
            const _regionComponents = stateRef.current.regionComponents;
            for(let i = done; i < limit; i++){
                liveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
                    _regionMask, _regionComponents);
                gen++;
                const pop = liveCells.size;
                popHistory.push(pop);
                if(popHistory.length > MAX_POP_HISTORY * 2){ popHistory = popHistory.slice(-MAX_POP_HISTORY); }
                if(pop > peak){ peak = pop; }
            }
            done = limit;
            if(done < n){
                setTimeout(doChunk, 0);
            } else {
                refs.minimapDirty = true;
                dispatch({type:'MERGE', payload:{
                    liveCells: liveCells,
                    generations: gen,
                    running: false,
                    popHistory: popHistory,
                    sessionPeakPop: peak,
                    stable: false
                }});
                refs.drawPending = true;
            }
        };
        doChunk();
    },

    // ── Generation history (step backward) ─────────────────────────────

    _pushGenHistory : function(stateRef, refs, _dispatch){
        refs.genHistoryCounter++;
        const pop = stateRef.current.liveCells.size;
        const interval = pop > 50000 ? 10 : pop > 10000 ? 5 : refs.genHistoryInterval;
        if(refs.genHistoryCounter % interval !== 0){ return; }
        refs.genHistory.push({
            liveCells: new Map(stateRef.current.liveCells),
            generations: stateRef.current.generations
        });
        if(refs.genHistory.length > refs.genHistoryMax){
            refs.genHistory.shift();
        }
    },

    stepBack : function(stateRef, refs, dispatch){
        if(refs.genHistory.length === 0){ return; }
        const snapshot = refs.genHistory.pop();
        refs.minimapDirty = true;
        SimRunner.invalidate();
        dispatch({type:'MERGE', payload:{
            liveCells: snapshot.liveCells,
            generations: snapshot.generations,
            running: false,
            stable: false
        }});
        refs.drawPending = true;
    },

    clearGenHistory : function(_stateRef, refs, _dispatch){
        refs.genHistory = [];
        refs.genHistoryCounter = 0;
    },

    toggleGame : function(stateRef, refs, dispatch){
        if(stateRef.current.running){
            dispatch({type:'MERGE', payload:{running : false}});
            LifeViewUtils._announce(stateRef, refs, dispatch, 'Simulation paused');
        } else {
            refs.prevBoardHash = null;
            refs.stableCount = 0;
            dispatch({type:'MERGE', payload:{running : true, stable : false}});
            LifeSimUtils._startLoop(stateRef, refs, dispatch);
            LifeViewUtils._announce(stateRef, refs, dispatch, 'Simulation started');
        }
    },
};

export { LifeSimUtils };
