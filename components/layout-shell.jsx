import React from 'react';
import { LifeViewUtils } from '../life-view-utils.js';
import { LifeAnalysisUtils } from '../life-analysis-utils.js';
import { CanvasArea, MobileMinimapArea, toggleTrails } from './canvas-area.jsx';
import { StatsPanel, StatsChip, MobileSparkline } from './stats-panel.jsx';
import { TransportControls, MobileTransportBar } from './transport-controls.jsx';
import { SpeedSlider, BoardSliders, BoundaryControls, ViewControls, ZoomSlider, DisplaySettings } from './settings-panels.jsx';
import { ModeControls, ToolsContent, MobileContextPanel } from './tools-panel.jsx';
import { RulesSection, ExportContent } from './rules-export.jsx';
import { FloatPanel, PanelGroup, ObservatoryPanelUtils } from './observatory-panels.jsx';
/**
 * Layout orchestrator components extracted from LifeBoard.
 *
 * Components:
 *   CartographerLayout  — desktop Cartographer layout (rail + canvas)
 *   CartographerMobile  — mobile Cartographer layout
 *   ObservatoryLayout   — desktop Observatory layout (floating panels)
 *   ObservatoryMobile   — mobile Observatory layout
 *   LayoutSwitcher      — toggle between Cartographer and Observatory
 *   BottomSheet         — mobile bottom sheet overlay
 *
 * Helpers:
 *   TabContentBuilder   — builds tab content for a given tab ID
 *
 * Also exports the _MOBILE_TABS array via refs.MOBILE_TABS (set at load time).
 */

const _MOBILE_TABS = [
    {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
    {id: 'board',    icon: 'fa-th-large',  label: 'Board'},
    {id: 'view',     icon: 'fa-eye',      label: 'View'},
    {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
    {id: 'rules',    icon: 'fa-cogs',     label: 'Rules'},
    {id: 'export',   icon: 'fa-exchange',  label: 'Share'}
]; // eslint-disable-line no-unused-vars

/**
 * Generic drag handler for fixed-position elements (stats, minimap, panel menu).
 * Attaches mousedown/touchstart to make the element freely draggable.
 */
const _startFixedDrag = function(e, refs, key) {
    if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
       (e.target.closest && (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('label')))) { return; }
    e.preventDefault();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const offX = cx - rect.left;
    const offY = cy - rect.top;
    el.classList.add('dragging');

    const move = function(ev) {
        ev.preventDefault();
        const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const newX = Math.max(0, Math.min(window.innerWidth - 60, mx - offX));
        const newY = Math.max(0, Math.min(window.innerHeight - 40, my - offY));
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    };
    const end = function() {
        el.classList.remove('dragging');
        // Persist position
        if(refs && key) {
            const finalRect = el.getBoundingClientRect();
            if(!refs.fixedPositions) refs.fixedPositions = {};
            refs.fixedPositions[key] = {x: finalRect.left, y: finalRect.top};
        }
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

const _applyFixedPos = function(el, refs, key) {
    if(el && refs && refs.fixedPositions && refs.fixedPositions[key]) {
        const pos = refs.fixedPositions[key];
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    }
};

const TabContentBuilder = function TabContentBuilder(props) { // eslint-disable-line no-unused-vars
    const tabId = props.tabId, options = props.options || {};
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    switch(tabId){
        case 'simulate':
            return (
                <div>
                    {options.sectionTitle && <div className="sidebar-section-title">Simulate</div>}
                    {<TransportControls compact={false} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                    {<SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                    {options.sparkline && <MobileSparkline state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />}
                </div>
            );
        case 'board':
            return (
                <div>
                    {options.sectionTitle && <div className="sidebar-section-title">Board</div>}
                    {<BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                    {<BoundaryControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                </div>
            );
        case 'view':
            return (
                <div>
                    {options.sectionTitle && <div className="sidebar-section-title">View</div>}
                    <ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />
                    {<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                    {<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                </div>
            );
        case 'tools':
            return (
                <div>
                    {options.sectionTitle && <div className="sidebar-section-title">Tools</div>}
                    {<ModeControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                    {<ToolsContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                </div>
            );
        case 'rules':  return <RulesSection state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
        case 'export': return <ExportContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
        default:       return null;
    }
};

const BottomSheet = function BottomSheet(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const sheetContent = props.sheetContent;

    const tabs = _MOBILE_TABS;
    const layoutSwitcher = <LayoutSwitcher state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
    return (
        <div className="bottom-sheet-container"
            onKeyDown={function(e){ LifeViewUtils._onSheetKeyDown(stateRef, refs, dispatch, e); }}>
            <div className="bottom-sheet-backdrop" onClick={function(){ LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch); }}
                role="presentation" aria-hidden="true"></div>
            <div className={"bottom-sheet" + (state.bottomSheetClosing ? " sheet-closing" : "")} role="dialog" aria-modal="true"
                aria-label="Controls panel"
                onTouchStart={function(e){ LifeViewUtils._onSheetTouchStart(stateRef, refs, e); }}
                onTouchMove={function(e){ LifeViewUtils._onSheetTouchMove(stateRef, refs, e); }}
                onTouchEnd={function(e){ LifeViewUtils._onSheetTouchEnd(stateRef, refs, dispatch, e); }}>
                <div className="bottom-sheet-handle"></div>
                <div className="bottom-sheet-tabs" role="tablist" aria-label="Control categories">
                    {tabs.map(function(tab){
                        const isActive = state.bottomSheetTab === tab.id;
                        return (
                            <button key={tab.id}
                                className={"rail-tab" + (isActive ? " active" : "")}
                                onClick={function(){ LifeViewUtils.setBottomSheetTab(stateRef, refs, dispatch, tab.id); }}
                                role="tab" aria-selected={isActive} aria-label={tab.label}
                                aria-controls={"sheet-panel-" + tab.id}>
                                <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                <span className="rail-tab-label">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="bottom-sheet-content"
                    id={"sheet-panel-" + state.bottomSheetTab}
                    role="tabpanel"
                    aria-label={state.bottomSheetTab + " controls"}>
                    {sheetContent}
                    {layoutSwitcher &&
                        <div className="sheet-footer">
                            {layoutSwitcher}
                        </div>
                    }
                </div>
            </div>
        </div>
    );
};

const LayoutSwitcher = function LayoutSwitcher(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const dc = state.deviceClass;
    const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
    if(isMobile){ return null; }

    const mode = state.layoutMode;
    return (
        <div className="layout-switcher">
            <button type="button" className={"btn btn-toggle" + (mode === 'cartographer' ? " active" : "")}
                onClick={function(){ LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'cartographer'); }}
                title="Cartographer: Edge rail with tabs"
                aria-label="Cartographer layout: edge rail with tabs"
                aria-pressed={mode === 'cartographer'}
                data-tooltip="Cartographer">
                <i className="fa fa-columns"></i>
            </button>
            <button type="button" className={"btn btn-toggle" + (mode === 'observatory' ? " active" : "")}
                onClick={function(){ LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'observatory'); }}
                title="Observatory: Floating panels"
                aria-label="Observatory layout: floating panels"
                aria-pressed={mode === 'observatory'}
                data-tooltip="Observatory">
                <i className="fa fa-object-ungroup"></i>
            </button>
        </div>
    );
};

const CartographerLayout = function CartographerLayout(props) { // eslint-disable-line no-unused-vars
    const cs = props.cs, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

    const dc = state.deviceClass;
    const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

    if(isMobile){
        return <CartographerMobile cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
    }

    const railW = state.railHidden ? 0 : (state.railCollapsed ? 40 : (dc === 'tablet' ? 200 : 240));
    const railSide = state.railSide;
    const railClass = 'rail' +
        (state.railCollapsed ? ' rail-collapsed' : '') +
        (state.railHidden ? ' rail-hidden' : '') +
        (' rail-' + railSide);

    const tabContent = (
        <div className="rail-tab-content">
            <TabContentBuilder tabId={state.railTab} options={{sectionTitle: true}} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
        </div>
    );

    const tabs = _MOBILE_TABS;

    return (
        <div className="layout-cartographer">
            <CanvasArea cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {/* Rail */}
            <div className={railClass} style={{width: railW + 'px'}}
                role="complementary" aria-label="Controls panel">
                <div className="rail-header">
                    <span className="rail-title">{"Game of Life"}</span>
                    <div className="rail-header-controls">
                        <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch); }} aria-label="Help" title="Keyboard shortcuts (?)">
                            <i className="fa fa-question-circle" aria-hidden="true"></i>
                        </button>
                        <button type="button" className="btn" onClick={function(){ LifeViewUtils.toggleRailSide(stateRef, refs, dispatch); }}
                            aria-label={state.railSide === 'right' ? "Move panel to left" : "Move panel to right"}
                            title={state.railSide === 'right' ? "Move panel to left" : "Move panel to right"}>
                            <i className={"fa " + (state.railSide === 'right' ? "fa-indent" : "fa-dedent")} aria-hidden="true"></i>
                        </button>
                        <button type="button" className="btn rail-collapse-btn" onClick={function(){ LifeViewUtils.toggleRailCollapsed(stateRef, refs, dispatch); }}
                            aria-expanded={!state.railCollapsed}
                            aria-label={state.railCollapsed ? "Expand controls panel" : "Collapse controls panel"}>
                            {state.railCollapsed ? <i className="fa fa-chevron-left" aria-hidden="true"></i> : <i className="fa fa-chevron-right" aria-hidden="true"></i>}
                        </button>
                    </div>
                </div>
                {!state.railCollapsed && state.showStats !== false && <div className="rail-stats">{<StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />}</div>}
                <div className="rail-tabs" role="tablist" aria-label="Control categories">
                    {tabs.map(function(tab){
                        const isActive = state.railTab === tab.id;
                        return (
                            <button key={tab.id}
                                className={"rail-tab" + (isActive ? " active" : "")}
                                onClick={function(){ LifeViewUtils.setRailTab(stateRef, refs, dispatch, tab.id); }}
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={"rail-panel-" + tab.id}
                                aria-label={tab.label}
                                title={tab.label}>
                                <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                {!state.railCollapsed && <span className="rail-tab-label">{tab.label}</span>}
                            </button>
                        );
                    })}
                </div>
                {!state.railCollapsed &&
                    <div id={"rail-panel-" + state.railTab} role="tabpanel"
                        aria-label={state.railTab + " controls"}
                        style={{flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column'}}>
                        {tabContent}
                    </div>
                }
                {!state.railCollapsed &&
                    <div className="rail-footer">
                        <LayoutSwitcher state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
                    </div>
                }
            </div>
            {/* Floating transport strip */}
            <div className="transport-strip" role="toolbar" aria-label="Simulation transport">
                {<TransportControls compact={true} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            </div>
            {/* Rail show button when hidden */}
            {state.railHidden &&
                <div className={"rail-reveal rail-reveal-" + railSide}
                    onMouseEnter={function(){ LifeViewUtils.toggleRailHidden(stateRef, refs, dispatch); }}></div>
            }
            {/* Mobile minimap element for tablet/medium screens */}
            <MobileMinimapArea state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
        </div>
    );
};

const CartographerMobile = function CartographerMobile(props) { // eslint-disable-line no-unused-vars
    const cs = props.cs, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const sheetContent = state.bottomSheetOpen
        ? <TabContentBuilder tabId={state.bottomSheetTab} options={{sectionTitle: true, sparkline: true}} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
        : null;
    return (
        <div className="layout-cartographer layout-mobile">
            <CanvasArea cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {!state.bottomSheetOpen && !refs.statsChipHidden && state.showStats !== false && <StatsChip state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {!state.bottomSheetOpen && <MobileContextPanel state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {!state.bottomSheetOpen && <MobileMinimapArea state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {<MobileTransportBar state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {state.bottomSheetOpen && <BottomSheet sheetContent={sheetContent} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
        </div>
    );
};

const _ObservatoryHints = function _ObservatoryHints(props) { // eslint-disable-line no-unused-vars
    const dismissed = React.useState(function(){ try { return localStorage.getItem('life-obs-hints-seen') === '1'; } catch(e){ return false; } });
    const seen = dismissed[0], setSeen = dismissed[1];
    if(seen){ return null; }
    const dismiss = function(){ setSeen(true); try { localStorage.setItem('life-obs-hints-seen', '1'); } catch(e){/* */} };
    return (
        <div className="obs-hints-overlay" role="dialog" aria-label="Quick tips">
            <div className="obs-hints-card">
                <h3 className="obs-hints-title">Observatory Tips</h3>
                <ul className="obs-hints-list">
                    <li>Drag panel headers to reposition. Drop panels on each other to dock.</li>
                    <li>Click <b>{"\u00ab"}</b> to compact a panel into icon buttons.</li>
                    <li>In compact mode, the right column shows context-sensitive actions.</li>
                    <li>Hover any icon to see what it does.</li>
                </ul>
                <button type="button" className="btn obs-hints-dismiss" onClick={dismiss}>Got it</button>
            </div>
        </div>
    );
};

const ObservatoryLayout = function ObservatoryLayout(props) { // eslint-disable-line no-unused-vars
    const cs = props.cs, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

    const dc = state.deviceClass;
    const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

    if(isMobile){
        return <ObservatoryMobile cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
    }

    const panels = state.panelStates;
    const zenMode = state.zenMode;

    return (
        <div className={"layout-observatory" + (zenMode ? " zen-mode" : "")}>
            <CanvasArea cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {/* Floating transport strip — always visible so users can pause even if panels are closed */}
            <div className="transport-strip" role="toolbar" aria-label="Simulation transport">
                {<TransportControls compact={true} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            </div>
            {!zenMode &&
                <div className="panel-overlay-container" role="group" aria-label="Floating control panels">
                    <FloatPanel panelId="transport" label="Simulate" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <div>{<TransportControls compact={false} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>
                    </FloatPanel>
                    <FloatPanel panelId="board" label="Board" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <div>{<BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<BoundaryControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>
                    </FloatPanel>
                    <FloatPanel panelId="view" label="View" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <div>{<ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />}{<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>
                    </FloatPanel>
                    <FloatPanel panelId="mode" label="Tools" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <div>{<ModeControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<ToolsContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>
                    </FloatPanel>
                    <FloatPanel panelId="rules" label="Rules" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <RulesSection state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
                    </FloatPanel>
                    {state.showStats &&
                        <div className="stats-window draggable-fixed" role="region" aria-label="Statistics"
                            ref={function(el){ _applyFixedPos(el, refs, 'stats'); }}
                            onMouseDown={function(e){ _startFixedDrag(e, refs, 'stats'); }}
                            onTouchStart={function(e){ _startFixedDrag(e, refs, 'stats'); }}>
                            <StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />
                        </div>
                    }
                    <FloatPanel panelId="importExport" label="Share" state={state} stateRef={stateRef} refs={refs} dispatch={dispatch}>
                        <ExportContent state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
                    </FloatPanel>
                    {state.panelGroups.map(function(group){ return <PanelGroup key={group.id} group={group} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; })}
                    {/* Panel menu */}
                    <div className="panel-menu draggable-fixed" role="group" aria-label="Panel visibility"
                        ref={function(el){ _applyFixedPos(el, refs, 'panelMenu'); }}
                        onMouseDown={function(e){ _startFixedDrag(e, refs, 'panelMenu'); }}
                        onTouchStart={function(e){ _startFixedDrag(e, refs, 'panelMenu'); }}>
                        <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch); }} aria-label="Help" title="Keyboard shortcuts (?)" data-tooltip="Help (?)">
                            <i className="fa fa-question-circle" aria-hidden="true"></i>
                        </button>
                        <button type="button" className="btn panel-menu-toggle"
                            onClick={function(){ dispatch({type:"MERGE", payload:{panelMenuOpen: !state.panelMenuOpen}}); }}
                            aria-expanded={!!state.panelMenuOpen}
                            aria-label="Toggle panel visibility menu"
                            data-tooltip="Panel visibility">
                            <i className="fa fa-th" aria-hidden="true"></i>
                        </button>
                        {state.panelMenuOpen &&
                            <div className="panel-menu-backdrop" aria-hidden="true"
                                onClick={function(){ dispatch({type:"MERGE", payload:{panelMenuOpen: false}}); }}></div>
                        }
                        {state.panelMenuOpen &&
                            <div className="panel-menu-list" role="group" aria-label="Panel toggles"
                                tabIndex="-1"
                                ref={function(el){ if(el) el.focus(); }}
                                onKeyDown={function(e){ if(e.key === 'Escape'){ e.stopPropagation(); dispatch({type:"MERGE", payload:{panelMenuOpen: false}}); } }}>
                                {['transport','board','view','mode','rules','importExport'].map(function(id){
                                    const label = ObservatoryPanelUtils.getPanelLabel(id);
                                    return (
                                        <label key={id} className="panel-menu-item">
                                            <input type="checkbox" checked={panels[id].open}
                                                onChange={function(){ ObservatoryPanelUtils.togglePanelOpen(id, state, stateRef, refs, dispatch); }}
                                                aria-label={"Show " + label + " panel"} />
                                            <span>{label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        }
                        <button type="button" className="btn panel-menu-toggle"
                            onClick={function(){ LifeViewUtils.toggleZenMode(stateRef, refs, dispatch); }}
                            title="Zen mode — hide all panels (Z)"
                            aria-label="Toggle zen mode"
                            data-tooltip="Zen mode (Z)">
                            <i className="fa fa-compress" aria-hidden="true"></i>
                        </button>
                        <LayoutSwitcher state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
                    </div>
                </div>
            }
            {zenMode &&
                <button type="button" className="btn zen-exit-btn"
                    onClick={function(){ LifeViewUtils.toggleZenMode(stateRef, refs, dispatch); }}
                    title="Exit zen mode (Z or Escape)"
                    aria-label="Exit zen mode">
                    <i className="fa fa-eye" aria-hidden="true"></i>{' Exit Zen'}
                </button>
            }
            {zenMode && state.zenNotify &&
                <div className="zen-notify" role="status" aria-live="polite">Zen mode — press Z or Esc to exit</div>
            }
            {/* Mobile minimap element for tablet/medium screens */}
            <MobileMinimapArea state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {!zenMode && <_ObservatoryHints />}
        </div>
    );
};

const ObservatoryMobile = function ObservatoryMobile(props) { // eslint-disable-line no-unused-vars
    const cs = props.cs, state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const sheetContent = state.bottomSheetOpen
        ? <TabContentBuilder tabId={state.bottomSheetTab} options={{sectionTitle: true, sparkline: true}} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
        : null;
    return (
        <div className="layout-observatory layout-mobile">
            <CanvasArea cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {<MobileTransportBar state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {!state.bottomSheetOpen && !refs.statsChipHidden && state.showStats !== false && <StatsChip state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {!state.bottomSheetOpen && <MobileContextPanel state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {!state.bottomSheetOpen && <MobileMinimapArea state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
            {state.bottomSheetOpen && <BottomSheet sheetContent={sheetContent} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
        </div>
    );
};

export { TabContentBuilder, BottomSheet, LayoutSwitcher, CartographerLayout, CartographerMobile, ObservatoryLayout, ObservatoryMobile };
