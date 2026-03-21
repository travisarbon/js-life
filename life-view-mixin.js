/* global parseKey, STATS_CHIP_REAPPEAR_DELAY */
/**
 * View, layout, and panel management mixin for LifeBoard component.
 * Handles viewport pan/zoom, layout modes, rail/panel/sheet state, focus management.
 */
var LifeViewMixin = { // eslint-disable-line no-unused-vars

    // Compute canvas pixel dimensions that fit the device viewport.
    getCanvasSize : function(){
        var cellSize   = this.state.cellSize;
        var pendingCols = this.state.pendingCols;
        var pendingRows = this.state.pendingRows;
        // Use stable viewport dimensions from resize handler to prevent
        // minor iOS address-bar fluctuations from resizing the canvas.
        var winW = this._lastResizeW || window.innerWidth;
        var winH = this._lastResizeH || window.innerHeight;
        // Memoization: return cached result if inputs haven't changed.
        var cacheKey = cellSize + ',' + pendingCols + ',' + pendingRows + ',' +
            this.state.deviceClass + ',' + this.state.layoutMode + ',' +
            this.state.boundary + ',' + this.state.bottomSheetOpen + ',' +
            winW + ',' + winH;
        if(this._canvasSizeCacheKey === cacheKey && this._canvasSizeCache){
            return this._canvasSizeCache;
        }
        var maxW, maxH;

            // All layouts: canvas fills full viewport
            maxW = winW;
            maxH = winH;

        // Infinite canvas: always fill the available space regardless of boundary mode.
        var w = maxW, h = maxH;
        var result = {w: w, h: h, displayW: w, displayH: h};
        this._canvasSizeCacheKey = cacheKey;
        this._canvasSizeCache = result;
        return result;
    },

    clampView : function(viewX, viewY){
        return {viewX: Math.round(viewX), viewY: Math.round(viewY)};
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    pan : function(dc, dr){
        var clamped = this.clampView(
            this.state.viewX + dc, this.state.viewY + dr,
            this.state.cols, this.state.rows, this.state.cellSize);
        var self = this;
        this.setState({viewX: clamped.viewX, viewY: clamped.viewY},
            function(){ self.drawBoard(); });
    },

    selectAllVisible : function(){
        var liveCells = this.state.liveCells;
        var viewX = this.state.viewX, viewY = this.state.viewY;
        var cs = this.getCanvasSize();
        var viewCols = Math.ceil(cs.w / this.state.cellSize);
        var viewRows = Math.ceil(cs.h / this.state.cellSize);
        var isUnbounded = this.state.boundary === 'unbounded';
        var rMask = (!isUnbounded && this.state.regionMask && this.state.regionMask.size > 0) ? this.state.regionMask : null;
        var cells = [];
        var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(_, key){
            var rc = parseKey(key);
            var r = rc[0], c = rc[1];
            if(c >= viewX && c < viewX + viewCols && r >= viewY && r < viewY + viewRows &&
               (!rMask || rMask.has(key))){
                cells.push([r, c]);
                if(r < minR) minR = r; if(r > maxR) maxR = r;
                if(c < minC) minC = c; if(c > maxC) maxC = c;
            }
        });
        if(cells.length === 0){ return; }
        var self = this;
        this.setState({
            selection: {type:'all-visible', cells: cells,
                        c1: minC, r1: minR, c2: maxC, r2: maxR},
            drawMode: 'select'
        }, function(){ self.drawBoard(); });
    },

    fitView : function(){
        if(!this._canvas){ return; }
        // In unbounded mode, "Fit Grid" behaves like "Fit Cells".
        if(this.state.boundary === 'unbounded'){ this.fitLiveCells(); return; }
        // Use regionBounds to determine the area to fit.
        var rb = this.state.regionBounds;
        var originC = rb ? rb.minC : 0;
        var originR = rb ? rb.minR : 0;
        var cols = rb ? rb.maxC - rb.minC + 1 : this.state.cols;
        var rows = rb ? rb.maxR - rb.minR + 1 : this.state.rows;
        if(cols <= 0 || rows <= 0){ return; }
        var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
        var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
        var contentPad = isMobile ? 24 : 40;
        var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;

        var isMobileToolsOpen = typeof window !== 'undefined'
            && window.innerWidth <= 620 && this.state.bottomSheetOpen;
        var hFrac = isMobile ? (isMobileToolsOpen ? 0.36 : 0.82) : 0.90;
        var effW = typeof window !== 'undefined'
            ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
        var effH = typeof window !== 'undefined'
            ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
        // Apply the same aspect-ratio constraint as getCanvasSize.
        var fitAspect = cols / rows;
        if(effW / effH > fitAspect){
            effW = Math.max(1, Math.round(effH * fitAspect));
        } else if(effH / effW > 1 / fitAspect){
            effH = Math.max(1, Math.round(effW / fitAspect));
        }
        // Add padding around bounding box so its border is visible on the infinite canvas.
        var padCols = Math.max(2, Math.round(cols * 0.05));
        var padRows = Math.max(2, Math.round(rows * 0.05));
        var totalCols = cols + padCols * 2;
        var totalRows = rows + padRows * 2;
        // Largest integer cellSize where the padded area fits in the canvas.
        var newCS = Math.max(1, Math.floor(Math.min(effW / totalCols, effH / totalRows)));
        var self = this;
        this.setState({cellSize: newCS, viewX: originC - padCols, viewY: originR - padRows}, function(){ self.drawBoard(); });
    },

    fitLiveCells : function(){
        if(!this._canvas){ return; }
        var liveCells = this.state.liveCells;
        if(liveCells.size === 0){ this.fitView(); return; }
        var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(_, key){
            var rc = parseKey(key);
            var r = rc[0], c = rc[1];
            if(r < minR){ minR = r; } if(r > maxR){ maxR = r; }
            if(c < minC){ minC = c; } if(c > maxC){ maxC = c; }
        });
        var spanR = maxR - minR + 1, spanC = maxC - minC + 1;
        var padR = Math.max(2, Math.round(spanR * 0.1));
        var padC = Math.max(2, Math.round(spanC * 0.1));
        var totalR = spanR + padR * 2, totalC = spanC + padC * 2;
        var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
        var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
        var contentPad = isMobile ? 24 : 40;
        var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;

        var isMobileToolsOpen = typeof window !== 'undefined'
            && window.innerWidth <= 620 && this.state.bottomSheetOpen;
        var hFrac = isMobile ? (isMobileToolsOpen ? 0.36 : 0.82) : 0.90;
        var effW = typeof window !== 'undefined'
            ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
        var effH = typeof window !== 'undefined'
            ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
        var newCS = Math.max(1, Math.floor(Math.min(effW / totalC, effH / totalR)));
        var newVX = minC - padC;
        var newVY = minR - padR;
        var self = this;
        this.setState({cellSize: newCS, viewX: newVX, viewY: newVY}, function(){ self.drawBoard(); });
    },

    setZoom : function(e){
        var newCS = parseInt(e.target.value, 10);
        if(isNaN(newCS) || newCS < 1){ return; }
        newCS = Math.max(1, Math.min(128, newCS));
        var clamped = this.clampView(
            this.state.viewX, this.state.viewY,
            this.state.cols, this.state.rows, newCS);
        var self = this;
        this.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
            function(){ self.drawBoard(); });
    },

    // ── Layout mode management ───────────────────────────────────────

    _persistLayout : function(){
        try {
            localStorage.setItem('life-layout-prefs', JSON.stringify({
                _schemaVersion: 1,
                layoutMode:    this.state.layoutMode,
                railCollapsed: this.state.railCollapsed,
                railTab:       this.state.railTab,
                railSide:      this.state.railSide,
                panelStates:   this.state.panelStates
            }));
        } catch(e){
            // localStorage full or unavailable — silently ignore.
        }
    },

    // ── Focus management ─────────────────────────────────────────

    _saveFocus : function(){
        this._prevFocusEl = document.activeElement;
    },

    _restoreFocus : function(){
        if(this._prevFocusEl && this._prevFocusEl.focus){
            try { this._prevFocusEl.focus(); } catch(e){}
        }
        this._prevFocusEl = null;
    },

    _announce : function(msg){
        this.setState({srAnnouncement: msg});
        var self = this;
        setTimeout(function(){ if(self._mounted) self.setState({srAnnouncement: ''}); }, 3000);
    },

    _focusFirst : function(containerSelector){
        setTimeout(function(){
            var el = document.querySelector(containerSelector);
            if(!el){ return; }
            var focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if(focusable){ focusable.focus(); }
        }, 50);
    },

    setLayoutMode : function(mode){
        var self = this;
        this.setState({layoutMode: mode, zenMode: false}, function(){
            self._persistLayout();
            self.drawBoard();
        });
    },

    setRailTab : function(tab){
        var self = this;
        var updates = {railTab: tab, railCollapsed: false};
        this.setState(updates, function(){ self._persistLayout(); });
    },

    toggleRailCollapsed : function(){
        var self = this;
        this.setState({railCollapsed: !this.state.railCollapsed}, function(){
            self._persistLayout();
            self.drawBoard();
        });
    },

    toggleRailHidden : function(){
        var self = this;
        this.setState({railHidden: !this.state.railHidden}, function(){ self.drawBoard(); });
    },

    toggleRailSide : function(){
        var self = this;
        var newSide = this.state.railSide === 'right' ? 'left' : 'right';
        this.setState({railSide: newSide}, function(){
            self._persistLayout();
            self.drawBoard();
        });
    },

    toggleZenMode : function(){
        var self = this;
        this.setState({zenMode: !this.state.zenMode}, function(){ self.drawBoard(); });
    },

    toggleBottomSheet : function(){
        var self = this;
        if(this.state.bottomSheetOpen){
            // Closing: animate out, then unmount.
            this._previewCanvas = null;
            this.setState({bottomSheetClosing: true}, function(){
                setTimeout(function(){
                    self.setState({bottomSheetOpen: false, bottomSheetClosing: false}, function(){
                        self._restoreFocus();
                        self.drawBoard();
                    });
                }, 200);
            });
        } else {
            // Opening.
            this._saveFocus();
            this.setState({bottomSheetOpen: true, bottomSheetClosing: false}, function(){
                self._focusFirst('.bottom-sheet');
                self.drawRotationPreview();
            });
        }
    },

    setBottomSheetTab : function(tab){
        this.setState({bottomSheetTab: tab, bottomSheetOpen: true});
    },

    // ── Bottom sheet swipe-to-dismiss ─────────────────────────────────

    _onSheetTouchStart : function(e){
        this._sheetTouchY = e.touches[0].clientY;
        this._sheetEl = e.currentTarget;
    },
    _onSheetTouchMove : function(e){
        if(this._sheetTouchY === null || this._sheetTouchY === undefined){ return; }
        var dy = e.touches[0].clientY - this._sheetTouchY;
        if(dy > 0){
            e.preventDefault();
            this._sheetEl.style.transform = 'translateY(' + dy + 'px)';
        }
    },
    _onSheetTouchEnd : function(){
        if(this._sheetTouchY === null || this._sheetTouchY === undefined){ return; }
        var el = this._sheetEl;
        var transform = el.style.transform;
        var dy = 0;
        if(transform){
            var match = transform.match(/translateY\((-?\d+)/);
            if(match){ dy = parseInt(match[1], 10); }
        }
        el.style.transform = '';
        if(dy > 60){
            this.toggleBottomSheet();
        }
        this._sheetTouchY = null;
    },

    // ── Bottom sheet focus trap + keyboard ────────────────────────────

    _onSheetKeyDown : function(e){
        if(e.key === 'Escape'){
            this.toggleBottomSheet();
            e.preventDefault();
            return;
        }
        if(e.key !== 'Tab'){ return; }
        var sheet = e.currentTarget.querySelector('.bottom-sheet');
        if(!sheet){ return; }
        var focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if(!focusable.length){ return; }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if(e.shiftKey && document.activeElement === first){
            e.preventDefault(); last.focus();
        } else if(!e.shiftKey && document.activeElement === last){
            e.preventDefault(); first.focus();
        }
    },

    // ── Toggles ───────────────────────────────────────────────────────

    _hideStatsChip : function(){
        this._statsChipHidden = true;
        this._minimapHidden = true;
        clearTimeout(this._statsChipTimer);
        clearTimeout(this._minimapTimer);
    },

    _showStatsChipAfterDelay : function(){
        var self = this;
        clearTimeout(this._statsChipTimer);
        clearTimeout(this._minimapTimer);
        this._statsChipTimer = setTimeout(function(){
            self._statsChipHidden = false;
            self.forceUpdate();
        }, STATS_CHIP_REAPPEAR_DELAY);
        this._minimapTimer = setTimeout(function(){
            self._minimapHidden = false;
            self.forceUpdate();
        }, STATS_CHIP_REAPPEAR_DELAY);
    },
};
