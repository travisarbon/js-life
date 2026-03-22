/* global HashLife, SimRunner, CanvasRenderer, InputHandler, RegionUtil,
          PATTERN_GROUPS, PATTERNS, PATTERN_META, SimEngine, parseKey,
          RULE_PRESETS, SPEED_DELAYS, THEMES,
          LifeSimUtils, LifeIOUtils, LifeInputUtils, LifeViewUtils,
          LifeBoardUtils, LifeAnalysisUtils */
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
                _observeTabBars(stateRef, refs);

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
            _observeTabBars(stateRef, refs);
        }
        prevSelectedPattern.current = state.selectedPattern;
        prevPatternRotation.current = state.patternRotation;
        prevBottomSheetOpen.current = state.bottomSheetOpen;
        prevBottomSheetTab.current = state.bottomSheetTab;
        prevLayoutMode.current = state.layoutMode;
        prevPanelGroups.current = state.panelGroups;
    });

            // ── Rendering ─────────────────────────────────────────────────────

    function drawBoard(){
                var canvas = refs.canvas;
                if(!canvas){ return; }
                var ctx = canvas.getContext("2d");
                if(!ctx){ return; }
                var cellSize = state.cellSize;
                var cols = state.cols;
                var rows = state.rows;
                var viewX = state.viewX;
                var viewY = state.viewY;
                var canvasW = canvas.width;
                var canvasH = canvas.height;
                var theme = THEMES[state.theme] || THEMES['Teal'];
                var liveCells = state.liveCells;
                var isUnbounded = state.boundary === 'unbounded';

                // Visible cell range.
                var startC = viewX, startR = viewY;
                var endC = viewX + Math.ceil(canvasW / cellSize) + 1;
                var endR = viewY + Math.ceil(canvasH / cellSize) + 1;

                // Clear canvas.
                // In bounded mode, pre-darken the entire canvas so that out-of-region
                // areas are uniformly dimmed with no edge gaps.  Region cells are then
                // restored to the clean bg before cells/trails/grid are drawn.
                ctx.fillStyle = theme.bg;
                ctx.fillRect(0, 0, canvasW, canvasH);
                if(!isUnbounded && state.regionMask && state.regionMask.size > 0){
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    ctx.fillRect(0, 0, canvasW, canvasH);
                    // Restore clean bg for in-region cells.
                    CanvasRenderer.clearRegionCells(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
                }

                // Palette.
                var palettes = CanvasRenderer._ensurePalette(theme, state.theme);

                // Cells.
                CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

                // Trails.
                if(refs.trailEnabled && refs.trailMap && refs.trailMap.size > 0){
                    CanvasRenderer.drawTrails(ctx, refs.trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.trail);
                }

                // Grid.
                if(state.gridLines){
                    CanvasRenderer.drawGrid(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme.grid);
                }

                // Region overlay (replaces single bounding box).
                if(!isUnbounded){
                    CanvasRenderer.drawRegionOverlay(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme, state.boundary);
                }

                // Selection.
                CanvasRenderer.drawSelection(ctx, state.selection, viewX, viewY, cellSize, theme);

                // Tool preview (paint mode).
                CanvasRenderer.drawToolPreview(ctx, InputHandler._drawPreviewCells, InputHandler._drawErasing, viewX, viewY, cellSize, theme);

                // Region tool preview.
                if(state.drawMode === 'region'){
                    // Show rubber-band shape preview.
                    if(InputHandler._regionPreviewKeys.length > 0){
                        CanvasRenderer.drawRegionPreview(ctx, InputHandler._regionPreviewKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
                    }
                    // Show cell-by-cell painting preview.
                    if(InputHandler._regionDragging){
                        var rgPainted = InputHandler._regionPaintedKeys;
                        var rgKeys = Object.keys(rgPainted);
                        if(rgKeys.length > 0){
                            CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
                        }
                    }
                }

                // Pattern preview.
                if(state.drawMode === 'preset'){
                    var previewMask = (!isUnbounded && state.regionMask && state.regionMask.size > 0) ? state.regionMask : null;
                    CanvasRenderer.drawPatternPreview(ctx, state.selectedPattern, state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme, previewMask);
                }

                // Minimap overlay (bottom-right corner on large desktop; separate element elsewhere).
                var useMobileMinimap = state.deviceClass === 'phone-portrait' ||
                    state.deviceClass === 'phone-landscape' ||
                    state.deviceClass === 'tablet' ||
                    (typeof window !== 'undefined' && window.innerWidth <= 1200);
                if(state.showMinimap && (isUnbounded || (cols > 0 && rows > 0))){
                    if(useMobileMinimap){
                        drawMinimapMobile(liveCells, cols, rows, viewX, viewY, cellSize, theme);
                        refs.minimapRect = null;
                    } else {
                        // Compute scale from actual canvas element for accuracy.
                        var mmDisplayScale = 1;
                        if(canvas.style.width){
                            var cssW = parseFloat(canvas.style.width);
                            if(cssW > 0 && canvasW > 0){ mmDisplayScale = cssW / canvasW; }
                        }
                        drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, mmDisplayScale);
                    }
                }

                // GIF recording: capture frame.
                if(state.recording && refs.gif){
                    refs.gif.addFrame(ctx, {copy: true, delay: SPEED_DELAYS[state.speed - 1] || 50});
                }
    }

    function drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale){
                // Derive minimap world region.
                // For all modes on the infinite canvas, show the bounding box area
                // expanded to include any live cells outside and the current viewport.
                var isUnbounded = state.boundary === 'unbounded';
                var mmOriginR = 0, mmOriginC = 0;
                // regionBounds and regionComponents used instead of mmBBCols/mmBBRows
                if(isUnbounded){
                    var bb = SimEngine.getBoundingBox(liveCells);
                    if(bb){
                        var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        var newMinR = bb.minR - pad, newMinC = bb.minC - pad;
                        var newMaxR = bb.maxR + pad, newMaxC = bb.maxC + pad;
                        // Hysteresis: only expand, never shrink (prevents flashing).
                        var prev = refs.mmUnboundedRegion;
                        if(prev){
                            newMinR = Math.min(prev.minR, newMinR);
                            newMinC = Math.min(prev.minC, newMinC);
                            newMaxR = Math.max(prev.maxR, newMaxR);
                            newMaxC = Math.max(prev.maxC, newMaxC);
                        }
                        refs.mmUnboundedRegion = {minR: newMinR, minC: newMinC, maxR: newMaxR, maxC: newMaxC};
                        mmOriginR = newMinR;
                        mmOriginC = newMinC;
                        rows = newMaxR - newMinR + 1;
                        cols = newMaxC - newMinC + 1;
                    } else {
                        mmOriginR = viewY - 50;
                        mmOriginC = viewX - 50;
                        rows = 100; cols = 100;
                        refs.mmUnboundedRegion = null;
                    }
                } else {
                    // Bounded modes: fixed world region = region bounds + live cells + static padding.
                    // Does NOT expand to follow viewport — arrow indicators show off-screen viewport.
                    var rb = state.regionBounds;
                    var mmMinR = rb ? rb.minR : 0;
                    var mmMinC = rb ? rb.minC : 0;
                    var mmMaxR = rb ? rb.maxR + 1 : rows;
                    var mmMaxC = rb ? rb.maxC + 1 : cols;
                    var bbLive = SimEngine.getBoundingBox(liveCells);
                    if(bbLive){
                        mmMinR = Math.min(mmMinR, bbLive.minR);
                        mmMinC = Math.min(mmMinC, bbLive.minC);
                        mmMaxR = Math.max(mmMaxR, bbLive.maxR + 1);
                        mmMaxC = Math.max(mmMaxC, bbLive.maxC + 1);
                    }
                    var pad2 = Math.max(5, Math.round(Math.max(mmMaxR - mmMinR, mmMaxC - mmMinC) * 0.1));
                    mmOriginR = mmMinR - pad2;
                    mmOriginC = mmMinC - pad2;
                    rows = mmMaxR - mmMinR + pad2 * 2;
                    cols = mmMaxC - mmMinC + pad2 * 2;
                }
                // Target a fixed CSS display size of ~160px for the minimap.
                // The buffer size is inversely proportional to displayScale so the CSS display size stays constant.
                var TARGET_CSS_SIZE = 160;
                var ds = (displayScale && displayScale > 0) ? displayScale : 1;
                var aspect = cols / rows;
                // Cap buffer dimensions so the minimap never exceeds 1/3 of the canvas.
                var maxMmW = Math.floor(canvasW / 3);
                var maxMmH = Math.floor(canvasH / 3);
                var mmW, mmH;
                if(aspect >= 1){
                    mmW = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmW);
                    mmH = Math.min(Math.max(40, Math.round(mmW / aspect)), maxMmH);
                } else {
                    mmH = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmH);
                    mmW = Math.min(Math.max(40, Math.round(mmH * aspect)), maxMmW);
                }
                // Resize the off-screen canvas if dimensions changed.
                if(refs.minimapCanvas.width !== mmW || refs.minimapCanvas.height !== mmH){
                    refs.minimapCanvas.width  = mmW;
                    refs.minimapCanvas.height = mmH;
                    refs.minimapDirty = true;
                }
                // Express the margin in CSS-space pixels by scaling by 1/ds,
                // so the visual gap from the canvas corner stays ~6px at all zoom levels.
                var marginBuf = Math.max(1, Math.round(6 / ds));
                // In Cartographer mode, offset minimap upward to clear the fixed transport strip.
                var isMobileView2 = state.deviceClass === 'phone-portrait' || state.deviceClass === 'phone-landscape';
                var transportPad = (state.layoutMode === 'cartographer' && !isMobileView2) ? Math.round(60 / ds) : 0;
                // In Cartographer, place minimap on the opposite side from the rail.
                var mmOnLeft = (state.layoutMode === 'cartographer' && state.railSide === 'right');
                var mmX = mmOnLeft ? marginBuf : (canvasW - mmW - marginBuf);
                var mmY = canvasH - mmH - marginBuf - transportPad;

                // Redraw minimap off-screen canvas only when marked dirty.
                if(refs.minimapDirty){
                    var mc = refs.minimapCanvas;
                    var mctx = mc.getContext('2d');
                    mctx.clearRect(0, 0, mmW, mmH);
                    // Background.
                    mctx.fillStyle = 'rgba(10,14,26,0.85)';
                    mctx.fillRect(0, 0, mmW, mmH);
                    // Draw all live cells as 1-px dots.
                    mctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
                    var _mmOC = mmOriginC, _mmOR = mmOriginR, _mmCols = cols, _mmRows = rows;
                    liveCells.forEach(function(age, key){
                        var _rc = parseKey(key), kr = _rc[0] - _mmOR, kc = _rc[1] - _mmOC;
                        if(kr >= 0 && kr < _mmRows && kc >= 0 && kc < _mmCols){
                            mctx.fillRect(Math.floor(kc / _mmCols * mmW), Math.floor(kr / _mmRows * mmH), 1, 1);
                        }
                    });
                    // Region indicator on minimap (bounded modes only).
                    if(!isUnbounded && state.regionMask){
                        var _regionMask = state.regionMask;
                        mctx.fillStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.12)';
                        _regionMask.forEach(function(key){
                            var _i = key.indexOf(',');
                            var _rr = parseInt(key.substring(0, _i), 10) - _mmOR;
                            var _cc = parseInt(key.substring(_i + 1), 10) - _mmOC;
                            if(_rr >= 0 && _rr < _mmRows && _cc >= 0 && _cc < _mmCols){
                                mctx.fillRect(Math.floor(_cc / _mmCols * mmW), Math.floor(_rr / _mmRows * mmH), 1, 1);
                            }
                        });
                        // Draw component bounding rects as dashed outlines.
                        var _comps = state.regionComponents;
                        if(_comps && _comps.length > 0){
                            mctx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
                            mctx.lineWidth = 1;
                            mctx.setLineDash([3, 2]);
                            for(var _ci = 0; _ci < _comps.length; _ci++){
                                var _comp = _comps[_ci];
                                var _cx = Math.round((_comp.minC - _mmOC) / _mmCols * mmW);
                                var _cy = Math.round((_comp.minR - _mmOR) / _mmRows * mmH);
                                var _cw = Math.round((_comp.maxC - _comp.minC + 1) / _mmCols * mmW);
                                var _ch = Math.round((_comp.maxR - _comp.minR + 1) / _mmRows * mmH);
                                mctx.strokeRect(_cx + 0.5, _cy + 0.5, _cw, _ch);
                            }
                            mctx.setLineDash([]);
                        }
                    }
                    // Border.
                    mctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    mctx.lineWidth = 1;
                    mctx.strokeRect(0.5, 0.5, mmW - 1, mmH - 1);
                    refs.minimapDirty = false;
                }

                // Blit minimap to main canvas.
                ctx.drawImage(refs.minimapCanvas, mmX, mmY);

                // Viewport rectangle.
                var visCols = Math.ceil(canvasW / cellSize);
                var visRows = Math.ceil(canvasH / cellSize);
                var vx1 = mmX + Math.round((viewX - mmOriginC) / cols * mmW);
                var vy1 = mmY + Math.round((viewY - mmOriginR) / rows * mmH);
                var vw  = Math.max(2, Math.round(visCols / cols * mmW));
                var vh  = Math.max(2, Math.round(visRows / rows * mmH));
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1;
                var clampX = Math.max(vx1, mmX);
                var clampY = Math.max(vy1, mmY);
                var clampR = Math.min(vx1 + vw, mmX + mmW);
                var clampB = Math.min(vy1 + vh, mmY + mmH);
                if(clampR > clampX && clampB > clampY){
                    ctx.strokeRect(clampX + 0.5, clampY + 0.5, clampR - clampX, clampB - clampY);
                }

                // Off-screen viewport indicator arrow (when viewport is outside minimap world region).
                var vpCenterC = viewX + visCols / 2;
                var vpCenterR = viewY + visRows / 2;
                var vpOutside = vpCenterC < mmOriginC || vpCenterC > mmOriginC + cols ||
                                vpCenterR < mmOriginR || vpCenterR > mmOriginR + rows;
                if(vpOutside){
                    var mmCenterC = mmOriginC + cols / 2;
                    var mmCenterR = mmOriginR + rows / 2;
                    var arrowAngle = Math.atan2(vpCenterR - mmCenterR, vpCenterC - mmCenterC);
                    // Position arrow on minimap border
                    var arrowPx = mmX + mmW / 2 + Math.cos(arrowAngle) * (mmW / 2 - 8);
                    var arrowPy = mmY + mmH / 2 + Math.sin(arrowAngle) * (mmH / 2 - 8);
                    arrowPx = Math.max(mmX + 6, Math.min(mmX + mmW - 6, arrowPx));
                    arrowPy = Math.max(mmY + 6, Math.min(mmY + mmH - 6, arrowPy));
                    ctx.save();
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.translate(arrowPx, arrowPy);
                    ctx.rotate(arrowAngle);
                    ctx.beginPath();
                    ctx.moveTo(6, 0);
                    ctx.lineTo(-3, -4);
                    ctx.lineTo(-3, 4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                // Store minimap rect for click detection (include world origin/dims for coordinate mapping).
                refs.minimapRect = {x: mmX, y: mmY, w: mmW, h: mmH, originC: mmOriginC, originR: mmOriginR, worldCols: cols, worldRows: rows};
    }

    function drawRotationPreview(){
                var theme = THEMES[state.theme] || THEMES['Teal'];
                CanvasRenderer.drawRotationPreview(refs.previewCanvas, state.selectedPattern, state.patternRotation, theme);
    }

            // ── Methods delegated to mixins ──────────────────────────────────
            // LifeSimUtils: simulation loop, undo/redo, stepping
            // LifeIOUtils: file import/export, URL sharing, RLE
            // LifeInputUtils: mouse, touch, keyboard, shortcuts
            // LifeViewUtils: viewport, layout, panels, bottom sheet
            // LifeBoardUtils: board config, drawing modes, selection, patterns
            // LifeAnalysisUtils: pattern analysis, recording, help

    function toggleTrails(){
                var newVal = !state.showTrails;
                refs.trailEnabled = newVal;
                if(!newVal){ refs.trailMap = new Map(); }
                
                dispatch({type:"MERGE", payload:{showTrails: newVal}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
    }

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

    function renderMobileMinimapArea(){
                if(!state.showMinimap || refs.minimapHidden){ return null; }
                
                return (
                    <div className="mobile-minimap-area">
                        <canvas className="mobile-minimap-canvas"
                            ref={function(c){ refs.mobileMinimap = c; }}
                            role="img" aria-label="Minimap navigation"
                            onMouseDown={function(e){ onMinimapElementDown(e, stateRef, refs, dispatch); }}
                            onMouseMove={function(e){ onMinimapElementMove(e, stateRef, refs, dispatch); }}
                            onTouchStart={function(e){ onMinimapElementDown(e, stateRef, refs, dispatch); }}
                            onTouchMove={function(e){ onMinimapElementMove(e, stateRef, refs, dispatch); }}
                            onMouseUp={function(){ onMinimapElementUp(stateRef, refs); }}
                            onTouchEnd={function(){ onMinimapElementUp(stateRef, refs); }} />
                    </div>
                );
    }

    function onMinimapElementDown(e){
                e.preventDefault();
                refs.mmElemDragging = true;
                panMinimapElement(e, state, stateRef, refs, dispatch);
    }

    function onMinimapElementMove(e){
                if(!refs.mmElemDragging){ return; }
                e.preventDefault();
                panMinimapElement(e, state, stateRef, refs, dispatch);
    }

    function onMinimapElementUp(){
                refs.mmElemDragging = false;
    }

    function panMinimapElement(e){
                if(!refs.mobileMinimap){ return; }
                var rect = refs.mobileMinimap.getBoundingClientRect();
                var clientX = e.touches ? e.touches[0].clientX : e.clientX;
                var clientY = e.touches ? e.touches[0].clientY : e.clientY;
                var frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                var frac_r = Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height));
                // Use stored world dims from last minimap render for accurate panning.
                var mmWorld = refs.mmMobileWorld;
                var mmCols = mmWorld ? mmWorld.cols : state.cols;
                var mmRows = mmWorld ? mmWorld.rows : state.rows;
                var mmOC = mmWorld ? mmWorld.originC : 0;
                var mmOR = mmWorld ? mmWorld.originR : 0;
                var newVX = Math.round(frac_c * mmCols + mmOC - (refs.canvas.width  / state.cellSize) / 2);
                var newVY = Math.round(frac_r * mmRows + mmOR - (refs.canvas.height / state.cellSize) / 2);
                var clamped = LifeViewUtils.clampView(stateRef, refs, newVX, newVY, state.cols, state.rows, state.cellSize);
                
                dispatch({type:"MERGE", payload:{viewX: clamped.viewX, viewY: clamped.viewY}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
    }

    function drawMinimapMobile(liveCells, cols, rows, viewX, viewY, cellSize, theme){
                if(!refs.mobileMinimap){ return; }
                var isUnbounded = state.boundary === 'unbounded';
                var mmMobOriginR = 0, mmMobOriginC = 0;
                var mmRegionRows, mmRegionCols;
                // regionBounds used for mobile minimap bounding indicator
                if(isUnbounded){
                    var bb = SimEngine.getBoundingBox(liveCells);
                    if(bb){
                        var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        var newMinR = bb.minR - pad, newMinC = bb.minC - pad;
                        var newMaxR = bb.maxR + pad, newMaxC = bb.maxC + pad;
                        // Hysteresis: only expand, never shrink (prevents flashing).
                        var prev = refs.mmUnboundedRegion;
                        if(prev){
                            newMinR = Math.min(prev.minR, newMinR);
                            newMinC = Math.min(prev.minC, newMinC);
                            newMaxR = Math.max(prev.maxR, newMaxR);
                            newMaxC = Math.max(prev.maxC, newMaxC);
                        }
                        refs.mmUnboundedRegion = {minR: newMinR, minC: newMinC, maxR: newMaxR, maxC: newMaxC};
                        mmMobOriginR = newMinR;
                        mmMobOriginC = newMinC;
                        mmRegionRows = newMaxR - newMinR + 1;
                        mmRegionCols = newMaxC - newMinC + 1;
                    } else {
                        mmMobOriginR = viewY - 50; mmMobOriginC = viewX - 50;
                        mmRegionRows = 100; mmRegionCols = 100;
                    }
                } else {
                    // Bounded modes: fixed world region = region bounds + live cells + static padding.
                    var rbm = state.regionBounds;
                    var mmMR = rbm ? rbm.minR : 0;
                    var mmMC = rbm ? rbm.minC : 0;
                    var mmMXR = rbm ? rbm.maxR + 1 : rows;
                    var mmMXC = rbm ? rbm.maxC + 1 : cols;
                    var bbMob = SimEngine.getBoundingBox(liveCells);
                    if(bbMob){
                        mmMR = Math.min(mmMR, bbMob.minR);
                        mmMC = Math.min(mmMC, bbMob.minC);
                        mmMXR = Math.max(mmMXR, bbMob.maxR + 1);
                        mmMXC = Math.max(mmMXC, bbMob.maxC + 1);
                    }
                    var pad2m = Math.max(5, Math.round(Math.max(mmMXR - mmMR, mmMXC - mmMC) * 0.1));
                    mmMobOriginR = mmMR - pad2m;
                    mmMobOriginC = mmMC - pad2m;
                    mmRegionRows = mmMXR - mmMR + pad2m * 2;
                    mmRegionCols = mmMXC - mmMC + pad2m * 2;
                }
                var MOBILE_MM_CSS_W = Math.min(120, Math.round(window.innerWidth * 0.3));
                var mmAspect = mmRegionCols / Math.max(1, mmRegionRows);
                var mmH_css = Math.round(MOBILE_MM_CSS_W / mmAspect);
                var mmW_css = MOBILE_MM_CSS_W;

                // Resize off-screen buffer if needed
                if(refs.minimapCanvas.width !== mmW_css || refs.minimapCanvas.height !== mmH_css){
                    refs.minimapCanvas.width  = mmW_css;
                    refs.minimapCanvas.height = mmH_css;
                }

                // Render minimap cells to off-screen canvas using actual theme colors.
                var mmCtx = refs.minimapCanvas.getContext('2d');
                // Dark background for contrast (same approach as desktop drawMinimap).
                mmCtx.fillStyle = 'rgba(10,14,26,0.85)';
                mmCtx.fillRect(0, 0, mmW_css, mmH_css);

                var cellW = mmW_css / mmRegionCols;
                var cellH = mmH_css / mmRegionRows;
                mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';

                var _mmMOR = mmMobOriginR, _mmMOC = mmMobOriginC, _mmMCols = mmRegionCols, _mmMRows = mmRegionRows;
                liveCells.forEach(function(_, key){
                    var rc = parseKey(key);
                    var kr = rc[0] - _mmMOR;
                    var kc = rc[1] - _mmMOC;
                    if(kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
                    var px = Math.floor(kc * cellW);
                    var py = Math.floor(kr * cellH);
                    var pw = Math.max(1, Math.ceil(cellW));
                    var ph = Math.max(1, Math.ceil(cellH));
                    mmCtx.fillRect(px, py, pw, ph);
                });

                // Region indicator on mobile minimap (bounded modes only).
                if(!isUnbounded && state.regionComponents){
                    var _compsM = state.regionComponents;
                    if(_compsM.length > 0){
                        mmCtx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
                        mmCtx.lineWidth = 1;
                        mmCtx.setLineDash([3, 2]);
                        for(var _ciM = 0; _ciM < _compsM.length; _ciM++){
                            var _compM = _compsM[_ciM];
                            var _cxM = Math.round((_compM.minC - mmMobOriginC) * cellW);
                            var _cyM = Math.round((_compM.minR - mmMobOriginR) * cellH);
                            var _cwM = Math.round((_compM.maxC - _compM.minC + 1) * cellW);
                            var _chM = Math.round((_compM.maxR - _compM.minR + 1) * cellH);
                            mmCtx.strokeRect(_cxM + 0.5, _cyM + 0.5, _cwM, _chM);
                        }
                        mmCtx.setLineDash([]);
                    }
                }

                // Border.
                mmCtx.strokeStyle = 'rgba(255,255,255,0.2)';
                mmCtx.lineWidth = 1;
                mmCtx.strokeRect(0.5, 0.5, mmW_css - 1, mmH_css - 1);

                // Viewport rectangle.
                var vpVisColsM = refs.canvas ? refs.canvas.width / cellSize : 100;
                var vpVisRowsM = refs.canvas ? refs.canvas.height / cellSize : 100;
                var vpW = vpVisColsM * cellW;
                var vpH = vpVisRowsM * cellH;
                var vpX = (viewX - mmMobOriginC) * cellW;
                var vpY = (viewY - mmMobOriginR) * cellH;
                // Only draw viewport rect if it overlaps the minimap area.
                var vpClampX = Math.max(0, vpX), vpClampY = Math.max(0, vpY);
                var vpClampR = Math.min(mmW_css, vpX + vpW), vpClampB = Math.min(mmH_css, vpY + vpH);
                if(vpClampR > vpClampX && vpClampB > vpClampY){
                    mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
                    mmCtx.lineWidth = 1;
                    mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
                }

                // Off-screen viewport indicator arrow.
                var vpCenterCm = viewX + vpVisColsM / 2;
                var vpCenterRm = viewY + vpVisRowsM / 2;
                var vpOutsideM = vpCenterCm < mmMobOriginC || vpCenterCm > mmMobOriginC + mmRegionCols ||
                                 vpCenterRm < mmMobOriginR || vpCenterRm > mmMobOriginR + mmRegionRows;
                if(vpOutsideM){
                    var mmCCm = mmMobOriginC + mmRegionCols / 2, mmCRm = mmMobOriginR + mmRegionRows / 2;
                    var aaM = Math.atan2(vpCenterRm - mmCRm, vpCenterCm - mmCCm);
                    var apxM = mmW_css / 2 + Math.cos(aaM) * (mmW_css / 2 - 8);
                    var apyM = mmH_css / 2 + Math.sin(aaM) * (mmH_css / 2 - 8);
                    apxM = Math.max(6, Math.min(mmW_css - 6, apxM));
                    apyM = Math.max(6, Math.min(mmH_css - 6, apyM));
                    mmCtx.save();
                    mmCtx.fillStyle = 'rgba(255,255,255,0.85)';
                    mmCtx.translate(apxM, apyM);
                    mmCtx.rotate(aaM);
                    mmCtx.beginPath();
                    mmCtx.moveTo(6, 0);
                    mmCtx.lineTo(-3, -4);
                    mmCtx.lineTo(-3, 4);
                    mmCtx.closePath();
                    mmCtx.fill();
                    mmCtx.restore();
                }

                // Resize HTML canvas if needed and blit
                if(refs.mobileMinimap.width !== mmW_css || refs.mobileMinimap.height !== mmH_css){
                    refs.mobileMinimap.width  = mmW_css;
                    refs.mobileMinimap.height = mmH_css;
                }
                var mobileCtx = refs.mobileMinimap.getContext('2d');
                mobileCtx.drawImage(refs.minimapCanvas, 0, 0);
                // Store world dims for mobile minimap panning.
                refs.mmMobileWorld = {originC: mmMobOriginC, originR: mmMobOriginR, cols: mmRegionCols, rows: mmRegionRows};
    }

    function renderStats(){
                // Extracted to components/stats-panel.js as StatsPanel
    }

            // ── Shared mobile sub-components (R10) ─────────────────────────────
            // Extracted from 3 duplicated mobile render methods.

    var _MOBILE_TABS = [
                {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
                {id: 'board',    icon: 'fa-th-large',  label: 'Board'},
                {id: 'view',     icon: 'fa-eye',      label: 'View'},
                {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
                {id: 'rules',    icon: 'fa-cogs',     label: 'Rules'},
                {id: 'export',   icon: 'fa-exchange',  label: 'Share'}
    ];

    function _buildSheetContent(){
                if(!state.bottomSheetOpen){ return null; }
                return _buildTabContent(state.bottomSheetTab, {sectionTitle: true, sparkline: true}, state, stateRef, refs, dispatch);
    }

            // Shared tab content builder used by mobile sheet, desktop rail, and context tray.
    function _buildTabContent(tabId, options){
                options = options || {};
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
                                {<ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />}
                                {<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                                {<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                            </div>
                        );
                    case 'tools':
                        return (
                            <div>
                                {options.sectionTitle && <div className="sidebar-section-title">Tools</div>}
                                {renderModeControls(state, stateRef, refs, dispatch)}
                                {renderToolsContent(state, stateRef, refs, dispatch)}
                            </div>
                        );
                    case 'rules':  return renderRulesSection(state, stateRef, refs, dispatch);
                    case 'export': return renderExportContent(state, stateRef, refs, dispatch);
                    default:       return null;
                }
    }


    function _renderStatsChip(){
                // Extracted to components/stats-panel.js as StatsChip
    }

    // _renderMobileTransportBar — extracted to components/transport-controls.js as MobileTransportBar

    function _renderBottomSheet(sheetContent){
                
                var tabs = refs.MOBILE_TABS;
                var layoutSwitcher = renderLayoutSwitcher(state, stateRef, refs, dispatch);
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
                                    var isActive = state.bottomSheetTab === tab.id;
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
                                    <div style={{padding:'8px 12px 0', borderTop:'1px solid var(--panel-border)'}}>
                                        {layoutSwitcher}
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                );
    }

    function renderMobileContextPanel(){
                
                var showRotation = state.drawMode === 'preset' && state.selectedPattern;
                var showSelection = state.selection !== null;
                if(!showRotation && !showSelection){ return null; }
                return (
                    <div className="mobile-context-panel">
                        {showRotation &&
                            <div className="rotation-btns">
                                <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }}
                                    title="Rotate 90° counter-clockwise"><i className="fa fa-undo" aria-hidden="true"></i></button>
                                <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }}
                                    title="Rotate 90° clockwise"><i className="fa fa-repeat" aria-hidden="true"></i></button>
                                <button type="button" className="btn" onClick={function(){
                                    InputHandler._previewPos = null;
                                    dispatch({type:"MERGE", payload:{selectedPattern: null, patternRotation: 0, drawMode: "paint"}});
                                        setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                }} aria-label="Cancel pattern placement" title="Cancel placement">
                                    <i className="fa fa-times" aria-hidden="true"></i>
                                </button>
                            </div>
                        }
                        {showSelection &&
                            <div className="buttons buttons-selection">
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.copySelection(stateRef, refs, dispatch); }}
                                    disabled={!state.selection} title="Copy selected cells" aria-label="Copy selected cells">Copy</button>
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch); }}
                                    disabled={!state.clipboard || state.clipboard.length === 0} title="Paste copied cells" aria-label="Paste copied cells">Paste</button>
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.deleteSelection(stateRef, refs, dispatch); }}
                                    disabled={!state.selection} title="Delete selected cells" aria-label="Delete selected cells">Delete</button>
                                <button type="button" className="btn" onClick={function(){
                                    dispatch({type:"MERGE", payload:{selection: null}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                }} title="Clear selection" aria-label="Clear selection">
                                    <i className="fa fa-times" aria-hidden="true"></i>
                                </button>
                            </div>
                        }
                    </div>
                );
    }

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

    function renderCanvas(cs){
                
                return (
                    <div className="app-canvas-container">
                        <canvas className="display"
                            ref    = {function(c){ refs.canvas = c; }}
                            width  = {cs.w}
                            height = {cs.h}
                            style  = {{width: cs.displayW + 'px', height: cs.displayH + 'px', display: 'block', margin: '0 auto'}}
                            id = "life-canvas"
                            role = "application"
                            aria-roledescription = "Game of Life grid"
                            aria-label = "Conway's Game of Life simulation canvas"
                            draggable     = {false}
                            onMouseDown   = {function(e){ LifeInputUtils.onMouseDown(stateRef, refs, dispatch, e); }}
                            onMouseMove   = {function(e){ LifeInputUtils.onMouseMove(stateRef, refs, dispatch, e); }}
                            onMouseUp     = {function(e){ LifeInputUtils.onMouseUp(stateRef, refs, dispatch, e); }}
                            onMouseLeave  = {function(e){ LifeInputUtils.onMouseLeave(stateRef, refs, dispatch, e); }}
                            onContextMenu = {function(e){ LifeInputUtils.onContextMenu(stateRef, refs, dispatch, e); }}
                            onTouchStart  = {function(e){ LifeInputUtils.onTouchStart(stateRef, refs, dispatch, e); }}
                            onTouchMove   = {function(e){ LifeInputUtils.onTouchMove(stateRef, refs, dispatch, e); }}
                            onTouchEnd    = {function(e){ LifeInputUtils.onTouchEnd(stateRef, refs, dispatch, e); }}></canvas>
                        {state.analysisResult ? <button type="button" className={"analysis-result" + (state.analyzing ? " analysis-cancellable" : "")} onClick={state.analyzing ? function(){ LifeAnalysisUtils.cancelAnalysis(stateRef, refs, dispatch); } : null} aria-live="assertive">{state.analysisResult}</button> : null}
                    </div>
                );
    }

    // renderTransportControls — extracted to components/transport-controls.js as TransportControls

    // renderViewControls — extracted to components/settings-panels.js as ViewControls

    // renderBoundaryControls — extracted to components/settings-panels.js as BoundaryControls

    function renderModeControls(){
                return (
                    <div className="mode-controls">
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'paint' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); }} title="Freehand draw mode (D)"><i className="fa fa-pencil" aria-hidden="true"></i> Draw</button>
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'preset' ? " active" : "")} onClick={function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); }} title="Place preset patterns (P)"><i className="fa fa-puzzle-piece" aria-hidden="true"></i> Preset</button>
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'select' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch); }} title="Select and move cells (S)"><i className="fa fa-mouse-pointer" aria-hidden="true"></i> Select</button>
                        {state.boundary !== 'unbounded' && <button type="button" className={"btn btn-toggle" + (state.drawMode === 'region' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); }} title="Draw/erase region bounds (B)"><i className="fa fa-th" aria-hidden="true"></i> Region</button>}
                        <button type="button" className={"btn btn-toggle" + (state.livePaintMode ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch); }} title="Paint while running"><i className="fa fa-paint-brush" aria-hidden="true"></i> Live Paint</button>
                        <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch); }} disabled={state.analyzing} title="Detect oscillator/spaceship"><i className="fa fa-crosshairs" aria-hidden="true"></i> Analyze</button>
                    </div>
                );
    }

    function renderToolsContent(){
                
                var filterLc = state.patternFilter.toLowerCase();
                var patternOptions = Object.keys(PATTERN_GROUPS).map(function(group){
                    var names = Object.keys(PATTERN_GROUPS[group]).filter(function(name){
                        return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
                    });
                    if(names.length === 0){ return null; }
                    var opts = names.map(function(name){
                        var meta = PATTERN_META[name];
                        var title = '';
                        if(meta){
                            if(meta.type === 'Still life') title = 'Still life \xB7 ' + meta.cells + ' cells';
                            else if(meta.type === 'Oscillator') title = 'Oscillator \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
                            else if(meta.type === 'Spaceship') title = 'Spaceship \xB7 Period\u00a0' + meta.period + (meta.note ? ' \xB7 ' + meta.note : '');
                            else if(meta.type === 'Methuselah') title = 'Methuselah \xB7 ' + meta.lifespan + '\u00a0gen lifespan \xB7 ' + meta.cells + ' cells';
                            else if(meta.type === 'Gun') title = 'Gun \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
                        }
                        return <option key={name} value={name} title={title}>{name}</option>;
                    });
                    return <optgroup key={group} label={group}>{opts}</optgroup>;
                }).filter(function(x){ return x !== null; });
                if(PATTERNS['Custom']){
                    patternOptions = patternOptions.concat(
                        <optgroup key="custom" label="Custom"><option value="Custom">Custom</option></optgroup>
                    );
                }
                return (
                    <div className="tools-content">
                        <div className="btn-section">
                            <div className="tool-subtype-row">
                                <label className="tool-label">Draw:</label>
                                <select value={state.drawTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{drawTool: e.target.value, drawMode: 'paint', selection: null}}); }}>
                                    <option value="cell">Cell paint</option>
                                    <option value="line">Line</option>
                                    <option value="fill">Flood fill</option>
                                    <option value="shape-rect">Rectangle</option>
                                    <option value="shape-circle">Circle</option>
                                </select>
                            </div>
                            <div className="tool-subtype-row">
                                <label className="tool-label">Select:</label>
                                <select value={state.selectTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{selectTool: e.target.value, drawMode: 'select', selection: null}}); }}>
                                    <option value="rect">Rectangle</option>
                                    <option value="ellipse">Ellipse</option>
                                    <option value="freeform">Freeform</option>
                                    <option value="all-visible">All visible</option>
                                </select>
                            </div>
                            {state.boundary !== 'unbounded' && <div className="tool-subtype-row">
                                <label className="tool-label">Region:</label>
                                <select value={state.regionTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{regionTool: e.target.value, drawMode: 'region'}}); }}>
                                    <option value="cell">Cell paint</option>
                                    <option value="line">Line</option>
                                    <option value="fill">Flood fill</option>
                                    <option value="shape-rect">Rectangle</option>
                                    <option value="shape-circle">Circle</option>
                                </select>
                            </div>}
                            <div className="tool-subtype-row">
                                <label className="tool-label">Preset:</label>
                                <select className={"preset-select" + (state.drawMode === 'preset' && state.selectedPattern ? " active" : "")}
                                    value={state.selectedPattern || ""}
                                    onChange={function(e){ LifeBoardUtils.selectPattern(stateRef, refs, dispatch, e); }}>
                                    <option value="">Choose preset...</option>
                                    {patternOptions}
                                </select>
                            </div>
                            <input className="pattern-filter-input"
                                type="search" placeholder="Filter patterns..."
                                aria-label="Filter patterns"
                                value={state.patternFilter}
                                onChange={function(e){ dispatch({type:"MERGE", payload:{patternFilter: e.target.value}}); }} />
                            {state.drawMode === 'preset' && state.selectedPattern &&
                                <div className="rotation-row">
                                    <canvas className="rotation-preview" width="96" height="96"
                                        role="img" aria-label="Pattern rotation preview"
                                        ref={function(c){ refs.previewCanvas = c; if(c) requestAnimationFrame(function(){ drawRotationPreview(stateRef, refs); }); }} />
                                    <div className="rotation-btns">
                                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }} title="Rotate 90° counter-clockwise"><i className="fa fa-undo" aria-hidden="true"></i></button>
                                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }} title="Rotate 90° clockwise"><i className="fa fa-repeat" aria-hidden="true"></i></button>
                                        <button type="button" className="btn" onClick={function(){
                                            refs.previewPos = null;
                                            dispatch({type:"MERGE", payload:{selectedPattern: null, patternRotation: 0, drawMode: "paint"}});
                                                setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                        }} aria-label="Cancel pattern placement" title="Cancel placement">
                                            <i className="fa fa-times" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>
                            }
                            {state.selection &&
                                <div className="buttons buttons-selection">
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.copySelection(stateRef, refs, dispatch); }} title="Copy selected cells" aria-label="Copy selected cells">Copy</button>
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch); }}
                                        disabled={!state.clipboard || state.clipboard.length === 0} title="Paste copied cells" aria-label="Paste copied cells">Paste</button>
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.deleteSelection(stateRef, refs, dispatch); }} title="Delete selected cells" aria-label="Delete selected cells">Delete</button>
                                </div>
                            }
                        </div>
                    </div>
                );
    }

    function renderExportContent(){
                return (
                    <div className="export-content">
                        <div className="sidebar-section-title">Share</div>
                        <div className="btn-section">
                            <div className="buttons buttons-export">
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.exportPNG(stateRef, refs, dispatch); }} title="Save as PNG"><i className="fa fa-camera" aria-hidden="true"></i> Export PNG</button>
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.copyRLE(stateRef, refs, dispatch); }} title="Copy board as RLE"><i className="fa fa-clipboard" aria-hidden="true"></i> Copy RLE</button>
                                <button type="button" className={"btn btn-toggle" + (state.recording ? " active btn-record" : "")} onClick={function(){ LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch); }} title="Record an animated GIF" aria-label={state.recording ? "Stop recording" : "Record GIF"}><i className={"fa " + (state.recording ? "fa-stop" : "fa-circle")} aria-hidden="true"></i> {state.recording ? "Stop" : "Record"}</button>
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.shareURL(stateRef, refs, dispatch); }} title="Copy shareable URL to clipboard" aria-label="Share simulation URL"><i className="fa fa-share-alt" aria-hidden="true"></i> {state.shareTooltip ? "Copied!" : "Share"}</button>
                            </div>
                            {renderRLESection(state, stateRef, refs, dispatch)}
                        </div>
                    </div>
                );
    }

    function renderLayoutSwitcher(){
                var dc = state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
                if(isMobile){ return null; }
                
                var mode = state.layoutMode;
                return (
                    <div className="layout-switcher">
                        <button type="button" className={"btn btn-toggle" + (mode === 'cartographer' ? " active" : "")}
                            onClick={function(){ LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'cartographer'); }}
                            title="Cartographer: Edge rail with tabs"
                            aria-label="Cartographer layout: edge rail with tabs">
                            <i className="fa fa-columns"></i>
                        </button>
                        <button type="button" className={"btn btn-toggle" + (mode === 'observatory' ? " active" : "")}
                            onClick={function(){ LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'observatory'); }}
                            title="Observatory: Floating panels"
                            aria-label="Observatory layout: floating panels">
                            <i className="fa fa-th-large"></i>
                        </button>
                    </div>
                );
    }

            // ── Cartographer layout ─────────────────────────────────────────

    function renderCartographer(cs){
                
                var dc = state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

                if(isMobile){
                    return renderCartographerMobile(cs, state, stateRef, refs, dispatch);
                }

                var railW = state.railHidden ? 0 : (state.railCollapsed ? 40 : (dc === 'tablet' ? 200 : 240));
                var railSide = state.railSide;
                var railClass = 'rail' +
                    (state.railCollapsed ? ' rail-collapsed' : '') +
                    (state.railHidden ? ' rail-hidden' : '') +
                    (' rail-' + railSide);

                var tabContent = (
                    <div className="rail-tab-content">
                        {_buildTabContent(state.railTab, {sectionTitle: true}, state, stateRef, refs, dispatch)}
                    </div>
                );

                var tabs = refs.MOBILE_TABS;

                return (
                    <div className="layout-cartographer">
                        {renderCanvas(cs, state, stateRef, refs, dispatch)}
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
                            {!state.railCollapsed && <div className="rail-stats">{<StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />}</div>}
                            <div className="rail-tabs" role="tablist" aria-label="Control categories">
                                {tabs.map(function(tab){
                                    var isActive = state.railTab === tab.id;
                                    return (
                                        <button key={tab.id}
                                            className={"rail-tab" + (isActive ? " active" : "")}
                                            onClick={function(){ LifeViewUtils.setRailTab(stateRef, refs, dispatch, tab.id); }}
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls={"rail-panel-" + tab.id}
                                            aria-label={tab.label}>
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
                                <div style={{padding:'8px 12px', borderTop:'1px solid var(--panel-border)', flexShrink:0}}>
                                    {renderLayoutSwitcher(state, stateRef, refs, dispatch)}
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
                        {renderMobileMinimapArea(state, stateRef, refs, dispatch)}
                    </div>
                );
    }

    function renderCartographerMobile(cs){
                var sheetContent = _buildSheetContent(state, stateRef, refs, dispatch);
                return (
                    <div className="layout-cartographer layout-mobile">
                        {renderCanvas(cs, state, stateRef, refs, dispatch)}
                        {!state.bottomSheetOpen && !refs.statsChipHidden && <StatsChip state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                        {!state.bottomSheetOpen && renderMobileContextPanel(state, stateRef, refs, dispatch)}
                        {!state.bottomSheetOpen && renderMobileMinimapArea(state, stateRef, refs, dispatch)}
                        {<MobileTransportBar state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                        {state.bottomSheetOpen && _renderBottomSheet(sheetContent, state, stateRef, refs, dispatch)}
                    </div>
                );
    }

            // ── Observatory layout ───────────────────────────────────────────

    function renderObservatory(cs){
                
                var dc = state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

                if(isMobile){
                    return renderObservatoryMobile(cs, state, stateRef, refs, dispatch);
                }

                var panels = state.panelStates;
                var zenMode = state.zenMode;

                return (
                    <div className={"layout-observatory" + (zenMode ? " zen-mode" : "")}>
                        {renderCanvas(cs, state, stateRef, refs, dispatch)}
                        {!zenMode &&
                            <div className="panel-overlay-container" role="group" aria-label="Floating control panels">
                                {_renderFloatPanel('transport', 'Simulate', <div>{<TransportControls compact={false} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>)}
                                {_renderFloatPanel('board', 'Board', <div>{<BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<BoundaryControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>)}
                                {_renderFloatPanel('view', 'View', <div>{<ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />}{<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>)}
                                {_renderFloatPanel('mode', 'Tools', <div>{renderModeControls(state, stateRef, refs, dispatch)}{renderToolsContent(state, stateRef, refs, dispatch)}</div>)}
                                {_renderFloatPanel('rules', 'Rules', renderRulesSection(state, stateRef, refs, dispatch))}
                                {_renderFloatPanel('stats', 'Stats', <StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />)}
                                {_renderFloatPanel('importExport', 'Share', renderExportContent(state, stateRef, refs, dispatch))}
                                {state.panelGroups.map(function(group){ return _renderPanelGroup(group, state, stateRef, refs, dispatch); })}
                                {/* Panel menu */}
                                <div className="panel-menu" role="group" aria-label="Panel visibility">
                                    <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch); }} aria-label="Help" title="Keyboard shortcuts (?)">
                                        <i className="fa fa-question-circle" aria-hidden="true"></i>
                                    </button>
                                    <button type="button" className="btn panel-menu-toggle"
                                        onClick={function(){ dispatch({type:"MERGE", payload:{panelMenuOpen: !state.panelMenuOpen}}); }}
                                        aria-expanded={!!state.panelMenuOpen}
                                        aria-label="Toggle panel visibility menu">
                                        <i className="fa fa-th" aria-hidden="true"></i>
                                    </button>
                                    {state.panelMenuOpen &&
                                        <div className="panel-menu-list" role="group" aria-label="Panel toggles">
                                            {['transport','board','view','mode','rules','stats','importExport'].map(function(id){
                                                var label = _getPanelLabel(id);
                                                return (
                                                    <label key={id} className="panel-menu-item">
                                                        <input type="checkbox" checked={panels[id].open}
                                                            onChange={function(){ _togglePanelOpen(id, stateRef, refs, dispatch); }}
                                                            aria-label={"Show " + label + " panel"} />
                                                        <span>{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    }
                                    {renderLayoutSwitcher(state, stateRef, refs, dispatch)}
                                </div>
                            </div>
                        }
                        {/* Mobile minimap element for tablet/medium screens */}
                        {renderMobileMinimapArea(state, stateRef, refs, dispatch)}
                    </div>
                );
    }

    function renderObservatoryMobile(cs){
                var sheetContent = _buildSheetContent(state, stateRef, refs, dispatch);
                return (
                    <div className="layout-observatory layout-mobile">
                        {renderCanvas(cs, state, stateRef, refs, dispatch)}
                        {<MobileTransportBar state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                        {!state.bottomSheetOpen && !refs.statsChipHidden && <StatsChip state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                        {!state.bottomSheetOpen && renderMobileContextPanel(state, stateRef, refs, dispatch)}
                        {!state.bottomSheetOpen && renderMobileMinimapArea(state, stateRef, refs, dispatch)}
                        {state.bottomSheetOpen && _renderBottomSheet(sheetContent, state, stateRef, refs, dispatch)}
                    </div>
                );
    }

            // ── Float panel helper (Observatory) ─────────────────────────────

    function _renderFloatPanel(panelId, label, content){
                
                var ps = state.panelStates[panelId];
                if(!ps || !ps.open){ return null; }
                // Skip panels that are in a group — they render inside the group.
                if(LifeViewUtils._findGroupForPanel(stateRef, refs, panelId)){ return null; }
                var isCompact = ps.compact && !ps.collapsed;
                var className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() +
                    (ps.collapsed ? " float-panel-collapsed" : "") +
                    (isCompact ? " float-panel-compact" : "");
                var style = {};
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
                            <span className="float-panel-title" id={"panel-title-" + panelId}>{label}</span>
                            <button type="button" className="btn float-panel-compact-toggle"
                                onClick={function(){ LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId); }}
                                aria-label={isCompact ? "Expand " + label + " panel width" : "Compact " + label + " panel"}
                                title={isCompact ? "Expand panel" : "Compact panel"}>
                                {isCompact ? "\u00bb" : "\u00ab"}
                            </button>
                            <button type="button" className="btn float-panel-collapse"
                                onClick={function(){ _togglePanelCollapse(panelId, stateRef, refs, dispatch); }}
                                aria-expanded={!ps.collapsed}
                                aria-label={ps.collapsed ? "Expand " + label + " panel" : "Collapse " + label + " panel"}>
                                {ps.collapsed ? "+" : "\u2013"}
                            </button>
                            <button type="button" className="btn float-panel-close"
                                onClick={function(){ _togglePanelOpen(panelId, stateRef, refs, dispatch); }}
                                aria-label={"Close " + label + " panel"}>&times;</button>
                        </div>
                        {!ps.collapsed && <div className="float-panel-body">
                            {isCompact ? _renderCompactBody(panelId, state, stateRef, refs, dispatch) : content}
                        </div>}
                        {!ps.collapsed && <div className="float-panel-resize"
                            onMouseDown={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}
                            onTouchStart={function(e){ _startPanelResize(panelId, e, stateRef, refs, dispatch); }}></div>}
                    </div>
                );
    }

    function _renderCompactBody(panelId){
                
                var defs = _getCompactDefs(panelId, state, stateRef, refs, dispatch);
                if(!defs || defs.length === 0){ return null; }
                return (
                    <div className="compact-body">
                        {defs.map(function(def){
                            var isOpen = LifeViewUtils._isPopOutOpen(stateRef, refs, panelId, def.id);
                            return (
                                <div key={def.id} className="pop-out-trigger">
                                    <button type="button"
                                        className={"btn" + (def.active ? " active" : "")}
                                        onClick={def.popOut ? function(){ isOpen ? LifeViewUtils._closePopOut(stateRef, refs, dispatch) : LifeViewUtils._openPopOut(stateRef, refs, dispatch, panelId, def.id); } : def.onClick}
                                        title={def.title}>
                                        <i className={"fa " + def.icon} aria-hidden="true"></i>
                                    </button>
                                    {def.popOut && isOpen &&
                                        <div className="pop-out-panel">
                                            {def.popOut()}
                                        </div>
                                    }
                                </div>
                            );
                        })}
                    </div>
                );
    }

    function _getCompactDefs(panelId){
                
                switch(panelId){
                    case 'transport':
                        return [
                            {id:'play', icon: state.running ? 'fa-pause' : 'fa-play', title: 'Play/Pause (Space)', onClick: function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }, active: state.running},
                            {id:'step', icon: 'fa-step-forward', title: 'Step (.)', onClick: function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }},
                            {id:'back', icon: 'fa-step-backward', title: 'Step backward (,)', onClick: function(){ LifeSimUtils.stepBack(stateRef, refs, dispatch); }},
                            {id:'go', icon: 'fa-fast-forward', title: 'Advance multiple generations', onClick: function(){ LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount); }},
                            {id:'reset', icon: 'fa-refresh', title: 'Randomize (R)', onClick: function(){ LifeBoardUtils.resetGame(stateRef, refs, dispatch); }},
                            {id:'empty', icon: 'fa-eraser', title: 'Clear all cells (E)', onClick: function(){ LifeBoardUtils.emptyBoard(stateRef, refs, dispatch); }},
                            {id:'undo', icon: 'fa-undo', title: 'Undo (Ctrl+Z)', onClick: function(){ LifeSimUtils.undo(stateRef, refs, dispatch); }},
                            {id:'speed', icon: 'fa-tachometer', title: 'Speed', popOut: function(){ return <SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
                        ];
                    case 'board':
                        return [
                            {id:'boundary', icon: 'fa-repeat', title: 'Cycle boundary', onClick: function(){ LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch); }, active: state.boundary !== 'toroidal'},
                            {id:'grid-size', icon: 'fa-th-large', title: 'Grid size', popOut: function(){ return <BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
                        ];
                    case 'view':
                        return [
                            {id:'fit-grid', icon: 'fa-arrows-alt', title: 'Fit Grid', onClick: function(){ LifeViewUtils.fitView(stateRef, refs, dispatch); }},
                            {id:'fit-cells', icon: 'fa-compress', title: 'Fit Cells', onClick: function(){ LifeViewUtils.fitLiveCells(stateRef, refs, dispatch); }},
                            {id:'grid', icon: 'fa-th', title: 'Grid lines (G)', onClick: function(){ LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch); }, active: state.gridLines},
                            {id:'trails', icon: 'fa-eye', title: 'Trails', onClick: function(){ toggleTrails(stateRef, refs, dispatch); }, active: state.showTrails},
                            {id:'minimap', icon: 'fa-map-o', title: 'Minimap (M)', onClick: function(){ LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch); }, active: state.showMinimap},
                            {id:'zoom', icon: 'fa-search-plus', title: 'Zoom', popOut: function(){ return <ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }},
                            {id:'display', icon: 'fa-paint-brush', title: 'Display settings', popOut: function(){ return <DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />; }}
                        ];
                    case 'mode':
                        var defs = [
                            {id:'draw', icon: 'fa-pencil', title: 'Draw mode (D)', onClick: function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); }, active: state.drawMode === 'paint'},
                            {id:'preset', icon: 'fa-puzzle-piece', title: 'Preset patterns (P)', onClick: function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); }, active: state.drawMode === 'preset'},
                            {id:'select', icon: 'fa-mouse-pointer', title: 'Select mode (S)', onClick: function(){ LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch); }, active: state.drawMode === 'select'},
                            {id:'live-paint', icon: 'fa-paint-brush', title: 'Live Paint', onClick: function(){ LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch); }, active: state.livePaintMode},
                            {id:'analyze', icon: 'fa-crosshairs', title: 'Analyze', onClick: function(){ LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch); }},
                            {id:'tools', icon: 'fa-wrench', title: 'Tool options', popOut: function(){ return renderToolsContent(state, stateRef, refs, dispatch); }}
                        ];
                        if(state.boundary !== 'unbounded'){
                            defs.splice(3, 0, {id:'region', icon: 'fa-th', title: 'Region bounds (B)', onClick: function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); }, active: state.drawMode === 'region'});
                        }
                        return defs;
                    case 'rules':
                        return [
                            {id:'rules', icon: 'fa-cogs', title: 'Rules', popOut: function(){ return renderRulesSection(state, stateRef, refs, dispatch); }}
                        ];
                    case 'stats':
                        return [
                            {id:'stats', icon: 'fa-bar-chart', title: 'Statistics', popOut: function(){ return <StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />; }}
                        ];
                    case 'importExport':
                        return [
                            {id:'io', icon: 'fa-exchange', title: 'Share', popOut: function(){ return renderExportContent(state, stateRef, refs, dispatch); }}
                        ];
                    default:
                        return [];
                }
    }

            // ── Panel group rendering (Observatory docking) ──────────────────

    function _getPanelLabel(panelId){
                var PANEL_LABELS = {transport:'Simulate', board:'Board', view:'View', mode:'Tools', tools:'Tools', rules:'Rules', stats:'Stats', importExport:'Share'};
                return PANEL_LABELS[panelId] || panelId;
    }

    function _getPanelIcon(panelId){
                var PANEL_ICONS = {transport:'fa-play', board:'fa-th-large', view:'fa-eye',
                    mode:'fa-pencil', tools:'fa-wrench', rules:'fa-cogs', stats:'fa-bar-chart',
                    importExport:'fa-exchange'};
                return PANEL_ICONS[panelId] || 'fa-circle-o';
    }

    function _getPanelContent(panelId){
                switch(panelId){
                    case 'transport': return <div>{<TransportControls compact={false} state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<SpeedSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
                    case 'board': return <div>{<BoardSliders state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<BoundaryControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
                    case 'view': return <div>{<ViewControls state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} onToggleTrails={toggleTrails} />}{<ZoomSlider state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}{<DisplaySettings state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}</div>;
                    case 'mode': return <div>{renderModeControls(state, stateRef, refs, dispatch)}{renderToolsContent(state, stateRef, refs, dispatch)}</div>;
                    case 'rules': return renderRulesSection(state, stateRef, refs, dispatch);
                    case 'stats': return <StatsPanel state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />;
                    case 'importExport': return renderExportContent(state, stateRef, refs, dispatch);
                    default: return null;
                }
    }

    function _checkTabBarOverflow(bar){
                bar.classList.remove('panel-tab-bar-icons');
                if(bar.scrollWidth > bar.clientWidth + 1){
                    bar.classList.add('panel-tab-bar-icons');
                }
    }

    function _observeTabBars(){
                
                if(refs.tabBarObservers){
                    refs.tabBarObservers.forEach(function(obs){ obs.disconnect(); });
                }
                refs.tabBarObservers = [];
                var tabBars = document.querySelectorAll('.panel-group .panel-tab-bar');
                for(var i = 0; i < tabBars.length; i++){
                    (function(bar){
                        var obs = new ResizeObserver(function(){ _checkTabBarOverflow(bar); });
                        obs.observe(bar);
                        refs.tabBarObservers.push(obs);
                    })(tabBars[i]);
                }
    }

    function _renderPanelGroup(group){
                
                var panels = state.panelStates;
                // Filter to only open panels in this group.
                var openPanels = group.panels.filter(function(pid){ return panels[pid] && panels[pid].open; });
                if(openPanels.length === 0){ return null; }
                // If only one panel remains open, render as standalone.
                if(openPanels.length === 1){
                    var soloId = openPanels[0];
                    var soloLabel = _getPanelLabel(soloId);
                    return _renderFloatPanelDirect(soloId, soloLabel, _getPanelContent(soloId, state, stateRef, refs, dispatch), group);
                }
                var activeTab = openPanels.indexOf(group.activeTab) !== -1 ? group.activeTab : openPanels[0];
                var isCompact = !!group.compact;
                var tabMode = group.compactTabMode || 'horizontal';
                var style = {};
                if(group.x >= 0){ style.left = group.x; style.top = group.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
                if(group.z){ style.zIndex = group.z; }
                var className = "float-panel panel-group" + (isCompact ? " panel-group-compact panel-group-compact-" + tabMode : "");

                // Tab buttons shared by horizontal and sidebar modes.
                var tabButtons = openPanels.map(function(pid){
                    var label = _getPanelLabel(pid);
                    return (
                        <button key={pid} type="button"
                            className={"panel-tab" + (pid === activeTab ? " panel-tab-active" : "")}
                            onClick={function(e){ e.stopPropagation(); LifeViewUtils._setGroupActiveTab(stateRef, refs, dispatch, group.id, pid); }}
                            onMouseDown={function(e){ if(!isCompact) _startTabDrag(pid, group.id, e, stateRef, refs, dispatch); }}
                            title={label}>
                            <i className={"fa " + _getPanelIcon(pid) + " panel-tab-icon"} aria-hidden="true"></i>
                            <span className="panel-tab-label">{label}</span>
                        </button>
                    );
                });

                // Tab area: dropdown mode uses a single trigger, others use tab bar.
                var tabArea;
                if(isCompact && tabMode === 'dropdown'){
                    tabArea = (
                        <div className="panel-tab-dropdown">
                            <button type="button" className="btn panel-tab-dropdown-trigger"
                                onClick={function(e){ e.stopPropagation(); dispatch({type:"MERGE", payload:{groupTabDropdownOpen: state.groupTabDropdownOpen === group.id ? null : group.id}}); }}
                                title={_getPanelLabel(activeTab)}>
                                <i className={"fa " + _getPanelIcon(activeTab)} aria-hidden="true"></i>
                                <i className="fa fa-caret-down panel-tab-dropdown-caret" aria-hidden="true"></i>
                            </button>
                            {state.groupTabDropdownOpen === group.id && (
                                <div className="panel-tab-dropdown-menu">
                                    {openPanels.map(function(pid){
                                        return (
                                            <button key={pid} type="button"
                                                className={"panel-tab-dropdown-item" + (pid === activeTab ? " active" : "")}
                                                onClick={function(e){ e.stopPropagation(); LifeViewUtils._setGroupActiveTab(stateRef, refs, dispatch, group.id, pid); dispatch({type:"MERGE", payload:{groupTabDropdownOpen: null}}); }}
                                                title={_getPanelLabel(pid)}>
                                                <i className={"fa " + _getPanelIcon(pid)} aria-hidden="true"></i>
                                                <span>{_getPanelLabel(pid)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                } else {
                    tabArea = (
                        <div className={"panel-tab-bar" + (isCompact ? " panel-tab-bar-icons" : "")}>
                            {tabButtons}
                        </div>
                    );
                }

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
                                title={isCompact ? "Expand group" : "Compact group"}>
                                {isCompact ? "\u00bb" : "\u00ab"}
                            </button>
                            {isCompact && <button type="button" className="btn panel-group-mode-toggle"
                                onClick={function(){ LifeViewUtils._cycleGroupCompactTabMode(stateRef, refs, dispatch, group.id); }}
                                title={"Tab layout: " + tabMode + " (click to cycle)"}>
                                <i className={"fa " + (tabMode === 'horizontal' ? 'fa-ellipsis-h' : tabMode === 'sidebar' ? 'fa-ellipsis-v' : 'fa-caret-down')} aria-hidden="true"></i>
                            </button>}
                            <button type="button" className="btn float-panel-close"
                                onClick={function(){ _togglePanelOpen(activeTab, stateRef, refs, dispatch); }}
                                aria-label="Close active panel">&times;</button>
                        </div>
                        <div className="float-panel-body">
                            {isCompact ? _renderCompactBody(activeTab, state, stateRef, refs, dispatch) : _getPanelContent(activeTab, state, stateRef, refs, dispatch)}
                        </div>
                        <div className="float-panel-resize"
                            onMouseDown={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}
                            onTouchStart={function(e){ _startGroupResize(group.id, e, stateRef, refs, dispatch); }}></div>
                    </div>
                );
    }

            // Render a standalone panel that belongs to a group (when group has only 1 open panel).
    function _renderFloatPanelDirect(panelId, label, content, group){
                
                var ps = state.panelStates[panelId];
                if(!ps || !ps.open){ return null; }
                var style = {};
                if(group && group.x >= 0){ style.left = group.x; style.top = group.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
                else if(ps.x >= 0){ style.left = ps.x; style.top = ps.y; style.right = 'auto'; style.bottom = 'auto'; style.transform = 'none'; }
                if(ps.z){ style.zIndex = ps.z; }
                if(group && group.z){ style.zIndex = group.z; }
                return (
                    <div className={"float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase()} style={style}
                        data-panel-id={panelId}
                        onMouseDown={function(){ LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId); }}
                        role="region" aria-label={label + " panel"}>
                        <div className="float-panel-header"
                            onMouseDown={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}
                            onTouchStart={function(e){ _startPanelDrag(panelId, e, stateRef, refs, dispatch); }}>
                            <span className="float-panel-title">{label}</span>
                            <button type="button" className="btn float-panel-collapse"
                                onClick={function(){ _togglePanelCollapse(panelId, stateRef, refs, dispatch); }}
                                aria-expanded={!ps.collapsed}>
                                {ps.collapsed ? "+" : "\u2013"}
                            </button>
                            <button type="button" className="btn float-panel-close"
                                onClick={function(){ _togglePanelOpen(panelId, stateRef, refs, dispatch); }}
                                aria-label={"Close " + label + " panel"}>&times;</button>
                        </div>
                        {!ps.collapsed && <div className="float-panel-body">{content}</div>}
                    </div>
                );
    }

    function _startGroupDrag(groupId, e){
                if(e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button'))){ return; }
                e.preventDefault();
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var clientX = e.touches ? e.touches[0].clientX : e.clientX;
                var clientY = e.touches ? e.touches[0].clientY : e.clientY;
                var offX = clientX - rect.left;
                var offY = clientY - rect.top;
                LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, groupId);
                panel.classList.add('dragging');
                
                var move = function(ev){
                    ev.preventDefault();
                    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                    panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, cx - offX)) + 'px';
                    panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, cy - offY)) + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.transform = 'none';
                };
                var end = function(){
                    panel.classList.remove('dragging');
                    var finalRect = panel.getBoundingClientRect();
                    var groups = JSON.parse(JSON.stringify(state.panelGroups));
                    for(var i = 0; i < groups.length; i++){
                        if(groups[i].id === groupId){
                            groups[i].x = finalRect.left;
                            groups[i].y = finalRect.top;
                            break;
                        }
                    }
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
    }

    function _startTabDrag(panelId, groupId, e){
                // Only initiate tab-tear-off if the user drags far enough from starting point.
                var startX = e.clientX;
                var startY = e.clientY;
                
                var threshold = 30;
                var tornOff = false;
                var move = function(ev){
                    if(tornOff){ return; }
                    var dx = ev.clientX - startX;
                    var dy = ev.clientY - startY;
                    if(Math.sqrt(dx * dx + dy * dy) > threshold){
                        tornOff = true;
                        LifeViewUtils._separatePanel(stateRef, refs, dispatch, panelId, groupId, ev.clientX - 40, ev.clientY - 10);
                        document.removeEventListener('mousemove', move);
                        document.removeEventListener('mouseup', end);
                    }
                };
                var end = function(){
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', end);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', end);
    }

    function _startGroupResize(groupId, e){
                e.preventDefault();
                e.stopPropagation();
                var self2 = this;
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var startW = rect.width;
                var startH = rect.height;
                var startX = e.touches ? e.touches[0].clientX : e.clientX;
                var startY = e.touches ? e.touches[0].clientY : e.clientY;
                var group = null;
                var groups = state.panelGroups;
                for(var gi = 0; gi < groups.length; gi++){
                    if(groups[gi].id === groupId){ group = groups[gi]; break; }
                }
                var isCompact = group && !!group.compact;
                var didToggle = false;
                var move = function(ev){
                    ev.preventDefault();
                    if(didToggle) return;
                    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                    var newW = startW + (cx - startX);
                    var newH = startH + (cy - startY);
                    if(!isCompact && newW < 120){
                        didToggle = true;
                        panel.style.width = '';
                        panel.style.maxHeight = '';
                        self2._toggleGroupCompact(groupId);
                    } else if(isCompact && newW > 120){
                        didToggle = true;
                        panel.style.width = Math.max(180, newW) + 'px';
                        self2._toggleGroupCompact(groupId);
                    } else if(!isCompact){
                        panel.style.width = Math.max(180, newW) + 'px';
                        panel.style.maxHeight = Math.max(80, newH) + 'px';
                    }
                };
                var end = function(){
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', end);
                    document.removeEventListener('touchmove', move);
                    document.removeEventListener('touchend', end);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', end);
                document.addEventListener('touchmove', move, {passive: false});
                document.addEventListener('touchend', end);
    }

            // ── Panel drag (Observatory) ─────────────────────────────────────

    function _startPanelDrag(panelId, e){
                if(e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button'))){ return; }
                e.preventDefault();
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var clientX = e.touches ? e.touches[0].clientX : e.clientX;
                var clientY = e.touches ? e.touches[0].clientY : e.clientY;
                refs.fpDragId = panelId;
                refs.fpDragOffX = clientX - rect.left;
                refs.fpDragOffY = clientY - rect.top;
                LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId);
                panel.classList.add('dragging');
                
                refs.fpDragMove = function(ev){
                    ev.preventDefault();
                    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                    var newX = Math.max(0, Math.min(window.innerWidth - 60, cx - refs.fpDragOffX));
                    var newY = Math.max(0, Math.min(window.innerHeight - 40, cy - refs.fpDragOffY));
                    panel.style.left = newX + 'px';
                    panel.style.top = newY + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.transform = 'none';
                    // Highlight potential merge targets during drag.
                    _updateDropIndicator(panelId, newX, newY, panel, stateRef, refs);
                };
                refs.fpDragEnd = function(){
                    panel.classList.remove('dragging');
                    _clearDropIndicator();
                    var finalRect = panel.getBoundingClientRect();
                    // Check for merge target.
                    var mergeTarget = _findDropTarget(panelId, finalRect, stateRef, refs);
                    if(mergeTarget){
                        LifeViewUtils._mergePanels(stateRef, refs, dispatch, panelId, mergeTarget);
                    } else {
                        var panels = JSON.parse(JSON.stringify(state.panelStates));
                        panels[panelId].x = finalRect.left;
                        panels[panelId].y = finalRect.top;
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
    }

    function _updateDropIndicator(draggedId, dragX, dragY, dragPanel){
                var allPanels = document.querySelectorAll('.float-panel, .panel-group');
                var dragRect = dragPanel.getBoundingClientRect();
                var found = false;
                for(var i = 0; i < allPanels.length; i++){
                    var other = allPanels[i];
                    if(other === dragPanel){ allPanels[i].classList.remove('drop-target'); continue; }
                    var otherRect = other.getBoundingClientRect();
                    var overlap = refs.rectsOverlap(dragRect, otherRect);
                    if(overlap > 0.3 && !found){
                        other.classList.add('drop-target');
                        found = true;
                    } else {
                        other.classList.remove('drop-target');
                    }
                }
    }

    function _clearDropIndicator(){
                var els = document.querySelectorAll('.drop-target');
                for(var i = 0; i < els.length; i++){ els[i].classList.remove('drop-target'); }
    }

    function _rectsOverlap(a, b){
                var overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                var overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                var overlapArea = overlapX * overlapY;
                var aArea = a.width * a.height;
                return aArea > 0 ? overlapArea / aArea : 0;
    }

    function _findDropTarget(draggedId, dragRect){
                var allPanels = document.querySelectorAll('.float-panel, .panel-group');
                for(var i = 0; i < allPanels.length; i++){
                    var el = allPanels[i];
                    var targetId = el.getAttribute('data-panel-id');
                    var targetGroupId = el.getAttribute('data-group-id');
                    if(!targetId && !targetGroupId){ continue; }
                    if(targetId === draggedId){ continue; }
                    var otherRect = el.getBoundingClientRect();
                    if(refs.rectsOverlap(dragRect, otherRect) > 0.3){
                        return targetId || targetGroupId;
                    }
                }
                return null;
    }

            // ── Panel resize (Observatory) ───────────────────────────────────

    function _startPanelResize(panelId, e){
                e.preventDefault();
                e.stopPropagation();
                var self2 = this;
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var startW = rect.width;
                var startH = rect.height;
                var startX = e.touches ? e.touches[0].clientX : e.clientX;
                var startY = e.touches ? e.touches[0].clientY : e.clientY;
                var isCompact = state.panelStates[panelId] && state.panelStates[panelId].compact;
                var didToggle = false;
                var move = function(ev){
                    ev.preventDefault();
                    if(didToggle) return;
                    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                    var newW = startW + (cx - startX);
                    var newH = startH + (cy - startY);
                    if(!isCompact && newW < 120){
                        didToggle = true;
                        panel.style.width = '';
                        panel.style.maxHeight = '';
                        self2._togglePanelCompact(panelId);
                    } else if(isCompact && newW > 120){
                        didToggle = true;
                        panel.style.width = Math.max(180, newW) + 'px';
                        self2._togglePanelCompact(panelId);
                    } else if(!isCompact){
                        panel.style.width = Math.max(180, newW) + 'px';
                        panel.style.maxHeight = Math.max(80, newH) + 'px';
                    }
                };
                var end = function(){
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', end);
                    document.removeEventListener('touchmove', move);
                    document.removeEventListener('touchend', end);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', end);
                document.addEventListener('touchmove', move, {passive: false});
                document.addEventListener('touchend', end);
    }

            // ── Panel state helpers (Observatory) ────────────────────────────

    function _togglePanelOpen(panelId){
                var panels = JSON.parse(JSON.stringify(state.panelStates));
                panels[panelId].open = !panels[panelId].open;
                
                dispatch({type:"MERGE", payload:{panelStates: panels}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
    }

    function _togglePanelCollapse(panelId){
                var panels = JSON.parse(JSON.stringify(state.panelStates));
                panels[panelId].collapsed = !panels[panelId].collapsed;
                
                dispatch({type:"MERGE", payload:{panelStates: panels}}); setTimeout(function(){ LifeViewUtils._persistLayout(stateRef, refs); }, 0);
    }

    // ── Main render ───────────────────────────────────────────────────

    var cs = LifeViewUtils.getCanvasSize(stateRef, refs);
    var layout = state.layoutMode;
    var dc = state.deviceClass;
    var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
    if(isMobile){ layout = 'observatory'; }
    var layoutContent;

    switch(layout){
        case 'observatory':
            layoutContent = renderObservatory(cs, state, stateRef, refs, dispatch);
            break;
        default:
            layoutContent = renderCartographer(cs, state, stateRef, refs, dispatch);
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
