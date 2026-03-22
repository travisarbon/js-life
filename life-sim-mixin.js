/* global SimRunner, InputHandler, parseKey, SPEED_DELAYS, MAX_POP_HISTORY,
          TRAIL_MAX_VALUE, MAX_TRAIL_MAP, TRAIL_PRUNE_THRESHOLD, MAX_UNDO_STACK,
          LifeViewUtils, LifeBoardUtils */
/**
 * Simulation control utilities for LifeBoard component.
 * Handles animation loop, stepping, undo/redo, and generation history.
 */
var LifeSimUtils = { // eslint-disable-line no-unused-vars

    // ── Animation loop ─────────────────────────────────────────────────

    _startLoop : function(stateRef, dispatch, refs){
        if(refs.loopRunning){ return; }
        refs.loopRunning = true;
        var tickId = ++refs.tickId;
        refs.rafId = requestAnimationFrame(function(){ LifeSimUtils.findNewStates(stateRef, dispatch, refs, tickId); });
    },

    findNewStates : function(stateRef, dispatch, refs, tickId){
        if(!refs.mounted){ refs.loopRunning = false; return; }
        if(tickId !== refs.tickId){ refs.loopRunning = false; return; }
        if(stateRef.current.running !== true){ refs.loopRunning = false; return; }

        var liveCells = stateRef.current.liveCells;
        var cols     = stateRef.current.cols;
        var rows     = stateRef.current.rows;
        var birth    = stateRef.current.birthRule;
        var survive  = stateRef.current.surviveRule;
        var boundary = stateRef.current.boundary;

        var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            stateRef.current.regionMask, stateRef.current.regionComponents);
        LifeSimUtils._applyNewStates(stateRef, dispatch, refs, newLiveCells, tickId);
    },

    // Called by the worker response handler and the sync path.
    _applyNewStates : function(stateRef, dispatch, refs, newLiveCells, tickId){
        if(!refs.mounted){ refs.loopRunning = false; return; }
        if(tickId !== refs.tickId){ refs.loopRunning = false; return; }

        // While the user is mid-stroke in Live Paint mode, merge the
        // cells being painted so they aren't erased by the incoming
        // generation (which was computed from the pre-stroke snapshot).
        if(InputHandler._dragging && stateRef.current.livePaintMode){
            var painted = InputHandler._paintedCells;
            var paintKeys = Object.keys(painted);
            if(paintKeys.length > 0){
                for(var pi = 0; pi < paintKeys.length; pi++){
                    var k = paintKeys[pi];
                    if(painted[k] === 1){ newLiveCells.set(k, 1); }
                    else { newLiveCells.delete(k); }
                }
                SimRunner.invalidate();
            }
        }

        // Cell trail tracking: record recently-dead cells.
        if(refs.trailEnabled){
            var trailMap = refs.trailMap;
            var prevCells = stateRef.current.liveCells;
            // Cells that were alive but are now dead → add to trail.
            prevCells.forEach(function(age, key){
                if(!newLiveCells.has(key)){ trailMap.set(key, TRAIL_MAX_VALUE); }
            });
            // Single pass: decay values, collect expired/overwritten entries.
            var toDelete = [];
            trailMap.forEach(function(val, key){
                if(newLiveCells.has(key) || val <= 1){ toDelete.push(key); }
                else { trailMap.set(key, val - 1); }
            });
            for(var ti = 0; ti < toDelete.length; ti++){ trailMap.delete(toDelete[ti]); }
            // Prune if over limit.
            if(trailMap.size > MAX_TRAIL_MAP){
                trailMap.forEach(function(val, key){
                    if(val <= TRAIL_PRUNE_THRESHOLD){ trailMap.delete(key); }
                });
                if(trailMap.size > MAX_TRAIL_MAP){ trailMap.clear(); }
            }
        }

        // Generation history snapshot for step-backward.
        LifeSimUtils._pushGenHistory(stateRef, dispatch, refs);

        // Stability detection via O(n) order-independent hash (FNV-1a inspired).
        var _h1 = 0, _h2 = 0x811c9dc5, _h3 = 0, _hCount = 0;
        newLiveCells.forEach(function(age, key){
            var _krc = parseKey(key), kr = _krc[0], kc = _krc[1];
            var paired = kr >= kc ? kr * kr + kr + kc : kc * kc + kr;
            _h1 = (_h1 + paired) | 0;
            _h2 = Math.imul(_h2 ^ paired, 16777619) | 0;
            _h3 = (_h3 + Math.imul(paired, 2654435761)) | 0;
            _hCount++;
        });
        var boardHash = _hCount + '|' + _h1 + '|' + _h2 + '|' + _h3;
        var isStable  = (boardHash === refs.prevBoardHash);
        refs.prevBoardHash = boardHash;
        refs.stableCount = isStable ? refs.stableCount + 1 : 0;
        var hitStable = refs.stableCount >= 2 && stateRef.current.autoPauseOnStable;

        var newPop = newLiveCells.size;
        var newHistory = stateRef.current.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        var newSessionPeak = Math.max(stateRef.current.sessionPeakPop || 0, newPop);
        // Store last measured GPS so it persists briefly after pausing.
        refs.gpsDisplayUntil = refs.gpsDisplayUntil || 0;

        // Gen/sec tracking.
        var now = Date.now();
        refs.genTimestamps.push(now);
        if(refs.genTimestamps.length > 20){ refs.genTimestamps.shift(); }
        if(refs.genTimestamps.length >= 2){
            var ts = refs.genTimestamps;
            var dt = ts[ts.length - 1] - ts[0];
            if(dt > 0){ refs.measuredGps = (ts.length - 1) / dt * 1000; }
        }
        // Keep GPS visible for 3 s after pausing.
        refs.gpsDisplayUntil = now + 3000;

        refs.minimapDirty = true;
        var myTickId = tickId;
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
        if(hitStable){ refs.loopRunning = false; LifeViewUtils._announce(stateRef, dispatch, refs, 'Stable pattern detected \u2014 simulation paused'); return; }
        var delay = SPEED_DELAYS[Math.max(0, Math.min(9, (stateRef.current.speed || 1) - 1))] || 0;
        refs.loopTimeout = setTimeout(function(){
            refs.rafId = requestAnimationFrame(function(){ LifeSimUtils.findNewStates(stateRef, dispatch, refs, myTickId); });
        }, delay);
    },

    stepGame : function(stateRef, dispatch, refs){
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        var liveCells = stateRef.current.liveCells;
        var cols      = stateRef.current.cols;
        var rows      = stateRef.current.rows;
        var birth     = stateRef.current.birthRule;
        var survive   = stateRef.current.surviveRule;
        var boundary  = stateRef.current.boundary;
        var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            stateRef.current.regionMask, stateRef.current.regionComponents);
        var newPop = newLiveCells.size;
        var newHistory = stateRef.current.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        var newSessionPeakStep = Math.max(stateRef.current.sessionPeakPop || 0, newPop);
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

    pushUndo : function(stateRef, dispatch, refs){
        refs.undoStack.push({
            liveCells :   new Map(stateRef.current.liveCells),
            generations : stateRef.current.generations,
            regionMask :  new Set(stateRef.current.regionMask)
        });
        if(refs.undoStack.length > MAX_UNDO_STACK){ refs.undoStack.shift(); }
        refs.redoStack = [];
    },

    popUndo : function(stateRef, dispatch, refs){
        if(refs.undoStack && refs.undoStack.length > 0){
            return refs.undoStack.pop();
        }
        return null;
    },

    cancelDrawTool : function(stateRef, dispatch, refs){
        if(!InputHandler._drawToolStart){ return; }
        InputHandler._drawToolStart = null;
        InputHandler._drawPreviewCells = [];
        LifeSimUtils.popUndo(stateRef, dispatch, refs);
        refs.drawPending = true;
    },

    undo : function(stateRef, dispatch, refs){
        if(refs.undoStack.length === 0){ LifeViewUtils._announce(stateRef, dispatch, refs, 'Nothing to undo'); return; }
        // Save current state for redo before restoring.
        refs.redoStack.push({
            liveCells: new Map(stateRef.current.liveCells),
            generations: stateRef.current.generations,
            regionMask: new Set(stateRef.current.regionMask)
        });
        if(refs.redoStack.length > MAX_UNDO_STACK){ refs.redoStack.shift(); }
        var entry = refs.undoStack.pop();
        refs.tickId++;
        refs.loopRunning = false;
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        SimRunner.invalidate();
        var stateUpdate = {
            liveCells :   entry.liveCells,
            generations : entry.generations,
            running :     false,
            stable :      false
        };
        if(entry.regionMask){
            stateUpdate.regionMask = entry.regionMask;
        }
        dispatch({type:'MERGE', payload: stateUpdate});
        if(entry.regionMask){ LifeBoardUtils._recomputeRegion(stateRef, dispatch, refs); }
        else { refs.drawPending = true; }
    },

    redo : function(stateRef, dispatch, refs){
        if(refs.redoStack.length === 0){ LifeViewUtils._announce(stateRef, dispatch, refs, 'Nothing to redo'); return; }
        // Save current state for undo before applying redo.
        refs.undoStack.push({
            liveCells: new Map(stateRef.current.liveCells),
            generations: stateRef.current.generations,
            regionMask: new Set(stateRef.current.regionMask)
        });
        var entry = refs.redoStack.pop();
        refs.tickId++;
        refs.loopRunning = false;
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        SimRunner.invalidate();
        var stateUpdate = {
            liveCells :   entry.liveCells,
            generations : entry.generations,
            running :     false,
            stable :      false
        };
        if(entry.regionMask){
            stateUpdate.regionMask = entry.regionMask;
        }
        dispatch({type:'MERGE', payload: stateUpdate});
        if(entry.regionMask){ LifeBoardUtils._recomputeRegion(stateRef, dispatch, refs); }
        else { refs.drawPending = true; }
    },

    // Advance N generations at once via SimRunner.
    stepN : function(stateRef, dispatch, refs, n){
        if(!n || n < 1){ n = 1; }
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        LifeSimUtils._pushGenHistory(stateRef, dispatch, refs);
        var liveCells = stateRef.current.liveCells;
        var cols      = stateRef.current.cols;
        var rows      = stateRef.current.rows;
        var birth     = stateRef.current.birthRule;
        var survive   = stateRef.current.surviveRule;
        var boundary  = stateRef.current.boundary;
        var gen = stateRef.current.generations;
        var popHistory = stateRef.current.popHistory;
        var peak = stateRef.current.sessionPeakPop || 0;

        // Fast path: unbounded — SimRunner handles HashLife batch internally
        if(boundary === 'unbounded'){
            var batch = SimRunner.stepN(liveCells, cols, rows, birth, survive, boundary, n,
                stateRef.current.regionMask, stateRef.current.regionComponents);
            for(var p = 0; p < batch.pops.length; p++){
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
        var done = 0;
        var CHUNK = 50;
        var doChunk = function(){
            var limit = Math.min(done + CHUNK, n);
            var _regionMask = stateRef.current.regionMask;
            var _regionComponents = stateRef.current.regionComponents;
            for(var i = done; i < limit; i++){
                liveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
                    _regionMask, _regionComponents);
                gen++;
                var pop = liveCells.size;
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

    _pushGenHistory : function(stateRef, dispatch, refs){
        refs.genHistoryCounter++;
        var pop = stateRef.current.liveCells.size;
        var interval = pop > 50000 ? 10 : pop > 10000 ? 5 : refs.genHistoryInterval;
        if(refs.genHistoryCounter % interval !== 0){ return; }
        refs.genHistory.push({
            liveCells: new Map(stateRef.current.liveCells),
            generations: stateRef.current.generations
        });
        if(refs.genHistory.length > refs.genHistoryMax){
            refs.genHistory.shift();
        }
    },

    stepBack : function(stateRef, dispatch, refs){
        if(refs.genHistory.length === 0){ return; }
        var snapshot = refs.genHistory.pop();
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

    clearGenHistory : function(stateRef, dispatch, refs){
        refs.genHistory = [];
        refs.genHistoryCounter = 0;
    },

    toggleGame : function(stateRef, dispatch, refs){
        if(stateRef.current.running){
            dispatch({type:'MERGE', payload:{running : false}});
            LifeViewUtils._announce(stateRef, dispatch, refs, 'Simulation paused');
        } else {
            refs.prevBoardHash = null;
            refs.stableCount = 0;
            dispatch({type:'MERGE', payload:{running : true, stable : false}});
            LifeSimUtils._startLoop(stateRef, dispatch, refs);
            LifeViewUtils._announce(stateRef, dispatch, refs, 'Simulation started');
        }
    },
};
