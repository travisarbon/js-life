/* global SimEngine, SimRunner, CanvasRenderer, InputHandler, RegionUtil, PATTERNS */
/**
 * Board configuration, drawing modes, and selection mixin for LifeBoard component.
 * Handles board resize, rules, patterns, mode toggles, selection, and region management.
 */
var LifeBoardMixin = { // eslint-disable-line no-unused-vars

    // ── Selection & draw helpers ─────────────────────────────────────────

    getSelectionCells : function(sel){
        var mask = this.state.boundary !== 'unbounded' ? this.state.regionMask : null;
        return InputHandler.getSelectionCells(sel, mask);
    },

    pointInPolygon : function(px, py, polygon){ return InputHandler.pointInPolygon(px, py, polygon); },

    bresenhamLine : function(r0, c0, r1, c1){ return InputHandler.bresenhamLine(r0, c0, r1, c1); },

    floodFillCells : function(startC, startR, liveCells, cols, rows, startAlive){
        return InputHandler.floodFillCells(startC, startR, liveCells, cols, rows, this.state.boundary, startAlive, this.state.regionMask);
    },

    ellipseCells : function(c1, r1, c2, r2){ return InputHandler.ellipseCells(c1, r1, c2, r2); },

    // ── Selection operations ─────────────────────────────────────────────

    copySelection : function(){
        var sel = this.state.selection;
        if(!sel){ return; }
        var liveCells = this.state.liveCells;
        var selCells = this.getSelectionCells(sel);
        if(selCells.length === 0){ return; }
        var minR = Infinity, minC = Infinity;
        selCells.forEach(function(rc){ if(rc[0] < minR) minR = rc[0]; if(rc[1] < minC) minC = rc[1]; });
        var cells = [];
        selCells.forEach(function(rc){
            if(liveCells.has(rc[0] + ',' + rc[1])){
                cells.push([rc[0] - minR, rc[1] - minC]);
            }
        });
        this.setState({clipboard: cells});
    },

    pasteAsPattern : function(){
        if(!this.state.clipboard || this.state.clipboard.length === 0){ return; }
        PATTERNS['Clipboard'] = this.state.clipboard;
        InputHandler._previewPos = null;
        var self = this;
        this.setState({selectedPattern: 'Clipboard', patternRotation: 0,
                       drawMode: 'preset', selection: null},
            function(){ self.drawBoard(); self.drawRotationPreview(); });
    },

    deleteSelection : function(){
        var sel = this.state.selection;
        if(!sel){ return; }
        this.pushUndo();
        this._stableCount = 0;
        this._prevBoardHash = null;
        // Snapshot selection cells before setState to avoid stale closure.
        var selCells = this.getSelectionCells(sel);
        this._minimapDirty = true;
        SimRunner.invalidate();
        var self = this;
        this.setState(function(prevState){
            var newLiveCells = new Map(prevState.liveCells);
            selCells.forEach(function(rc){
                newLiveCells.delete(rc[0] + ',' + rc[1]);
            });
            return {liveCells: newLiveCells, stable: false};
        }, function(){ self.drawBoard(); });
    },

    clearSelection : function(){
        var self = this;
        // Restore to preset or paint depending on whether a pattern is armed.
        var restoreMode = this.state.selectedPattern ? 'preset' : 'paint';
        this.setState({selection: null, drawMode: restoreMode},
            function(){ self.drawBoard(); });
    },

    toggleSelectMode : function(){
        if(this.state.drawMode === 'select'){
            this.clearSelection();
        } else {
            var self = this;
            // Enter select mode without clearing the armed preset.
            this.setState({drawMode: 'select'},
                function(){ self.drawBoard(); });
        }
    },

    // ── Mode toggles ─────────────────────────────────────────────────────

    toggleDrawMode : function(){
        var self = this;
        this.setState({drawMode: 'paint'}, function(){ self.drawBoard(); });
    },

    togglePresetMode : function(){
        var self = this;
        var newMode = this.state.drawMode === 'preset' ? 'paint' : 'preset';
        this.setState({drawMode: newMode}, function(){ self.drawBoard(); });
    },

    toggleMinimap : function(){
        var self = this;
        this.setState({showMinimap: !this.state.showMinimap}, function(){ self.drawBoard(); });
    },

    togglePanMode : function(){
        this.setState({panMode: !this.state.panMode});
    },

    toggleMobileTools : function(){
        this.toggleBottomSheet();
    },

    // ── Theme / dark mode ────────────────────────────────────────────────

    _applyDarkMode : function(dark){
        document.documentElement.classList.toggle('dark-mode', !!dark);
    },

    setDarkModePref : function(e){
        var pref = e.target.value;
        var dark;
        if(pref === 'dark'){ dark = true; }
        else if(pref === 'light'){ dark = false; }
        else { dark = this._darkModeQuery && this._darkModeQuery.matches; }
        this._applyDarkMode(dark);
        this.setState({darkModePref: pref});
        try { localStorage.setItem('life-dark-mode-pref', pref); } catch(ex){}
    },

    setTheme : function(e){
        var self = this;
        this.setState({theme: e.target.value}, function(){ self.drawBoard(); });
    },

    // ── Step count and toggles ───────────────────────────────────────────

    setStepCount : function(e){
        this.setState({stepCount: Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 1))});
    },

    toggleLivePaint : function(){
        this.setState({livePaintMode : !this.state.livePaintMode});
    },

    toggleGridLines : function(){
        var self = this;
        this.setState({gridLines : !this.state.gridLines}, function(){
            self.drawBoard();
        });
    },

    // ── Region management ────────────────────────────────────────────────

    /**
     * Recompute regionComponents and regionBounds from current regionMask,
     * kill any liveCells outside the mask, and update cols/rows/pendingCols/pendingRows.
     * Optionally accepts a callback.
     */
    _recomputeRegion : function(callback){
        var mask = this.state.regionMask;
        var components = RegionUtil.findComponents(mask);
        var bounds = RegionUtil.getBounds(mask);
        CanvasRenderer.invalidateRegionCache();
        // Derive cols/rows from bounds for backward compat.
        var newCols = bounds ? bounds.maxC - bounds.minC + 1 : this.state.cols;
        var newRows = bounds ? bounds.maxR - bounds.minR + 1 : this.state.rows;
        // Kill live cells outside the region when in bounded mode.
        var clippedLiveCells = this.state.liveCells;
        if(this.state.boundary !== 'unbounded' && mask.size > 0){
            var dirty = false;
            clippedLiveCells = new Map();
            var liveCells = this.state.liveCells;
            liveCells.forEach(function(age, key){
                if(mask.has(key)){
                    clippedLiveCells.set(key, age);
                } else {
                    dirty = true;
                }
            });
            if(!dirty){ clippedLiveCells = this.state.liveCells; }
        }
        this._minimapDirty = true;
        SimRunner.invalidate();
        var self = this;
        this.setState({
            regionComponents: components,
            regionBounds: bounds || {minR: 0, maxR: newRows - 1, minC: 0, maxC: newCols - 1},
            cols: newCols,
            rows: newRows,
            pendingCols: newCols,
            pendingRows: newRows,
            liveCells: clippedLiveCells,
            stable: false
        }, function(){
            self.drawBoard();
            if(callback) callback();
        });
    },

    /**
     * Apply region mask mutations (add/remove keys), then recompute.
     * addKeys: array of "r,c" strings to add.
     * removeKeys: array of "r,c" strings to remove.
     */
    _mutateRegion : function(addKeys, removeKeys, callback){
        var newMask = new Set(this.state.regionMask);
        if(addKeys){
            for(var ai = 0; ai < addKeys.length; ai++){ newMask.add(addKeys[ai]); }
        }
        if(removeKeys){
            for(var ri = 0; ri < removeKeys.length; ri++){ newMask.delete(removeKeys[ri]); }
        }
        var self = this;
        this.setState({regionMask: newMask}, function(){
            self._recomputeRegion(callback);
        });
    },

    /**
     * Switch to region draw mode.
     */
    toggleRegionMode : function(){
        var self = this;
        var newMode = this.state.drawMode === 'region' ? 'paint' : 'region';
        this.setState({drawMode: newMode}, function(){ self.drawBoard(); });
    },

    toggleBoundary : function(){
        var cur = this.state.boundary;
        var next = cur === 'toroidal' ? 'finite' : cur === 'finite' ? 'unbounded' : 'toroidal';
        SimRunner.invalidate();
        this._minimapDirty = true;
        this._mmUnboundedRegion = null;
        CanvasRenderer.invalidateRegionCache();
        var self = this;
        var stateUpdate = {boundary : next};
        // Exit region mode when switching to unbounded.
        if(next === 'unbounded' && this.state.drawMode === 'region'){
            stateUpdate.drawMode = 'paint';
        }
        this.setState(stateUpdate, function(){ self.drawBoard(); });
    },

    // ── Sliders ──────────────────────────────────────────────────────────

    resizeBoard : function(newCols, newRows){
        newCols = Math.max(1, Math.round(newCols || 1));
        newRows = Math.max(1, Math.round(newRows || 1));
        // Replace region mask with a fresh rectangle of the new dimensions.
        var newRegionMask = RegionUtil.buildRect(newCols, newRows);
        var newRegionComponents = [{
            cells: newRegionMask,
            minR: 0, maxR: newRows - 1, minC: 0, maxC: newCols - 1
        }];
        // Keep only cells that still fall within the new bounds.
        var oldLiveCells = this.state.liveCells;
        var newLiveCells = new Map();
        oldLiveCells.forEach(function(age, key){
            if(newRegionMask.has(key)){ newLiveCells.set(key, age); }
        });
        var clamped = this.clampView(
            this.state.viewX, this.state.viewY, newCols, newRows, this.state.cellSize);
        this._minimapDirty = true;
        SimRunner.invalidate();
        CanvasRenderer.invalidateRegionCache();
        var self = this;
        this.setState({
            cols :        newCols,
            rows :        newRows,
            pendingCols : newCols,
            pendingRows : newRows,
            liveCells :   newLiveCells,
            viewX :       clamped.viewX,
            viewY :       clamped.viewY,
            selection :      null,
            popHistory :     [],
            sessionPeakPop : 0,
            regionMask :     newRegionMask,
            regionComponents : newRegionComponents,
            regionBounds :   {minR: 0, maxR: newRows - 1, minC: 0, maxC: newCols - 1}
        }, function(){ self.drawBoard(); });
    },

    setWidth : function(e){
        var v = parseInt(e.target.value, 10);
        if(isNaN(v) || v < 1) v = this.state.cols;
        v = Math.max(1, Math.min(10000, v));
        var self = this;
        this.setState({pendingCols : v}, function(){
            self.drawBoard();
        });
    },

    applyWidth : function(){
        this.resizeBoard(this.state.pendingCols, this.state.rows);
    },

    onWidthKeyDown : function(e){
        if(e.key === 'Enter'){ this.applyWidth(); }
    },

    setHeight : function(e){
        var v = parseInt(e.target.value, 10);
        if(isNaN(v) || v < 1) v = this.state.rows;
        v = Math.max(1, Math.min(10000, v));
        var self = this;
        this.setState({pendingRows : v}, function(){
            self.drawBoard();
        });
    },

    applyHeight : function(){
        this.resizeBoard(this.state.cols, this.state.pendingRows);
    },

    onHeightKeyDown : function(e){
        if(e.key === 'Enter'){ this.applyHeight(); }
    },

    applyGridPreset : function(cols, rows){
        if(cols * rows > 500000){
            if(!confirm('A ' + cols + '\u00d7' + rows + ' grid uses significant memory and may run slowly. Continue?')){ return; }
        }
        this.resizeBoard(cols, rows);
    },

    setDensity : function(e){
        this.setState({sparseness : 9 - (parseInt(e.target.value, 10) || 0)});
    },

    setSpeed : function(e){
        var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
        this.setState({speed : v});
    },

    // ── Rules ────────────────────────────────────────────────────────────

    parseRuleString : function(val){
        var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
        if(!match){ return null; }
        return {
            birth :   match[1].split('').filter(function(d,i,a){ return a.indexOf(d) === i; }).map(Number),
            survive : match[2].split('').filter(function(d,i,a){ return a.indexOf(d) === i; }).map(Number)
        };
    },

    setRule : function(e){
        var val = e.target.value;
        var parsed = this.parseRuleString(val);
        if(parsed){
            SimRunner.invalidate();
            this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                ruleString : val, rulePreset : val.toUpperCase()});
        } else {
            this.setState({ruleString : val, rulePreset : ''});
        }
    },

    setRulePreset : function(e){
        var rule = e.target.value;
        if(!rule){ return; }
        var parsed = this.parseRuleString(rule);
        if(parsed){
            SimRunner.invalidate();
            this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                ruleString : rule, rulePreset : rule});
        }
    },

    // ── Patterns ─────────────────────────────────────────────────────────

    rotateCW : function(){
        var self = this;
        this.setState({patternRotation : (this.state.patternRotation + 1) % 4},
            function(){ self.drawBoard(); });
    },

    rotateCCW : function(){
        var self = this;
        this.setState({patternRotation : (this.state.patternRotation + 3) % 4},
            function(){ self.drawBoard(); });
    },

    selectPattern : function(e){
        var name = e.target.value || null;
        InputHandler._previewPos = null;
        var self = this;
        var newMode = name ? 'preset' : 'paint';
        this.setState({selectedPattern: name, drawMode: newMode, patternRotation: 0},
            function(){ self.drawBoard(); });
    },

    placePattern : function(name, centerC, centerR){
        if(!PATTERNS[name]){ return; }
        this.pushUndo();
        this._stableCount = 0;
        this._prevBoardHash = null;
        var pattern = SimEngine.rotatePattern(PATTERNS[name], this.state.patternRotation);
        var maxR = 0, maxC = 0;
        for(var k = 0; k < pattern.length; k++){
            if(pattern[k][0] > maxR){ maxR = pattern[k][0]; }
            if(pattern[k][1] > maxC){ maxC = pattern[k][1]; }
        }
        var offsetR = centerR - Math.floor(maxR / 2);
        var offsetC = centerC - Math.floor(maxC / 2);
        var newLiveCells = new Map(this.state.liveCells);
        var regionMask = this.state.regionMask;
        var isUnbounded = this.state.boundary === 'unbounded';
        for(var i = 0; i < pattern.length; i++){
            var pr = pattern[i][0] + offsetR;
            var pc = pattern[i][1] + offsetC;
            var pkey = pr + ',' + pc;
            if(isUnbounded || regionMask.has(pkey)){
                newLiveCells.set(pkey, 1);
            }
        }
        InputHandler._previewPos = null;
        this._minimapDirty = true;
        SimRunner.invalidate();
        var self = this;
        this.setState({liveCells: newLiveCells, stable: false}, function(){ self.drawBoard(); });
    },

    // ── Board actions ────────────────────────────────────────────────────

    emptyBoard : function(){
        this.pushUndo();
        this._prevBoardHash = null;
        this._stableCount = 0;
        this._minimapDirty = true;
        this._mmUnboundedRegion = null;
        SimRunner.invalidate();
        this._trailMap = new Map();
        this.clearGenHistory();
        var self = this;
        this.setState({running : false, generations : 0, liveCells : new Map(),
            popHistory : [], sessionPeakPop : 0, stable : false}, function(){ self.drawBoard(); });
        this._announce('Board cleared');
    },

    resetGame : function(){
        this.pushUndo();
        var mask = this.state.regionMask;
        var useMask = this.state.boundary !== 'unbounded' && mask && mask.size > 0;
        var resetCols = this.state.boundary === 'unbounded' ? 100 : this.state.cols;
        var resetRows = this.state.boundary === 'unbounded' ? 100 : this.state.rows;
        var totalCells = useMask ? mask.size : resetCols * resetRows;
        var sparseness = this.state.sparseness;
        // Cap density for very large boards to prevent browser crash.
        if(totalCells > 1000000){
            sparseness = Math.max(sparseness, totalCells / 500000);
        }
        var wasRunning = this.state.running;
        this._tickId++;
        this._loopRunning = false;
        this._prevBoardHash = null;
        this._stableCount = 0;
        this._minimapDirty = true;
        this._mmUnboundedRegion = null;
        SimRunner.invalidate();
        this._trailMap = new Map();
        this.clearGenHistory();
        var self = this;
        var applyReset = function(newLiveCells){
            self.setState({running : false, generations : 0, liveCells : newLiveCells,
                popHistory : [], sessionPeakPop : 0, stable : false}, function(){
                self.drawBoard();
                if(wasRunning){
                    self.setState({running : true}, function(){ self._startLoop(); });
                }
            });
        };
        if(useMask){
            // Generate random cells only within the region mask.
            var newLiveCells = new Map();
            mask.forEach(function(key){
                if(Math.random() < (1 / sparseness)){
                    newLiveCells.set(key, 1);
                }
            });
            applyReset(newLiveCells);
        } else if(totalCells > 250000){
            // Large board: generate cells asynchronously to avoid UI freeze.
            this.setState({running : false});
            SimEngine.buildLiveCellsAsync(resetCols, resetRows, sparseness, applyReset);
        } else {
            applyReset(SimEngine.buildLiveCells(resetCols, resetRows, sparseness));
        }
    }
};
