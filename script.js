/* global HashLife, SimRunner, CanvasRenderer, InputHandler, RegionUtil,
          PATTERN_GROUPS, PATTERNS, PATTERN_META, SimEngine, parseKey,
          RULE_PRESETS, SPEED_DELAYS, THEMES,
          LifeSimUtils, LifeIOUtils, LifeInputUtils, LifeViewUtils,
          LifeBoardUtils, LifeAnalysisUtils,
          CanvasArea, MobileMinimapArea, ModeControls, ToolsContent, MobileContextPanel,
          drawBoard, drawMinimap, drawMinimapMobile, drawRotationPreview, toggleTrails,
          CartographerLayout, ObservatoryLayout,
          FloatPanel, FloatPanelDirect, PanelGroup, CompactBody, ObservatoryPanelUtils */
/**
 * Conway's Game of Life — React UI component (React 19 functional).
 * Constants, SimEngine, and helpers are loaded from constants.js.
 */

function lifeReducer(state, action) {
    switch(action.type) {
        case 'MERGE': return Object.assign({}, state, action.payload);
        default:      return Object.assign({}, state, action.payload);
    }
}

function initState(){
                var cols = 100;
                var rows = 100;
                // On mobile, default to 8px/cell; on desktop, 5px/cell.
                // Center the view on the grid for all screen sizes.
                var isMobileInit = window.innerWidth <= 900 ||
                    (window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 550px)').matches);
                var cellSize = isMobileInit ? 8 : 10;
                var initViewX = Math.round((cols / 2) - (window.innerWidth / (2 * cellSize)));
                var initViewY = Math.round((rows / 2) - (window.innerHeight / (2 * cellSize)));
                // Load persisted layout preferences from localStorage.
                // Schema v1: {layoutMode, railCollapsed, railTab, railSide, panelStates}
                var savedLayout = {};
                try {
                    var raw = localStorage.getItem('life-layout-prefs');
                    if(raw){
                        var parsed = JSON.parse(raw);
                        // Validate schema version — if missing or mismatched, discard.
                        if(parsed && typeof parsed === 'object'){
                            // Validate layoutMode is a known value.
                            if(parsed.layoutMode && ['cartographer','observatory'].indexOf(parsed.layoutMode) !== -1){
                                savedLayout.layoutMode = parsed.layoutMode;
                            } else if(parsed.layoutMode === 'specimen'){
                                savedLayout.layoutMode = 'cartographer';
                            }
                            if(typeof parsed.railCollapsed === 'boolean'){
                                savedLayout.railCollapsed = parsed.railCollapsed;
                            }
                            if(parsed.railTab && ['simulate','board','view','tools','rules','export'].indexOf(parsed.railTab) !== -1){
                                savedLayout.railTab = parsed.railTab;
                            }
                            if(parsed.railSide && ['left','right'].indexOf(parsed.railSide) !== -1){
                                savedLayout.railSide = parsed.railSide;
                            }
                            // Validate panelStates: must be an object with known panel keys.
                            if(parsed.panelStates && typeof parsed.panelStates === 'object'){
                                var validPanels = ['transport','view','mode','tools','board','rules','stats','importExport'];
                                var ps = {};
                                var allValid = true;
                                var maxZ = 0;
                                for(var vi = 0; vi < validPanels.length; vi++){
                                    var pid = validPanels[vi];
                                    if(parsed.panelStates[pid] && typeof parsed.panelStates[pid] === 'object'){
                                        var pz = typeof parsed.panelStates[pid].z === 'number' ? parsed.panelStates[pid].z : 0;
                                        if(pz > maxZ){ maxZ = pz; }
                                        ps[pid] = {
                                            open: typeof parsed.panelStates[pid].open === 'boolean' ? parsed.panelStates[pid].open : true,
                                            x: typeof parsed.panelStates[pid].x === 'number' ? parsed.panelStates[pid].x : -1,
                                            y: typeof parsed.panelStates[pid].y === 'number' ? parsed.panelStates[pid].y : -1,
                                            collapsed: typeof parsed.panelStates[pid].collapsed === 'boolean' ? parsed.panelStates[pid].collapsed : false,
                                            z: pz,
                                            compact: typeof parsed.panelStates[pid].compact === 'boolean' ? parsed.panelStates[pid].compact : false
                                        };
                                    } else {
                                        allValid = false;
                                        break;
                                    }
                                }
                                if(allValid){
                                    savedLayout.panelStates = ps;
                                    savedLayout.panelZCounter = maxZ + 1;
                                }
                            }
                            // Validate panelGroups: array of group objects.
                            if(Array.isArray(parsed.panelGroups)){
                                savedLayout.panelGroups = parsed.panelGroups.filter(function(g){
                                    return g && typeof g === 'object' && Array.isArray(g.panels) && g.panels.length >= 2 && typeof g.id === 'string';
                                });
                            }
                        }
                    }
                } catch(e){
                    // Corrupted localStorage — silently ignore, use defaults.
                    try { localStorage.removeItem('life-layout-prefs'); } catch(e2){}
                }

                var initRegionMask = RegionUtil.buildRect(cols, rows);
                var initRegionComponents = [{
                    cells: initRegionMask,
                    minR: 0, maxR: rows - 1, minC: 0, maxC: cols - 1
                }];

                return {
                    running :        true,
                    cellSize :       cellSize,
                    cols :           cols,
                    rows :           rows,
                    viewX :          initViewX,
                    viewY :          initViewY,
                    sparseness :     2,
                    liveCells :      SimEngine.buildLiveCells(cols, rows, 2),
                    generations :    0,
                    livePaintMode :  false,
                    speed :          5,
                    gridLines :      true,
                    boundary :       'toroidal',
                    regionMask :     initRegionMask,
                    regionComponents : initRegionComponents,
                    regionBounds :   {minR: 0, maxR: rows - 1, minC: 0, maxC: cols - 1},
                    birthRule :      [3],
                    surviveRule :    [2, 3],
                    ruleString :     'B3/S23',
                    rulePreset :     'B3/S23',
                    selectedPattern: null,
                    patternRotation: 0,
                    pendingCols :    cols,
                    pendingRows :    rows,
                    popHistory :     [],
                    sessionPeakPop : 0,
                    stable :         false,
                    showHelp :       false,
                    showRle :        false,
                    rleInput :       '',
                    rleError :       '',
                    patternFilter :  '',
                    hoverCell :      null,
                    theme :          'Teal',
                    drawMode :       'paint',
                    selectTool :     'rect',
                    drawTool :       'cell',
                    regionTool :     'shape-rect',
                    selection :      null,
                    clipboard :      null,
                    showMinimap :     !isMobileInit,
                    recording :       false,
                    showMobileTools : false,
                    showTrails :      true,
                    darkModePref :    (function(){ try { return localStorage.getItem('life-dark-mode-pref') || 'system'; } catch(e){ return 'system'; } })(),
                    stepCount :       1,
                    shareTooltip :    false,
                    showPopGraph :    false,
                    analysisResult :  null,
                    analyzing :       false,

                    // ── Layout mode state ───────────────────────────
                    layoutMode :       savedLayout.layoutMode || 'cartographer',
                    // Cartographer state
                    railCollapsed :    savedLayout.railCollapsed || false,
                    railHidden :       false,
                    railTab :          savedLayout.railTab || 'simulate',
                    railSide :         savedLayout.railSide || 'right',
                    // Observatory state
                    zenMode :          false,
                    panelMenuOpen :   false,
                    panelStates :      savedLayout.panelStates || {
                        transport: { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        view:      { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        mode:      { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        tools:     { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        board:     { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        rules:     { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        stats:     { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false },
                        importExport: { open: false, x: -1, y: -1, collapsed: false, z: 0, compact: false }
                    },
                    panelZCounter :    savedLayout.panelZCounter || 1,
                    panelGroups :      savedLayout.panelGroups || [{
                        id: 'g-default', panels: ['transport','view','mode','board','rules','stats'],
                        activeTab: 'transport', x: 10, y: 50, z: 1, compact: true, compactTabMode: 'sidebar'
                    }],
                    activePopOut :     null,
                    groupTabDropdownOpen : null,
                    // Responsive device class
                    deviceClass :      'desktop',
                    // Bottom sheet (phone modes)
                    bottomSheetOpen :  false,
                    bottomSheetClosing: false,
                    bottomSheetTab :   'simulate',
                    panMode :          false,
                    srAnnouncement :   '',
                    autoPauseOnStable : true
                };
}

document.addEventListener('DOMContentLoaded', function(){

function LifeBoard() {
    var _r = React.useReducer(lifeReducer, undefined, initState);
    var state = _r[0], dispatch = _r[1];
    var stateRef = React.useRef(state);
    stateRef.current = state;
    var refs = React.useRef(null);
    if(!refs.current) {
        refs.current = {
            mounted: false, canvas: null, minimapCanvas: null, previewCanvas: null,
            mobileMinimap: null, genHistory: [], genHistoryMax: 200,
            genHistoryInterval: 1, genHistoryCounter: 0,
            trailMap: new Map(), trailEnabled: true, loopRunning: false,
            tickId: 0, undoStack: [], redoStack: [], prevBoardHash: null,
            stableCount: 0, genTimestamps: [], measuredGps: 0,
            gif: null, minimapDirty: true, minimapCanvas2: document.createElement('canvas'),
            mmElemDragging: false, statsChipHidden: false, statsChipTimer: null,
            minimapHidden: false, minimapTimer: null, drawPending: false,
            tabBarObservers: [], shortcuts: {}, rafId: null, loopTimeout: null,
            prevFocusEl: null, resizeTimer: null, lastResizeW: window.innerWidth,
            lastResizeH: window.innerHeight, canvasSizeCacheKey: null, canvasSizeCache: null,
            sheetTouchY: null, sheetEl: null, gpsDisplayUntil: 0,
            previewPos: null, analysisCancelled: false,
            darkModeQuery: null, onDarkModeChange: null,
            mqPhone: null, mqPhoneLandscape: null, mqTablet: null, mqLandscape: null,
            updateDeviceClass: null, onResize: null, onOrientationChange: null,
            onPopOutDismiss: null, onPaste: null, onDragOver: null, onDragLeave: null, onDrop: null,
            forceRender: null, drawRotationPreview: null
        };
    }
    refs = refs.current;
    var fr = React.useReducer(function(x){return x+1;},0);
    refs.forceRender = fr[1];


    // ── Mount effect (replaces componentDidMount + componentWillUnmount) ──
    React.useEffect(function(){
                refs.mounted = true;
                refs.minimapCanvas2.width  = 100;
                refs.minimapCanvas2.height = 75;
                InputHandler.reset();
                SimRunner.invalidate();
                // Attach wheel listener as non-passive so preventDefault works.
                refs.canvas.addEventListener('wheel', function(e){ LifeInputUtils.onWheel(stateRef, refs, dispatch, e); }, {passive: false});
                var handleKey = function(e){ LifeInputUtils.handleKeyDown(stateRef, refs, dispatch, e); };
                document.addEventListener('keydown', handleKey);
                // System clipboard paste: import RLE/pattern text from clipboard.
                refs.onPaste = function(e){ LifeIOUtils._handleClipboardPaste(stateRef, refs, dispatch, e); };
                document.addEventListener('paste', refs.onPaste);
                // Close pop-outs on click outside or Escape.
                refs.onPopOutDismiss = function(e){
                    if(!stateRef.current.activePopOut){ return; }
                    if(e.type === 'keydown' && e.key === 'Escape'){ LifeViewUtils._closePopOut(stateRef, refs, dispatch); return; }
                    if(e.type === 'mousedown'){
                        var popOut = e.target.closest && e.target.closest('.pop-out-trigger');
                        if(!popOut){ LifeViewUtils._closePopOut(stateRef, refs, dispatch); }
                    }
                };
                document.addEventListener('mousedown', refs.onPopOutDismiss);
                document.addEventListener('keydown', refs.onPopOutDismiss);
                // Drag-and-drop file import (desktop).
                var canvasContainer = refs.canvas.parentNode;
                refs.onDragOver = function(e){ e.preventDefault(); e.stopPropagation(); canvasContainer.classList.add('drop-active'); };
                refs.onDragLeave = function(e){ e.preventDefault(); e.stopPropagation(); canvasContainer.classList.remove('drop-active'); };
                refs.onDrop = function(e){ LifeIOUtils._handleFileDrop(stateRef, refs, dispatch, e); };
                canvasContainer.addEventListener('dragover', refs.onDragOver);
                canvasContainer.addEventListener('dragleave', refs.onDragLeave);
                canvasContainer.addEventListener('drop', refs.onDrop);
                // Dark mode: respect system preference.
                refs.darkModeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
                if(refs.darkModeQuery){
                    refs.onDarkModeChange = function(e){
                        if(stateRef.current.darkModePref === 'system'){
                            LifeBoardUtils._applyDarkMode(e.matches);
                        }
                    };
                    try { refs.darkModeQuery.addEventListener('change', refs.onDarkModeChange); }
                    catch(ex){ try { refs.darkModeQuery.addListener(refs.onDarkModeChange); } catch(ex2){} }
                    // Apply initial dark mode state.
                    if(stateRef.current.darkModePref === 'system'){
                        LifeBoardUtils._applyDarkMode(refs.darkModeQuery.matches);
                    }
                }
                // Respond to viewport resize (throttled) to update canvas dimensions.
                refs.onResize = function(){
                    var newW = window.innerWidth;
                    var newH = window.innerHeight;
                    var widthChanged = Math.abs(newW - refs.lastResizeW) > 10;
                    var heightBigChange = Math.abs(newH - refs.lastResizeH) > 100;
                    if(!widthChanged && !heightBigChange){ return; }
                    refs.lastResizeW = newW;
                    refs.lastResizeH = newH;
                    clearTimeout(refs.resizeTimer);
                    refs.resizeTimer = setTimeout(function(){ refs.forceRender(); drawBoard(stateRef, refs); }, 120);
                };
                window.addEventListener('resize', refs.onResize);
                refs.onOrientationChange = function(){
                    clearTimeout(refs.resizeTimer);
                    refs.resizeTimer = setTimeout(function(){ refs.forceRender(); drawBoard(stateRef, refs); }, 300);
                };
                window.addEventListener('orientationchange', refs.onOrientationChange);
                // ── Device class detection via matchMedia ──────────────────
                refs.mqPhone = window.matchMedia('(max-width: 900px)');
                refs.mqPhoneLandscape = window.matchMedia('(orientation: landscape) and (max-height: 550px)');
                refs.mqTablet = window.matchMedia('(min-width: 901px) and (max-width: 1200px)');
                refs.mqLandscape = window.matchMedia('(orientation: landscape)');
                refs.updateDeviceClass = function(){
                    var dc;
                    if(refs.mqPhone.matches){
                        dc = refs.mqLandscape.matches ? 'phone-landscape' : 'phone-portrait';
                    } else if(refs.mqPhoneLandscape.matches){
                        dc = 'phone-landscape';
                    } else if(refs.mqTablet.matches){
                        dc = 'tablet';
                    } else {
                        dc = 'desktop';
                    }
                    if(dc !== stateRef.current.deviceClass){
                        dispatch({type:'MERGE', payload:{deviceClass: dc}});
                        setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                    }
                };
                refs.updateDeviceClass();
                try {
                    refs.mqPhone.addEventListener('change', refs.updateDeviceClass);
                    refs.mqPhoneLandscape.addEventListener('change', refs.updateDeviceClass);
                    refs.mqTablet.addEventListener('change', refs.updateDeviceClass);
                    refs.mqLandscape.addEventListener('change', refs.updateDeviceClass);
                } catch(ex){
                    try {
                        refs.mqPhone.addListener(refs.updateDeviceClass);
                        refs.mqPhoneLandscape.addListener(refs.updateDeviceClass);
                        refs.mqTablet.addListener(refs.updateDeviceClass);
                        refs.mqLandscape.addListener(refs.updateDeviceClass);
                    } catch(ex2){}
                }

                // ── Keyboard shortcut registry ──────────────────────────────
                LifeInputUtils._registerCoreShortcuts(stateRef, refs, dispatch);

                // Initialize HashLife engine with current rules.
                HashLife.init(stateRef.current.birthRule, stateRef.current.surviveRule);
                SimRunner._hlRuleKey = stateRef.current.birthRule.join(',') + '/' + stateRef.current.surviveRule.join(',');
                drawBoard(stateRef, refs);
                LifeIOUtils._loadFromURLHash(stateRef, refs, dispatch);
                LifeSimUtils._startLoop(stateRef, refs, dispatch);
                ObservatoryPanelUtils._observeTabBars(stateRef, refs);

                // ── Cleanup (replaces componentWillUnmount) ──
                return function(){
                    if(refs.tabBarObservers){
                        refs.tabBarObservers.forEach(function(obs){ obs.disconnect(); });
                    }
                    if(!refs.canvas){ return; }
                    document.removeEventListener('keydown', handleKey);
                    document.removeEventListener('paste', refs.onPaste);
                    document.removeEventListener('mousedown', refs.onPopOutDismiss);
                    document.removeEventListener('keydown', refs.onPopOutDismiss);
                    window.removeEventListener('resize', refs.onResize);
                    window.removeEventListener('orientationchange', refs.onOrientationChange);
                    var container = refs.canvas.parentNode;
                    if(container){
                        container.removeEventListener('dragover', refs.onDragOver);
                        container.removeEventListener('dragleave', refs.onDragLeave);
                        container.removeEventListener('drop', refs.onDrop);
                    }
                    if(refs.gif){ refs.gif.abort(); refs.gif = null; }
                    if(refs.darkModeQuery && refs.onDarkModeChange){
                        try { refs.darkModeQuery.removeEventListener('change', refs.onDarkModeChange); }
                        catch(ex){ try { refs.darkModeQuery.removeListener(refs.onDarkModeChange); } catch(ex2){} }
                    }
                    if(refs.updateDeviceClass){
                        var mqList = [refs.mqPhone, refs.mqPhoneLandscape, refs.mqTablet, refs.mqLandscape];
                        for(var mi = 0; mi < mqList.length; mi++){
                            if(mqList[mi]){
                                try { mqList[mi].removeEventListener('change', refs.updateDeviceClass); }
                                catch(ex){ try { mqList[mi].removeListener(refs.updateDeviceClass); } catch(ex2){} }
                            }
                        }
                    }
                    refs.mounted = false;
                    if(refs.rafId){ cancelAnimationFrame(refs.rafId); refs.rafId = null; }
                    if(refs.loopTimeout){ clearTimeout(refs.loopTimeout); refs.loopTimeout = null; }
                    InputHandler.reset();
                    refs.minimapCanvas2 = null;
                    SimRunner._hlRoot = null;
                    refs.genHistory = [];
                    refs.trailMap = null;
                    InputHandler._paintedCells = {};
                    refs.sheetEl = null;
                };
    }, []);

    // ── Update effect (replaces componentDidUpdate) ──
    var prevSelectedPattern = React.useRef(state.selectedPattern);
    var prevPatternRotation = React.useRef(state.patternRotation);
    var prevBottomSheetOpen = React.useRef(state.bottomSheetOpen);
    var prevBottomSheetTab = React.useRef(state.bottomSheetTab);
    var prevLayoutMode = React.useRef(state.layoutMode);
    var prevPanelGroups = React.useRef(state.panelGroups);
    React.useEffect(function(){
        if(prevSelectedPattern.current !== state.selectedPattern ||
           prevPatternRotation.current !== state.patternRotation ||
           prevBottomSheetOpen.current !== state.bottomSheetOpen ||
           prevBottomSheetTab.current !== state.bottomSheetTab ||
           prevLayoutMode.current !== state.layoutMode){
            drawRotationPreview(stateRef, refs);
        }
        if(prevPanelGroups.current !== state.panelGroups){
            ObservatoryPanelUtils._observeTabBars(stateRef, refs);
        }
        prevSelectedPattern.current = state.selectedPattern;
        prevPatternRotation.current = state.patternRotation;
        prevBottomSheetOpen.current = state.bottomSheetOpen;
        prevBottomSheetTab.current = state.bottomSheetTab;
        prevLayoutMode.current = state.layoutMode;
        prevPanelGroups.current = state.panelGroups;
    });

            // ── Rendering ─────────────────────────────────────────────────────

    // drawBoard — extracted to components/canvas-area.js as top-level function

    // drawMinimap — extracted to components/canvas-area.js as top-level function

    // drawRotationPreview — extracted to components/canvas-area.js as top-level function

            // ── Methods delegated to mixins ──────────────────────────────────
            // LifeSimUtils: simulation loop, undo/redo, stepping
            // LifeIOUtils: file import/export, URL sharing, RLE
            // LifeInputUtils: mouse, touch, keyboard, shortcuts
            // LifeViewUtils: viewport, layout, panels, bottom sheet
            // LifeBoardUtils: board config, drawing modes, selection, patterns
            // LifeAnalysisUtils: pattern analysis, recording, help

    // toggleTrails — extracted to components/canvas-area.js as top-level function

            // ── Render sub-methods ────────────────────────────────────────────

    // HelpModal extracted to components/help-modal.js

    // PopGraphModal extracted to components/pop-graph.js

            // Returns the sparkline SVG block (or null if insufficient data).
            // Called from both renderStats (desktop) and renderMobileSparkline (mobile).
    function renderSparklineSVG(){
                // Extracted to components/stats-panel.js as SparklineSVG
    }

    function renderMobileSparkline(){
                // Extracted to components/stats-panel.js as MobileSparkline
    }

    // renderMobileMinimapArea — extracted to components/canvas-area.js as MobileMinimapArea
    // onMinimapElementDown, onMinimapElementMove, onMinimapElementUp, panMinimapElement — extracted to components/canvas-area.js

    // drawMinimapMobile — extracted to components/canvas-area.js as top-level function

    function renderStats(){
                // Extracted to components/stats-panel.js as StatsPanel
    }

            // ── Shared mobile sub-components (R10) ─────────────────────────────
            // Extracted from 3 duplicated mobile render methods.

    // _MOBILE_TABS — extracted to components/layout-shell.js as _MOBILE_TABS

    // _buildSheetContent — extracted to components/layout-shell.js (inlined in CartographerMobile/ObservatoryMobile)

    // _buildTabContent — extracted to components/layout-shell.js as TabContentBuilder


    function _renderStatsChip(){
                // Extracted to components/stats-panel.js as StatsChip
    }

    // _renderMobileTransportBar — extracted to components/transport-controls.js as MobileTransportBar

    // _renderBottomSheet — extracted to components/layout-shell.js as BottomSheet

    // renderMobileContextPanel — extracted to components/tools-panel.js as MobileContextPanel

    function renderMobileStatsBar(){
                var population = state.liveCells.size;
                var hist = state.popHistory;
                var trendArrow = '';
                if(hist.length >= 5){
                    var delta = hist[hist.length - 1] - hist[hist.length - 5];
                    trendArrow = delta > 2 ? ' \u25b2' : delta < -2 ? ' \u25bc' : ' \u223c';
                }
                var statusLabel = state.stable ? 'Stable' :
                                  (state.running ? 'Running' : 'Paused');
                var statusClass = state.stable ? 'status-stable' :
                                  (state.running ? 'status-running' : 'status-paused');
                var contextLabel = state.drawMode === 'preset' && state.selectedPattern
                    ? state.selectedPattern
                    : (state.drawMode === 'select' ? 'Select' : 'Draw');
                return (
                    <div className="mobile-stats-bar">
                        <span className="msb-left">
                            <span className="msb-title">{"Conway's Game of Life"}</span>
                            {'Gen\u00a0' + state.generations.toLocaleString()
                             + '\u2002Pop\u00a0' + population.toLocaleString() + trendArrow}
                        </span>
                        <span className={'status-indicator ' + statusClass}>{statusLabel}</span>
                        <span className="msb-right">{contextLabel}</span>
                    </div>
                );
    }

            // ── Horizontal toolbar (desktop/tablet only — hidden on mobile via CSS) ──
    function renderToolbar(){
                
                return (
                    <div className="toolbar-strip">
                        <span className="toolbar-title">{"Conway's\nGame of Life"}</span>
                        <div className="toolbar-groups">
                            <div className="toolbar-group">
                                <button type="button" className={"btn btn-toggle" + (state.running ? " active" : "")} onClick={function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }} title="Start or pause the simulation (Space)">{state.running ? "Pause" : "Play"}</button>
                                <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }} title="Advance one generation (Enter)"><i className="fa fa-step-forward" aria-hidden="true"></i> Step</button>
                                <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepBack(stateRef, refs, dispatch); }} title="Step backward to a previous generation (,)" disabled={refs.genHistory.length === 0}>Back</button>
                                <select className="toolbar-step-select" value={state.stepCount} onChange={function(e){ LifeBoardUtils.setStepCount(stateRef, refs, dispatch, e); }} title="Advance N generations at once (Shift+.)">
                                    <option value="1">+1</option>
                                    <option value="10">+10</option>
                                    <option value="50">+50</option>
                                    <option value="100">+100</option>
                                    <option value="500">+500</option>
                                </select>
                                <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount); }} title="Advance multiple generations (Shift+.)">Go</button>
                            </div>
                            <div className="toolbar-group">
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.resetGame(stateRef, refs, dispatch); }} title="Randomize the board (R)"><i className="fa fa-refresh" aria-hidden="true"></i> Reset</button>
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.emptyBoard(stateRef, refs, dispatch); }} title="Clear all cells (E)">Empty</button>
                                <button type="button" className="btn" onClick={function(){ LifeSimUtils.undo(stateRef, refs, dispatch); }} title="Undo last edit (Ctrl+Z)">Undo</button>
                            </div>
                            <div className="toolbar-group">
                                <button type="button" className="btn" onClick={function(){ LifeViewUtils.fitView(stateRef, refs, dispatch); }} title="Zoom to fit entire grid">Fit Grid</button>
                                <button type="button" className="btn" onClick={function(){ LifeViewUtils.fitLiveCells(stateRef, refs, dispatch); }} title="Zoom to fit live cells">Fit Cells</button>
                                <button type="button" className={"btn btn-toggle" + (state.gridLines ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch); }} title="Toggle grid lines (G)">Grid</button>
                                <button type="button" className={"btn btn-toggle" + (state.showTrails ? " active" : "")} onClick={function(){ toggleTrails(stateRef, refs, dispatch); }} title="Show ghost trails of recently-dead cells">Trails</button>
                                <button type="button" className={"btn btn-toggle" + (state.showMinimap ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch); }} title="Show/hide minimap overview (M)">Minimap</button>
                            </div>
                            <div className="toolbar-group">
                                <button type="button" className={"btn btn-toggle" + (state.drawMode === 'paint' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); }} title="Freehand draw mode (D)">Draw</button>
                                <button type="button" className={"btn btn-toggle" + (state.drawMode === 'preset' ? " active" : "")} onClick={function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); }} title="Place preset patterns (P)">Preset</button>
                                <button type="button" className={"btn btn-toggle" + (state.drawMode === 'select' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch); }} title="Select and move cells (S)">Select</button>
                                {state.boundary !== 'unbounded' && <button type="button" className={"btn btn-toggle" + (state.drawMode === 'region' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); }} title="Draw/erase region bounds (B)">Region</button>}
                                <button type="button" className={"btn btn-toggle" + (state.livePaintMode ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch); }} title="Paint cells while the simulation is running">Live Paint</button>
                                <button type="button" className={"btn btn-toggle" + (state.boundary !== 'toroidal' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch); }} title="Cycle boundary: Wrap → Hard → Infinite">{state.boundary === 'toroidal' ? "Wrap" : state.boundary === 'finite' ? "Hard" : "\u221E"}</button>
                            </div>
                            <div className="toolbar-group">
                                <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch); }} disabled={state.analyzing} title="Detect oscillator period or spaceship velocity">Analyze</button>
                            </div>
                        </div>
                    </div>
                );
    }


    // renderDisplaySettings — extracted to components/settings-panels.js as DisplaySettings

    // renderRulesSection — extracted to components/rules-export.js as RulesSection

    // renderBoardSliders — extracted to components/settings-panels.js as BoardSliders

    // renderSpeedSlider — extracted to components/settings-panels.js as SpeedSlider

    // renderZoomSlider — extracted to components/settings-panels.js as ZoomSlider

    // renderRLESection — extracted to components/rules-export.js as RLESection

            // ── Shared sub-components (used by all layout modes) ───────────

    // renderCanvas — extracted to components/canvas-area.js as CanvasArea

    // renderTransportControls — extracted to components/transport-controls.js as TransportControls

    // renderViewControls — extracted to components/settings-panels.js as ViewControls

    // renderBoundaryControls — extracted to components/settings-panels.js as BoundaryControls

    // renderModeControls — extracted to components/tools-panel.js as ModeControls

    // renderToolsContent — extracted to components/tools-panel.js as ToolsContent

    // renderExportContent — extracted to components/rules-export.js as ExportContent

    // renderLayoutSwitcher — extracted to components/layout-shell.js as LayoutSwitcher

    // renderCartographer — extracted to components/layout-shell.js as CartographerLayout
    // renderCartographerMobile — extracted to components/layout-shell.js as CartographerMobile
    // renderObservatory — extracted to components/layout-shell.js as ObservatoryLayout
    // renderObservatoryMobile — extracted to components/layout-shell.js as ObservatoryMobile

    // _renderFloatPanel — extracted to components/observatory-panels.js as FloatPanel
    // _renderCompactBody — extracted to components/observatory-panels.js as CompactBody
    // _getCompactDefs — extracted to components/observatory-panels.js as ObservatoryPanelUtils.getCompactDefs
    // _getPanelLabel — extracted to components/observatory-panels.js as ObservatoryPanelUtils.getPanelLabel
    // _getPanelIcon — extracted to components/observatory-panels.js as ObservatoryPanelUtils.getPanelIcon
    // _getPanelContent — extracted to components/observatory-panels.js as ObservatoryPanelUtils.getPanelContent
    // _checkTabBarOverflow, _observeTabBars — extracted to components/observatory-panels.js
    // _renderPanelGroup — extracted to components/observatory-panels.js as PanelGroup
    // _renderFloatPanelDirect — extracted to components/observatory-panels.js as FloatPanelDirect
    // _startGroupDrag, _startTabDrag, _startGroupResize — extracted to components/observatory-panels.js
    // _startPanelDrag — extracted to components/observatory-panels.js
    // _updateDropIndicator, _clearDropIndicator, _rectsOverlap, _findDropTarget — extracted to components/observatory-panels.js
    // _startPanelResize — extracted to components/observatory-panels.js
    // _togglePanelOpen — extracted to components/observatory-panels.js as ObservatoryPanelUtils.togglePanelOpen
    // _togglePanelCollapse — extracted to components/observatory-panels.js as ObservatoryPanelUtils.togglePanelCollapse

    // ── Main render ───────────────────────────────────────────────────

    var cs = LifeViewUtils.getCanvasSize(stateRef, refs);
    var layout = state.layoutMode;
    var dc = state.deviceClass;
    var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
    if(isMobile){ layout = 'observatory'; }
    var layoutContent;

    switch(layout){
        case 'observatory':
            layoutContent = <ObservatoryLayout cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
            break;
        default:
            layoutContent = <CartographerLayout cs={cs} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />;
    }

    return (
        <div className={"app-root layout-" + layout} role="application"
            aria-label="Conway's Game of Life">
            <a className="skip-to-content" href="#life-canvas">Skip to simulation</a>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {state.srAnnouncement}
            </div>
            <HelpModal showHelp={state.showHelp} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            <PopGraphModal showPopGraph={state.showPopGraph} popHistory={state.popHistory} stateRef={stateRef} refs={refs} dispatch={dispatch} />
            {layoutContent}
        </div>
    );
} // end LifeBoard

var root = ReactDOM.createRoot(document.getElementById("content"));
root.render(<div><LifeBoard/></div>);
});
