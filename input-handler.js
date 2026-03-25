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

const InputHandler = { // eslint-disable-line no-unused-vars

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
        const mask = host.state.regionMask;
        if(!mask || mask.size === 0) return true;
        return mask.has(r + ',' + c);
    },

    // ── Pure geometry helpers (no state dependencies) ─────────────────────────

    /** Bresenham line: returns [[r,c],...] from (r0,c0) to (r1,c1). */
    bresenhamLine: function(r0, c0, r1, c1){
        const cells = [];
        const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
        const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
        let err = dr - dc;
        while(true){
            cells.push([r0, c0]);
            if(r0 === r1 && c0 === c1){ break; }
            const e2 = 2 * err;
            if(e2 > -dc){ err -= dc; r0 += sr; }
            if(e2 < dr) { err += dr; c0 += sc; }
        }
        return cells;
    },

    /** Compute cells inside ellipse from bounding rect. */
    ellipseCells: function(c1, r1, c2, r2){
        const cells = [];
        const rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
        const cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
        const cx = (cc1 + cc2) / 2, cy = (rr1 + rr2) / 2;
        const rx = (cc2 - cc1) / 2, ry = (rr2 - rr1) / 2;
        for(let r = rr1; r <= rr2; r++)
            for(let c = cc1; c <= cc2; c++){
                const dx = rx > 0.001 ? (c - cx) / (rx + 0.5) : 0;
                const dy = ry > 0.001 ? (r - cy) / (ry + 0.5) : 0;
                if(dx*dx + dy*dy <= 1) cells.push([r, c]);
            }
        return cells;
    },

    /** Ray-casting point-in-polygon test. polygon is array of {c,r}. */
    pointInPolygon: function(px, py, polygon){
        let inside = false;
        const n = polygon.length;
        for(let i = 0, j = n - 1; i < n; j = i++){
            const xi = polygon[i].c, yi = polygon[i].r;
            const xj = polygon[j].c, yj = polygon[j].r;
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
        const hasRegion = regionMask && regionMask.size > 0;
        const type = sel.type || 'rect';
        if(type === 'rect'){
            const cells = [];
            const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
            const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
            for(let r = r1; r <= r2; r++)
                for(let c = c1; c <= c2; c++)
                    if(!hasRegion || regionMask.has(r + ',' + c))
                        cells.push([r, c]);
            return cells;
        }
        if(type === 'ellipse'){
            const r1e = Math.min(sel.r1, sel.r2), r2e = Math.max(sel.r1, sel.r2);
            const c1e = Math.min(sel.c1, sel.c2), c2e = Math.max(sel.c1, sel.c2);
            const cxe = (c1e + c2e) / 2, cye = (r1e + r2e) / 2;
            const rxe = (c2e - c1e) / 2, rye = (r2e - r1e) / 2;
            const ecells = [];
            for(let re = r1e; re <= r2e; re++)
                for(let ce = c1e; ce <= c2e; ce++){
                    const ddx = (cxe > 0 || rxe > 0) ? (ce - cxe) / (rxe + 0.5) : 0;
                    const ddy = (cye > 0 || rye > 0) ? (re - cye) / (rye + 0.5) : 0;
                    if(ddx*ddx + ddy*ddy <= 1 && (!hasRegion || regionMask.has(re + ',' + ce)))
                        ecells.push([re, ce]);
                }
            return ecells;
        }
        if(type === 'freeform' || type === 'all-visible'){
            const raw = sel.cells || [];
            if(!hasRegion) return raw;
            return raw.filter(function(rc){ return regionMask.has(rc[0] + ',' + rc[1]); });
        }
        return [];
    },

    /** BFS flood fill: returns [[r,c],...] of connected cells matching startAlive. */
    floodFillCells: function(startC, startR, liveCells, cols, rows, boundary, startAlive, regionMask){
        const isUnbounded = boundary === 'unbounded';
        const maxFlood = 100000;
        const queue = [[startR, startC]];
        const result = [];
        const visited = new Set();
        while(queue.length){
            if(result.length >= maxFlood){ break; }
            const cur = queue.pop();
            const key = cur[0] + ',' + cur[1];
            if(visited.has(key)){ continue; }
            visited.add(key);
            const rr = cur[0], cc = cur[1];
            // Use region mask for bounds checking if available.
            if(!isUnbounded){
                if(regionMask && regionMask.size > 0){
                    if(!regionMask.has(key)){ continue; }
                } else if(cc < 0 || cc >= cols || rr < 0 || rr >= rows){
                    continue;
                }
            }
            const isAlive = liveCells.has(key);
            if(isAlive !== startAlive){ continue; }
            result.push([rr, cc]);
            queue.push([rr+1, cc], [rr-1, cc], [rr, cc+1], [rr, cc-1]);
        }
        return result;
    },

    // ── Canvas coordinate helpers ────────────────────────────────────────────

    /** Convert mouse/touch event to canvas pixel coordinates. */
    getMousePos: function(event, canvas){
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top)  * scaleY
        };
    },

    /** Convert mouse/touch event to board cell coordinates. */
    getCellPos: function(event, canvas, viewX, viewY, cellSize){
        const mouse = this.getMousePos(event, canvas);
        return {
            c: viewX + Math.floor(mouse.x / cellSize),
            r: viewY + Math.floor(mouse.y / cellSize)
        };
    },

    /** Pan momentum animation. */
    _startPanMomentum: function(vx, vy, host){
        if(this._panMomentumFrame){ cancelAnimationFrame(this._panMomentumFrame); this._panMomentumFrame = null; }
        const self = this;
        const friction = 0.92;
        const cellSize = host.state.cellSize;
        function tick(){
            vx *= friction;
            vy *= friction;
            if(Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05){ return; }
            const dCols = -vx * 16 / cellSize;
            const dRows = -vy * 16 / cellSize;
            const newVX = host.state.viewX + Math.round(dCols);
            const newVY = host.state.viewY + Math.round(dRows);
            const clamped = host.clampView(newVX, newVY,
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
        const canvas = host._canvas;
        // Minimap click.
        if(event.button === 0 && host._minimapRect && host.state.showMinimap && host.state.drawMode !== 'select'){
            const mouse = this.getMousePos(event, canvas);
            const mm = host._minimapRect;
            if(mm.w > 0 && mm.h > 0 &&
               mouse.x >= mm.x && mouse.x <= mm.x + mm.w &&
               mouse.y >= mm.y && mouse.y <= mm.y + mm.h){
                const frac_c = (mouse.x - mm.x) / mm.w;
                const frac_r = (mouse.y - mm.y) / mm.h;
                const mmWorldCols = mm.worldCols || host.state.cols;
                const mmWorldRows = mm.worldRows || host.state.rows;
                const mmOC = mm.originC || 0, mmOR = mm.originR || 0;
                const newVX = Math.round(frac_c * mmWorldCols + mmOC - (canvas.width / host.state.cellSize) / 2);
                const newVY = Math.round(frac_r * mmWorldRows + mmOR - (canvas.height / host.state.cellSize) / 2);
                const clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, host.state.cellSize);
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
        const pos = this.getCellPos(event, canvas, host.state.viewX, host.state.viewY, host.state.cellSize);
        const c = pos.c, r = pos.r;

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
            const selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'all-visible'){ host.selectAllVisible(); return; }
            this._selStart = {c: c, r: r};
            this._lassoPath = [];
            const selType = selectTool === 'ellipse' ? 'ellipse' : (selectTool === 'freeform' ? 'freeform' : 'rect');
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
            const regionTool = host.state.regionTool || 'shape-rect';
            const regionKey = r + ',' + c;
            const startInRegion = host.state.regionMask.has(regionKey);

            if(regionTool === 'fill'){
                // Flood fill on region mask.
                host.pushUndo();
                const fillKeys = RegionUtil.floodFillRegion(r, c, host.state.regionMask, 100000);
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
        const drawTool = host.state.drawTool || 'cell';
        // Check region bounds before pausing the simulation.
        if(!this._cellInRegion(r, c, host)){ return; }
        if(!host.state.livePaintMode){ host.setState({running: false}); }
        if(drawTool === 'fill'){
            const startAlive = host.state.liveCells.has(r + ',' + c);
            this._drawErasing = startAlive;
            host.pushUndo();
            const fillCells = this.floodFillCells(c, r, host.state.liveCells, host.state.cols, host.state.rows, host.state.boundary, startAlive, host.state.regionMask);
            host._minimapDirty = true;
            SimRunner.invalidate();
            host.setState(function(prevState){
                const newLiveCells = new Map(prevState.liveCells);
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
        const key = r + ',' + c;
        host.pushUndo();
        this._dragging = true;
        this._dragStatus = host.state.liveCells.has(key) ? 0 : 1;
        this._paintedCells = {};
        this._paintedCells[key] = this._dragStatus;
        host.drawBoard();
    },

    onMouseMove: function(event, host){
        const canvas = host._canvas;
        // Pan drag.
        if(this._panDragging && this._panStart){
            const dx = event.clientX - this._panStart.x;
            const dy = event.clientY - this._panStart.y;
            const cellSize = host.state.cellSize;
            const rect = canvas.getBoundingClientRect();
            const displayCellSize = (rect.width > 0 && canvas.width > 0)
                ? cellSize * (rect.width / canvas.width) : cellSize;
            const dcells = -Math.round(dx / displayCellSize);
            const drows  = -Math.round(dy / displayCellSize);
            const clamped = host.clampView(
                this._panStart.vx + dcells, this._panStart.vy + drows,
                host.state.cols, host.state.rows, cellSize);
            host.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }

        const pos = this.getCellPos(event, canvas, host.state.viewX, host.state.viewY, host.state.cellSize);
        const c = pos.c, r = pos.r;

        // Hover cell.
        const newHover = {c: c, r: r};
        const ph = host.state.hoverCell;
        const hoverChanged = (!!newHover !== !!ph) ||
            (newHover && ph && (newHover.c !== ph.c || newHover.r !== ph.r));
        if(hoverChanged){ host.setState({hoverCell: newHover}); }

        // Selection drag.
        if(host.state.drawMode === 'select' && this._selStart){
            const bc = c, br = r;
            const selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'freeform'){
                const path = this._lassoPath;
                const last = path.length > 0 ? path[path.length - 1] : null;
                if(!last || last.c !== bc || last.r !== br){
                    path.push({c: bc, r: br});
                    host.setState({selection: {type:'freeform', path: path.slice(), cells: []}},
                        function(){ host.drawBoard(); });
                }
                return;
            }
            const prev2 = host.state.selection;
            if(prev2 && prev2.c2 === bc && prev2.r2 === br){ return; }
            const selType = selectTool === 'ellipse' ? 'ellipse' : 'rect';
            host.setState({selection: {type: selType, c1: this._selStart.c, r1: this._selStart.r, c2: bc, r2: br}},
                function(){ host.drawBoard(); });
            return;
        }

        // Draw tool preview.
        if(this._drawToolStart && host.state.drawMode === 'paint'){
            const drawTool = host.state.drawTool || 'cell';
            if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                const tc = c, tr = r;
                const ds = this._drawToolStart;
                let rawCells;
                if(drawTool === 'line'){
                    rawCells = this.bresenhamLine(ds.r, ds.c, tr, tc);
                } else if(drawTool === 'shape-rect'){
                    rawCells = [];
                    const rMin = Math.min(ds.r, tr), rMax = Math.max(ds.r, tr);
                    const cMin = Math.min(ds.c, tc), cMax = Math.max(ds.c, tc);
                    for(let pr = rMin; pr <= rMax; pr++)
                        for(let pc = cMin; pc <= cMax; pc++)
                            rawCells.push([pr, pc]);
                } else {
                    rawCells = this.ellipseCells(ds.c, ds.r, tc, tr);
                }
                // Filter to region bounds.
                const selfDT = this;
                this._drawPreviewCells = rawCells.filter(function(rc){ return selfDT._cellInRegion(rc[0], rc[1], host); });
                host.drawBoard();
                return;
            }
        }

        // Region tool preview (rubber-band shapes).
        if(this._regionToolStart && host.state.drawMode === 'region'){
            const regionTool = host.state.regionTool || 'shape-rect';
            if(regionTool === 'line' || regionTool === 'shape-rect' || regionTool === 'shape-circle'){
                const rds = this._regionToolStart;
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
            const rgKey = r + ',' + c;
            if(this._regionPaintedKeys[rgKey] === undefined){
                this._regionPaintedKeys[rgKey] = this._regionDragStatus;
                host.drawBoard();
            }
            return;
        }

        // Minimap drag.
        if(this._minimapDragging && host._minimapRect && host.state.showMinimap){
            const mm = host._minimapRect;
            const mmMouse = this.getMousePos(event, canvas);
            const frac_c = Math.max(0, Math.min(1, (mmMouse.x - mm.x) / mm.w));
            const frac_r = Math.max(0, Math.min(1, (mmMouse.y - mm.y) / mm.h));
            const mmWC2 = mm.worldCols || host.state.cols;
            const mmWR2 = mm.worldRows || host.state.rows;
            const mmOC2 = mm.originC || 0, mmOR2 = mm.originR || 0;
            const newVX = Math.round(frac_c * mmWC2 + mmOC2 - (canvas.width / host.state.cellSize) / 2);
            const newVY = Math.round(frac_r * mmWR2 + mmOR2 - (canvas.height / host.state.cellSize) / 2);
            const clampedMm = host.clampView(newVX, newVY, host.state.cols, host.state.rows, host.state.cellSize);
            host.setState({viewX: clampedMm.viewX, viewY: clampedMm.viewY}, function(){ host.drawBoard(); });
            return;
        }

        // Pattern preview.
        if(host.state.drawMode === 'preset' && host.state.selectedPattern){
            const newPos = {c: c, r: r};
            const prev = this._previewPos;
            if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
            this._previewPos = newPos;
            host.drawBoard();
            return;
        }

        // Cell painting.
        if(!this._dragging){ return; }
        if(!this._cellInRegion(r, c, host)){ return; }
        const paintKey = r + ',' + c;
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
            const selectTool = host.state.selectTool || 'rect';
            if(selectTool === 'freeform'){
                const path = this._lassoPath;
                if(path.length >= 3){
                    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                    path.forEach(function(p){ if(p.r<minR)minR=p.r; if(p.r>maxR)maxR=p.r; if(p.c<minC)minC=p.c; if(p.c>maxC)maxC=p.c; });
                    const fcells = [];
                    const fcols = host.state.cols, frows = host.state.rows;
                    const self = this;
                    const isUnboundedSel = host.state.boundary === 'unbounded';
                    const fMask = (!isUnboundedSel && host.state.regionMask && host.state.regionMask.size > 0) ? host.state.regionMask : null;
                    for(let fr = minR; fr <= maxR; fr++)
                        for(let fc = minC; fc <= maxC; fc++)
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
            const sel = host.state.selection;
            if(sel){
                const normType = sel.type || 'rect';
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
            const regionPreview = this._regionPreviewKeys;
            this._regionToolStart = null;
            this._regionPreviewKeys = [];
            const regionErasing = this._regionErasing;
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
            const rPainted = this._regionPaintedKeys;
            const addKeys = [], removeKeys = [];
            const rKeys = Object.keys(rPainted);
            for(let rki = 0; rki < rKeys.length; rki++){
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
            const drawTool = host.state.drawTool || 'cell';
            if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                const previewCells = this._drawPreviewCells;
                this._drawToolStart = null;
                this._drawPreviewCells = [];
                host._minimapDirty = true;
                SimRunner.invalidate();
                const erasing = this._drawErasing;
                host.setState(function(prevState){
                    const newLiveCells = new Map(prevState.liveCells);
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
        const paintedCells = this._paintedCells;
        const newLiveCells = new Map(host.state.liveCells);
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
        const canvas = host._canvas;
        if(!canvas){ return; }
        const ctx = canvas.getContext("2d");
        if(!ctx){ return; }
        const cellSize = host.state.cellSize;
        const viewX = host.state.viewX, viewY = host.state.viewY;
        const theme = THEMES[host.state.theme] || THEMES['Teal'];
        const px = (c - viewX) * cellSize;
        const py = (r - viewY) * cellSize;
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
        const canvas = host._canvas;
        if(!canvas){ return; }
        const cellSize = host.state.cellSize;

        // Normalize deltaY across deltaMode values (line vs pixel vs page).
        let rawDX = event.deltaX;
        let rawDY = event.deltaY;
        if(event.deltaMode === 1){ rawDX *= 16; rawDY *= 16; } // DOM_DELTA_LINE
        else if(event.deltaMode === 2){ rawDX *= 100; rawDY *= 100; } // DOM_DELTA_PAGE

        // ── Zoom (Ctrl+wheel or trackpad pinch) ──────────────────────
        if(event.ctrlKey || event.metaKey){
            const mouse = this.getMousePos(event, canvas);
            const delta = rawDY > 0 ? -1 : 1;
            const newCS = Math.max(1, Math.min(128, cellSize + delta));
            if(newCS === cellSize){ return; }
            // Zoom toward cursor: keep the cell under the pointer fixed.
            const cellC = host.state.viewX + mouse.x / cellSize;
            const cellR = host.state.viewY + mouse.y / cellSize;
            const newVX = Math.round(cellC - mouse.x / newCS);
            const newVY = Math.round(cellR - mouse.y / newCS);
            const clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, newCS);
            host.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }

        // ── Pan (plain scroll / trackpad two-finger drag) ────────────
        const rect = canvas.getBoundingClientRect();
        const displayCellSize = (rect.width > 0 && canvas.width > 0)
            ? cellSize * (rect.width / canvas.width) : cellSize;
        // Always accumulate for consistent behavior across mouse wheel and trackpad.
        this._wheelAccX = (this._wheelAccX || 0) + rawDX / displayCellSize;
        this._wheelAccY = (this._wheelAccY || 0) + rawDY / displayCellSize;
        const dc = Math.trunc(this._wheelAccX);
        const dr = Math.trunc(this._wheelAccY);
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
        const canvas = host._canvas;
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
            const t0 = event.touches[0], t1 = event.touches[1];
            const pMidX = (t0.clientX + t1.clientX) / 2;
            const pMidY = (t0.clientY + t1.clientY) / 2;
            const pRect = canvas.getBoundingClientRect();
            const pScaleX = canvas.width / pRect.width;
            const pScaleY = canvas.height / pRect.height;
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
        const t = event.touches[0];
        const self = this;
        const pos = this.getCellPos({clientX: t.clientX, clientY: t.clientY}, canvas,
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
        const canvas = host._canvas;
        if(event.touches.length === 2 && this._pinchStart){
            const t0 = event.touches[0], t1 = event.touches[1];
            const newDist = Math.sqrt(
                (t1.clientX - t0.clientX) * (t1.clientX - t0.clientX) +
                (t1.clientY - t0.clientY) * (t1.clientY - t0.clientY));
            const newMidX = (t0.clientX + t1.clientX) / 2;
            const newMidY = (t0.clientY + t1.clientY) / 2;
            const scale = this._pinchStart.dist > 0 ? newDist / this._pinchStart.dist : 1;
            const newCS = Math.max(1, Math.min(128, Math.round(this._pinchStart.cellSize * scale)));
            const pzRect = canvas.getBoundingClientRect();
            const pzScaleX = canvas.width / pzRect.width;
            const pzScaleY = canvas.height / pzRect.height;
            const midCanvasX = (newMidX - pzRect.left) * pzScaleX;
            const midCanvasY = (newMidY - pzRect.top) * pzScaleY;
            const newVX = Math.round(this._pinchStart.cellC - midCanvasX / newCS);
            const newVY = Math.round(this._pinchStart.cellR - midCanvasY / newCS);
            const clamped = host.clampView(newVX, newVY, host.state.cols, host.state.rows, newCS);
            host.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                function(){ host.drawBoard(); });
            return;
        }
        if(event.touches.length !== 1){ return; }
        if(this._wasPinching){ return; }
        const t = event.touches[0];
        if(host.state.panMode && this._panDragging && this._panStart){
            const dx = t.clientX - this._panStart.x;
            const dy = t.clientY - this._panStart.y;
            const cs2 = host.state.cellSize;
            const panRect = canvas.getBoundingClientRect();
            const displayCS = (panRect.width > 0 && canvas.width > 0)
                ? cs2 * (panRect.width / canvas.width) : cs2;
            const newVX2 = this._panStart.vx - Math.round(dx / displayCS);
            const newVY2 = this._panStart.vy - Math.round(dy / displayCS);
            const clamped2 = host.clampView(newVX2, newVY2, host.state.cols, host.state.rows, cs2);
            host.setState({viewX: clamped2.viewX, viewY: clamped2.viewY},
                function(){ host.drawBoard(); });
            const now = Date.now();
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
                    const vel = this._panVelocity;
                    const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
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
