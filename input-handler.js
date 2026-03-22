/* global SimRunner, THEMES, RegionUtil, CanvasRenderer */
/**
 * Input handling module for Game of Life (R08, R19).
 * Extracts mouse, touch, and drawing logic from the monolithic component.
 *
 * Pure geometry helpers are static functions on InputHandler.
 * Event handlers are methods that receive a `host` (the React component)
 * to access state and call component methods.
 *
 * Global exposed: InputHandler
 */

var InputHandler = { // eslint-disable-line no-unused-vars

    // ── Internal drag/interaction state ──────────────────────────────────────
    _dragging: false,
    _dragStatus: null,
    _paintedCells: {},
    _panDragging: false,
    _panStart: null,
    _panVelocity: null,
    _panLastDx: 0,
    _panLastDy: 0,
    _panLastTime: 0,
    _panMomentumFrame: null,
    _minimapDragging: false,
    _selStart: null,
    _lassoPath: [],
    _drawToolStart: null,
    _drawPreviewCells: [],
    _drawErasing: false,
    _previewPos: null,
    _pinchStart: null,
    _wasPinching: false,
    _wasRunningBeforeTouch: false,
    _longPressTimer: null,

    // ── Region drawing state ──────────────────────────────────────────────
    _regionDragging: false,
    _regionDragStatus: null,  // 1 = adding, 0 = erasing
    _regionPaintedKeys: {},
    _regionToolStart: null,
    _regionPreviewKeys: [],
    _regionErasing: false,

    // ── Wheel/trackpad scroll accumulator ────────────────────────────────
    _wheelAccX: 0,
    _wheelAccY: 0,
    _zoomAcc: 0,

    /** Check whether a cell at (r,c) is inside the active region.
     *  Returns true if the cell is allowed (unbounded mode, no region, or in-region). */
    _cellInRegion: function(r, c, host){
        if(host.state.boundary === 'unbounded') return true;
        var mask = host.state.regionMask;
        if(!mask || mask.size === 0) return true;
        return mask.has(r + ',' + c);
    },

    // ── Pure geometry helpers (no state dependencies) ─────────────────────────

    /** Bresenham line: returns [[r,c],...] from (r0,c0) to (r1,c1). */
    bresenhamLine: function(r0, c0, r1, c1){
        var cells = [];
        var dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
        var sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
        var err = dr - dc;
        while(true){
            cells.push([r0, c0]);
            if(r0 === r1 && c0 === c1){ break; }
            var e2 = 2 * err;
            if(e2 > -dc){ err -= dc; r0 += sr; }
            if(e2 < dr) { err += dr; c0 += sc; }
        }
        return cells;
    },

    /** Compute cells inside ellipse from bounding rect. */
    ellipseCells: function(c1, r1, c2, r2){
        var cells = [];
        var rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
        var cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
        var cx = (cc1 + cc2) / 2, cy = (rr1 + rr2) / 2;
        var rx = (cc2 - cc1) / 2, ry = (rr2 - rr1) / 2;
        for(var r = rr1; r <= rr2; r++)
            for(var c = cc1; c <= cc2; c++){
                var dx = rx > 0.001 ? (c - cx) / (rx + 0.5) : 0;
                var dy = ry > 0.001 ? (r - cy) / (ry + 0.5) : 0;
                if(dx*dx + dy*dy <= 1) cells.push([r, c]);
            }
        return cells;
    },

    /** Ray-casting point-in-polygon test. polygon is array of {c,r}. */
    pointInPolygon: function(px, py, polygon){
        var inside = false;
        var n = polygon.length;
        for(var i = 0, j = n - 1; i < n; j = i++){
            var xi = polygon[i].c, yi = polygon[i].r;
            var xj = polygon[j].c, yj = polygon[j].r;
            if(((yi > py) !== (yj > py)) &&
               (px < (xj - xi) * (py - yi) / (yj - yi) + xi)){
                inside = !inside;
            }
        }
        return inside;
    },

    /** Returns [[r,c],...] for every cell in the selection (any type).
     *  If regionMask is provided (and non-empty), cells outside it are excluded. */
    getSelectionCells: function(sel, regionMask){
        if(!sel){ return []; }
        var hasRegion = regionMask && regionMask.size > 0;
        var type = sel.type || 'rect';
        if(type === 'rect'){
            var cells = [];
            var r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
            var c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
            for(var r = r1; r <= r2; r++)
                for(var c = c1; c <= c2; c++)
                    if(!hasRegion || regionMask.has(r + ',' + c))
                        cells.push([r, c]);
            return cells;
        }
        if(type === 'ellipse'){
            var r1e = Math.min(sel.r1, sel.r2), r2e = Math.max(sel.r1, sel.r2);
            var c1e = Math.min(sel.c1, sel.c2), c2e = Math.max(sel.c1, sel.c2);
            var cxe = (c1e + c2e) / 2, cye = (r1e + r2e) / 2;
            var rxe = (c2e - c1e) / 2, rye = (r2e - r1e) / 2;
            var ecells = [];
            for(var re = r1e; re <= r2e; re++)
                for(var ce = c1e; ce <= c2e; ce++){
                    var ddx = (cxe > 0 || rxe > 0) ? (ce - cxe) / (rxe + 0.5) : 0;
                    var ddy = (cye > 0 || rye > 0) ? (re - cye) / (rye + 0.5) : 0;
                    if(ddx*ddx + ddy*ddy <= 1 && (!hasRegion || regionMask.has(re + ',' + ce)))
                        ecells.push([re, ce]);
                }
            return ecells;
        }
        if(type === 'freeform' || type === 'all-visible'){
            var raw = sel.cells || [];
            if(!hasRegion) return raw;
            return raw.filter(function(rc){ return regionMask.has(rc[0] + ',' + rc[1]); });
        }
        return [];
    },

    /** BFS flood fill: returns [[r,c],...] of connected cells matching startAlive. */
    floodFillCells: function(startC, startR, liveCells, cols, rows, boundary, startAlive, regionMask){
        var isUnbounded = boundary === 'unbounded';
        var maxFlood = 100000;
        var queue = [[startR, startC]];
        var result = [];
        var visited = new Set();
        while(queue.length){
            if(result.length >= maxFlood){ break; }
            var cur = queue.pop();
            var key = cur[0] + ',' + cur[1];
            if(visited.has(key)){ continue; }
            visited.add(key);
            var rr = cur[0], cc = cur[1];
            // Use region mask for bounds checking if available.
            if(!isUnbounded){
                if(regionMask && regionMask.size > 0){
                    if(!regionMask.has(key)){ continue; }
                } else if(cc < 0 || cc >= cols || rr < 0 || rr >= rows){
                    continue;
                }
            }
            var isAlive = liveCells.has(key);
            if(isAlive !== startAlive){ continue; }
            result.push([rr, cc]);
            queue.push([rr+1, cc], [rr-1, cc], [rr, cc+1], [rr, cc-1]);
        }
        return result;
    },

    // ── Canvas coordinate helpers ────────────────────────────────────────────

    /** Convert mouse/touch event to canvas pixel coordinates. */
    getMousePos: function(event, canvas){
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width  / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top)  * scaleY
        };
    },

    /** Convert mouse/touch event to board cell coordinates. */
    getCellPos: function(event, canvas, viewX, viewY, cellSize){
        var mouse = this.getMousePos(event, canvas);
        return {
            c: viewX + Math.floor(mouse.x / cellSize),
            r: viewY + Math.floor(mouse.y / cellSize)
        };
    },

    /** Pan momentum animation. */
    _startPanMomentum: function(vx, vy, host){
        if(this._panMomentumFrame){ cancelAnimationFrame(this._panMomentumFrame); this._panMomentumFrame = null; }
        var self = this;
        var friction = 0.92;
        var cellSize = host.state.cellSize;
        function tick(){
            vx *= friction;
            vy *= friction;
            if(Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05){ return; }
            var dCols = -vx * 16 / cellSize;
            var dRows = -vy * 16 / cellSize;
            var newVX = host.state.viewX + Math.round(dCols);
            var newVY = host.state.viewY + Math.round(dRows);
            var clamped = host.clampView(newVX, newVY,
                host.state.cols, host.state.rows, cellSize);
            if(clamped.viewX === host.state.viewX && clamped.viewY === host.state.viewY){ return; }
            host.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            self._panMomentumFrame = requestAnimationFrame(tick);
        }
        this._panMomentumFrame = requestAnimationFrame(tick);
    },

    // ── Mouse event handlers ─────────────────────────────────────────────────
    // Each receives the DOM event and the host component.

    onMouseDown: function(event, host){
        event.preventDefault();
        var canvas = host._canvas;
        // Minimap click.
        if(event.button === 0 && host._minimapRect && host.state.showMinimap && host.state.drawMode !== 'select'){
            var mouse = this.getMousePos(event, canvas);
            var mm = host._minimapRect;
            if(mm.w > 0 && mm.h > 0 &&
               mouse.x >= mm.x && mouse.x <= mm.x + mm.w &&
               mouse.y >= mm.y && mouse.y <= mm.y + mm.h){
                var frac_c = (mouse.x - mm.x) / mm.w;
                var frac_r = (mouse.y - mm.y) / mm.h;
                var mmWorldCols = mm.worldCols || host.state.cols;
                var mmWorldRows = mm.worldRows || host.state.rows;
                var mmOC = mm.originC || 0, mmOR = mm.originR || 0;
                var newVX = Math.round(frac_c * mmWorldCols + mmOC - (canvas.width / host.state.cellSize) / 2);
                var newVY = Math.round(frac_r * mmWorldRows + mmOR - (canvas.height / host.state.cellSize) / 2);
                var clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, host.state.cellSize);
                host.setState({viewX: clamped.viewX, viewY: clamped.viewY}, function(){ host.drawBoard(); });
                this._minimapDragging = true;
                return;
            }
        }
        // Middle-mouse pan.
        if(event.button === 1){
            this._panDragging = true;
            this._panStart = {x: event.clientX, y: event.clientY,
                              vx: host.state.viewX, vy: host.state.viewY};
            return;
        }
        // Right-click: exit pattern mode, or start pan drag.
        if(event.button === 2){
            if(host.state.drawMode === 'preset' && host.state.selectedPattern){
                this._previewPos = null;
                host.setState({selectedPattern: null, patternRotation: 0, drawMode: 'paint'},
                    function(){ host.drawBoard(); });
                return;
            }
            // Right-click drag to pan (complements middle-click pan above).
            this._panDragging = true;
            this._panStart = {x: event.clientX, y: event.clientY,
                              vx: host.state.viewX, vy: host.state.viewY};
            return;
        }
        if(event.button !== 0){ return; }
        var pos = this.getCellPos(event, canvas, host.state.viewX, host.state.viewY, host.state.cellSize);
        var c = pos.c, r = pos.r;

        // Pan mode.
        if(host.state.panMode){
            this._panDragging = true;
            this._panStart = {x: event.clientX, y: event.clientY,
                              vx: host.state.viewX, vy: host.state.viewY};
            return;
        }

        host._hideStatsChip();

        // Selection mode.
        if(host.state.drawMode === 'select'){
            var selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'all-visible'){ host.selectAllVisible(); return; }
            this._selStart = {c: c, r: r};
            this._lassoPath = [];
            var selType = selectTool === 'ellipse' ? 'ellipse' : (selectTool === 'freeform' ? 'freeform' : 'rect');
            host.setState({selection: {type: selType, c1: c, r1: r, c2: c, r2: r, path: [], cells: []}},
                function(){ host.drawBoard(); });
            return;
        }

        // Pattern placement.
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            if(!this._cellInRegion(r, c, host)){ return; }
            if(!host.state.livePaintMode){ host.setState({running: false}); }
            host.placePattern(host.state.selectedPattern, c, r);
            return;
        }

        // Region drawing mode.
        if(host.state.drawMode === 'region'){
            host.setState({running: false});
            var regionTool = host.state.regionTool || 'shape-rect';
            var regionKey = r + ',' + c;
            var startInRegion = host.state.regionMask.has(regionKey);

            if(regionTool === 'fill'){
                // Flood fill on region mask.
                host.pushUndo();
                var fillKeys = RegionUtil.floodFillRegion(r, c, host.state.regionMask, 100000);
                this._regionErasing = startInRegion;
                if(startInRegion){
                    host._mutateRegion(null, fillKeys);
                } else {
                    host._mutateRegion(fillKeys, null);
                }
                CanvasRenderer.invalidateRegionCache();
                return;
            }
            if(regionTool === 'line' || regionTool === 'shape-rect' || regionTool === 'shape-circle'){
                this._regionErasing = startInRegion;
                host.pushUndo();
                this._regionToolStart = {c: c, r: r};
                this._regionPreviewKeys = [regionKey];
                host.drawBoard();
                return;
            }
            // Default: cell-by-cell region painting.
            host.pushUndo();
            this._regionDragging = true;
            this._regionDragStatus = startInRegion ? 0 : 1;
            this._regionPaintedKeys = {};
            this._regionPaintedKeys[regionKey] = this._regionDragStatus;
            this._regionErasing = startInRegion;
            host.drawBoard();
            return;
        }

        // Paint mode.
        var drawTool = host.state.drawTool || 'cell';
        // Check region bounds before pausing the simulation.
        if(!this._cellInRegion(r, c, host)){ return; }
        if(!host.state.livePaintMode){ host.setState({running: false}); }
        if(drawTool === 'fill'){
            var startAlive = host.state.liveCells.has(r + ',' + c);
            this._drawErasing = startAlive;
            host.pushUndo();
            var fillCells = this.floodFillCells(c, r, host.state.liveCells, host.state.cols, host.state.rows, host.state.boundary, startAlive, host.state.regionMask);
            host._minimapDirty = true;
            SimRunner.invalidate();
            host.setState(function(prevState){
                var newLiveCells = new Map(prevState.liveCells);
                fillCells.forEach(function(rc){
                    if(startAlive){ newLiveCells.delete(rc[0]+','+rc[1]); }
                    else { newLiveCells.set(rc[0]+','+rc[1], 1); }
                });
                return {liveCells: newLiveCells, stable: false};
            }, function(){ host.drawBoard(); });
            return;
        }
        if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
            this._drawErasing = host.state.liveCells.has(r + ',' + c);
            host.pushUndo();
            this._drawToolStart = {c: c, r: r};
            this._drawPreviewCells = [[r, c]];
            host.drawBoard();
            return;
        }
        // Default: single-cell paint.
        var key = r + ',' + c;
        host.pushUndo();
        this._dragging = true;
        this._dragStatus = host.state.liveCells.has(key) ? 0 : 1;
        this._paintedCells = {};
        this._paintedCells[key] = this._dragStatus;
        host.drawBoard();
    },

    onMouseMove: function(event, host){
        var canvas = host._canvas;
        // Pan drag.
        if(this._panDragging && this._panStart){
            var dx = event.clientX - this._panStart.x;
            var dy = event.clientY - this._panStart.y;
            var cellSize = host.state.cellSize;
            var rect = canvas.getBoundingClientRect();
            var displayCellSize = (rect.width > 0 && canvas.width > 0)
                ? cellSize * (rect.width / canvas.width) : cellSize;
            var dcells = -Math.round(dx / displayCellSize);
            var drows  = -Math.round(dy / displayCellSize);
            var clamped = host.clampView(
                this._panStart.vx + dcells, this._panStart.vy + drows,
                host.state.cols, host.state.rows, cellSize);
            host.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }

        var pos = this.getCellPos(event, canvas, host.state.viewX, host.state.viewY, host.state.cellSize);
        var c = pos.c, r = pos.r;

        // Hover cell.
        var newHover = {c: c, r: r};
        var ph = host.state.hoverCell;
        var hoverChanged = (!!newHover !== !!ph) ||
            (newHover && ph && (newHover.c !== ph.c || newHover.r !== ph.r));
        if(hoverChanged){ host.setState({hoverCell: newHover}); }

        // Selection drag.
        if(host.state.drawMode === 'select' && this._selStart){
            var bc = c, br = r;
            var selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'freeform'){
                var path = this._lassoPath;
                var last = path.length > 0 ? path[path.length - 1] : null;
                if(!last || last.c !== bc || last.r !== br){
                    path.push({c: bc, r: br});
                    host.setState({selection: {type:'freeform', path: path.slice(), cells: []}},
                        function(){ host.drawBoard(); });
                }
                return;
            }
            var prev2 = host.state.selection;
            if(prev2 && prev2.c2 === bc && prev2.r2 === br){ return; }
            var selType = selectTool === 'ellipse' ? 'ellipse' : 'rect';
            host.setState({selection: {type: selType, c1: this._selStart.c, r1: this._selStart.r, c2: bc, r2: br}},
                function(){ host.drawBoard(); });
            return;
        }

        // Draw tool preview.
        if(this._drawToolStart && host.state.drawMode === 'paint'){
            var drawTool = host.state.drawTool || 'cell';
            if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                var tc = c, tr = r;
                var ds = this._drawToolStart;
                var rawCells;
                if(drawTool === 'line'){
                    rawCells = this.bresenhamLine(ds.r, ds.c, tr, tc);
                } else if(drawTool === 'shape-rect'){
                    rawCells = [];
                    var rMin = Math.min(ds.r, tr), rMax = Math.max(ds.r, tr);
                    var cMin = Math.min(ds.c, tc), cMax = Math.max(ds.c, tc);
                    for(var pr = rMin; pr <= rMax; pr++)
                        for(var pc = cMin; pc <= cMax; pc++)
                            rawCells.push([pr, pc]);
                } else {
                    rawCells = this.ellipseCells(ds.c, ds.r, tc, tr);
                }
                // Filter to region bounds.
                var selfDT = this;
                this._drawPreviewCells = rawCells.filter(function(rc){ return selfDT._cellInRegion(rc[0], rc[1], host); });
                host.drawBoard();
                return;
            }
        }

        // Region tool preview (rubber-band shapes).
        if(this._regionToolStart && host.state.drawMode === 'region'){
            var regionTool = host.state.regionTool || 'shape-rect';
            if(regionTool === 'line' || regionTool === 'shape-rect' || regionTool === 'shape-circle'){
                var rds = this._regionToolStart;
                if(regionTool === 'line'){
                    this._regionPreviewKeys = RegionUtil.lineKeys(rds.r, rds.c, r, c);
                } else if(regionTool === 'shape-rect'){
                    this._regionPreviewKeys = RegionUtil.rectKeys(rds.r, rds.c, r, c);
                } else if(regionTool === 'shape-circle'){
                    this._regionPreviewKeys = RegionUtil.ellipseKeys(rds.r, rds.c, r, c);
                }
                host.drawBoard();
                return;
            }
        }

        // Region cell-by-cell painting drag.
        if(this._regionDragging && host.state.drawMode === 'region'){
            var rgKey = r + ',' + c;
            if(this._regionPaintedKeys[rgKey] === undefined){
                this._regionPaintedKeys[rgKey] = this._regionDragStatus;
                host.drawBoard();
            }
            return;
        }

        // Minimap drag.
        if(this._minimapDragging && host._minimapRect && host.state.showMinimap){
            var mm = host._minimapRect;
            var mmMouse = this.getMousePos(event, canvas);
            var frac_c = Math.max(0, Math.min(1, (mmMouse.x - mm.x) / mm.w));
            var frac_r = Math.max(0, Math.min(1, (mmMouse.y - mm.y) / mm.h));
            var mmWC2 = mm.worldCols || host.state.cols;
            var mmWR2 = mm.worldRows || host.state.rows;
            var mmOC2 = mm.originC || 0, mmOR2 = mm.originR || 0;
            var newVX = Math.round(frac_c * mmWC2 + mmOC2 - (canvas.width / host.state.cellSize) / 2);
            var newVY = Math.round(frac_r * mmWR2 + mmOR2 - (canvas.height / host.state.cellSize) / 2);
            var clampedMm = host.clampView(newVX, newVY, host.state.cols, host.state.rows, host.state.cellSize);
            host.setState({viewX: clampedMm.viewX, viewY: clampedMm.viewY}, function(){ host.drawBoard(); });
            return;
        }

        // Pattern preview.
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            var newPos = {c: c, r: r};
            var prev = this._previewPos;
            if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
            this._previewPos = newPos;
            host.drawBoard();
            return;
        }

        // Cell painting.
        if(!this._dragging){ return; }
        if(!this._cellInRegion(r, c, host)){ return; }
        var paintKey = r + ',' + c;
        if(this._paintedCells[paintKey] !== undefined){ return; }
        this._paintedCells[paintKey] = this._dragStatus;
        host.drawBoard();
    },

    onMouseUp: function(event, host){
        host._showStatsChipAfterDelay();
        this._minimapDragging = false;
        if(this._panDragging){
            this._panDragging = false;
            this._panStart = null;
        }
        if(host.state.drawMode === 'select' && this._selStart){
            var selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'freeform'){
                var path = this._lassoPath;
                if(path.length >= 3){
                    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                    path.forEach(function(p){ if(p.r<minR)minR=p.r; if(p.r>maxR)maxR=p.r; if(p.c<minC)minC=p.c; if(p.c>maxC)maxC=p.c; });
                    var fcells = [];
                    var fcols = host.state.cols, frows = host.state.rows;
                    var self = this;
                    var isUnboundedSel = host.state.boundary === 'unbounded';
                    var fMask = (!isUnboundedSel && host.state.regionMask && host.state.regionMask.size > 0) ? host.state.regionMask : null;
                    for(var fr = minR; fr <= maxR; fr++)
                        for(var fc = minC; fc <= maxC; fc++)
                            if((isUnboundedSel || (fc>=0 && fc<fcols && fr>=0 && fr<frows)) &&
                               (!fMask || fMask.has(fr + ',' + fc)) &&
                               self.pointInPolygon(fc, fr, path))
                                fcells.push([fr, fc]);
                    host.setState({selection: {type:'freeform', path: path.slice(), cells: fcells}});
                } else {
                    host.setState({selection: null});
                }
                this._selStart = null;
                this._lassoPath = [];
                host.drawBoard();
                return;
            }
            var sel = host.state.selection;
            if(sel){
                var normType = sel.type || 'rect';
                host.setState({selection: {
                    type: normType,
                    r1: Math.min(sel.r1, sel.r2), c1: Math.min(sel.c1, sel.c2),
                    r2: Math.max(sel.r1, sel.r2), c2: Math.max(sel.c1, sel.c2)
                }}, function(){ host.drawBoard(); });
            }
            this._selStart = null;
            return;
        }
        // Apply region rubber-band tools.
        if(this._regionToolStart && host.state.drawMode === 'region'){
            var regionPreview = this._regionPreviewKeys;
            this._regionToolStart = null;
            this._regionPreviewKeys = [];
            var regionErasing = this._regionErasing;
            CanvasRenderer.invalidateRegionCache();
            if(regionErasing){
                host._mutateRegion(null, regionPreview);
            } else {
                host._mutateRegion(regionPreview, null);
            }
            return;
        }
        // Apply region cell-by-cell painting.
        if(this._regionDragging && host.state.drawMode === 'region'){
            this._regionDragging = false;
            var rPainted = this._regionPaintedKeys;
            var addKeys = [], removeKeys = [];
            var rKeys = Object.keys(rPainted);
            for(var rki = 0; rki < rKeys.length; rki++){
                if(rPainted[rKeys[rki]] === 1){ addKeys.push(rKeys[rki]); }
                else { removeKeys.push(rKeys[rki]); }
            }
            this._regionPaintedKeys = {};
            CanvasRenderer.invalidateRegionCache();
            host._mutateRegion(
                addKeys.length > 0 ? addKeys : null,
                removeKeys.length > 0 ? removeKeys : null
            );
            return;
        }
        // Apply rubber-band tools.
        if(this._drawToolStart && host.state.drawMode === 'paint'){
            var drawTool = host.state.drawTool || 'cell';
            if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                var previewCells = this._drawPreviewCells;
                this._drawToolStart = null;
                this._drawPreviewCells = [];
                host._minimapDirty = true;
                SimRunner.invalidate();
                var erasing = this._drawErasing;
                host.setState(function(prevState){
                    var newLiveCells = new Map(prevState.liveCells);
                    previewCells.forEach(function(rc){
                        if(erasing){ newLiveCells.delete(rc[0]+','+rc[1]); }
                        else { newLiveCells.set(rc[0]+','+rc[1], 1); }
                    });
                    return {liveCells: newLiveCells, stable: false};
                }, function(){ host.drawBoard(); });
                return;
            }
        }
        if(!this._dragging){ return; }
        this._dragging = false;
        var paintedCells = this._paintedCells;
        var newLiveCells = new Map(host.state.liveCells);
        Object.keys(paintedCells).forEach(function(k){
            if(paintedCells[k] === 1){ newLiveCells.set(k, 1); }
            else { newLiveCells.delete(k); }
        });
        this._paintedCells = {};
        host._minimapDirty = true;
        SimRunner.invalidate();
        host.setState({liveCells: newLiveCells, stable: false}, function(){ host.drawBoard(); });
    },

    onMouseLeave: function(event, host){
        if(host.state.hoverCell){ host.setState({hoverCell: null}); }
        this._minimapDragging = false;
        this._panDragging = false;
        this._panStart = null;
        if(this._regionToolStart){
            this._regionToolStart = null;
            this._regionPreviewKeys = [];
            host.popUndo();
            host.drawBoard();
            return;
        }
        if(this._drawToolStart){
            host.cancelDrawTool();
            host.drawBoard();
            return;
        }
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            this._previewPos = null;
            host.drawBoard();
        }
        this.onMouseUp(event, host);
    },

    onContextMenu: function(event, host){
        event.preventDefault();
        if(this._regionToolStart){
            this._regionToolStart = null;
            this._regionPreviewKeys = [];
            host.popUndo();
            host.drawBoard();
            return;
        }
        if(this._drawToolStart){
            host.cancelDrawTool();
            host.drawBoard();
            return;
        }
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            this._previewPos = null;
            host.setState({selectedPattern: null, patternRotation: 0, drawMode: 'paint'},
                function(){ host.drawBoard(); });
        }
    },

    /** Paint a single cell directly on canvas (immediate visual feedback). */
    paintCellDirect: function(c, r, host){
        var canvas = host._canvas;
        if(!canvas){ return; }
        var ctx = canvas.getContext("2d");
        if(!ctx){ return; }
        var cellSize = host.state.cellSize;
        var viewX = host.state.viewX, viewY = host.state.viewY;
        var theme = THEMES[host.state.theme] || THEMES['Teal'];
        var px = (c - viewX) * cellSize;
        var py = (r - viewY) * cellSize;
        ctx.fillStyle = this._dragStatus === 1
            ? ('rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')')
            : theme.bg;
        ctx.fillRect(px, py, cellSize, cellSize);
        if(host.state.gridLines){
            ctx.strokeStyle = theme.grid;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, cellSize, cellSize);
        }
    },

    // ── Wheel / trackpad ────────────────────────────────────────────────────
    //
    // Ctrl+wheel (or trackpad pinch, which browsers report as ctrlKey+wheel)
    // zooms toward the cursor.  Plain wheel/trackpad two-finger scroll pans
    // the viewport.

    onWheel: function(event, host){
        event.preventDefault();
        if(this._panMomentumFrame){ cancelAnimationFrame(this._panMomentumFrame); this._panMomentumFrame = null; }
        var canvas = host._canvas;
        if(!canvas){ return; }
        var cellSize = host.state.cellSize;

        // Normalize deltaY across deltaMode values (line vs pixel vs page).
        var rawDX = event.deltaX;
        var rawDY = event.deltaY;
        if(event.deltaMode === 1){ rawDX *= 16; rawDY *= 16; } // DOM_DELTA_LINE
        else if(event.deltaMode === 2){ rawDX *= 100; rawDY *= 100; } // DOM_DELTA_PAGE

        // ── Zoom (Ctrl+wheel or trackpad pinch) ──────────────────────
        if(event.ctrlKey || event.metaKey){
            var mouse = this.getMousePos(event, canvas);
            var delta = rawDY > 0 ? -1 : 1;
            var newCS = Math.max(1, Math.min(128, cellSize + delta));
            if(newCS === cellSize){ return; }
            // Zoom toward cursor: keep the cell under the pointer fixed.
            var cellC = host.state.viewX + mouse.x / cellSize;
            var cellR = host.state.viewY + mouse.y / cellSize;
            var newVX = Math.round(cellC - mouse.x / newCS);
            var newVY = Math.round(cellR - mouse.y / newCS);
            var clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, newCS);
            host.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }

        // ── Pan (plain scroll / trackpad two-finger drag) ────────────
        var rect = canvas.getBoundingClientRect();
        var displayCellSize = (rect.width > 0 && canvas.width > 0)
            ? cellSize * (rect.width / canvas.width) : cellSize;
        // Always accumulate for consistent behavior across mouse wheel and trackpad.
        this._wheelAccX = (this._wheelAccX || 0) + rawDX / displayCellSize;
        this._wheelAccY = (this._wheelAccY || 0) + rawDY / displayCellSize;
        var dc = Math.trunc(this._wheelAccX);
        var dr = Math.trunc(this._wheelAccY);
        this._wheelAccX -= dc;
        this._wheelAccY -= dr;
        if(dc !== 0 || dr !== 0){
            host.pan(dc, dr);
        }
    },

    // ── Touch event handlers ─────────────────────────────────────────────────

    onTouchStart: function(event, host){
        event.preventDefault();
        if(this._panMomentumFrame){ cancelAnimationFrame(this._panMomentumFrame); this._panMomentumFrame = null; }
        clearTimeout(this._longPressTimer);
        var canvas = host._canvas;
        if(!event.touches || event.touches.length === 0){ return; }
        if(event.touches.length === 2){
            this._dragging = false;
            this._panDragging = false;
            this._panStart = null;
            this._panVelocity = null;
            this._selStart = null;
            this._lassoPath = [];
            if(this._drawToolStart){
                this._drawToolStart = null;
                this._drawPreviewCells = [];
            }
            this._previewPos = null;
            this._wasPinching = true;
            if(this._wasRunningBeforeTouch && !host.state.running){
                host.setState({running: true});
                host._startLoop();
            }
            this._wasRunningBeforeTouch = false;
            var t0 = event.touches[0], t1 = event.touches[1];
            var pMidX = (t0.clientX + t1.clientX) / 2;
            var pMidY = (t0.clientY + t1.clientY) / 2;
            var pRect = canvas.getBoundingClientRect();
            var pScaleX = canvas.width / pRect.width;
            var pScaleY = canvas.height / pRect.height;
            this._pinchStart = {
                dist: Math.sqrt(
                    (t1.clientX - t0.clientX) * (t1.clientX - t0.clientX) +
                    (t1.clientY - t0.clientY) * (t1.clientY - t0.clientY)),
                midX: pMidX, midY: pMidY,
                cellSize: host.state.cellSize,
                viewX: host.state.viewX, viewY: host.state.viewY,
                cellC: host.state.viewX + (pMidX - pRect.left) * pScaleX / host.state.cellSize,
                cellR: host.state.viewY + (pMidY - pRect.top) * pScaleY / host.state.cellSize
            };
            return;
        }
        this._pinchStart = null;
        this._wasPinching = false;
        var t = event.touches[0];
        var self = this;
        var pos = this.getCellPos({clientX: t.clientX, clientY: t.clientY}, canvas,
            host.state.viewX, host.state.viewY, host.state.cellSize);
        // Always allow interaction — region mask handles boundary enforcement.
        {
            this._longPressTimer = setTimeout(function(){
                host.setState({hoverCell: {c: pos.c, r: pos.r}});
                self._longPressTimer = setTimeout(function(){
                    host.setState({hoverCell: null});
                }, 2000);
            }, 420);
        }
        if(host.state.panMode){
            this._panDragging = true;
            this._panStart = {x: t.clientX, y: t.clientY,
                              vx: host.state.viewX, vy: host.state.viewY};
            return;
        }
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            this._previewPos = {c: pos.c, r: pos.r};
            host.drawBoard();
            host._hideStatsChip();
            return;
        }
        this._wasRunningBeforeTouch = host.state.running;
        this.onMouseDown({preventDefault: function(){}, button: 0,
            clientX: t.clientX, clientY: t.clientY}, host);
    },

    onTouchMove: function(event, host){
        event.preventDefault();
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
        var canvas = host._canvas;
        if(event.touches.length === 2 && this._pinchStart){
            var t0 = event.touches[0], t1 = event.touches[1];
            var newDist = Math.sqrt(
                (t1.clientX - t0.clientX) * (t1.clientX - t0.clientX) +
                (t1.clientY - t0.clientY) * (t1.clientY - t0.clientY));
            var newMidX = (t0.clientX + t1.clientX) / 2;
            var newMidY = (t0.clientY + t1.clientY) / 2;
            var scale = this._pinchStart.dist > 0 ? newDist / this._pinchStart.dist : 1;
            var newCS = Math.max(1, Math.min(128, Math.round(this._pinchStart.cellSize * scale)));
            var pzRect = canvas.getBoundingClientRect();
            var pzScaleX = canvas.width / pzRect.width;
            var pzScaleY = canvas.height / pzRect.height;
            var midCanvasX = (newMidX - pzRect.left) * pzScaleX;
            var midCanvasY = (newMidY - pzRect.top) * pzScaleY;
            var newVX = Math.round(this._pinchStart.cellC - midCanvasX / newCS);
            var newVY = Math.round(this._pinchStart.cellR - midCanvasY / newCS);
            var clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, newCS);
            host.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }
        if(event.touches.length !== 1){ return; }
        if(this._wasPinching){ return; }
        var t = event.touches[0];
        if(host.state.panMode && this._panDragging && this._panStart){
            var dx = t.clientX - this._panStart.x;
            var dy = t.clientY - this._panStart.y;
            var cs2 = host.state.cellSize;
            var panRect = canvas.getBoundingClientRect();
            var displayCS = (panRect.width > 0 && canvas.width > 0)
                ? cs2 * (panRect.width / canvas.width) : cs2;
            var newVX2 = this._panStart.vx - Math.round(dx / displayCS);
            var newVY2 = this._panStart.vy - Math.round(dy / displayCS);
            var clamped2 = host.clampView(newVX2, newVY2, host.state.cols, host.state.rows, cs2);
            host.setState({viewX: clamped2.viewX, viewY: clamped2.viewY},
                function(){ host.drawBoard(); });
            var now = Date.now();
            this._panVelocity = {
                vx: (dx - (this._panLastDx || 0)) / Math.max(1, now - (this._panLastTime || now)),
                vy: (dy - (this._panLastDy || 0)) / Math.max(1, now - (this._panLastTime || now))
            };
            this._panLastDx = dx; this._panLastDy = dy; this._panLastTime = now;
            return;
        }
        this.onMouseMove({clientX: t.clientX, clientY: t.clientY}, host);
    },

    onTouchEnd: function(event, host){
        event.preventDefault();
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
        if(event.touches.length < 2){ this._pinchStart = null; }
        if(event.touches.length === 1 && this._wasPinching){ return; }
        if(event.touches.length === 0){
            if(this._wasPinching){
                this._wasPinching = false;
                this._previewPos = null;
                this._panDragging = false;
                this._panStart = null;
                this._panVelocity = null;
                host.drawBoard();
                return;
            }
            if(host.state.panMode && this._panDragging){
                this._panDragging = false;
                this._panStart = null;
                if(this._panVelocity){
                    var vel = this._panVelocity;
                    var speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
                    if(speed > 0.15){ this._startPanMomentum(vel.vx, vel.vy, host); }
                }
                this._panVelocity = null;
                this._panLastDx = 0; this._panLastDy = 0; this._panLastTime = 0;
                return;
            }
            if(host.state.drawMode === 'preset' && host.state.selectedPattern && this._previewPos){
                if(!this._cellInRegion(this._previewPos.r, this._previewPos.c, host)){ return; }
                if(!host.state.livePaintMode){ host.setState({running: false}); }
                host.placePattern(host.state.selectedPattern, this._previewPos.c, this._previewPos.r);
                host._showStatsChipAfterDelay();
                return;
            }
            if(host.state.drawMode === 'preset' && this._previewPos){
                this._previewPos = null;
                host.drawBoard();
            }
            this.onMouseUp(event, host);
        }
    },

    /** Reset all internal drag state (called on component reset). */
    reset: function(){
        this._dragging = false;
        this._dragStatus = null;
        this._paintedCells = {};
        this._panDragging = false;
        this._panStart = null;
        this._panVelocity = null;
        this._panLastDx = 0; this._panLastDy = 0; this._panLastTime = 0;
        if(this._panMomentumFrame){ cancelAnimationFrame(this._panMomentumFrame); }
        this._panMomentumFrame = null;
        this._minimapDragging = false;
        this._selStart = null;
        this._lassoPath = [];
        this._drawToolStart = null;
        this._drawPreviewCells = [];
        this._drawErasing = false;
        this._previewPos = null;
        this._pinchStart = null;
        this._wasPinching = false;
        this._wasRunningBeforeTouch = false;
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
        this._regionDragging = false;
        this._regionDragStatus = null;
        this._regionPaintedKeys = {};
        this._regionToolStart = null;
        this._regionPreviewKeys = [];
        this._regionErasing = false;
        this._wheelAccX = 0;
        this._wheelAccY = 0;
    }
};
