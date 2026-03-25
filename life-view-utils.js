/* global parseKey, STATS_CHIP_REAPPEAR_DELAY, drawRotationPreview */
/**
 * View, layout, and panel management utilities for LifeBoard component.
 * Handles viewport pan/zoom, layout modes, rail/panel/sheet state, focus management.
 */
const LifeViewUtils = { // eslint-disable-line no-unused-vars

    // Compute canvas pixel dimensions that fit the device viewport.
    getCanvasSize : function(stateRef, refs, _dispatch){
        const cellSize   = stateRef.current.cellSize;
        const pendingCols = stateRef.current.pendingCols;
        const pendingRows = stateRef.current.pendingRows;
        // Use stable viewport dimensions from resize handler to prevent
        // minor iOS address-bar fluctuations from resizing the canvas.
        const winW = refs.lastResizeW || window.innerWidth;
        const winH = refs.lastResizeH || window.innerHeight;
        // Memoization: return cached result if inputs haven't changed.
        const cacheKey = cellSize + ',' + pendingCols + ',' + pendingRows + ',' +
            stateRef.current.deviceClass + ',' + stateRef.current.layoutMode + ',' +
            stateRef.current.boundary + ',' + stateRef.current.bottomSheetOpen + ',' +
            winW + ',' + winH;
        if(refs.canvasSizeCacheKey === cacheKey && refs.canvasSizeCache){
            return refs.canvasSizeCache;
        }
        const w = winW, h = winH;
        const result = {w: w, h: h, displayW: w, displayH: h};
        refs.canvasSizeCacheKey = cacheKey;
        refs.canvasSizeCache = result;
        return result;
    },

    clampView : function(stateRef, refs, dispatch, viewX, viewY){
        return {viewX: Math.round(viewX), viewY: Math.round(viewY)};
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    pan : function(stateRef, refs, dispatch, dc, dr){
        const clamped = LifeViewUtils.clampView(stateRef, refs, dispatch,
            stateRef.current.viewX + dc, stateRef.current.viewY + dr);
        dispatch({type:'MERGE', payload:{viewX: clamped.viewX, viewY: clamped.viewY}}); refs.drawPending = true;
    },

    selectAllVisible : function(stateRef, refs, dispatch){
        const liveCells = stateRef.current.liveCells;
        const viewX = stateRef.current.viewX, viewY = stateRef.current.viewY;
        const cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
        const viewCols = Math.ceil(cs.w / stateRef.current.cellSize);
        const viewRows = Math.ceil(cs.h / stateRef.current.cellSize);
        const isUnbounded = stateRef.current.boundary === 'unbounded';
        const rMask = (!isUnbounded && stateRef.current.regionMask && stateRef.current.regionMask.size > 0) ? stateRef.current.regionMask : null;
        const cells = [];
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(_, key){
            const rc = parseKey(key);
            const r = rc[0], c = rc[1];
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
        const rb = stateRef.current.regionBounds;
        const originC = rb ? rb.minC : 0;
        const originR = rb ? rb.minR : 0;
        const cols = rb ? rb.maxC - rb.minC + 1 : stateRef.current.cols;
        const rows = rb ? rb.maxR - rb.minR + 1 : stateRef.current.rows;
        if(cols <= 0 || rows <= 0){ return; }
        // Use layout dimensions for accurate fit calculation.
        const cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
        const canvasW = cs.displayW;
        const canvasH = cs.displayH;
        // Add padding around bounding box so its border is visible.
        const padCols = Math.max(2, Math.round(cols * 0.05));
        const padRows = Math.max(2, Math.round(rows * 0.05));
        const totalCols = cols + padCols * 2;
        const totalRows = rows + padRows * 2;
        // Largest integer cellSize where the padded area fits in the canvas.
        const newCS = Math.max(1, Math.floor(Math.min(canvasW / totalCols, canvasH / totalRows)));
        // Center the grid in the viewport.
        const visibleCols = Math.ceil(canvasW / newCS);
        const visibleRows = Math.ceil(canvasH / newCS);
        const viewX = originC - padCols - (visibleCols - totalCols) / 2;
        const viewY = originR - padRows - (visibleRows - totalRows) / 2;
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: Math.round(viewX), viewY: Math.round(viewY)}}); refs.drawPending = true;
    },

    fitLiveCells : function(stateRef, refs, dispatch){
        if(!refs.canvas){ return; }
        const liveCells = stateRef.current.liveCells;
        if(liveCells.size === 0){ LifeViewUtils.fitView(stateRef, refs, dispatch); return; }
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(_, key){
            const rc = parseKey(key);
            const r = rc[0], c = rc[1];
            if(r < minR){ minR = r; } if(r > maxR){ maxR = r; }
            if(c < minC){ minC = c; } if(c > maxC){ maxC = c; }
        });
        const spanR = maxR - minR + 1, spanC = maxC - minC + 1;
        const padR = Math.max(2, Math.round(spanR * 0.1));
        const padC = Math.max(2, Math.round(spanC * 0.1));
        const totalR = spanR + padR * 2, totalC = spanC + padC * 2;
        // Use layout dimensions for accurate fit calculation.
        const cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
        const canvasW = cs.displayW;
        const canvasH = cs.displayH;
        const newCS = Math.max(1, Math.floor(Math.min(canvasW / totalC, canvasH / totalR)));
        // Center the live cells in the viewport.
        const visibleCols = Math.ceil(canvasW / newCS);
        const visibleRows = Math.ceil(canvasH / newCS);
        const newVX = minC - padC - (visibleCols - totalC) / 2;
        const newVY = minR - padR - (visibleRows - totalR) / 2;
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: Math.round(newVX), viewY: Math.round(newVY)}}); refs.drawPending = true;
    },

    setZoom : function(stateRef, refs, dispatch, e){
        let newCS = parseInt(e.target.value, 10);
        if(isNaN(newCS) || newCS < 1){ return; }
        newCS = Math.max(1, Math.min(128, newCS));
        const clamped = LifeViewUtils.clampView(stateRef, refs, dispatch,
            stateRef.current.viewX, stateRef.current.viewY);
        dispatch({type:'MERGE', payload:{cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY}}); refs.drawPending = true;
    },

    // ── Layout mode management ───────────────────────────────────────

    _persistLayout : function(stateRef, _refs, _dispatch){
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
        const panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        const next = (stateRef.current.panelZCounter || 1) + 1;
        panels[panelId].z = next;
        dispatch({type:'MERGE', payload:{ panelStates: panels, panelZCounter: next }});
    },

    // ── Panel grouping (docking) ─────────────────────────────────

    _generateGroupId : function(_stateRef, _refs, _dispatch){
        return 'g' + Date.now() + Math.random().toString(36).substr(2, 4);
    },

    _findGroupForPanel : function(stateRef, refs, dispatch, panelId){
        const groups = stateRef.current.panelGroups;
        for(let i = 0; i < groups.length; i++){
            if(groups[i].panels.indexOf(panelId) !== -1){ return groups[i]; }
        }
        return null;
    },

    _mergePanels : function(stateRef, refs, dispatch, draggedId, targetId){
        let groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        const panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        let dragGroup = null, targetGroup = null;
        for(let i = 0; i < groups.length; i++){
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
            const newGroup = {
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

        const next = (stateRef.current.panelZCounter || 1) + 1;
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelStates: panels, panelZCounter: next, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _separatePanel : function(stateRef, refs, dispatch, panelId, groupId, x, y){
        const groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        const panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        const next = (stateRef.current.panelZCounter || 1) + 1;

        for(let i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].panels = groups[i].panels.filter(function(p){ return p !== panelId; });
                if(groups[i].activeTab === panelId){
                    groups[i].activeTab = groups[i].panels[0] || '';
                }
                // Dissolve group if only 1 panel remains.
                if(groups[i].panels.length < 2){
                    // Transfer group position to the remaining panel.
                    const remaining = groups[i].panels[0];
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
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelStates: panels, panelZCounter: next, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _setGroupActiveTab : function(stateRef, refs, dispatch, groupId, panelId){
        const groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        for(let i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].activeTab = panelId;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _bringGroupToFront : function(stateRef, refs, dispatch, groupId){
        const groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        const next = (stateRef.current.panelZCounter || 1) + 1;
        for(let i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].z = next;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups, panelZCounter: next }});
    },

    // ── Compact mode ─────────────────────────────────────────────

    _togglePanelCompact : function(stateRef, refs, dispatch, panelId){
        const panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
        panels[panelId].compact = !panels[panelId].compact;
        dispatch({type:'MERGE', payload:{ panelStates: panels, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
    },

    _toggleGroupCompact : function(stateRef, refs, dispatch, groupId){
        const groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
        for(let i = 0; i < groups.length; i++){
            if(groups[i].id === groupId){
                groups[i].compact = !groups[i].compact;
                break;
            }
        }
        dispatch({type:'MERGE', payload:{ panelGroups: groups, activePopOut: null }}); LifeViewUtils._persistLayout(stateRef, refs, dispatch);
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

    _saveFocus : function(_stateRef, refs, _dispatch){
        refs.prevFocusEl = document.activeElement;
    },

    _restoreFocus : function(_stateRef, refs, _dispatch){
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
            const el = document.querySelector(containerSelector);
            if(!el){ return; }
            const focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if(focusable){ focusable.focus(); }
        }, 50);
    },

    setLayoutMode : function(stateRef, refs, dispatch, mode){
        dispatch({type:'MERGE', payload:{layoutMode: mode, zenMode: false}});
        LifeViewUtils._persistLayout(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    setRailTab : function(stateRef, refs, dispatch, tab){
        const updates = {railTab: tab, railCollapsed: false};
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
        const newSide = stateRef.current.railSide === 'right' ? 'left' : 'right';
        dispatch({type:'MERGE', payload:{railSide: newSide}});
        LifeViewUtils._persistLayout(stateRef, refs, dispatch);
        refs.drawPending = true;
    },

    toggleZenMode : function(stateRef, refs, dispatch){
        const entering = !stateRef.current.zenMode;
        const payload = {zenMode: entering};
        if(entering){
            payload._zenMinimapWas = stateRef.current.showMinimap;
            payload.showMinimap = false;
            payload.zenNotify = true;
            // Clear the notification after animation completes
            setTimeout(function(){ dispatch({type:'MERGE', payload:{zenNotify: false}}); }, 2600);
        } else {
            if(stateRef.current._zenMinimapWas){ payload.showMinimap = true; }
            payload._zenMinimapWas = false;
            payload.zenNotify = false;
        }
        dispatch({type:'MERGE', payload: payload});
        refs.drawPending = true;
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
        const dy = e.touches[0].clientY - refs.sheetTouchY;
        if(dy > 0){
            e.preventDefault();
            refs.sheetEl.style.transform = 'translateY(' + dy + 'px)';
        }
    },
    _onSheetTouchEnd : function(stateRef, refs, dispatch){
        if(refs.sheetTouchY === null || refs.sheetTouchY === undefined){ return; }
        const el = refs.sheetEl;
        const transform = el.style.transform;
        let dy = 0;
        if(transform){
            const match = transform.match(/translateY\((-?\d+)/);
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
        const sheet = e.currentTarget.querySelector('.bottom-sheet');
        if(!sheet){ return; }
        const focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if(!focusable.length){ return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if(e.shiftKey && document.activeElement === first){
            e.preventDefault(); last.focus();
        } else if(!e.shiftKey && document.activeElement === last){
            e.preventDefault(); first.focus();
        }
    },

    // ── Toggles ───────────────────────────────────────────────────────

    _hideStatsChip : function(_stateRef, refs, _dispatch){
        refs.statsChipHidden = true;
        refs.minimapHidden = true;
        clearTimeout(refs.statsChipTimer);
        clearTimeout(refs.minimapTimer);
    },

    _showStatsChipAfterDelay : function(_stateRef, refs, _dispatch){
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
