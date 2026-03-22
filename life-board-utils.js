/* global SimEngine, SimRunner, CanvasRenderer, InputHandler, RegionUtil, PATTERNS, LifeSimUtils, LifeViewUtils, drawRotationPreview */
/**
 * Board configuration, drawing modes, and selection utility for LifeBoard component.
 * Handles board resize, rules, patterns, mode toggles, selection, and region management.
 */
var LifeBoardUtils = { // eslint-disable-line no-unused-vars

    // ── Selection & draw helpers ─────────────────────────────────────────

    getSelectionCells : function(stateRef, dispatch, refs, sel){
        var mask = stateRef.current.boundary !== 'unbounded' ? stateRef.current.regionMask : null;
        return InputHandler.getSelectionCells(sel, mask);
    },

    pointInPolygon : function(stateRef, dispatch, refs, px, py, polygon){ return InputHandler.pointInPolygon(px, py, polygon); },

    bresenhamLine : function(stateRef, dispatch, refs, r0, c0, r1, c1){ return InputHandler.bresenhamLine(r0, c0, r1, c1); },

    floodFillCells : function(stateRef, dispatch, refs, startC, startR, liveCells, cols, rows, startAlive){
        return InputHandler.floodFillCells(startC, startR, liveCells, cols, rows, stateRef.current.boundary, startAlive, stateRef.current.regionMask);
    },

    ellipseCells : function(stateRef, dispatch, refs, c1, r1, c2, r2){ return InputHandler.ellipseCells(c1, r1, c2, r2); },

    // ── Selection operations ─────────────────────────────────────────────

    copySelection : function(stateRef, dispatch, refs){
        var sel = stateRef.current.selection;
        if(!sel){ return; }
        var liveCells = stateRef.current.liveCells;
        var selCells = LifeBoardUtils.getSelectionCells(stateRef, dispatch, refs, sel);
        if(selCells.length === 0){ return; }
        var minR = Infinity, minC = Infinity;
        selCells.forEach(function(rc){ if(rc[0] < minR) minR = rc[0]; if(rc[1] < minC) minC = rc[1]; });
        var cells = [];
        selCells.forEach(function(rc){
            if(liveCells.has(rc[0] + ',' + rc[1])){
                cells.push([rc[0] - minR, rc[1] - minC]);
            }
        });
        dispatch({type:'MERGE', payload:{clipboard: cells}});
    },

    pasteAsPattern : function(stateRef, dispatch, refs){
        if(!stateRef.current.clipboard || stateRef.current.clipboard.length === 0){ return; }
        PATTERNS['Clipboard'] = stateRef.current.clipboard;
        InputHandler._previewPos = null;
        dispatch({type:'MERGE', payload:{selectedPattern: 'Clipboard', patternRotation: 0,
                       drawMode: 'preset', selection: null}});
        refs.drawPending = true;
        drawRotationPreview(stateRef, refs);
    },

    deleteSelection : function(stateRef, dispatch, refs){
        var sel = stateRef.current.selection;
        if(!sel){ return; }
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        refs.stableCount = 0;
        refs.prevBoardHash = null;
        // Snapshot selection cells before dispatch to avoid stale closure.
        var selCells = LifeBoardUtils.getSelectionCells(stateRef, dispatch, refs, sel);
        refs.minimapDirty = true;
        SimRunner.invalidate();
        var newLiveCells = new Map(stateRef.current.liveCells);
        selCells.forEach(function(rc){
            newLiveCells.delete(rc[0] + ',' + rc[1]);
        });
        dispatch({type:'MERGE', payload:{liveCells: newLiveCells, stable: false}});
        refs.drawPending = true;
    },

    clearSelection : function(stateRef, dispatch, refs){
        // Restore to preset or paint depending on whether a pattern is armed.
        var restoreMode = stateRef.current.selectedPattern ? 'preset' : 'paint';
        dispatch({type:'MERGE', payload:{selection: null, drawMode: restoreMode}});
        refs.drawPending = true;
    },

    toggleSelectMode : function(stateRef, dispatch, refs){
        if(stateRef.current.drawMode === 'select'){
            LifeBoardUtils.clearSelection(stateRef, dispatch, refs);
        } else {
            // Enter select mode without clearing the armed preset.
            dispatch({type:'MERGE', payload:{drawMode: 'select'}});
            refs.drawPending = true;
        }
    },

    // ── Mode toggles ─────────────────────────────────────────────────────

    toggleDrawMode : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{drawMode: 'paint'}});
        refs.drawPending = true;
    },

    togglePresetMode : function(stateRef, dispatch, refs){
        var newMode = stateRef.current.drawMode === 'preset' ? 'paint' : 'preset';
        dispatch({type:'MERGE', payload:{drawMode: newMode}});
        refs.drawPending = true;
    },

    toggleMinimap : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{showMinimap: !stateRef.current.showMinimap}});
        refs.drawPending = true;
    },

    togglePanMode : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{panMode: !stateRef.current.panMode}});
    },

    toggleMobileTools : function(stateRef, dispatch, refs){
        LifeViewUtils.toggleBottomSheet(stateRef, dispatch, refs);
    },

    // ── Theme / dark mode ────────────────────────────────────────────────

    _applyDarkMode : function(stateRef, dispatch, refs, dark){
        document.documentElement.classList.toggle('dark-mode', !!dark);
    },

    setDarkModePref : function(stateRef, dispatch, refs, e){
        var pref = e.target.value;
        var dark;
        if(pref === 'dark'){ dark = true; }
        else if(pref === 'light'){ dark = false; }
        else { dark = refs.darkModeQuery && refs.darkModeQuery.matches; }
        LifeBoardUtils._applyDarkMode(stateRef, dispatch, refs, dark);
        dispatch({type:'MERGE', payload:{darkModePref: pref}});
        try { localStorage.setItem('life-dark-mode-pref', pref); } catch(ex){}
    },

    setTheme : function(stateRef, dispatch, refs, e){
        dispatch({type:'MERGE', payload:{theme: e.target.value}});
        refs.drawPending = true;
    },

    // ── Step count and toggles ───────────────────────────────────────────

    setStepCount : function(stateRef, dispatch, refs, e){
        dispatch({type:'MERGE', payload:{stepCount: Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 1))}});
    },

    toggleLivePaint : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{livePaintMode : !stateRef.current.livePaintMode}});
    },

    toggleGridLines : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{gridLines : !stateRef.current.gridLines}});
        refs.drawPending = true;
    },

    // ── Region management ────────────────────────────────────────────────

    /**
     * Recompute regionComponents and regionBounds from current regionMask,
     * kill any liveCells outside the mask, and update cols/rows/pendingCols/pendingRows.
     * Optionally accepts a callback.
     */
    _recomputeRegion : function(stateRef, dispatch, refs, callback){
        var mask = stateRef.current.regionMask;
        var components = RegionUtil.findComponents(mask);
        var bounds = RegionUtil.getBounds(mask);
        CanvasRenderer.invalidateRegionCache();
        // Derive cols/rows from bounds for backward compat.
        var newCols = bounds ? bounds.maxC - bounds.minC + 1 : stateRef.current.cols;
        var newRows = bounds ? bounds.maxR - bounds.minR + 1 : stateRef.current.rows;
        // Kill live cells outside the region when in bounded mode.
        var clippedLiveCells = stateRef.current.liveCells;
        if(stateRef.current.boundary !== 'unbounded' && mask.size > 0){
            var dirty = false;
            clippedLiveCells = new Map();
            var liveCells = stateRef.current.liveCells;
            liveCells.forEach(function(age, key){
                if(mask.has(key)){
                    clippedLiveCells.set(key, age);
                } else {
                    dirty = true;
                }
            });
            if(!dirty){ clippedLiveCells = stateRef.current.liveCells; }
        }
        refs.minimapDirty = true;
        SimRunner.invalidate();
        dispatch({type:'MERGE', payload:{
            regionComponents: components,
            regionBounds: bounds || {minR: 0, maxR: newRows - 1, minC: 0, maxC: newCols - 1},
            cols: newCols,
            rows: newRows,
            pendingCols: newCols,
            pendingRows: newRows,
            liveCells: clippedLiveCells,
            stable: false
        }});
        refs.drawPending = true;
        if(callback) callback();
    },

    /**
     * Apply region mask mutations (add/remove keys), then recompute.
     * addKeys: array of "r,c" strings to add.
     * removeKeys: array of "r,c" strings to remove.
     */
    _mutateRegion : function(stateRef, dispatch, refs, addKeys, removeKeys, callback){
        var newMask = new Set(stateRef.current.regionMask);
        if(addKeys){
            for(var ai = 0; ai < addKeys.length; ai++){ newMask.add(addKeys[ai]); }
        }
        if(removeKeys){
            for(var ri = 0; ri < removeKeys.length; ri++){ newMask.delete(removeKeys[ri]); }
        }
        dispatch({type:'MERGE', payload:{regionMask: newMask}});
        LifeBoardUtils._recomputeRegion(stateRef, dispatch, refs, callback);
    },

    /**
     * Switch to region draw mode.
     */
    toggleRegionMode : function(stateRef, dispatch, refs){
        var newMode = stateRef.current.drawMode === 'region' ? 'paint' : 'region';
        dispatch({type:'MERGE', payload:{drawMode: newMode}});
        refs.drawPending = true;
    },

    toggleBoundary : function(stateRef, dispatch, refs){
        var cur = stateRef.current.boundary;
        var next = cur === 'toroidal' ? 'finite' : cur === 'finite' ? 'unbounded' : 'toroidal';
        SimRunner.invalidate();
        refs.minimapDirty = true;
        refs.mmUnboundedRegion = null;
        CanvasRenderer.invalidateRegionCache();
        var stateUpdate = {boundary : next};
        // Exit region mode when switching to unbounded.
        if(next === 'unbounded' && stateRef.current.drawMode === 'region'){
            stateUpdate.drawMode = 'paint';
        }
        dispatch({type:'MERGE', payload:stateUpdate});
        refs.drawPending = true;
    },

    // ── Sliders ──────────────────────────────────────────────────────────

    resizeBoard : function(stateRef, dispatch, refs, newCols, newRows){
        newCols = Math.max(1, Math.round(newCols || 1));
        newRows = Math.max(1, Math.round(newRows || 1));
        // Replace region mask with a fresh rectangle of the new dimensions.
        var newRegionMask = RegionUtil.buildRect(newCols, newRows);
        var newRegionComponents = [{
            cells: newRegionMask,
            minR: 0, maxR: newRows - 1, minC: 0, maxC: newCols - 1
        }];
        // Keep only cells that still fall within the new bounds.
        var oldLiveCells = stateRef.current.liveCells;
        var newLiveCells = new Map();
        oldLiveCells.forEach(function(age, key){
            if(newRegionMask.has(key)){ newLiveCells.set(key, age); }
        });
        var clamped = LifeViewUtils.clampView(stateRef, dispatch, refs,
            stateRef.current.viewX, stateRef.current.viewY, newCols, newRows, stateRef.current.cellSize);
        refs.minimapDirty = true;
        SimRunner.invalidate();
        CanvasRenderer.invalidateRegionCache();
        dispatch({type:'MERGE', payload:{
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
        }});
        refs.drawPending = true;
    },

    setWidth : function(stateRef, dispatch, refs, e){
        var v = parseInt(e.target.value, 10);
        if(isNaN(v) || v < 1) v = stateRef.current.cols;
        v = Math.max(1, Math.min(10000, v));
        dispatch({type:'MERGE', payload:{pendingCols : v}});
        refs.drawPending = true;
    },

    applyWidth : function(stateRef, dispatch, refs){
        LifeBoardUtils.resizeBoard(stateRef, dispatch, refs, stateRef.current.pendingCols, stateRef.current.rows);
    },

    onWidthKeyDown : function(stateRef, dispatch, refs, e){
        if(e.key === 'Enter'){ LifeBoardUtils.applyWidth(stateRef, dispatch, refs); }
    },

    setHeight : function(stateRef, dispatch, refs, e){
        var v = parseInt(e.target.value, 10);
        if(isNaN(v) || v < 1) v = stateRef.current.rows;
        v = Math.max(1, Math.min(10000, v));
        dispatch({type:'MERGE', payload:{pendingRows : v}});
        refs.drawPending = true;
    },

    applyHeight : function(stateRef, dispatch, refs){
        LifeBoardUtils.resizeBoard(stateRef, dispatch, refs, stateRef.current.cols, stateRef.current.pendingRows);
    },

    onHeightKeyDown : function(stateRef, dispatch, refs, e){
        if(e.key === 'Enter'){ LifeBoardUtils.applyHeight(stateRef, dispatch, refs); }
    },

    applyGridPreset : function(stateRef, dispatch, refs, cols, rows){
        if(cols * rows > 500000){
            if(!confirm('A ' + cols + '\u00d7' + rows + ' grid uses significant memory and may run slowly. Continue?')){ return; }
        }
        LifeBoardUtils.resizeBoard(stateRef, dispatch, refs, cols, rows);
    },

    setDensity : function(stateRef, dispatch, refs, e){
        dispatch({type:'MERGE', payload:{sparseness : 9 - (parseInt(e.target.value, 10) || 0)}});
    },

    setSpeed : function(stateRef, dispatch, refs, e){
        var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
        dispatch({type:'MERGE', payload:{speed : v}});
    },

    // ── Rules ────────────────────────────────────────────────────────────

    parseRuleString : function(stateRef, dispatch, refs, val){
        var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
        if(!match){ return null; }
        return {
            birth :   match[1].split('').filter(function(d,i,a){ return a.indexOf(d) === i; }).map(Number),
            survive : match[2].split('').filter(function(d,i,a){ return a.indexOf(d) === i; }).map(Number)
        };
    },

    setRule : function(stateRef, dispatch, refs, e){
        var val = e.target.value;
        var parsed = LifeBoardUtils.parseRuleString(stateRef, dispatch, refs, val);
        if(parsed){
            SimRunner.invalidate();
            dispatch({type:'MERGE', payload:{birthRule : parsed.birth, surviveRule : parsed.survive,
                ruleString : val, rulePreset : val.toUpperCase()}});
        } else {
            dispatch({type:'MERGE', payload:{ruleString : val, rulePreset : ''}});
        }
    },

    setRulePreset : function(stateRef, dispatch, refs, e){
        var rule = e.target.value;
        if(!rule){ return; }
        var parsed = LifeBoardUtils.parseRuleString(stateRef, dispatch, refs, rule);
        if(parsed){
            SimRunner.invalidate();
            dispatch({type:'MERGE', payload:{birthRule : parsed.birth, surviveRule : parsed.survive,
                ruleString : rule, rulePreset : rule}});
        }
    },

    // ── Patterns ─────────────────────────────────────────────────────────

    rotateCW : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{patternRotation : (stateRef.current.patternRotation + 1) % 4}});
        refs.drawPending = true;
    },

    rotateCCW : function(stateRef, dispatch, refs){
        dispatch({type:'MERGE', payload:{patternRotation : (stateRef.current.patternRotation + 3) % 4}});
        refs.drawPending = true;
    },

    selectPattern : function(stateRef, dispatch, refs, e){
        var name = e.target.value || null;
        InputHandler._previewPos = null;
        var newMode = name ? 'preset' : 'paint';
        dispatch({type:'MERGE', payload:{selectedPattern: name, drawMode: newMode, patternRotation: 0}});
        refs.drawPending = true;
    },

    placePattern : function(stateRef, dispatch, refs, name, centerC, centerR){
        if(!PATTERNS[name]){ return; }
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        refs.stableCount = 0;
        refs.prevBoardHash = null;
        var pattern = SimEngine.rotatePattern(PATTERNS[name], stateRef.current.patternRotation);
        var maxR = 0, maxC = 0;
        for(var k = 0; k < pattern.length; k++){
            if(pattern[k][0] > maxR){ maxR = pattern[k][0]; }
            if(pattern[k][1] > maxC){ maxC = pattern[k][1]; }
        }
        var offsetR = centerR - Math.floor(maxR / 2);
        var offsetC = centerC - Math.floor(maxC / 2);
        var newLiveCells = new Map(stateRef.current.liveCells);
        var regionMask = stateRef.current.regionMask;
        var isUnbounded = stateRef.current.boundary === 'unbounded';
        for(var i = 0; i < pattern.length; i++){
            var pr = pattern[i][0] + offsetR;
            var pc = pattern[i][1] + offsetC;
            var pkey = pr + ',' + pc;
            if(isUnbounded || regionMask.has(pkey)){
                newLiveCells.set(pkey, 1);
            }
        }
        InputHandler._previewPos = null;
        refs.minimapDirty = true;
        SimRunner.invalidate();
        dispatch({type:'MERGE', payload:{liveCells: newLiveCells, stable: false}});
        refs.drawPending = true;
    },

    // ── Board actions ────────────────────────────────────────────────────

    emptyBoard : function(stateRef, dispatch, refs){
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        refs.mmUnboundedRegion = null;
        SimRunner.invalidate();
        refs.trailMap = new Map();
        LifeSimUtils.clearGenHistory(stateRef, dispatch, refs);
        dispatch({type:'MERGE', payload:{running : false, generations : 0, liveCells : new Map(),
            popHistory : [], sessionPeakPop : 0, stable : false}});
        refs.drawPending = true;
        LifeViewUtils._announce(stateRef, dispatch, refs, 'Board cleared');
    },

    resetGame : function(stateRef, dispatch, refs){
        LifeSimUtils.pushUndo(stateRef, dispatch, refs);
        var mask = stateRef.current.regionMask;
        var useMask = stateRef.current.boundary !== 'unbounded' && mask && mask.size > 0;
        var resetCols = stateRef.current.boundary === 'unbounded' ? 100 : stateRef.current.cols;
        var resetRows = stateRef.current.boundary === 'unbounded' ? 100 : stateRef.current.rows;
        var totalCells = useMask ? mask.size : resetCols * resetRows;
        var sparseness = stateRef.current.sparseness;
        // Cap density for very large boards to prevent browser crash.
        if(totalCells > 1000000){
            sparseness = Math.max(sparseness, totalCells / 500000);
        }
        var wasRunning = stateRef.current.running;
        refs.tickId++;
        refs.loopRunning = false;
        refs.prevBoardHash = null;
        refs.stableCount = 0;
        refs.minimapDirty = true;
        refs.mmUnboundedRegion = null;
        SimRunner.invalidate();
        refs.trailMap = new Map();
        LifeSimUtils.clearGenHistory(stateRef, dispatch, refs);
        var applyReset = function(newLiveCells){
            dispatch({type:'MERGE', payload:{running : false, generations : 0, liveCells : newLiveCells,
                popHistory : [], sessionPeakPop : 0, stable : false}});
            refs.drawPending = true;
            if(wasRunning){
                dispatch({type:'MERGE', payload:{running : true}});
                LifeSimUtils._startLoop(stateRef, dispatch, refs);
            }
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
            dispatch({type:'MERGE', payload:{running : false}});
            SimEngine.buildLiveCellsAsync(resetCols, resetRows, sparseness, applyReset);
        } else {
            applyReset(SimEngine.buildLiveCells(resetCols, resetRows, sparseness));
        }
    }
};
