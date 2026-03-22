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
                        importExport: { open: true, x: -1, y: -1, collapsed: false, z: 0, compact: false }
                    },
                    panelZCounter :    savedLayout.panelZCounter || 1,
                    panelGroups :      savedLayout.panelGroups || [{
                        id: 'g-default', panels: ['transport','view','mode','tools','board','rules','stats','importExport'],
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
            mounted: false, canvas: null, minimapCanvas: document.createElement('canvas'), previewCanvas: null,
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
                // Render loop: consume drawPending flag each frame.
                (function renderLoop(){
                    refs.rafId = requestAnimationFrame(function(){
                        try {
                            if(refs.drawPending){
                                refs.drawPending = false;
                                drawBoard(stateRef, refs);
                                var s = stateRef.current;
                                if(refs.mobileMinimap){
                                    drawMinimapMobile(stateRef, refs, s.liveCells, s.cols, s.rows, s.viewX, s.viewY, s.cellSize, THEMES[s.theme] || THEMES['Teal']);
                                }
                            }
                        } catch(e){ /* prevent loop death */ }
                        if(refs.mounted){ renderLoop(); }
                    });
                })();
                LifeIOUtils._loadFromURLHash(stateRef, refs, dispatch);
                LifeSimUtils._startLoop(stateRef, refs, dispatch);
                ObservatoryPanelUtils._observeTabBars(stateRef, refs, dispatch);

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
            ObservatoryPanelUtils._observeTabBars(stateRef, refs, dispatch);
        }
        prevSelectedPattern.current = state.selectedPattern;
        prevPatternRotation.current = state.patternRotation;
        prevBottomSheetOpen.current = state.bottomSheetOpen;
        prevBottomSheetTab.current = state.bottomSheetTab;
        prevLayoutMode.current = state.layoutMode;
        prevPanelGroups.current = state.panelGroups;
    });

            // ── Rendering ─────────────────────────────────────────────────────

    // ── Main render ───────────────────────────────────────────────────

    var cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
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
