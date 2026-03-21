/* global SimRunner, InputHandler, parseKey, SPEED_DELAYS, MAX_POP_HISTORY,
          TRAIL_MAX_VALUE, MAX_TRAIL_MAP, TRAIL_PRUNE_THRESHOLD, MAX_UNDO_STACK */
/**
 * Simulation control mixin for LifeBoard component.
 * Handles animation loop, stepping, undo/redo, and generation history.
 */
var LifeSimMixin = { // eslint-disable-line no-unused-vars

    // ── Animation loop ─────────────────────────────────────────────────

    _startLoop : function(){
        if(this._loopRunning){ return; }
        this._loopRunning = true;
        var tickId = ++this._tickId;
        var self = this;
        this._rafId = requestAnimationFrame(function(){ self.findNewStates(tickId); });
    },

    findNewStates : function(tickId){
        if(!this._mounted){ this._loopRunning = false; return; }
        if(tickId !== this._tickId){ this._loopRunning = false; return; }
        if(this.state.running !== true){ this._loopRunning = false; return; }

        var liveCells = this.state.liveCells;
        var cols     = this.state.cols;
        var rows     = this.state.rows;
        var birth    = this.state.birthRule;
        var survive  = this.state.surviveRule;
        var boundary = this.state.boundary;

        var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            this.state.regionMask, this.state.regionComponents);
        this._applyNewStates(newLiveCells, tickId);
    },

    // Called by the worker response handler and the sync path.
    _applyNewStates : function(newLiveCells, tickId){
        if(!this._mounted){ this._loopRunning = false; return; }
        if(tickId !== this._tickId){ this._loopRunning = false; return; }

        // While the user is mid-stroke in Live Paint mode, merge the
        // cells being painted so they aren't erased by the incoming
        // generation (which was computed from the pre-stroke snapshot).
        if(InputHandler._dragging && this.state.livePaintMode){
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
        if(this._trailEnabled){
            var trailMap = this._trailMap;
            var prevCells = this.state.liveCells;
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
        this._pushGenHistory();

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
        var isStable  = (boardHash === this._prevBoardHash);
        this._prevBoardHash = boardHash;
        this._stableCount = isStable ? this._stableCount + 1 : 0;
        var hitStable = this._stableCount >= 2 && this.state.autoPauseOnStable;

        var newPop = newLiveCells.size;
        var newHistory = this.state.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        var newSessionPeak = Math.max(this.state.sessionPeakPop || 0, newPop);
        // Store last measured GPS so it persists briefly after pausing.
        this._gpsDisplayUntil = this._gpsDisplayUntil || 0;

        // Gen/sec tracking.
        var now = Date.now();
        this._genTimestamps.push(now);
        if(this._genTimestamps.length > 20){ this._genTimestamps.shift(); }
        if(this._genTimestamps.length >= 2){
            var ts = this._genTimestamps;
            var dt = ts[ts.length - 1] - ts[0];
            if(dt > 0){ this._measuredGps = (ts.length - 1) / dt * 1000; }
        }
        // Keep GPS visible for 3 s after pausing.
        this._gpsDisplayUntil = now + 3000;

        this._minimapDirty = true;
        var self = this;
        var myTickId = tickId;
        this.setState(function(prev){
            return {
                liveCells :      newLiveCells,
                generations :    prev.generations + 1,
                popHistory :     newHistory,
                sessionPeakPop : newSessionPeak,
                stable :         hitStable,
                running :        hitStable ? false : prev.running
            };
        }, function(){
            if(!self._mounted){ return; }
            self.drawBoard();
            if(hitStable){ self._loopRunning = false; self._announce('Stable pattern detected \u2014 simulation paused'); return; }
            var delay = SPEED_DELAYS[Math.max(0, Math.min(9, (self.state.speed || 1) - 1))] || 0;
            self._loopTimeout = setTimeout(function(){
                self._rafId = requestAnimationFrame(function(){ self.findNewStates(myTickId); });
            }, delay);
        });
    },

    stepGame : function(){
        this.pushUndo();
        var liveCells = this.state.liveCells;
        var cols      = this.state.cols;
        var rows      = this.state.rows;
        var birth     = this.state.birthRule;
        var survive   = this.state.surviveRule;
        var boundary  = this.state.boundary;
        var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary,
            this.state.regionMask, this.state.regionComponents);
        var newPop = newLiveCells.size;
        var newHistory = this.state.popHistory;
        newHistory.push(newPop);
        if(newHistory.length > MAX_POP_HISTORY * 2){ newHistory = newHistory.slice(-MAX_POP_HISTORY); }
        var newSessionPeakStep = Math.max(this.state.sessionPeakPop || 0, newPop);
        this._minimapDirty = true;
        var self = this;
        this.setState({
            liveCells :      newLiveCells,
            running :        false,
            generations :    this.state.generations + 1,
            popHistory :     newHistory,
            sessionPeakPop : newSessionPeakStep,
            stable :         false
        }, function(){ self.drawBoard(); });
    },

    // ── Undo ──────────────────────────────────────────────────────────

    pushUndo : function(){
        this._undoStack.push({
            liveCells :   new Map(this.state.liveCells),
            generations : this.state.generations,
            regionMask :  new Set(this.state.regionMask)
        });
        if(this._undoStack.length > MAX_UNDO_STACK){ this._undoStack.shift(); }
        this._redoStack = [];
    },

    popUndo : function(){
        if(this._undoStack && this._undoStack.length > 0){
            return this._undoStack.pop();
        }
        return null;
    },

    cancelDrawTool : function(){
        if(!InputHandler._drawToolStart){ return; }
        InputHandler._drawToolStart = null;
        InputHandler._drawPreviewCells = [];
        this.popUndo();
        this.drawBoard();
    },

    undo : function(){
        if(this._undoStack.length === 0){ this._announce('Nothing to undo'); return; }
        // Save current state for redo before restoring.
        this._redoStack.push({
            liveCells: new Map(this.state.liveCells),
            generations: this.state.generations,
            regionMask: new Set(this.state.regionMask)
        });
        if(this._redoStack.length > MAX_UNDO_STACK){ this._redoStack.shift(); }
        var entry = this._undoStack.pop();
        this._tickId++;
        this._loopRunning = false;
        this._prevBoardHash = null;
        this._stableCount = 0;
        this._minimapDirty = true;
        var self = this;
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
        this.setState(stateUpdate, function(){
            if(entry.regionMask){ self._recomputeRegion(); }
            else { self.drawBoard(); }
        });
    },

    redo : function(){
        if(this._redoStack.length === 0){ this._announce('Nothing to redo'); return; }
        // Save current state for undo before applying redo.
        this._undoStack.push({
            liveCells: new Map(this.state.liveCells),
            generations: this.state.generations,
            regionMask: new Set(this.state.regionMask)
        });
        var entry = this._redoStack.pop();
        this._tickId++;
        this._loopRunning = false;
        this._prevBoardHash = null;
        this._stableCount = 0;
        this._minimapDirty = true;
        var self = this;
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
        this.setState(stateUpdate, function(){
            if(entry.regionMask){ self._recomputeRegion(); }
            else { self.drawBoard(); }
        });
    },

    // Advance N generations at once via SimRunner.
    stepN : function(n){
        if(!n || n < 1){ n = 1; }
        this.pushUndo();
        this._pushGenHistory();
        var liveCells = this.state.liveCells;
        var cols      = this.state.cols;
        var rows      = this.state.rows;
        var birth     = this.state.birthRule;
        var survive   = this.state.surviveRule;
        var boundary  = this.state.boundary;
        var self = this;
        var gen = this.state.generations;
        var popHistory = this.state.popHistory;
        var peak = this.state.sessionPeakPop || 0;

        // Fast path: unbounded — SimRunner handles HashLife batch internally
        if(boundary === 'unbounded'){
            var batch = SimRunner.stepN(liveCells, cols, rows, birth, survive, boundary, n,
                this.state.regionMask, this.state.regionComponents);
            for(var p = 0; p < batch.pops.length; p++){
                popHistory.push(batch.pops[p]);
                if(popHistory.length > MAX_POP_HISTORY * 2){ popHistory = popHistory.slice(-MAX_POP_HISTORY); }
            }
            if(batch.peak > peak){ peak = batch.peak; }
            this._minimapDirty = true;
            this.setState({
                liveCells: batch.liveCells,
                generations: gen + n,
                running: false,
                popHistory: popHistory,
                sessionPeakPop: peak,
                stable: false
            }, function(){ self.drawBoard(); });
            return;
        }

        // Toroidal / finite: chunked for UI responsiveness
        var done = 0;
        var CHUNK = 50;
        var doChunk = function(){
            var limit = Math.min(done + CHUNK, n);
            var _regionMask = self.state.regionMask;
            var _regionComponents = self.state.regionComponents;
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
                self._minimapDirty = true;
                self.setState({
                    liveCells: liveCells,
                    generations: gen,
                    running: false,
                    popHistory: popHistory,
                    sessionPeakPop: peak,
                    stable: false
                }, function(){ self.drawBoard(); });
            }
        };
        doChunk();
    },

    // ── Generation history (step backward) ─────────────────────────────

    _pushGenHistory : function(){
        this._genHistoryCounter++;
        var pop = this.state.liveCells.size;
        var interval = pop > 50000 ? 10 : pop > 10000 ? 5 : this._genHistoryInterval;
        if(this._genHistoryCounter % interval !== 0){ return; }
        this._genHistory.push({
            liveCells: new Map(this.state.liveCells),
            generations: this.state.generations
        });
        if(this._genHistory.length > this._genHistoryMax){
            this._genHistory.shift();
        }
    },

    stepBack : function(){
        if(this._genHistory.length === 0){ return; }
        var snapshot = this._genHistory.pop();
        this._minimapDirty = true;
        SimRunner.invalidate();
        var self = this;
        this.setState({
            liveCells: snapshot.liveCells,
            generations: snapshot.generations,
            running: false,
            stable: false
        }, function(){ self.drawBoard(); });
    },

    clearGenHistory : function(){
        this._genHistory = [];
        this._genHistoryCounter = 0;
    },

    toggleGame : function(){
        if(this.state.running){
            this.setState({running : false});
            this._announce('Simulation paused');
        } else {
            this._prevBoardHash = null;
            this._stableCount = 0;
            this.setState({running : true, stable : false});
            this._startLoop();
            this._announce('Simulation started');
        }
    },
};
