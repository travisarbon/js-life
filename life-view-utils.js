/* global parseKey, STATS_CHIP_REAPPEAR_DELAY, drawRotationPreview */
/**
 * View, layout, and panel management utilities for LifeBoard component.
 * Handles viewport pan/zoom, layout modes, rail/panel/sheet state, focus management.
 */
var LifeViewUtils = { // eslint-disable-line no-unused-vars

    // Compute canvas pixel dimensions that fit the device viewport.
    getCanvasSize : function(stateRef, refs, dispatch){
        var cellSize   = stateRef.current.cellSize;
        var pendingCols = stateRef.current.pendingCols;
        var pendingRows = stateRef.current.pendingRows;
        // Use stable viewport dimensions from resize handler to prevent
        // minor iOS address-bar fluctuations from resizing the canvas.
        var winW = refs.lastResizeW || window.innerWidth;
        var winH = refs.lastResizeH || window.innerHeight;
        // Memoization: return cached result if inputs haven't changed.
        var cacheKey = cellSize + ',' + pendingCols + ',' + pendingRows + ',' +
            stateRef.current.deviceClass + ',' + stateRef.current.layoutMode + ',' +
            stateRef.current.boundary + ',' + stateRef.current.bottomSheetOpen + ',' +
            winW + ',' + winH;
        if(refs.canvasSizeCacheKey === cacheKey && refs.canvasSizeCache){
            return refs.canvasSizeCache;
        }
        var maxW, maxH;

            // All layouts: canvas fills full viewport
            maxW = winW;
            maxH = winH;

        // Infinite canvas: always fill the available space regardless of boundary mode.
        var w = maxW, h = maxH;
        var result = {w: w, h: h, displayW: w, displayH: h};
        refs.canvasSizeCacheKey = cacheKey;
        refs.canvasSizeCache = result;
        return result;
    },

    clampView : function(stateRef, refs, dispatch, viewX, viewY){
        return {viewX: Math.round(viewX), viewY: Math.round(viewY)};
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    pan : function(stateRef, refs, dispatch, dc, dr){
        var clamped = LifeViewUtils.clampView(stateRef, refs, dispatch,
            stateRef.current.viewX + dc, stateRef.current.viewY + dr,
            stateRef.current.cols, stateRef.current.rows, stateRef.current.cellSize);
        dispatch({type:'MERGE', payload:{viewX: clamped.viewX, viewY: clamped.viewY}}); refs.drawPending = true;
    },

    selectAllVisible : function(stateRef, refs, dispatch){
        var liveCells = stateRef.current.liveCells;
        var viewX = stateRef.current.viewX, viewY = stateRef.current.viewY;
        var cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
        var viewCols = Math.ceil(cs.w / stateRef.current.cellSize);
        var viewRows = Math.ceil(cs.h / stateRef.current.cellSize);
        var isUnbounded = stateRef.current.boundary === 'unbounded';
        var rMask = (!isUnbounded && stateRef.current.regionMask && stateRef.current.regionMask.size > 0) ? stateRef.current.regionMask : null;
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
        dispatch({type:'MERGE', payload:{
            selection: {type:'all-visible', cells: cells,
                        c1: minC, r1: minR, c2: maxC, r2: maxR},
            drawMode: 'select'
        }}); refs.drawPending = true;
    },

    fitView : function(stateRef, refs, dispatch){
        if(!refs.canvas){ return; }
        // In unbounded mode, "Fit Grid" behaves like "Fit Cells".
        if(stateRef.current.boundary === 'unbounded'){ LifeViewUtils.fitLiveCells(stateRef, refs, dispatch); return; }
        // Use regionBounds to determine the area to fit.
        var rb = stateRef.current.regionBounds;
        var originC = rb ? rb.minC : 0;
        var originR = rb ? rb.minR : 0;
        var cols = rb ? rb.maxC - rb.minC + 1 : stateRef.current.cols;
        var rows = rb ? rb.maxR - rb.minR + 1 : stateRef.current.rows;
        if(cols <= 0 || rows <= 0){ return; }
        // Use actual canvas dimensions for accurate fit calculation.
        var effW = refs.canvas ? refs.canvas.width : (typeof window !== 'undefined' ? window.innerWidth : 846);
        var effH = refs.canvas ? refs.canvas.height : (typeof window !== 'undefined' ? window.innerHeight : 900);
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
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: originC - padCols, viewY: originR - padRows}}); refs.drawPending = true;
    },

    fitLiveCells : function(stateRef, refs, dispatch){
        if(!refs.canvas){ return; }
        var liveCells = stateRef.current.liveCells;
        if(liveCells.size === 0){ LifeViewUtils.fitView(stateRef, refs, dispatch); return; }
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
        // Use actual canvas dimensions for accurate fit calculation.
        var effW = refs.canvas ? refs.canvas.width : (typeof window !== 'undefined' ? window.innerWidth : 846);
        var effH = refs.canvas ? refs.canvas.height : (typeof window !== 'undefined' ? window.innerHeight : 900);
        var newCS = Math.max(1, Math.floor(Math.min(effW / totalC, effH / totalR)));
        var newVX = minC - padC;
        var newVY = minR - padR;
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: newVX, viewY: newVY}}); refs.drawPending = true;
    },

    setZoom : function(stateRef, refs, dispatch, e){
        var newCS = parseInt(e.target.value, 10);
        if(isNaN(newCS) || newCS < 1){ return; }
        newCS = Math.max(1, Math.min(128, newCS));
        var clamped = LifeViewUtils.clampView(stateRef, refs, dispatch,
            stateRef.current.viewX, stateRef.current.viewY,
            stateRef.current.cols, stateRef.current.rows, newCS);
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY}}); refs.drawPending = true;
    },

    // ── Layout mode management ───────────────────────────────────────

    _persistLayout : function(stateRef, refs, dispatch){
        try {
            localStorage.setItem('life-layout-prefs', JSON.stringify({
                _schemaVersion: 1,
                layoutMode:    stateRef.current.layoutMode,
                railCollapsed: stateRef.current.railCollapsed,
                railTab:       stateRef.current.railTab,
                railSide:      stateRef.current.railSide,
                panelStates:   stateRef.current.panelStates,
                panelGroups:   stateRef.current.panelGroups
            }));
        } catch(e){
            // localStorage full or unavailable — silently ignore.
        }
    },

    // ── Z-index layering ─────────────────────────────────────────

    _bringPanelToFront : function(stateRef, refs, dispatch, panelId){
        var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        var next = (stateRef.current.panelZCounter || 1) + 1;
        panels[panelId].z = next;
        dispatch({type:'MERGE', payload:{ panelStates: panels, panelZCounter: next }});
    },

    // ── Panel grouping (docking) ─────────────────────────────────

    _generateGroupId : function(stateRef, refs, dispatch){
        return 'g' + Date.now() + Math.random().toString(36).substr(2, 4);
    },

    _findGroupForPanel : function(stateRef, refs, dispatch, panelId){
        var groups = stateRef.current.panelGroups;
        for(var i = 0; i < groups.length; i++){
            if(groups[i].panels.indexOf(panelId) !== -1){ return groups[i]; }
        }
        return null;
    },

    _mergePanels : function(stateRef, refs, dispatch, draggedId, targetId){
        // Stats panel cannot participate in merges.
        if(draggedId === 'stats' || targetId === 'stats'){ return; }
        var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        var dragGroup = null, targetGroup = null;
        for(var i = 0; i < groups.length; i++){
            if(groups[i].panels.indexOf(draggedId) !== -1){ dragGroup = groups[i]; }
            // targetId can be a panel ID or a group ID (starts with 'g').
            if(groups[i].id === targetId || groups[i].panels.indexOf(targetId) !== -1){ targetGroup = groups[i]; }
        }

        if(targetGroup){
            // Add dragged panel to existing target group.
            if(targetGroup.panels.indexOf(draggedId) === -1){
                targetGroup.panels.push(draggedId);
            }
            targetGroup.activeTab = draggedId;
            // If dragged was in its own group, dissolve that group.
            if(dragGroup && dragGroup.id !== targetGroup.id){
                groups = groups.filter(function(g){ return g.id !== dragGroup.id; });
            }
        } else {
            // Create new group at target's position.
            var newGroup = {
                id: LifeViewUtils._generateGroupId(stateRef, refs, dispatch),
                panels: [targetId, draggedId],
                activeTab: draggedId,
                x: panels[targetId].x,
                y: panels[targetId].y,
                z: (stateRef.current.panelZCounter || 1) + 1
            };
            groups.push(newGroup);
            // If dragged was in a group, remove it.
            if(dragGroup){
                dragGroup.panels = dragGroup.panels.filter(function(p){ return p !== draggedId; });
                if(dragGroup.panels.length < 2){
                    groups = groups.filter(function(g){ return g.id !== dragGroup.id; });
                }
            }
        }

        var next = (stateRef.current.panelZCounter || 1) + 1;
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelStates: panels, panelZCounter: next }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _separatePanel : function(stateRef, refs, dispatch, panelId, groupId, x, y){
        var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        var next = (stateRef.current.panelZCounter || 1) + 1;

        for(var i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].panels = groups[i].panels.filter(function(p){ return p !== panelId; });
                if(groups[i].activeTab === panelId){
                    groups[i].activeTab = groups[i].panels[0] || '';
                }
                // Dissolve group if only 1 panel remains.
                if(groups[i].panels.length < 2){
                    // Transfer group position to the remaining panel.
                    var remaining = groups[i].panels[0];
                    if(remaining){
                        panels[remaining].x = groups[i].x >= 0 ? groups[i].x : panels[remaining].x;
                        panels[remaining].y = groups[i].y >= 0 ? groups[i].y : panels[remaining].y;
                    }
                    groups.splice(i, 1);
                }
                break;
            }
        }
        // Position the separated panel.
        panels[panelId].x = x;
        panels[panelId].y = y;
        panels[panelId].z = next;
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelStates: panels, panelZCounter: next }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _setGroupActiveTab : function(stateRef, refs, dispatch, groupId, panelId){
        var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        for(var i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].activeTab = panelId;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _bringGroupToFront : function(stateRef, refs, dispatch, groupId){
        var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        var next = (stateRef.current.panelZCounter || 1) + 1;
        for(var i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].z = next;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelZCounter: next }});
    },

    // ── Compact mode ─────────────────────────────────────────────

    _togglePanelCompact : function(stateRef, refs, dispatch, panelId){
        var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        panels[panelId].compact = !panels[panelId].compact;
        dispatch({type:'MERGE', payload:{ panelStates: panels }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _toggleGroupCompact : function(stateRef, refs, dispatch, groupId){
        var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        for(var i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].compact = !groups[i].compact;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _openPopOut : function(stateRef, refs, dispatch, panelId, controlId){
        dispatch({type:'MERGE', payload:{ activePopOut: panelId + ':' + controlId }});
    },

    _closePopOut : function(stateRef, refs, dispatch){
        dispatch({type:'MERGE', payload:{ activePopOut: null }});
    },

    _isPopOutOpen : function(stateRef, refs, dispatch, panelId, controlId){
        return stateRef.current.activePopOut === panelId + ':' + controlId;
    },

    // ── Focus management ─────────────────────────────────────────

    _saveFocus : function(stateRef, refs, dispatch){
        refs.prevFocusEl = document.activeElement;
    },

    _restoreFocus : function(stateRef, refs, dispatch){
        if(refs.prevFocusEl && refs.prevFocusEl.focus){
            try { refs.prevFocusEl.focus(); } catch(e){}
        }
        refs.prevFocusEl = null;
    },

    _announce : function(stateRef, refs, dispatch, msg){
        dispatch({type:'MERGE', payload:{srAnnouncement: msg}});
        setTimeout(function(){ if(refs.mounted) dispatch({type:'MERGE', payload:{srAnnouncement: ''}}); }, 3000);
    },

    _focusFirst : function(stateRef, refs, dispatch, containerSelector){
        setTimeout(function(){
            var el = document.querySelector(containerSelector);
            if(!el){ return; }
            var focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if(focusable){ focusable.focus(); }
        }, 50);
    },

    setLayoutMode : function(stateRef, refs, dispatch, mode){
        dispatch({type:'MERGE', payload:{layoutMode: mode, zenMode: false}});
        LifeViewUtils._persistLayout(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    setRailTab : function(stateRef, refs, dispatch, tab){
        var updates = {railTab: tab, railCollapsed: false};
        dispatch({type:'MERGE', payload:updates}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    toggleRailCollapsed : function(stateRef, refs, dispatch){
        dispatch({type:'MERGE', payload:{railCollapsed: !stateRef.current.railCollapsed}});
        LifeViewUtils._persistLayout(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    toggleRailHidden : function(stateRef, refs, dispatch){
        dispatch({type:'MERGE', payload:{railHidden: !stateRef.current.railHidden}}); refs.drawPending = true;
    },

    toggleRailSide : function(stateRef, refs, dispatch){
        var newSide = stateRef.current.railSide === 'right' ? 'left' : 'right';
        dispatch({type:'MERGE', payload:{railSide: newSide}});
        LifeViewUtils._persistLayout(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    toggleZenMode : function(stateRef, refs, dispatch){
        dispatch({type:'MERGE', payload:{zenMode: !stateRef.current.zenMode}}); refs.drawPending = true;
    },

    toggleBottomSheet : function(stateRef, refs, dispatch){
        if(stateRef.current.bottomSheetOpen){
            // Closing: animate out, then unmount.
            refs.previewCanvas = null;
            dispatch({type:'MERGE', payload:{bottomSheetClosing: true}});
            setTimeout(function(){
                dispatch({type:'MERGE', payload:{bottomSheetOpen: false, bottomSheetClosing: false}});
                LifeViewUtils._restoreFocus(stateRef, refs, dispatch);
                refs.drawPending = true;
            }, 200);
        } else {
            // Opening.
            LifeViewUtils._saveFocus(stateRef, refs, dispatch);
            dispatch({type:'MERGE', payload:{bottomSheetOpen: true, bottomSheetClosing: false}});
            LifeViewUtils._focusFirst(stateRef, refs, dispatch, '.bottom-sheet');
            drawRotationPreview(stateRef, refs);
        }
    },

    setBottomSheetTab : function(stateRef, refs, dispatch, tab){
        dispatch({type:'MERGE', payload:{bottomSheetTab: tab, bottomSheetOpen: true}});
    },

    // ── Bottom sheet swipe-to-dismiss ─────────────────────────────────

    _onSheetTouchStart : function(stateRef, refs, dispatch, e){
        refs.sheetTouchY = e.touches[0].clientY;
        refs.sheetEl = e.currentTarget;
    },
    _onSheetTouchMove : function(stateRef, refs, dispatch, e){
        if(refs.sheetTouchY === null || refs.sheetTouchY === undefined){ return; }
        var dy = e.touches[0].clientY - refs.sheetTouchY;
        if(dy > 0){
            e.preventDefault();
            refs.sheetEl.style.transform = 'translateY(' + dy + 'px)';
        }
    },
    _onSheetTouchEnd : function(stateRef, refs, dispatch){
        if(refs.sheetTouchY === null || refs.sheetTouchY === undefined){ return; }
        var el = refs.sheetEl;
        var transform = el.style.transform;
        var dy = 0;
        if(transform){
            var match = transform.match(/translateY\((-?\d+)/);
            if(match){ dy = parseInt(match[1], 10); }
        }
        el.style.transform = '';
        if(dy > 60){
            LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch);
        }
        refs.sheetTouchY = null;
    },

    // ── Bottom sheet focus trap + keyboard ────────────────────────────

    _onSheetKeyDown : function(stateRef, refs, dispatch, e){
        if(e.key === 'Escape'){
            LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch);
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

    _hideStatsChip : function(stateRef, refs, dispatch){
        refs.statsChipHidden = true;
        refs.minimapHidden = true;
        clearTimeout(refs.statsChipTimer);
        clearTimeout(refs.minimapTimer);
    },

    _showStatsChipAfterDelay : function(stateRef, refs, dispatch){
        clearTimeout(refs.statsChipTimer);
        clearTimeout(refs.minimapTimer);
        refs.statsChipTimer = setTimeout(function(){
            refs.statsChipHidden = false;
            refs.forceRender(); refs.drawPending = true;
        }, STATS_CHIP_REAPPEAR_DELAY);
        refs.minimapTimer = setTimeout(function(){
            refs.minimapHidden = false;
            refs.forceRender(); refs.drawPending = true;
        }, STATS_CHIP_REAPPEAR_DELAY);
    },
};
