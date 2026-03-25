/* global LifeViewUtils, LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils, LifeIOUtils,
          TransportControls, SpeedSlider, BoardSliders, BoundaryControls,
          ViewControls, ZoomSlider, DisplaySettings, ModeControls, ToolsContent, PresetContent,
          DrawToolPopOut, SelectToolPopOut, RegionToolPopOut,
          RulesSection, RLESection, ExportContent, RULE_PRESETS,
          toggleTrails */
/**
 * Observatory panel system — extracted from LifeBoard.
 * Render components: FloatPanel, FloatPanelDirect, PanelGroup, CompactBody
 * Helper functions and imperative handlers: ObservatoryPanelUtils
 */

// ── Helper functions ─────────────────────────────────────────────────

const _getPanelLabel = function(panelId){
    const PANEL_LABELS = {transport:'Simulate', board:'Board', view:'View', mode:'Tools', rules:'Rules', importExport:'Share', stats:'Stats'};
    return PANEL_LABELS[panelId] || panelId;
};

const _getPanelIcon = function(panelId){
    const PANEL_ICONS = {transport:'fa-play', board:'fa-th-large', view:'fa-eye',
        mode:'fa-pencil', rules:'fa-cogs', importExport:'fa-exchange'};
    return PANEL_ICONS[panelId] || 'fa-circle-o';
};

const _getPanelContent = function(panelId, state, stateRef, refs, dispatch){
    switch(panelId){
        case 'transport': return <div><div className="sidebar-section-title">Simulate</div>{<TransportControls compact={false} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
        case 'board': return <div><div className="sidebar-section-title">Board</div>{<BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<BoundaryControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
        case 'view': return <div><div className="sidebar-section-title">View</div>{<ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />}{<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
        case 'mode': return <div><div className="sidebar-section-title">Tools</div>{<ModeControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<ToolsContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
        case 'rules': return <RulesSection state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
        case 'importExport': return <ExportContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
        default: return null;
    }
};

const _checkTabBarOverflow = function(){ /* no-op: icon-only intermediate state removed */ };

const _observeTabBars = function(stateRef, refs, dispatch){ // eslint-disable-line no-unused-vars
    if(refs.tabBarObservers){
        refs.tabBarObservers.forEach(function(obs){ obs.disconnect(); });
    }
    refs.tabBarObservers = [];
    const tabBars = document.querySelectorAll('.panel-group .panel-tab-bar');
    for(let i = 0; i < tabBars.length; i++){
        (function(bar){
            const obs = new ResizeObserver(function(){ _checkTabBarOverflow(bar, stateRef, refs, dispatch); });
            obs.observe(bar);
            refs.tabBarObservers.push(obs);
        })(tabBars[i]);
    }
};

// ── State toggle helpers ─────────────────────────────────────────────

const _togglePanelOpen = function(panelId, stateRef, refs, dispatch){
    const panels = Object.assign({}, stateRef.current.panelStates);
    panels[panelId] = Object.assign({}, panels[panelId], {open: !panels[panelId].open});
    dispatch({type:"MERGE", payload:{panelStates: panels}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
};

const _togglePanelCollapse = function(panelId, stateRef, refs, dispatch){
    const panels = Object.assign({}, stateRef.current.panelStates);
    panels[panelId] = Object.assign({}, panels[panelId], {collapsed: !panels[panelId].collapsed});
    dispatch({type:"MERGE", payload:{panelStates: panels}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
};

const _toggleGroupCollapse = function(groupId, stateRef, refs, dispatch){
    const groups = stateRef.current.panelGroups.map(function(g){
        return g.id === groupId ? Object.assign({}, g, {collapsed: !g.collapsed}) : g;
    });
    dispatch({type:"MERGE", payload:{panelGroups: groups}});
    setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
};

// ── Imperative drag/resize handlers ──────────────────────────────────

const _rectsOverlap = function(a, b){
    const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const overlapArea = overlapX * overlapY;
    const aArea = a.width * a.height;
    return aArea > 0 ? overlapArea / aArea : 0;
};

const _updateDropIndicator = function(draggedId, dragX, dragY, dragPanel){
    const allPanels = document.querySelectorAll('.float-panel, .panel-group');
    const dragRect = dragPanel.getBoundingClientRect();
    let found = false;
    for(let i = 0; i < allPanels.length; i++){
        const other = allPanels[i];
        if(other === dragPanel){ allPanels[i].classList.remove('drop-target'); continue; }
        const otherRect = other.getBoundingClientRect();
        const overlap = _rectsOverlap(dragRect, otherRect);
        if(overlap > 0.3 && !found){
            other.classList.add('drop-target');
            found = true;
        } else {
            other.classList.remove('drop-target');
        }
    }
};

const _clearDropIndicator = function(){
    const els = document.querySelectorAll('.drop-target');
    for(let i = 0; i < els.length; i++){ els[i].classList.remove('drop-target'); }
};

const _findDropTarget = function(draggedId, dragRect){
    const allPanels = document.querySelectorAll('.float-panel, .panel-group');
    for(let i = 0; i < allPanels.length; i++){
        const el = allPanels[i];
        const targetId = el.getAttribute('data-panel-id');
        const targetGroupId = el.getAttribute('data-group-id');
        if(!targetId && !targetGroupId){ continue; }
        if(targetId === draggedId){ continue; }
        const otherRect = el.getBoundingClientRect();
        if(_rectsOverlap(dragRect, otherRect) > 0.3){
            return targetId || targetGroupId;
        }
    }
    return null;
};

const _startPanelDrag = function(panelId, e, stateRef, refs, dispatch){
    if(e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button'))){ return; }
    e.preventDefault();
    const panel = e.currentTarget.parentElement;
    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    refs.fpDragId = panelId;
    refs.fpDragOffX = clientX - rect.left;
    refs.fpDragOffY = clientY - rect.top;
    LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId);
    panel.classList.add('dragging');

    refs.fpDragMove = function(ev){
        ev.preventDefault();
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const newX = Math.max(0, Math.min(window.innerWidth - 60, cx - refs.fpDragOffX));
        const newY = Math.max(0, Math.min(window.innerHeight - 40, cy - refs.fpDragOffY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
        _updateDropIndicator(panelId, newX, newY, panel);
    };
    refs.fpDragEnd = function(){
        panel.classList.remove('dragging');
        _clearDropIndicator();
        const finalRect = panel.getBoundingClientRect();
        const mergeTarget = _findDropTarget(panelId, finalRect);
        if(mergeTarget){
            LifeViewUtils._mergePanels(stateRef, refs, dispatch, panelId, mergeTarget);
        } else {
            const panels = Object.assign({}, stateRef.current.panelStates);
            panels[panelId] = Object.assign({}, panels[panelId], {x: finalRect.left, y: finalRect.top});
            dispatch({type:"MERGE", payload:{panelStates: panels}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
        }
        document.removeEventListener('mousemove', refs.fpDragMove);
        document.removeEventListener('mouseup', refs.fpDragEnd);
        document.removeEventListener('touchmove', refs.fpDragMove);
        document.removeEventListener('touchend', refs.fpDragEnd);
    };
    document.addEventListener('mousemove', refs.fpDragMove);
    document.addEventListener('mouseup', refs.fpDragEnd);
    document.addEventListener('touchmove', refs.fpDragMove, {passive: false});
    document.addEventListener('touchend', refs.fpDragEnd);
};

const _startPanelResize = function(panelId, e, stateRef, refs, dispatch){
    e.preventDefault();
    e.stopPropagation();
    const panel = e.currentTarget.parentElement;
    const rect = panel.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const isCompact = stateRef.current.panelStates[panelId] && stateRef.current.panelStates[panelId].compact;
    let didToggle = false;
    const move = function(ev){
        ev.preventDefault();
        if(didToggle) return;
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const newW = startW + (cx - startX);
        const newH = startH + (cy - startY);
        if(!isCompact && newW < 120){
            didToggle = true;
            panel.style.width = '';
            panel.style.maxHeight = '';
            LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
        } else if(isCompact && newW > 120){
            didToggle = true;
            panel.style.width = Math.max(180, newW) + 'px';
            LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
        } else if(!isCompact){
            panel.style.width = Math.max(180, newW) + 'px';
            panel.style.maxHeight = Math.max(80, newH) + 'px';
        }
    };
    const end = function(){
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, {passive: false});
    document.addEventListener('touchend', end);
};

const _startGroupDrag = function(groupId, e, stateRef, refs, dispatch){
    if(e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button'))){ return; }
    e.preventDefault();
    const panel = e.currentTarget.closest('.panel-group') || e.currentTarget.parentElement;
    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const offX = clientX - rect.left;
    const offY = clientY - rect.top;
    LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, groupId);
    panel.classList.add('dragging');

    const move = function(ev){
        ev.preventDefault();
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, cx - offX)) + 'px';
        panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, cy - offY)) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
    };
    const end = function(){
        panel.classList.remove('dragging');
        const finalRect = panel.getBoundingClientRect();
        const groups = stateRef.current.panelGroups.map(function(g){
            return g.id === groupId ? Object.assign({}, g, {x: finalRect.left, y: finalRect.top}) : g;
        });
        dispatch({type:"MERGE", payload:{panelGroups: groups}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, {passive: false});
    document.addEventListener('touchend', end);
};

const _startTabDrag = function(panelId, groupId, e, stateRef, refs, dispatch){
    const startX = e.clientX;
    const startY = e.clientY;

    const threshold = 30;
    let tornOff = false;
    const move = function(ev){
        if(tornOff){ return; }
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if(Math.sqrt(dx * dx + dy * dy) > threshold){
            tornOff = true;
            LifeViewUtils._separatePanel(stateRef, refs, dispatch, panelId, groupId, ev.clientX - 40, ev.clientY - 10);
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
        }
    };
    const end = function(){
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
};

const _startGroupResize = function(groupId, e, stateRef, refs, dispatch){
    e.preventDefault();
    e.stopPropagation();
    const panel = e.currentTarget.parentElement;
    const rect = panel.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    // Snap thresholds (applied on mouse-up, not during drag).
    const compactSnapThreshold = 100;
    let curGroup = null;
    const gs = stateRef.current.panelGroups;
    for(let gi = 0; gi < gs.length; gi++){
        if(gs[gi].id === groupId){ curGroup = gs[gi]; break; }
    }
    const isCompact = curGroup && !!curGroup.compact;
    // Suppress _checkTabBarOverflow auto-compact during resize.
    refs.resizingGroup = true;
    const move = function(ev){
        ev.preventDefault();
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const newH = startH + (cy - startY);
        if(isCompact){
            // Compact: vertical resize only.
            const body = panel.querySelector('.compact-group-body') || panel.querySelector('.compact-body');
            const minH = 60;
            if(body){ minH = body.scrollHeight + (panel.offsetHeight - panel.clientHeight) + 40; }
            panel.style.maxHeight = Math.max(minH, newH) + 'px';
        } else {
            // Expanded: allow width to track cursor freely during drag.
            const newW = startW + (cx - startX);
            panel.style.width = Math.max(60, newW) + 'px';
            panel.style.maxHeight = Math.max(80, newH) + 'px';
        }
    };
    const end = function(){
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
        refs.resizingGroup = false;
        if(!isCompact){
            // Snap to nearest of three sizes based on final width.
            const finalW = panel.getBoundingClientRect().width;
            if(finalW < compactSnapThreshold){
                // Snap to compact mode.
                panel.style.width = '';
                panel.style.maxHeight = '';
                LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, groupId);
            }
            // Otherwise keep the inline width; the ResizeObserver on the
            // tab bar naturally switches between text and icon-only tabs.
        }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, {passive: false});
    document.addEventListener('touchend', end);
};

// ── Compact body definitions ─────────────────────────────────────────

const _getCompactDefs = function(panelId, state, stateRef, refs, dispatch){
    switch(panelId){
        case 'transport':
            return [
                {id:'play', icon: state.running ? 'fa-pause' : 'fa-play', title: 'Play/Pause (Space)', onClick: function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }, active: state.running},
                {id:'step', icon: 'fa-step-forward', title: 'Step (.)', onClick: function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }},
                {id:'back', icon: 'fa-step-backward', title: 'Step backward (,)', onClick: function(){ LifeSimUtils.stepBack(stateRef, refs, dispatch); }},
                {id:'go', icon: 'fa-fast-forward', title: 'Advance ' + state.stepCount + ' generations', onClick: function(){ LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount); }, popOut: function(){
                    return (<div className="compact-popout-content">
                        <select className="toolbar-step-select full-width" value={state.stepCount} onChange={function(e){ LifeBoardUtils.setStepCount(stateRef, refs, dispatch, e); }} title="Step count">
                            <option value="1">1 gen</option><option value="10">10 gen</option><option value="50">50 gen</option><option value="100">100 gen</option><option value="500">500 gen</option>
                        </select>
                        <button type="button" className="btn btn-block btn-block-spaced" onClick={function(){ LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount); }}>Go</button>
                    </div>);
                }},
                {id:'reset', icon: 'fa-refresh', title: 'Randomize (R)', onClick: function(){ LifeBoardUtils.resetGame(stateRef, refs, dispatch); }},
                {id:'empty', icon: 'fa-eraser', title: 'Clear all cells (E)', onClick: function(){ LifeBoardUtils.emptyBoard(stateRef, refs, dispatch); }},
                {id:'undo', icon: 'fa-undo', title: 'Undo (Ctrl+Z)', onClick: function(){ LifeSimUtils.undo(stateRef, refs, dispatch); }},
                {id:'speed', icon: 'fa-tachometer', title: 'Speed', popOut: function(){ return <SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
            ];
        case 'board':
            const boardDefs = [
                {id:'boundary', icon: state.boundary === 'toroidal' ? 'fa-repeat' : state.boundary === 'finite' ? 'fa-stop' : null, label: state.boundary === 'unbounded' ? '\u221E' : null, title: 'Boundary: ' + (state.boundary === 'toroidal' ? 'Wrap' : state.boundary === 'finite' ? 'Hard' : '\u221E'), onClick: function(){ LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch); }, active: state.boundary !== 'toroidal'}
            ];
            if(state.boundary !== 'unbounded'){
                boardDefs.push(
                    {id:'grid-presets', icon: 'fa-table', title: 'Grid presets', popOut: function(){
                        return (<div className="compact-popout-content grid-presets">
                            <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 100, 100); }} title="100\u00d7100">100\u00b2</button>
                            <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 200, 200); }} title="200\u00d7200">200\u00b2</button>
                            <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 400, 400); }} title="400\u00d7400">400\u00b2</button>
                            <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 1000, 1000); }} title="1000\u00d71000">1000\u00b2</button>
                            <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 2000, 2000); }} title="2000\u00d72000">2000\u00b2</button>
                        </div>);
                    }},
                    {id:'grid-size', icon: 'fa-arrows-h', title: 'Width & Height', popOut: function(){
                        return (<div className="compact-popout-content">
                            <div className="sliders">
                                <label className="slider-title">{"Width: " + state.pendingCols}</label>
                                <div className="slider-row">
                                    <input type="range" min="20" max="2000" step="10" aria-label="Grid width" value={state.pendingCols}
                                        onChange={function(e){ LifeBoardUtils.setWidth(stateRef, refs, dispatch, e); }}
                                        onMouseUp={function(){ LifeBoardUtils.applyWidth(stateRef, refs, dispatch); }}
                                        onTouchEnd={function(){ LifeBoardUtils.applyWidth(stateRef, refs, dispatch); }} />
                                </div>
                            </div>
                            <div className="sliders">
                                <label className="slider-title">{"Height: " + state.pendingRows}</label>
                                <div className="slider-row">
                                    <input type="range" min="20" max="2000" step="10" aria-label="Grid height" value={state.pendingRows}
                                        onChange={function(e){ LifeBoardUtils.setHeight(stateRef, refs, dispatch, e); }}
                                        onMouseUp={function(){ LifeBoardUtils.applyHeight(stateRef, refs, dispatch); }}
                                        onTouchEnd={function(){ LifeBoardUtils.applyHeight(stateRef, refs, dispatch); }} />
                                </div>
                            </div>
                        </div>);
                    }}
                );
            }
            boardDefs.push(
                {id:'density', icon: 'fa-braille', title: 'Fill density', popOut: function(){
                    return (<div className="compact-popout-content sliders">
                        <label className="slider-title">Random Fill Density</label>
                        <div className="slider-row">
                            <input type="range" min="2" max="7" aria-label="Fill density" value={9 - state.sparseness}
                                onChange={function(e){ LifeBoardUtils.setDensity(stateRef, refs, dispatch, e); }} />
                        </div>
                    </div>);
                }}
            );
            return boardDefs;
        case 'view':
            return [
                {id:'fit-grid', icon: 'fa-arrows-alt', title: 'Fit Grid', onClick: function(){ LifeViewUtils.fitView(stateRef, refs, dispatch); }},
                {id:'fit-cells', icon: 'fa-compress', title: 'Fit Cells', onClick: function(){ LifeViewUtils.fitLiveCells(stateRef, refs, dispatch); }},
                {id:'grid', icon: 'fa-th', title: 'Grid lines (G)', onClick: function(){ LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch); }, active: state.gridLines},
                {id:'trails', icon: 'fa-sun-o', title: 'Trails', onClick: function(){ toggleTrails(stateRef, refs, dispatch); }, active: state.showTrails},
                {id:'minimap', icon: 'fa-map-o', title: 'Minimap (M)', onClick: function(){ LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch); }, active: state.showMinimap},
                {id:'stats', icon: 'fa-bar-chart', title: 'Stats', onClick: function(){ dispatch({type:'MERGE', payload:{showStats: !state.showStats}}); }, active: state.showStats},
                {id:'zoom', icon: 'fa-search-plus', title: 'Zoom', popOut: function(){ return <ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }},
                {id:'display', icon: 'fa-paint-brush', title: 'Display settings', popOut: function(){ return <DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
            ];
        case 'mode':
            const defs = [
                {id:'draw', icon: 'fa-pencil', title: 'Draw mode (D)', onClick: function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); }, active: state.drawMode === 'paint', popOut: function(){ return <DrawToolPopOut state={state} dispatch={dispatch} />; }},
                {id:'preset', icon: 'fa-puzzle-piece', title: 'Preset patterns (P)', onClick: function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); }, active: state.drawMode === 'preset', popOut: function(){ return <PresetContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }},
                {id:'select', icon: 'fa-mouse-pointer', title: 'Select mode (S)', onClick: function(){ LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch); }, active: state.drawMode === 'select', popOut: function(){ return <SelectToolPopOut state={state} dispatch={dispatch} />; }},
                {id:'live-paint', icon: 'fa-paint-brush', title: 'Live Paint', onClick: function(){ LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch); }, active: state.livePaintMode},
                {id:'analyze', icon: 'fa-crosshairs', title: 'Analyze', onClick: function(){ LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch); }}
            ];
            if(state.boundary !== 'unbounded'){
                defs.splice(3, 0, {id:'region', icon: 'fa-th', title: 'Region bounds (B)', onClick: function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); }, active: state.drawMode === 'region', popOut: function(){ return <RegionToolPopOut state={state} dispatch={dispatch} />; }});
            }
            return defs;
        case 'rules':
            return [
                {id:'rule-preset', icon: 'fa-cogs', title: 'Rule presets', popOut: function(){
                    return (<div className="compact-popout-content">
                        <select className="rule-preset-select" aria-label="Rule preset" value={state.rulePreset}
                            onChange={function(e){ LifeBoardUtils.setRulePreset(stateRef, refs, dispatch, e); }}>
                            <option value="">Preset...</option>
                            {RULE_PRESETS.map(function(p){ return <option key={p.rule} value={p.rule}>{p.name}</option>; })}
                        </select>
                    </div>);
                }},
                {id:'rule-input', icon: 'fa-pencil-square-o', title: 'Edit rule (B/S notation)', popOut: function(){
                    const ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(state.ruleString);
                    return (<div className="compact-popout-content">
                        <input className={"rule-input" + (ruleValid ? "" : " rule-input-invalid")} type="text" value={state.ruleString}
                            onChange={function(e){ LifeBoardUtils.setRule(stateRef, refs, dispatch, e); }}
                            title="B/S notation (e.g. B3/S23)" />
                    </div>);
                }}
            ];
        case 'importExport':
            return [
                {id:'export-png', icon: 'fa-camera', title: 'Export PNG', onClick: function(){ LifeIOUtils.exportPNG(stateRef, refs, dispatch); }},
                {id:'copy-rle', icon: 'fa-clipboard', title: 'Copy RLE', onClick: function(){ LifeIOUtils.copyRLE(stateRef, refs, dispatch); }},
                {id:'record', icon: state.recording ? 'fa-stop' : 'fa-circle', title: state.recording ? 'Stop recording' : 'Record GIF', onClick: function(){ LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch); }, active: state.recording},
                {id:'share-url', icon: 'fa-share-alt', title: 'Share URL', onClick: function(){ LifeIOUtils.shareURL(stateRef, refs, dispatch); }},
                {id:'import-rle', icon: 'fa-download', title: 'Import RLE/Plaintext', popOut: function(){ return <RLESection state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
            ];
        default:
            return [];
    }
};

// ── Render components ────────────────────────────────────────────────

const CompactBody = function CompactBody(props) { // eslint-disable-line no-unused-vars
    const panelId = props.panelId, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const defs = _getCompactDefs(panelId, state, stateRef, refs, dispatch);
    if(!defs || defs.length === 0){ return null; }
    return (
        <div className="compact-body">
            {defs.map(function(def){
                const isOpen = LifeViewUtils._isPopOutOpen(stateRef, refs, dispatch, panelId, def.id);
                return (
                    <div key={def.id} className="pop-out-trigger">
                        <button type="button"
                            className={"btn" + (def.active ? " active" : "")}
                            onClick={def.popOut ? function(){ if(def.onClick) def.onClick(); isOpen ? LifeViewUtils._closePopOut(stateRef, refs, dispatch) : LifeViewUtils._openPopOut(stateRef, refs, dispatch, panelId, def.id); } : def.onClick}
                            title={def.title}
                            data-tooltip={def.title}>
                            {def.icon ? <i className={"fa " + def.icon} aria-hidden="true"></i> : null}
                            {def.label ? <span className="compact-btn-label">{def.label}</span> : null}
                        </button>
                        {def.popOut && isOpen &&
                            <div className="pop-out-panel" tabIndex="-1"
                                ref={function(el){ if(el) el.focus(); }}
                                onKeyDown={function(e){ if(e.key === 'Escape'){ e.stopPropagation(); LifeViewUtils._closePopOut(stateRef, refs, dispatch); } }}>
                                {def.popOut()}
                            </div>
                        }
                    </div>
                );
            })}
        </div>
    );
};

const FloatPanel = function FloatPanel(props) { // eslint-disable-line no-unused-vars
    const panelId = props.panelId, label = props.label, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const content = props.content || props.children;
    const ps = state.panelStates[panelId];
    if(!ps || !ps.open){ return null; }
    // Skip panels that are in a group — they render inside the group.
    if(LifeViewUtils._findGroupForPanel(stateRef, refs, dispatch, panelId)){ return null; }
    const isCompact = !!ps.compact;
    const className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() +
        (isCompact ? " float-panel-compact" : "");
    const style = {};
    if(ps.x >= 0){ style.left = ps.x; style.top = ps.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
    if(ps.z){ style.zIndex = ps.z; }
    return (
        <div className={className} style={style} data-panel-id={panelId}
            onMouseDown={function(){ LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId); }}
            onTouchStart={function(){ LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId); }}
            role="region" aria-label={label + " panel"}>
            <div className="float-panel-header"
                onMouseDown={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}>
                <i className={"fa " + _getPanelIcon(panelId) + " float-panel-icon"} aria-hidden="true"></i>
                <span className="float-panel-title" id={"panel-title-" + panelId}>{label}</span>
                <button type="button" className="btn float-panel-compact-toggle"
                    onClick={function(){ LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId); }}
                    aria-label={isCompact ? "Expand " + label + " panel" : "Compact " + label + " panel"}
                    title={isCompact ? "Expand panel" : "Compact panel"}
                    data-tooltip={isCompact ? "Expand" : "Compact"}>
                    {isCompact ? "\u00bb" : "\u00ab"}
                </button>
                <button type="button" className="btn float-panel-close"
                    onClick={function(){ _togglePanelOpen(panelId, stateRef, refs, dispatch); }}
                    aria-label={"Close " + label + " panel"}
                    data-tooltip="Close">&times;</button>
            </div>
            <div className="float-panel-body">
                {isCompact ? <CompactBody panelId={panelId} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} /> : content}
            </div>
            <div className="float-panel-resize"
                onMouseDown={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}
                data-tooltip="Resize"></div>
        </div>
    );
};

const FloatPanelDirect = function FloatPanelDirect(props) { // eslint-disable-line no-unused-vars
    const panelId = props.panelId, label = props.label, content = props.content, group = props.group, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const ps = state.panelStates[panelId];
    if(!ps || !ps.open){ return null; }
    const isCompact = !!ps.compact;
    const style = {};
    if(group && group.x >= 0){ style.left = group.x; style.top = group.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
    else if(ps.x >= 0){ style.left = ps.x; style.top = ps.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
    if(ps.z){ style.zIndex = ps.z; }
    if(group && group.z){ style.zIndex = group.z; }
    const className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() +
        (isCompact ? " float-panel-compact" : "");
    return (
        <div className={className} style={style}
            data-panel-id={panelId}
            onMouseDown={function(){ LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId); }}
            onTouchStart={function(){ LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId); }}
            role="region" aria-label={label + " panel"}>
            <div className="float-panel-header"
                onMouseDown={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}>
                <i className={"fa " + _getPanelIcon(panelId) + " float-panel-icon"} aria-hidden="true"></i>
                <span className="float-panel-title" id={"panel-title-" + panelId}>{label}</span>
                <button type="button" className="btn float-panel-compact-toggle"
                    onClick={function(){ LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId); }}
                    aria-label={isCompact ? "Expand " + label + " panel" : "Compact " + label + " panel"}
                    title={isCompact ? "Expand panel" : "Compact panel"}
                    data-tooltip={isCompact ? "Expand" : "Compact"}>
                    {isCompact ? "\u00bb" : "\u00ab"}
                </button>
                <button type="button" className="btn float-panel-close"
                    onClick={function(){ _togglePanelOpen(panelId, stateRef, refs, dispatch); }}
                    aria-label={"Close " + label + " panel"}
                    data-tooltip="Close">&times;</button>
            </div>
            <div className="float-panel-body">
                {isCompact ? <CompactBody panelId={panelId} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} /> : content}
            </div>
            <div className="float-panel-resize"
                onMouseDown={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}
                data-tooltip="Resize"></div>
        </div>
    );
};

const PanelGroup = function PanelGroup(props) { // eslint-disable-line no-unused-vars
    const group = props.group, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const panels = state.panelStates;
    // Filter to only open panels in this group.
    const openPanels = group.panels.filter(function(pid){ return panels[pid] && panels[pid].open; });
    if(openPanels.length === 0){ return null; }
    // If only one panel remains open, render as standalone.
    if(openPanels.length === 1){
        const soloId = openPanels[0];
        const soloLabel = _getPanelLabel(soloId);
        return <FloatPanelDirect panelId={soloId} label={soloLabel} content={_getPanelContent(soloId, state, stateRef, refs, dispatch)} group={group} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
    }
    const activeTab = openPanels.indexOf(group.activeTab) !== -1 ? group.activeTab : openPanels[0];
    const isCompact = !!group.compact;
    const style = {};
    if(group.x >= 0){ style.left = group.x; style.top = group.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
    if(group.z){ style.zIndex = group.z; }
    const className = "float-panel panel-group" + (isCompact ? " panel-group-compact" : "");

    // Tab buttons: icon-only rail in compact, full tabs in expanded.
    const tabButtons = openPanels.map(function(pid){
        const label = _getPanelLabel(pid);
        return (
            <button key={pid} type="button"
                className={"panel-tab" + (pid === activeTab ? " panel-tab-active" : "")}
                onClick={function(e){ e.stopPropagation(); LifeViewUtils._setGroupActiveTab(stateRef, refs, dispatch, group.id, pid); if(group.collapsed){ _toggleGroupCollapse(group.id, stateRef, refs, dispatch); } }}
                onMouseDown={function(e){ if(!isCompact) _startTabDrag(pid, group.id, e, stateRef, refs, dispatch); }}
                title={label}>
                <i className={"fa " + _getPanelIcon(pid) + " panel-tab-icon"} aria-hidden="true"></i>
                {!isCompact && <span className="panel-tab-label">{label}</span>}
            </button>
        );
    });

    if(isCompact){
        // Compact layout: drag bar on top spanning full width, then icon rail + content side by side below.
        return (
            <div className={className} style={style} data-group-id={group.id}
                onMouseDown={function(){ LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, group.id); }}
                role="region" aria-label="Panel group">
                <div className="compact-group-header"
                    onMouseDown={function(e){ _startGroupDrag(group.id, e, stateRef, refs, dispatch); }}
                    onTouchStart={function(e){ _startGroupDrag(group.id, e, stateRef, refs, dispatch); }}>
                    <i className={"fa " + _getPanelIcon(activeTab) + " compact-active-icon"} aria-hidden="true" title={_getPanelLabel(activeTab)}></i>
                    <button type="button" className="btn float-panel-compact-toggle"
                        onClick={function(e){ e.stopPropagation(); LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, group.id); }}
                        title="Expand group" data-tooltip="Expand">{"\u00bb"}</button>
                    <button type="button" className="btn float-panel-collapse"
                        onClick={function(e){ e.stopPropagation(); _toggleGroupCollapse(group.id, stateRef, refs, dispatch); }}
                        aria-expanded={!group.collapsed}
                        aria-label={group.collapsed ? "Expand panel group" : "Collapse panel group"}
                        data-tooltip={group.collapsed ? "Expand" : "Collapse"}>
                        {group.collapsed ? "+" : "\u2013"}</button>
                    <button type="button" className="btn float-panel-close"
                        onClick={function(e){ e.stopPropagation(); _togglePanelOpen(activeTab, stateRef, refs, dispatch); }}
                        aria-label="Close active panel" data-tooltip="Close">&times;</button>
                </div>
                {!group.collapsed && <div className="compact-group-body">
                    <div className="compact-icon-rail">
                        {tabButtons}
                    </div>
                    <div className="compact-main">
                        <CompactBody panelId={activeTab} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
                    </div>
                </div>}
                {!group.collapsed && <div className="float-panel-resize"
                    onMouseDown={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}
                    onTouchStart={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}></div>}
            </div>
        );
    }

    // Expanded layout: tabs across the top.
    const tabArea = (
        <div className="panel-tab-bar">
            {tabButtons}
        </div>
    );

    return (
        <div className={className} style={style} data-group-id={group.id}
            onMouseDown={function(){ LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, group.id); }}
            role="region" aria-label="Panel group">
            <div className="float-panel-header"
                onMouseDown={function(e){ _startGroupDrag(group.id, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startGroupDrag(group.id, e, stateRef, refs, dispatch); }}>
                {tabArea}
                <button type="button" className="btn float-panel-compact-toggle"
                    onClick={function(){ LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, group.id); }}
                    title="Minimize to icon strip"
                    aria-label="Minimize panel group to compact icon strip"
                    data-tooltip="Compact">{"\u00ab"}</button>
                <button type="button" className="btn float-panel-collapse"
                    onClick={function(e){ e.stopPropagation(); _toggleGroupCollapse(group.id, stateRef, refs, dispatch); }}
                    aria-expanded={!group.collapsed}
                    aria-label={group.collapsed ? "Expand panel group" : "Collapse panel group"}
                    data-tooltip={group.collapsed ? "Expand" : "Collapse"}>
                    {group.collapsed ? "+" : "\u2013"}</button>
                <button type="button" className="btn float-panel-close"
                    onClick={function(e){ e.stopPropagation(); _togglePanelOpen(activeTab, stateRef, refs, dispatch); }}
                    aria-label="Close active panel" data-tooltip="Close">&times;</button>
            </div>
            {!group.collapsed && <div className="float-panel-body">
                {_getPanelContent(activeTab, state, stateRef, refs, dispatch)}
            </div>}
            {!group.collapsed && <div className="float-panel-resize"
                onMouseDown={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}
                onTouchStart={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}></div>}
        </div>
    );
};

// ── Exported utils object ────────────────────────────────────────────

const ObservatoryPanelUtils = { // eslint-disable-line no-unused-vars
    _getPanelLabel: _getPanelLabel,
    _getPanelIcon: _getPanelIcon,
    _getPanelContent: _getPanelContent,
    _getCompactDefs: _getCompactDefs,
    _checkTabBarOverflow: _checkTabBarOverflow,
    _observeTabBars: _observeTabBars,
    _togglePanelOpen: _togglePanelOpen,
    _togglePanelCollapse: _togglePanelCollapse,
    _toggleGroupCollapse: _toggleGroupCollapse,
    _startGroupDrag: _startGroupDrag,
    _startTabDrag: _startTabDrag,
    _startGroupResize: _startGroupResize,
    _startPanelDrag: _startPanelDrag,
    _startPanelResize: _startPanelResize,
    _updateDropIndicator: _updateDropIndicator,
    _clearDropIndicator: _clearDropIndicator,
    _rectsOverlap: _rectsOverlap,
    _findDropTarget: _findDropTarget,
    // Aliases without underscore (used by layout-shell.js)
    getPanelLabel: _getPanelLabel,
    getPanelIcon: _getPanelIcon,
    getPanelContent: _getPanelContent,
    togglePanelOpen: function(panelId, state, stateRef, refs, dispatch){ _togglePanelOpen(panelId, stateRef, refs, dispatch); },
    togglePanelCollapse: function(panelId, state, stateRef, refs, dispatch){ _togglePanelCollapse(panelId, stateRef, refs, dispatch); },
    toggleGroupCollapse: function(groupId, state, stateRef, refs, dispatch){ _toggleGroupCollapse(groupId, stateRef, refs, dispatch); }
};
