"use strict";

/* global HashLife, SimRunner, CanvasRenderer, InputHandler, RegionUtil,
          PATTERN_GROUPS, PATTERNS, PATTERN_META, SimEngine, parseKey,
          RULE_PRESETS, SPEED_DELAYS, THEMES,
          LifeSimMixin, LifeIOMixin, LifeInputMixin, LifeViewMixin,
          LifeBoardMixin, LifeAnalysisMixin */
/**
 * Conway's Game of Life — React UI component.
 * Constants, SimEngine, and helpers are loaded from constants.js.
 */

document.addEventListener('DOMContentLoaded', function () {
  var LifeBoard = React.createClass({
    displayName: "LifeBoard",
    mixins: [LifeSimMixin, LifeIOMixin, LifeInputMixin, LifeViewMixin, LifeBoardMixin, LifeAnalysisMixin],
    // ── Lifecycle ─────────────────────────────────────────────────────

    getInitialState: function () {
      var cols = 100;
      var rows = 100;
      // On mobile, default to 8px/cell; on desktop, 5px/cell.
      // Center the view on the grid for all screen sizes.
      var isMobileInit = window.innerWidth <= 900 || window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 550px)').matches;
      var cellSize = isMobileInit ? 8 : 10;
      var initViewX = Math.round(cols / 2 - window.innerWidth / (2 * cellSize));
      var initViewY = Math.round(rows / 2 - window.innerHeight / (2 * cellSize));
      // Load persisted layout preferences from localStorage.
      // Schema v1: {layoutMode, railCollapsed, railTab, railSide, panelStates}
      var savedLayout = {};
      try {
        var raw = localStorage.getItem('life-layout-prefs');
        if (raw) {
          var parsed = JSON.parse(raw);
          // Validate schema version — if missing or mismatched, discard.
          if (parsed && typeof parsed === 'object') {
            // Validate layoutMode is a known value.
            if (parsed.layoutMode && ['cartographer', 'observatory'].indexOf(parsed.layoutMode) !== -1) {
              savedLayout.layoutMode = parsed.layoutMode;
            } else if (parsed.layoutMode === 'specimen') {
              savedLayout.layoutMode = 'cartographer';
            }
            if (typeof parsed.railCollapsed === 'boolean') {
              savedLayout.railCollapsed = parsed.railCollapsed;
            }
            if (parsed.railTab && ['simulate', 'board', 'view', 'tools', 'rules', 'export'].indexOf(parsed.railTab) !== -1) {
              savedLayout.railTab = parsed.railTab;
            }
            if (parsed.railSide && ['left', 'right'].indexOf(parsed.railSide) !== -1) {
              savedLayout.railSide = parsed.railSide;
            }
            // Validate panelStates: must be an object with known panel keys.
            if (parsed.panelStates && typeof parsed.panelStates === 'object') {
              var validPanels = ['transport', 'view', 'mode', 'tools', 'board', 'rules', 'stats', 'importExport'];
              var ps = {};
              var allValid = true;
              var maxZ = 0;
              for (var vi = 0; vi < validPanels.length; vi++) {
                var pid = validPanels[vi];
                if (parsed.panelStates[pid] && typeof parsed.panelStates[pid] === 'object') {
                  var pz = typeof parsed.panelStates[pid].z === 'number' ? parsed.panelStates[pid].z : 0;
                  if (pz > maxZ) {
                    maxZ = pz;
                  }
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
              if (allValid) {
                savedLayout.panelStates = ps;
                savedLayout.panelZCounter = maxZ + 1;
              }
            }
            // Validate panelGroups: array of group objects.
            if (Array.isArray(parsed.panelGroups)) {
              savedLayout.panelGroups = parsed.panelGroups.filter(function (g) {
                return g && typeof g === 'object' && Array.isArray(g.panels) && g.panels.length >= 2 && typeof g.id === 'string';
              });
            }
          }
        }
      } catch (e) {
        // Corrupted localStorage — silently ignore, use defaults.
        try {
          localStorage.removeItem('life-layout-prefs');
        } catch (e2) {}
      }
      var initRegionMask = RegionUtil.buildRect(cols, rows);
      var initRegionComponents = [{
        cells: initRegionMask,
        minR: 0,
        maxR: rows - 1,
        minC: 0,
        maxC: cols - 1
      }];
      return {
        running: true,
        cellSize: cellSize,
        cols: cols,
        rows: rows,
        viewX: initViewX,
        viewY: initViewY,
        sparseness: 2,
        liveCells: SimEngine.buildLiveCells(cols, rows, 2),
        generations: 0,
        livePaintMode: false,
        speed: 5,
        gridLines: true,
        boundary: 'toroidal',
        regionMask: initRegionMask,
        regionComponents: initRegionComponents,
        regionBounds: {
          minR: 0,
          maxR: rows - 1,
          minC: 0,
          maxC: cols - 1
        },
        birthRule: [3],
        surviveRule: [2, 3],
        ruleString: 'B3/S23',
        rulePreset: 'B3/S23',
        selectedPattern: null,
        patternRotation: 0,
        pendingCols: cols,
        pendingRows: rows,
        popHistory: [],
        sessionPeakPop: 0,
        stable: false,
        showHelp: false,
        showRle: false,
        rleInput: '',
        rleError: '',
        patternFilter: '',
        hoverCell: null,
        theme: 'Teal',
        drawMode: 'paint',
        selectTool: 'rect',
        drawTool: 'cell',
        regionTool: 'shape-rect',
        selection: null,
        clipboard: null,
        showMinimap: !isMobileInit,
        recording: false,
        showMobileTools: false,
        showTrails: true,
        darkModePref: function () {
          try {
            return localStorage.getItem('life-dark-mode-pref') || 'system';
          } catch (e) {
            return 'system';
          }
        }(),
        stepCount: 1,
        shareTooltip: false,
        showPopGraph: false,
        analysisResult: null,
        analyzing: false,
        // ── Layout mode state ───────────────────────────
        layoutMode: savedLayout.layoutMode || 'cartographer',
        // Cartographer state
        railCollapsed: savedLayout.railCollapsed || false,
        railHidden: false,
        railTab: savedLayout.railTab || 'simulate',
        railSide: savedLayout.railSide || 'right',
        // Observatory state
        zenMode: false,
        panelMenuOpen: false,
        panelStates: savedLayout.panelStates || {
          transport: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          view: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          mode: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          tools: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          board: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          rules: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          stats: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          },
          importExport: {
            open: false,
            x: -1,
            y: -1,
            collapsed: false,
            z: 0,
            compact: false
          }
        },
        panelZCounter: savedLayout.panelZCounter || 1,
        panelGroups: savedLayout.panelGroups || [{
          id: 'g-default', panels: ['transport', 'view', 'mode', 'board', 'rules', 'stats'],
          activeTab: 'transport', x: 10, y: 50, z: 1, compact: true, compactTabMode: 'sidebar'
        }],
        activePopOut: null,
        groupTabDropdownOpen: null,
        // Responsive device class
        deviceClass: 'desktop',
        // Bottom sheet (phone modes)
        bottomSheetOpen: false,
        bottomSheetClosing: false,
        bottomSheetTab: 'simulate',
        panMode: false,
        srAnnouncement: '',
        autoPauseOnStable: true
      };
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      // Skip render when only canvas-only state changed during animation.
      // These keys are updated every tick but only affect the imperative
      // canvas — the React DOM tree doesn't depend on them.
      if (this.state.running && nextState.running) {
        var dominated_only = true;
        for (var k in nextState) {
          if (nextState.hasOwnProperty(k) && k !== 'popHistory' && k !== 'srAnnouncement' && k !== 'liveCells' && this.state[k] !== nextState[k]) {
            dominated_only = false;
            break;
          }
        }
        if (dominated_only) return false;
      }
      return true;
    },
    componentDidMount: function () {
      this._mounted = true;
      // Instance properties previously in componentWillMount.
      this._genHistory = [];
      this._genHistoryMax = 200;
      this._genHistoryInterval = 1;
      this._genHistoryCounter = 0;
      this._trailMap = new Map();
      this._trailEnabled = true;
      // Input state is managed by InputHandler module
      this._loopRunning = false;
      this._tickId = 0;
      this._undoStack = [];
      this._redoStack = [];
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._genTimestamps = [];
      this._measuredGps = 0;
      InputHandler.reset();
      SimRunner.invalidate();
      this._gif = null;
      this._minimapDirty = true;
      // _minimapDragging managed by InputHandler
      this._minimapCanvas = document.createElement('canvas');
      this._mobileMinimap = null;
      this._mmElemDragging = false;
      this._minimapCanvas.width = 100;
      this._minimapCanvas.height = 75;
      // _pinchStart, _wasPinching, _longPressTimer managed by InputHandler
      this._statsChipHidden = false;
      this._statsChipTimer = null;
      this._minimapHidden = false;
      this._minimapTimer = null;
      // _canvas is set via React ref callback in renderCanvas
      // Attach wheel listener as non-passive so preventDefault works.
      this._canvas.addEventListener('wheel', this.onWheel, {
        passive: false
      });
      document.addEventListener('keydown', this.handleKeyDown);
      // System clipboard paste: import RLE/pattern text from clipboard.
      this._onPaste = this._handleClipboardPaste.bind(this);
      document.addEventListener('paste', this._onPaste);
      // Close pop-outs on click outside or Escape.
      this._onPopOutDismiss = function (e) {
        if (!self.state.activePopOut) {
          return;
        }
        if (e.type === 'keydown' && e.key === 'Escape') {
          self._closePopOut();
          return;
        }
        if (e.type === 'mousedown') {
          var popOut = e.target.closest && e.target.closest('.pop-out-trigger');
          if (!popOut) {
            self._closePopOut();
          }
        }
      };
      document.addEventListener('mousedown', this._onPopOutDismiss);
      document.addEventListener('keydown', this._onPopOutDismiss);
      // Drag-and-drop file import (desktop).
      var canvasContainer = this._canvas.parentNode;
      this._onDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.add('drop-active');
      };
      this._onDragLeave = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.remove('drop-active');
      };
      this._onDrop = this._handleFileDrop.bind(this);
      canvasContainer.addEventListener('dragover', this._onDragOver);
      canvasContainer.addEventListener('dragleave', this._onDragLeave);
      canvasContainer.addEventListener('drop', this._onDrop);
      // Dark mode: respect system preference.
      this._darkModeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      if (this._darkModeQuery) {
        var self2 = this;
        this._onDarkModeChange = function (e) {
          if (self2.state.darkModePref === 'system') {
            self2._applyDarkMode(e.matches);
          }
        };
        try {
          this._darkModeQuery.addEventListener('change', this._onDarkModeChange);
        } catch (ex) {
          try {
            this._darkModeQuery.addListener(this._onDarkModeChange);
          } catch (ex2) {}
        }
        // Apply initial dark mode state.
        if (this.state.darkModePref === 'system') {
          this._applyDarkMode(this._darkModeQuery.matches);
        }
      }
      // Respond to viewport resize (throttled) to update canvas dimensions.
      var self = this;
      // Cache initial dimensions to filter out browser-chrome-only height changes on mobile.
      this._lastResizeW = window.innerWidth;
      this._lastResizeH = window.innerHeight;
      this._onResize = function () {
        var newW = window.innerWidth;
        var newH = window.innerHeight;
        var widthChanged = Math.abs(newW - self._lastResizeW) > 10;
        var heightBigChange = Math.abs(newH - self._lastResizeH) > 100;
        // Ignore height-only changes < 100px (mobile browser chrome show/hide on scroll).
        if (!widthChanged && !heightBigChange) {
          return;
        }
        self._lastResizeW = newW;
        self._lastResizeH = newH;
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self.forceUpdate(function () {
            self.drawBoard();
          });
        }, 120);
      };
      window.addEventListener('resize', this._onResize);
      // orientationchange fires before dimensions settle on iOS; use a longer debounce.
      this._onOrientationChange = function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self.forceUpdate(function () {
            self.drawBoard();
          });
        }, 300);
      };
      window.addEventListener('orientationchange', this._onOrientationChange);
      // ── Device class detection via matchMedia ──────────────────
      var self3 = this;
      this._mqPhone = window.matchMedia('(max-width: 900px)');
      this._mqPhoneLandscape = window.matchMedia('(orientation: landscape) and (max-height: 550px)');
      this._mqTablet = window.matchMedia('(min-width: 901px) and (max-width: 1200px)');
      this._mqLandscape = window.matchMedia('(orientation: landscape)');
      this._updateDeviceClass = function () {
        var dc;
        if (self3._mqPhone.matches) {
          dc = self3._mqLandscape.matches ? 'phone-landscape' : 'phone-portrait';
        } else if (self3._mqPhoneLandscape.matches) {
          dc = 'phone-landscape';
        } else if (self3._mqTablet.matches) {
          dc = 'tablet';
        } else {
          dc = 'desktop';
        }
        if (dc !== self3.state.deviceClass) {
          self3.setState({
            deviceClass: dc
          }, function () {
            self3.drawBoard();
          });
        }
      };
      this._updateDeviceClass();
      try {
        this._mqPhone.addEventListener('change', this._updateDeviceClass);
        this._mqPhoneLandscape.addEventListener('change', this._updateDeviceClass);
        this._mqTablet.addEventListener('change', this._updateDeviceClass);
        this._mqLandscape.addEventListener('change', this._updateDeviceClass);
      } catch (ex) {
        try {
          this._mqPhone.addListener(this._updateDeviceClass);
          this._mqPhoneLandscape.addListener(this._updateDeviceClass);
          this._mqTablet.addListener(this._updateDeviceClass);
          this._mqLandscape.addListener(this._updateDeviceClass);
        } catch (ex2) {}
      }

      // ── Keyboard shortcut registry ──────────────────────────────
      this._shortcuts = {};
      this._registerCoreShortcuts();

      // Initialize HashLife engine with current rules.
      HashLife.init(this.state.birthRule, this.state.surviveRule);
      SimRunner._hlRuleKey = this.state.birthRule.join(',') + '/' + this.state.surviveRule.join(',');
      this.drawBoard();
      this._loadFromURLHash();
      this._startLoop();
      this._observeTabBars();
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.selectedPattern !== this.state.selectedPattern || prevState.patternRotation !== this.state.patternRotation || prevState.bottomSheetOpen !== this.state.bottomSheetOpen || prevState.bottomSheetTab !== this.state.bottomSheetTab || prevState.layoutMode !== this.state.layoutMode) {
        this.drawRotationPreview();
      }
      if (prevState.panelGroups !== this.state.panelGroups) {
        this._observeTabBars();
      }
    },
    componentWillUnmount: function () {
      if (this._tabBarObservers) {
        this._tabBarObservers.forEach(function (obs) {
          obs.disconnect();
        });
      }
      if (!this._canvas) {
        return;
      }
      this._canvas.removeEventListener('wheel', this.onWheel);
      document.removeEventListener('keydown', this.handleKeyDown);
      document.removeEventListener('paste', this._onPaste);
      document.removeEventListener('mousedown', this._onPopOutDismiss);
      document.removeEventListener('keydown', this._onPopOutDismiss);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onOrientationChange);
      var container = this._canvas.parentNode;
      if (container) {
        container.removeEventListener('dragover', this._onDragOver);
        container.removeEventListener('dragleave', this._onDragLeave);
        container.removeEventListener('drop', this._onDrop);
      }
      if (this._gif) {
        this._gif.abort();
        this._gif = null;
      }
      // Remove media query listeners.
      if (this._darkModeQuery && this._onDarkModeChange) {
        try {
          this._darkModeQuery.removeEventListener('change', this._onDarkModeChange);
        } catch (ex) {
          try {
            this._darkModeQuery.removeListener(this._onDarkModeChange);
          } catch (ex2) {}
        }
      }
      if (this._updateDeviceClass) {
        var mqList = [this._mqPhone, this._mqPhoneLandscape, this._mqTablet, this._mqLandscape];
        for (var mi = 0; mi < mqList.length; mi++) {
          if (mqList[mi]) {
            try {
              mqList[mi].removeEventListener('change', this._updateDeviceClass);
            } catch (ex) {
              try {
                mqList[mi].removeListener(this._updateDeviceClass);
              } catch (ex2) {}
            }
          }
        }
      }
      // Cancel pending animation frame and timeout.
      this._mounted = false;
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._loopTimeout) {
        clearTimeout(this._loopTimeout);
        this._loopTimeout = null;
      }
      InputHandler.reset();
      // Release large objects.
      this._minimapCanvas = null;
      SimRunner._hlRoot = null;
      this._genHistory = [];
      this._trailMap = null;
      InputHandler._paintedCells = {};
      this._sheetEl = null;
    },
    // ── Rendering ─────────────────────────────────────────────────────

    drawBoard: function () {
      var canvas = this._canvas;
      if (!canvas) {
        return;
      }
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      var cellSize = this.state.cellSize;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var viewX = this.state.viewX;
      var viewY = this.state.viewY;
      var canvasW = canvas.width;
      var canvasH = canvas.height;
      var theme = THEMES[this.state.theme] || THEMES['Teal'];
      var liveCells = this.state.liveCells;
      var isUnbounded = this.state.boundary === 'unbounded';

      // Visible cell range.
      var startC = viewX,
        startR = viewY;
      var endC = viewX + Math.ceil(canvasW / cellSize) + 1;
      var endR = viewY + Math.ceil(canvasH / cellSize) + 1;

      // Clear canvas.
      // In bounded mode, pre-darken the entire canvas so that out-of-region
      // areas are uniformly dimmed with no edge gaps.  Region cells are then
      // restored to the clean bg before cells/trails/grid are drawn.
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvasW, canvasH);
      if (!isUnbounded && this.state.regionMask && this.state.regionMask.size > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, canvasW, canvasH);
        // Restore clean bg for in-region cells.
        CanvasRenderer.clearRegionCells(ctx, this.state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
      }

      // Palette.
      var palettes = CanvasRenderer._ensurePalette(theme, this.state.theme);

      // Cells.
      CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

      // Trails.
      if (this._trailEnabled && this._trailMap && this._trailMap.size > 0) {
        CanvasRenderer.drawTrails(ctx, this._trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.trail);
      }

      // Grid.
      if (this.state.gridLines) {
        CanvasRenderer.drawGrid(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme.grid);
      }

      // Region overlay (replaces single bounding box).
      if (!isUnbounded) {
        CanvasRenderer.drawRegionOverlay(ctx, this.state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme, this.state.boundary);
      }

      // Selection.
      CanvasRenderer.drawSelection(ctx, this.state.selection, viewX, viewY, cellSize, theme);

      // Tool preview (paint mode).
      CanvasRenderer.drawToolPreview(ctx, InputHandler._drawPreviewCells, InputHandler._drawErasing, viewX, viewY, cellSize, theme);

      // Region tool preview.
      if (this.state.drawMode === 'region') {
        // Show rubber-band shape preview.
        if (InputHandler._regionPreviewKeys.length > 0) {
          CanvasRenderer.drawRegionPreview(ctx, InputHandler._regionPreviewKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
        }
        // Show cell-by-cell painting preview.
        if (InputHandler._regionDragging) {
          var rgPainted = InputHandler._regionPaintedKeys;
          var rgKeys = Object.keys(rgPainted);
          if (rgKeys.length > 0) {
            CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
          }
        }
      }

      // Pattern preview.
      if (this.state.drawMode === 'preset') {
        var previewMask = !isUnbounded && this.state.regionMask && this.state.regionMask.size > 0 ? this.state.regionMask : null;
        CanvasRenderer.drawPatternPreview(ctx, this.state.selectedPattern, this.state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme, previewMask);
      }

      // Minimap overlay (bottom-right corner on large desktop; separate element elsewhere).
      var useMobileMinimap = this.state.deviceClass === 'phone-portrait' || this.state.deviceClass === 'phone-landscape' || this.state.deviceClass === 'tablet' || typeof window !== 'undefined' && window.innerWidth <= 1200;
      if (this.state.showMinimap && (isUnbounded || cols > 0 && rows > 0)) {
        if (useMobileMinimap) {
          this.drawMinimapMobile(liveCells, cols, rows, viewX, viewY, cellSize, theme);
          this._minimapRect = null;
        } else {
          // Compute scale from actual canvas element for accuracy.
          var mmDisplayScale = 1;
          if (canvas.style.width) {
            var cssW = parseFloat(canvas.style.width);
            if (cssW > 0 && canvasW > 0) {
              mmDisplayScale = cssW / canvasW;
            }
          }
          this.drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, mmDisplayScale);
        }
      }

      // GIF recording: capture frame.
      if (this.state.recording && this._gif) {
        this._gif.addFrame(ctx, {
          copy: true,
          delay: SPEED_DELAYS[this.state.speed - 1] || 50
        });
      }
    },
    drawMinimap: function (ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale) {
      // Derive minimap world region.
      // For all modes on the infinite canvas, show the bounding box area
      // expanded to include any live cells outside and the current viewport.
      var isUnbounded = this.state.boundary === 'unbounded';
      var mmOriginR = 0,
        mmOriginC = 0;
      // regionBounds and regionComponents used instead of mmBBCols/mmBBRows
      if (isUnbounded) {
        var bb = SimEngine.getBoundingBox(liveCells);
        if (bb) {
          var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
          var newMinR = bb.minR - pad,
            newMinC = bb.minC - pad;
          var newMaxR = bb.maxR + pad,
            newMaxC = bb.maxC + pad;
          // Hysteresis: only expand, never shrink (prevents flashing).
          var prev = this._mmUnboundedRegion;
          if (prev) {
            newMinR = Math.min(prev.minR, newMinR);
            newMinC = Math.min(prev.minC, newMinC);
            newMaxR = Math.max(prev.maxR, newMaxR);
            newMaxC = Math.max(prev.maxC, newMaxC);
          }
          this._mmUnboundedRegion = {
            minR: newMinR,
            minC: newMinC,
            maxR: newMaxR,
            maxC: newMaxC
          };
          mmOriginR = newMinR;
          mmOriginC = newMinC;
          rows = newMaxR - newMinR + 1;
          cols = newMaxC - newMinC + 1;
        } else {
          mmOriginR = viewY - 50;
          mmOriginC = viewX - 50;
          rows = 100;
          cols = 100;
          this._mmUnboundedRegion = null;
        }
      } else {
        // Bounded modes: fixed world region = region bounds + live cells + static padding.
        // Does NOT expand to follow viewport — arrow indicators show off-screen viewport.
        var rb = this.state.regionBounds;
        var mmMinR = rb ? rb.minR : 0;
        var mmMinC = rb ? rb.minC : 0;
        var mmMaxR = rb ? rb.maxR + 1 : rows;
        var mmMaxC = rb ? rb.maxC + 1 : cols;
        var bbLive = SimEngine.getBoundingBox(liveCells);
        if (bbLive) {
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
      var ds = displayScale && displayScale > 0 ? displayScale : 1;
      var aspect = cols / rows;
      // Cap buffer dimensions so the minimap never exceeds 1/3 of the canvas.
      var maxMmW = Math.floor(canvasW / 3);
      var maxMmH = Math.floor(canvasH / 3);
      var mmW, mmH;
      if (aspect >= 1) {
        mmW = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmW);
        mmH = Math.min(Math.max(40, Math.round(mmW / aspect)), maxMmH);
      } else {
        mmH = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmH);
        mmW = Math.min(Math.max(40, Math.round(mmH * aspect)), maxMmW);
      }
      // Resize the off-screen canvas if dimensions changed.
      if (this._minimapCanvas.width !== mmW || this._minimapCanvas.height !== mmH) {
        this._minimapCanvas.width = mmW;
        this._minimapCanvas.height = mmH;
        this._minimapDirty = true;
      }
      // Express the margin in CSS-space pixels by scaling by 1/ds,
      // so the visual gap from the canvas corner stays ~6px at all zoom levels.
      var marginBuf = Math.max(1, Math.round(6 / ds));
      // In Cartographer mode, offset minimap upward to clear the fixed transport strip.
      var isMobileView2 = this.state.deviceClass === 'phone-portrait' || this.state.deviceClass === 'phone-landscape';
      var transportPad = this.state.layoutMode === 'cartographer' && !isMobileView2 ? Math.round(60 / ds) : 0;
      // In Cartographer, place minimap on the opposite side from the rail.
      var mmOnLeft = this.state.layoutMode === 'cartographer' && this.state.railSide === 'right';
      var mmX = mmOnLeft ? marginBuf : canvasW - mmW - marginBuf;
      var mmY = canvasH - mmH - marginBuf - transportPad;

      // Redraw minimap off-screen canvas only when marked dirty.
      if (this._minimapDirty) {
        var mc = this._minimapCanvas;
        var mctx = mc.getContext('2d');
        mctx.clearRect(0, 0, mmW, mmH);
        // Background.
        mctx.fillStyle = 'rgba(10,14,26,0.85)';
        mctx.fillRect(0, 0, mmW, mmH);
        // Draw all live cells as 1-px dots.
        mctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
        var _mmOC = mmOriginC,
          _mmOR = mmOriginR,
          _mmCols = cols,
          _mmRows = rows;
        liveCells.forEach(function (age, key) {
          var _rc = parseKey(key),
            kr = _rc[0] - _mmOR,
            kc = _rc[1] - _mmOC;
          if (kr >= 0 && kr < _mmRows && kc >= 0 && kc < _mmCols) {
            mctx.fillRect(Math.floor(kc / _mmCols * mmW), Math.floor(kr / _mmRows * mmH), 1, 1);
          }
        });
        // Region indicator on minimap (bounded modes only).
        if (!isUnbounded && this.state.regionMask) {
          var _regionMask = this.state.regionMask;
          mctx.fillStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.12)';
          _regionMask.forEach(function (key) {
            var _i = key.indexOf(',');
            var _rr = parseInt(key.substring(0, _i), 10) - _mmOR;
            var _cc = parseInt(key.substring(_i + 1), 10) - _mmOC;
            if (_rr >= 0 && _rr < _mmRows && _cc >= 0 && _cc < _mmCols) {
              mctx.fillRect(Math.floor(_cc / _mmCols * mmW), Math.floor(_rr / _mmRows * mmH), 1, 1);
            }
          });
          // Draw component bounding rects as dashed outlines.
          var _comps = this.state.regionComponents;
          if (_comps && _comps.length > 0) {
            mctx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
            mctx.lineWidth = 1;
            mctx.setLineDash([3, 2]);
            for (var _ci = 0; _ci < _comps.length; _ci++) {
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
        this._minimapDirty = false;
      }

      // Blit minimap to main canvas.
      ctx.drawImage(this._minimapCanvas, mmX, mmY);

      // Viewport rectangle.
      var visCols = Math.ceil(canvasW / cellSize);
      var visRows = Math.ceil(canvasH / cellSize);
      var vx1 = mmX + Math.round((viewX - mmOriginC) / cols * mmW);
      var vy1 = mmY + Math.round((viewY - mmOriginR) / rows * mmH);
      var vw = Math.max(2, Math.round(visCols / cols * mmW));
      var vh = Math.max(2, Math.round(visRows / rows * mmH));
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      var clampX = Math.max(vx1, mmX);
      var clampY = Math.max(vy1, mmY);
      var clampR = Math.min(vx1 + vw, mmX + mmW);
      var clampB = Math.min(vy1 + vh, mmY + mmH);
      if (clampR > clampX && clampB > clampY) {
        ctx.strokeRect(clampX + 0.5, clampY + 0.5, clampR - clampX, clampB - clampY);
      }

      // Off-screen viewport indicator arrow (when viewport is outside minimap world region).
      var vpCenterC = viewX + visCols / 2;
      var vpCenterR = viewY + visRows / 2;
      var vpOutside = vpCenterC < mmOriginC || vpCenterC > mmOriginC + cols || vpCenterR < mmOriginR || vpCenterR > mmOriginR + rows;
      if (vpOutside) {
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
      this._minimapRect = {
        x: mmX,
        y: mmY,
        w: mmW,
        h: mmH,
        originC: mmOriginC,
        originR: mmOriginR,
        worldCols: cols,
        worldRows: rows
      };
    },
    drawRotationPreview: function () {
      var theme = THEMES[this.state.theme] || THEMES['Teal'];
      CanvasRenderer.drawRotationPreview(this._previewCanvas, this.state.selectedPattern, this.state.patternRotation, theme);
    },
    // ── Methods delegated to mixins ──────────────────────────────────
    // LifeSimMixin: simulation loop, undo/redo, stepping
    // LifeIOMixin: file import/export, URL sharing, RLE
    // LifeInputMixin: mouse, touch, keyboard, shortcuts
    // LifeViewMixin: viewport, layout, panels, bottom sheet
    // LifeBoardMixin: board config, drawing modes, selection, patterns
    // LifeAnalysisMixin: pattern analysis, recording, help

    toggleTrails: function () {
      var newVal = !this.state.showTrails;
      this._trailEnabled = newVal;
      if (!newVal) {
        this._trailMap = new Map();
      }
      var self = this;
      this.setState({
        showTrails: newVal
      }, function () {
        self.drawBoard();
      });
    },
    // ── Render sub-methods ────────────────────────────────────────────

    renderHelpModal: function () {
      if (!this.state.showHelp) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "help-overlay",
        onClick: this.toggleHelp,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "help-dialog-title",
        onKeyDown: function (e) {
          if (e.key === 'Tab') {
            var modal = e.currentTarget.querySelector('.help-modal');
            if (!modal) return;
            var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            var first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "help-modal",
        onClick: function (e) {
          e.stopPropagation();
        }
      }, /*#__PURE__*/React.createElement("h3", {
        className: "help-title",
        id: "help-dialog-title"
      }, "Keyboard Shortcuts"), /*#__PURE__*/React.createElement("table", {
        className: "help-table"
      }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Space"), /*#__PURE__*/React.createElement("td", null, "Play / Pause")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "."), /*#__PURE__*/React.createElement("td", null, "Step one generation")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Shift+."), /*#__PURE__*/React.createElement("td", null, "Step N generations")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, ","), /*#__PURE__*/React.createElement("td", null, "Step backward")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "R"), /*#__PURE__*/React.createElement("td", null, "Reset (random fill)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "E"), /*#__PURE__*/React.createElement("td", null, "Empty board")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+Z"), /*#__PURE__*/React.createElement("td", null, "Undo")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "S"), /*#__PURE__*/React.createElement("td", null, "Export PNG")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "X"), /*#__PURE__*/React.createElement("td", null, "Copy board as RLE")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "F"), /*#__PURE__*/React.createElement("td", null, "Fit live cells in view")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+Wheel"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Scroll / Trackpad"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Arrows"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Right-drag"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "["), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CCW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "]"), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+C"), /*#__PURE__*/React.createElement("td", null, "Copy selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+V"), /*#__PURE__*/React.createElement("td", null, "Paste selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Del"), /*#__PURE__*/React.createElement("td", null, "Delete selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Esc"), /*#__PURE__*/React.createElement("td", null, "Cancel / close")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "D"), /*#__PURE__*/React.createElement("td", null, "Switch to Draw mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "P"), /*#__PURE__*/React.createElement("td", null, "Switch to Preset mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "B"), /*#__PURE__*/React.createElement("td", null, "Switch to Region mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "G"), /*#__PURE__*/React.createElement("td", null, "Toggle grid lines")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "T"), /*#__PURE__*/React.createElement("td", null, "Toggle trails")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "M"), /*#__PURE__*/React.createElement("td", null, "Toggle minimap")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "?"), /*#__PURE__*/React.createElement("td", null, "Show / hide this help")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
        colSpan: "2",
        scope: "colgroup",
        style: {
          paddingTop: '10px',
          opacity: 0.55,
          fontSize: '0.85em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }, "Touch gestures")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tap"), /*#__PURE__*/React.createElement("td", null, "Paint / place cell")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Pinch"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "2-finger drag"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Long press"), /*#__PURE__*/React.createElement("td", null, "Show cell coordinates")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
        colSpan: "2",
        scope: "colgroup",
        style: {
          paddingTop: '10px',
          opacity: 0.55,
          fontSize: '0.85em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }, "File import")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Drag & drop"), /*#__PURE__*/React.createElement("td", null, "Drop .rle/.cells file on canvas")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+V"), /*#__PURE__*/React.createElement("td", null, "Paste RLE text from clipboard")))), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn help-close",
        onClick: this.toggleHelp,
        title: "Close",
        "aria-label": "Close help dialog"
      }, "Close")));
    },
    renderPopGraph: function () {
      if (!this.state.showPopGraph) {
        return null;
      }
      var hist = this.state.popHistory;
      if (hist.length < 2) {
        return null;
      }
      var maxPop = 0;
      for (var i = 0; i < hist.length; i++) {
        if (hist[i] > maxPop) {
          maxPop = hist[i];
        }
      }
      if (maxPop === 0) {
        maxPop = 1;
      }
      var vbW = 600,
        vbH = 200,
        padT = 10,
        padB = 20,
        padL = 50,
        padR = 10;
      var plotW = vbW - padL - padR;
      var plotH = vbH - padT - padB;
      // Draw data points as SVG polyline.
      var points = hist.map(function (p, idx) {
        var x = padL + idx / (hist.length - 1) * plotW;
        var y = padT + (1 - p / maxPop) * plotH;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      // Y-axis labels.
      var yLabels = [];
      var ySteps = 4;
      for (var yi = 0; yi <= ySteps; yi++) {
        var val = Math.round(maxPop * (1 - yi / ySteps));
        var yy = padT + yi / ySteps * plotH;
        yLabels.push({
          val: val,
          y: yy
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "help-overlay",
        onClick: this.togglePopGraph,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "popgraph-dialog-title",
        onKeyDown: function (e) {
          if (e.key === 'Tab') {
            var modal = e.currentTarget.querySelector('.pop-graph-modal');
            if (!modal) return;
            var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            var first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "pop-graph-modal",
        onClick: function (e) {
          e.stopPropagation();
        }
      }, /*#__PURE__*/React.createElement("h3", {
        className: "help-title",
        id: "popgraph-dialog-title"
      }, "Population History"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: '0.8em',
          opacity: 0.7,
          margin: '0 0 8px'
        }
      }, hist.length + ' generations recorded \xB7 peak ' + maxPop.toLocaleString()), /*#__PURE__*/React.createElement("svg", {
        width: "100%",
        viewBox: "0 0 " + vbW + " " + vbH,
        style: {
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '4px'
        },
        role: "img",
        "aria-label": "Population history graph"
      }, yLabels.map(function (yl, idx) {
        return /*#__PURE__*/React.createElement("g", {
          key: idx
        }, /*#__PURE__*/React.createElement("line", {
          x1: padL,
          y1: yl.y,
          x2: vbW - padR,
          y2: yl.y,
          stroke: "rgba(255,255,255,0.15)",
          strokeWidth: "0.5"
        }), /*#__PURE__*/React.createElement("text", {
          x: padL - 5,
          y: yl.y + 4,
          textAnchor: "end",
          fill: "rgba(255,255,255,0.6)",
          fontSize: "10"
        }, yl.val.toLocaleString()));
      }), /*#__PURE__*/React.createElement("text", {
        x: padL + plotW / 2,
        y: vbH - 2,
        textAnchor: "middle",
        fill: "rgba(255,255,255,0.5)",
        fontSize: "9"
      }, "Generation"), /*#__PURE__*/React.createElement("polyline", {
        fill: "none",
        stroke: CanvasRenderer._aliveRGB || '#70959A',
        strokeWidth: "1.5",
        points: points
      }), /*#__PURE__*/React.createElement("polygon", {
        fill: CanvasRenderer._aliveRGB ? CanvasRenderer._aliveRGB.replace('rgb', 'rgba').replace(')', ',0.2)') : 'rgba(112,149,154,0.2)',
        points: padL + ',' + (padT + plotH) + ' ' + points + ' ' + (padL + plotW) + ',' + (padT + plotH)
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn help-close",
        onClick: this.togglePopGraph,
        title: "Close",
        "aria-label": "Close population graph"
      }, "Close")));
    },
    // Returns the sparkline SVG block (or null if insufficient data).
    // Called from both renderStats (desktop) and renderMobileSparkline (mobile).
    renderSparklineSVG: function () {
      var population = this.state.liveCells.size;
      var now2 = Date.now();
      var gpsText = this._measuredGps > 0 && (this.state.running || now2 < (this._gpsDisplayUntil || 0)) ? this._measuredGps.toFixed(1) + '\u00a0gen/s' : null;
      var fullHist = this.state.popHistory;
      var trendArrow = '';
      if (fullHist.length >= 5) {
        var delta = fullHist[fullHist.length - 1] - fullHist[fullHist.length - 5];
        trendArrow = delta > 2 ? '\u2009\u25b2' : delta < -2 ? '\u2009\u25bc' : '\u2009\u223c';
      }
      var histStart = Math.max(0, fullHist.length - 60);
      var hist = histStart > 0 ? fullHist.slice(histStart) : fullHist;
      var maxPop = 0;
      for (var hi = 0; hi < hist.length; hi++) {
        if (hist[hi] > maxPop) {
          maxPop = hist[hi];
        }
      }
      if (hist.length <= 1) {
        return null;
      }
      var vbW = 200,
        vbH = 36,
        padT = 2,
        innerH = vbH - padT * 2;
      var spMax = maxPop || 1;
      var sparkPts = hist.map(function (p, idx) {
        var x = hist.length === 1 ? vbW / 2 : idx / (hist.length - 1) * vbW;
        var y = padT + (1 - p / spMax) * innerH;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      var spanLabel = hist.length >= 60 ? 'last 60 gen' : hist.length + ' gen';
      return /*#__PURE__*/React.createElement("div", {
        className: "sparkline-wrap"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sparkline-header"
      }, /*#__PURE__*/React.createElement("span", {
        className: "sparkline-title",
        onClick: this.togglePopGraph,
        style: {
          cursor: 'pointer'
        },
        title: "Click for full population graph"
      }, "Pop: " + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
        className: "sparkline-peak"
      }, "peak " + maxPop.toLocaleString() + (this.state.sessionPeakPop > maxPop ? " \xb7 all " + this.state.sessionPeakPop.toLocaleString() : ""))), /*#__PURE__*/React.createElement("svg", {
        className: "sparkline",
        width: "100%",
        height: vbH,
        viewBox: "0 0 " + vbW + " " + vbH,
        preserveAspectRatio: "none",
        role: "img",
        "aria-label": "Population sparkline"
      }, /*#__PURE__*/React.createElement("line", {
        x1: "0",
        y1: vbH - 0.5,
        x2: vbW,
        y2: vbH - 0.5,
        stroke: "rgba(244,233,225,0.25)",
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "0",
        y1: padT + innerH / 2,
        x2: vbW,
        y2: padT + innerH / 2,
        stroke: "rgba(244,233,225,0.1)",
        strokeWidth: "0.5"
      }), /*#__PURE__*/React.createElement("polyline", {
        points: sparkPts,
        fill: "none",
        stroke: CanvasRenderer._aliveRGB || '#70959A',
        strokeWidth: "1.5",
        strokeLinejoin: "round",
        strokeLinecap: "round"
      })), /*#__PURE__*/React.createElement("div", {
        className: "sparkline-footer"
      }, /*#__PURE__*/React.createElement("span", {
        className: "sparkline-gps"
      }, gpsText || ''), /*#__PURE__*/React.createElement("span", null, "← " + spanLabel + " →")));
    },
    renderMobileSparkline: function () {
      var svg = this.renderSparklineSVG();
      if (!svg) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-sparkline"
      }, svg);
    },
    renderMobileMinimapArea: function () {
      if (!this.state.showMinimap || this._minimapHidden) {
        return null;
      }
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-minimap-area"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "mobile-minimap-canvas",
        ref: function (c) {
          self._mobileMinimap = c;
        },
        role: "img",
        "aria-label": "Minimap navigation",
        onMouseDown: self.onMinimapElementDown,
        onMouseMove: self.onMinimapElementMove,
        onTouchStart: self.onMinimapElementDown,
        onTouchMove: self.onMinimapElementMove,
        onMouseUp: self.onMinimapElementUp,
        onTouchEnd: self.onMinimapElementUp
      }));
    },
    onMinimapElementDown: function (e) {
      e.preventDefault();
      this._mmElemDragging = true;
      this.panMinimapElement(e);
    },
    onMinimapElementMove: function (e) {
      if (!this._mmElemDragging) {
        return;
      }
      e.preventDefault();
      this.panMinimapElement(e);
    },
    onMinimapElementUp: function () {
      this._mmElemDragging = false;
    },
    panMinimapElement: function (e) {
      if (!this._mobileMinimap) {
        return;
      }
      var rect = this._mobileMinimap.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var frac_r = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      // Use stored world dims from last minimap render for accurate panning.
      var mmWorld = this._mmMobileWorld;
      var mmCols = mmWorld ? mmWorld.cols : this.state.cols;
      var mmRows = mmWorld ? mmWorld.rows : this.state.rows;
      var mmOC = mmWorld ? mmWorld.originC : 0;
      var mmOR = mmWorld ? mmWorld.originR : 0;
      var newVX = Math.round(frac_c * mmCols + mmOC - this._canvas.width / this.state.cellSize / 2);
      var newVY = Math.round(frac_r * mmRows + mmOR - this._canvas.height / this.state.cellSize / 2);
      var clamped = this.clampView(newVX, newVY, this.state.cols, this.state.rows, this.state.cellSize);
      var self = this;
      this.setState({
        viewX: clamped.viewX,
        viewY: clamped.viewY
      }, function () {
        self.drawBoard();
      });
    },
    drawMinimapMobile: function (liveCells, cols, rows, viewX, viewY, cellSize, theme) {
      if (!this._mobileMinimap) {
        return;
      }
      var isUnbounded = this.state.boundary === 'unbounded';
      var mmMobOriginR = 0,
        mmMobOriginC = 0;
      var mmRegionRows, mmRegionCols;
      // regionBounds used for mobile minimap bounding indicator
      if (isUnbounded) {
        var bb = SimEngine.getBoundingBox(liveCells);
        if (bb) {
          var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
          var newMinR = bb.minR - pad,
            newMinC = bb.minC - pad;
          var newMaxR = bb.maxR + pad,
            newMaxC = bb.maxC + pad;
          // Hysteresis: only expand, never shrink (prevents flashing).
          var prev = this._mmUnboundedRegion;
          if (prev) {
            newMinR = Math.min(prev.minR, newMinR);
            newMinC = Math.min(prev.minC, newMinC);
            newMaxR = Math.max(prev.maxR, newMaxR);
            newMaxC = Math.max(prev.maxC, newMaxC);
          }
          this._mmUnboundedRegion = {
            minR: newMinR,
            minC: newMinC,
            maxR: newMaxR,
            maxC: newMaxC
          };
          mmMobOriginR = newMinR;
          mmMobOriginC = newMinC;
          mmRegionRows = newMaxR - newMinR + 1;
          mmRegionCols = newMaxC - newMinC + 1;
        } else {
          mmMobOriginR = viewY - 50;
          mmMobOriginC = viewX - 50;
          mmRegionRows = 100;
          mmRegionCols = 100;
        }
      } else {
        // Bounded modes: fixed world region = region bounds + live cells + static padding.
        var rbm = this.state.regionBounds;
        var mmMR = rbm ? rbm.minR : 0;
        var mmMC = rbm ? rbm.minC : 0;
        var mmMXR = rbm ? rbm.maxR + 1 : rows;
        var mmMXC = rbm ? rbm.maxC + 1 : cols;
        var bbMob = SimEngine.getBoundingBox(liveCells);
        if (bbMob) {
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
      if (this._minimapCanvas.width !== mmW_css || this._minimapCanvas.height !== mmH_css) {
        this._minimapCanvas.width = mmW_css;
        this._minimapCanvas.height = mmH_css;
      }

      // Render minimap cells to off-screen canvas using actual theme colors.
      var mmCtx = this._minimapCanvas.getContext('2d');
      // Dark background for contrast (same approach as desktop drawMinimap).
      mmCtx.fillStyle = 'rgba(10,14,26,0.85)';
      mmCtx.fillRect(0, 0, mmW_css, mmH_css);
      var cellW = mmW_css / mmRegionCols;
      var cellH = mmH_css / mmRegionRows;
      mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
      var _mmMOR = mmMobOriginR,
        _mmMOC = mmMobOriginC,
        _mmMCols = mmRegionCols,
        _mmMRows = mmRegionRows;
      liveCells.forEach(function (_, key) {
        var rc = parseKey(key);
        var kr = rc[0] - _mmMOR;
        var kc = rc[1] - _mmMOC;
        if (kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
        var px = Math.floor(kc * cellW);
        var py = Math.floor(kr * cellH);
        var pw = Math.max(1, Math.ceil(cellW));
        var ph = Math.max(1, Math.ceil(cellH));
        mmCtx.fillRect(px, py, pw, ph);
      });

      // Region indicator on mobile minimap (bounded modes only).
      if (!isUnbounded && this.state.regionComponents) {
        var _compsM = this.state.regionComponents;
        if (_compsM.length > 0) {
          mmCtx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
          mmCtx.lineWidth = 1;
          mmCtx.setLineDash([3, 2]);
          for (var _ciM = 0; _ciM < _compsM.length; _ciM++) {
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
      var vpVisColsM = this._canvas ? this._canvas.width / cellSize : 100;
      var vpVisRowsM = this._canvas ? this._canvas.height / cellSize : 100;
      var vpW = vpVisColsM * cellW;
      var vpH = vpVisRowsM * cellH;
      var vpX = (viewX - mmMobOriginC) * cellW;
      var vpY = (viewY - mmMobOriginR) * cellH;
      // Only draw viewport rect if it overlaps the minimap area.
      var vpClampX = Math.max(0, vpX),
        vpClampY = Math.max(0, vpY);
      var vpClampR = Math.min(mmW_css, vpX + vpW),
        vpClampB = Math.min(mmH_css, vpY + vpH);
      if (vpClampR > vpClampX && vpClampB > vpClampY) {
        mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
        mmCtx.lineWidth = 1;
        mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
      }

      // Off-screen viewport indicator arrow.
      var vpCenterCm = viewX + vpVisColsM / 2;
      var vpCenterRm = viewY + vpVisRowsM / 2;
      var vpOutsideM = vpCenterCm < mmMobOriginC || vpCenterCm > mmMobOriginC + mmRegionCols || vpCenterRm < mmMobOriginR || vpCenterRm > mmMobOriginR + mmRegionRows;
      if (vpOutsideM) {
        var mmCCm = mmMobOriginC + mmRegionCols / 2,
          mmCRm = mmMobOriginR + mmRegionRows / 2;
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
      if (this._mobileMinimap.width !== mmW_css || this._mobileMinimap.height !== mmH_css) {
        this._mobileMinimap.width = mmW_css;
        this._mobileMinimap.height = mmH_css;
      }
      var mobileCtx = this._mobileMinimap.getContext('2d');
      mobileCtx.drawImage(this._minimapCanvas, 0, 0);
      // Store world dims for mobile minimap panning.
      this._mmMobileWorld = {
        originC: mmMobOriginC,
        originR: mmMobOriginR,
        cols: mmRegionCols,
        rows: mmRegionRows
      };
    },
    renderStats: function () {
      var population = this.state.liveCells.size;
      var hc = this.state.hoverCell;
      var coordText = hc ? 'Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r : '\u2014';
      var sparkline = this.renderSparklineSVG();
      return /*#__PURE__*/React.createElement("div", {
        className: "stats"
      }, /*#__PURE__*/React.createElement("div", {
        className: "stat-row"
      }, /*#__PURE__*/React.createElement("span", null, "Gen: " + this.state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", {
        className: "board-dims"
      }, this.state.cols + "\u00d7" + this.state.rows)), /*#__PURE__*/React.createElement("div", {
        className: "stat-row"
      }, /*#__PURE__*/React.createElement("div", {
        className: "status-badges"
      }, /*#__PURE__*/React.createElement("span", {
        className: "status-indicator " + (this.state.running ? "status-running" : "status-paused")
      }, this.state.running ? "Running" : "Paused"), this.state.stable && /*#__PURE__*/React.createElement("span", {
        className: "status-indicator status-stable"
      }, "Stable")), /*#__PURE__*/React.createElement("div", {
        className: "coord-display"
      }, coordText)), sparkline || /*#__PURE__*/React.createElement("div", {
        className: "sparkline-placeholder"
      }, "Pop: " + population.toLocaleString()));
    },
    // ── Shared mobile sub-components (R10) ─────────────────────────────
    // Extracted from 3 duplicated mobile render methods.

    _MOBILE_TABS: [{
      id: 'simulate',
      icon: 'fa-play',
      label: 'Simulate'
    }, {
      id: 'board',
      icon: 'fa-th',
      label: 'Board'
    }, {
      id: 'view',
      icon: 'fa-eye',
      label: 'View'
    }, {
      id: 'tools',
      icon: 'fa-pencil',
      label: 'Tools'
    }, {
      id: 'rules',
      icon: 'fa-cog',
      label: 'Rules'
    }, {
      id: 'export',
      icon: 'fa-download',
      label: 'Export'
    }],
    _buildSheetContent: function () {
      if (!this.state.bottomSheetOpen) {
        return null;
      }
      return this._buildTabContent(this.state.bottomSheetTab, {
        sectionTitle: true,
        sparkline: true
      });
    },
    // Shared tab content builder used by mobile sheet, desktop rail, and context tray.
    _buildTabContent: function (tabId, options) {
      options = options || {};
      switch (tabId) {
        case 'simulate':
          return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
            className: "sidebar-section-title"
          }, "Simulate"), this.renderTransportControls(false), this.renderSpeedSlider(), options.sparkline && this.renderMobileSparkline());
        case 'board':
          return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
            className: "sidebar-section-title"
          }, "Board"), this.renderBoardSliders(), this.renderBoundaryControls());
        case 'view':
          return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
            className: "sidebar-section-title"
          }, "View"), this.renderViewControls(), this.renderZoomSlider(), this.renderDisplaySettings());
        case 'tools':
          return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
            className: "sidebar-section-title"
          }, "Tools"), this.renderModeControls(), this.renderToolsContent());
        case 'rules':
          return this.renderRulesSection();
        case 'export':
          return this.renderExportContent();
        default:
          return null;
      }
    },
    _renderStatsChip: function () {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "stats-chip",
        onClick: this.togglePopGraph,
        role: "button",
        tabIndex: "0",
        "aria-atomic": "true",
        "aria-live": "off",
        onKeyDown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            self.togglePopGraph();
          }
        }
      }, /*#__PURE__*/React.createElement("span", null, "Gen " + this.state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", null, "\u2002Pop " + this.state.liveCells.size.toLocaleString()), /*#__PURE__*/React.createElement("span", {
        className: "status-indicator status-icon " + (this.state.running ? "status-running" : "status-paused")
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.stable ? "fa-check-circle" : this.state.running ? "fa-play" : "fa-pause")
      }), " ", this.state.stable ? "Stable" : this.state.running ? "Run" : "Pause"));
    },
    _renderMobileTransportBar: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-transport-bar",
        role: "toolbar",
        "aria-label": "Simulation transport"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        "aria-label": this.state.running ? "Pause simulation" : "Play simulation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        "aria-label": "Step one generation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        "aria-label": "Reset simulation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.panMode ? " active" : ""),
        onClick: this.togglePanMode,
        "aria-label": this.state.panMode ? "Switch to " + (this.state.drawMode === 'select' ? "select" : this.state.drawMode === 'preset' ? "preset" : this.state.drawMode === 'region' ? "region" : "draw") + " mode" : "Switch to pan mode",
        "aria-pressed": this.state.panMode
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.panMode ? this.state.drawMode === 'select' ? "fa-crosshairs" : this.state.drawMode === 'preset' ? "fa-puzzle-piece" : this.state.drawMode === 'region' ? "fa-th" : "fa-pencil" : "fa-hand-paper-o"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("span", {
        className: "mobile-transport-mode",
        "aria-live": "polite"
      }, this.state.panMode ? 'Pan' : this.state.drawMode === 'preset' && this.state.selectedPattern ? this.state.selectedPattern : this.state.drawMode === 'select' ? 'Select' : this.state.drawMode === 'region' ? 'Region' : 'Draw'), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle btn-sheet-toggle" + (this.state.bottomSheetOpen ? " active" : ""),
        onClick: this.toggleBottomSheet,
        "aria-expanded": this.state.bottomSheetOpen,
        "aria-label": "Open controls panel"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-ellipsis-h",
        "aria-hidden": "true"
      })));
    },
    _renderBottomSheet: function (sheetContent) {
      var self = this;
      var tabs = this._MOBILE_TABS;
      var layoutSwitcher = this.renderLayoutSwitcher();
      return /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-container",
        onKeyDown: function (e) {
          self._onSheetKeyDown(e);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-backdrop",
        onClick: this.toggleBottomSheet,
        role: "presentation",
        "aria-hidden": "true"
      }), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet" + (this.state.bottomSheetClosing ? " sheet-closing" : ""),
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Controls panel",
        onTouchStart: function (e) {
          self._onSheetTouchStart(e);
        },
        onTouchMove: function (e) {
          self._onSheetTouchMove(e);
        },
        onTouchEnd: function (e) {
          self._onSheetTouchEnd(e);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-handle"
      }), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-tabs",
        role: "tablist",
        "aria-label": "Control categories"
      }, tabs.map(function (tab) {
        var isActive = self.state.bottomSheetTab === tab.id;
        return /*#__PURE__*/React.createElement("button", {
          key: tab.id,
          className: "rail-tab" + (isActive ? " active" : ""),
          onClick: function () {
            self.setBottomSheetTab(tab.id);
          },
          role: "tab",
          "aria-selected": isActive,
          "aria-label": tab.label,
          "aria-controls": "sheet-panel-" + tab.id
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + tab.icon,
          "aria-hidden": "true"
        }), /*#__PURE__*/React.createElement("span", {
          className: "rail-tab-label"
        }, tab.label));
      })), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-content",
        id: "sheet-panel-" + this.state.bottomSheetTab,
        role: "tabpanel",
        "aria-label": this.state.bottomSheetTab + " controls"
      }, sheetContent, layoutSwitcher && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 12px 0',
          borderTop: '1px solid var(--panel-border)'
        }
      }, layoutSwitcher))));
    },
    renderMobileContextPanel: function () {
      var self = this;
      var showRotation = this.state.drawMode === 'preset' && this.state.selectedPattern;
      var showSelection = this.state.selection !== null;
      if (!showRotation && !showSelection) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-context-panel"
      }, showRotation && /*#__PURE__*/React.createElement("div", {
        className: "rotation-btns"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCCW,
        title: "Rotate 90\xB0 counter-clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCW,
        title: "Rotate 90\xB0 clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          InputHandler._previewPos = null;
          self.setState({
            selectedPattern: null,
            patternRotation: 0,
            drawMode: 'paint'
          }, function () {
            self.drawBoard();
          });
        },
        "aria-label": "Cancel pattern placement",
        title: "Cancel placement"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      }))), showSelection && /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-selection"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copySelection,
        disabled: !this.state.selection,
        title: "Copy selected cells",
        "aria-label": "Copy selected cells"
      }, "Copy"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.pasteAsPattern,
        disabled: !this.state.clipboard || this.state.clipboard.length === 0,
        title: "Paste copied cells",
        "aria-label": "Paste copied cells"
      }, "Paste"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.deleteSelection,
        disabled: !this.state.selection,
        title: "Delete selected cells",
        "aria-label": "Delete selected cells"
      }, "Delete"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.setState({
            selection: null
          }, function () {
            self.drawBoard();
          });
        },
        title: "Clear selection",
        "aria-label": "Clear selection"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      }))));
    },
    renderMobileStatsBar: function () {
      var population = this.state.liveCells.size;
      var hist = this.state.popHistory;
      var trendArrow = '';
      if (hist.length >= 5) {
        var delta = hist[hist.length - 1] - hist[hist.length - 5];
        trendArrow = delta > 2 ? ' \u25b2' : delta < -2 ? ' \u25bc' : ' \u223c';
      }
      var statusLabel = this.state.stable ? 'Stable' : this.state.running ? 'Running' : 'Paused';
      var statusClass = this.state.stable ? 'status-stable' : this.state.running ? 'status-running' : 'status-paused';
      var contextLabel = this.state.drawMode === 'preset' && this.state.selectedPattern ? this.state.selectedPattern : this.state.drawMode === 'select' ? 'Select' : 'Draw';
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-stats-bar"
      }, /*#__PURE__*/React.createElement("span", {
        className: "msb-left"
      }, /*#__PURE__*/React.createElement("span", {
        className: "msb-title"
      }, "Conway's Game of Life"), 'Gen\u00a0' + this.state.generations.toLocaleString() + '\u2002Pop\u00a0' + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
        className: 'status-indicator ' + statusClass
      }, statusLabel), /*#__PURE__*/React.createElement("span", {
        className: "msb-right"
      }, contextLabel));
    },
    // ── Horizontal toolbar (desktop/tablet only — hidden on mobile via CSS) ──
    renderToolbar: function () {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "toolbar-strip"
      }, /*#__PURE__*/React.createElement("span", {
        className: "toolbar-title"
      }, "Conway's\nGame of Life"), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-groups"
      }, /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        title: "Start or pause the simulation (Space)"
      }, this.state.running ? "Pause" : "Play"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        title: "Advance one generation (Enter)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      }), " Step"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepBack,
        title: "Step backward to a previous generation (,)",
        disabled: this._genHistory.length === 0
      }, "Back"), /*#__PURE__*/React.createElement("select", {
        className: "toolbar-step-select",
        value: this.state.stepCount,
        onChange: this.setStepCount,
        title: "Advance N generations at once (Shift+.)"
      }, /*#__PURE__*/React.createElement("option", {
        value: "1"
      }, "+1"), /*#__PURE__*/React.createElement("option", {
        value: "10"
      }, "+10"), /*#__PURE__*/React.createElement("option", {
        value: "50"
      }, "+50"), /*#__PURE__*/React.createElement("option", {
        value: "100"
      }, "+100"), /*#__PURE__*/React.createElement("option", {
        value: "500"
      }, "+500")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.stepN(self.state.stepCount);
        },
        title: "Advance multiple generations (Shift+.)"
      }, "Go")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        title: "Randomize the board (R)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      }), " Reset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.emptyBoard,
        title: "Clear all cells (E)"
      }, "Empty"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.undo,
        title: "Undo last edit (Ctrl+Z)"
      }, "Undo")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitView,
        title: "Zoom to fit entire grid"
      }, "Fit Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitLiveCells,
        title: "Zoom to fit live cells"
      }, "Fit Cells"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.gridLines ? " active" : ""),
        onClick: this.toggleGridLines,
        title: "Toggle grid lines (G)"
      }, "Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showTrails ? " active" : ""),
        onClick: this.toggleTrails,
        title: "Show ghost trails of recently-dead cells"
      }, "Trails"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showMinimap ? " active" : ""),
        onClick: this.toggleMinimap,
        title: "Show/hide minimap overview (M)"
      }, "Minimap")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : ""),
        onClick: this.toggleDrawMode,
        title: "Freehand draw mode (D)"
      }, "Draw"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : ""),
        onClick: this.togglePresetMode,
        title: "Place preset patterns (P)"
      }, "Preset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : ""),
        onClick: this.toggleSelectMode,
        title: "Select and move cells (S)"
      }, "Select"), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'region' ? " active" : ""),
        onClick: this.toggleRegionMode,
        title: "Draw/erase region bounds (B)"
      }, "Region"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.livePaintMode ? " active" : ""),
        onClick: this.toggleLivePaint,
        title: "Paint cells while the simulation is running"
      }, "Live Paint"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : ""),
        onClick: this.toggleBoundary,
        title: "Cycle boundary: Wrap \u2192 Hard \u2192 Infinite"
      }, this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.analyzePattern,
        disabled: this.state.analyzing,
        title: "Detect oscillator period or spaceship velocity"
      }, "Analyze"))));
    },
    renderDisplaySettings: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "display-settings"
      }, /*#__PURE__*/React.createElement("label", {
        className: "control-group-label"
      }, "Display"), /*#__PURE__*/React.createElement("div", {
        className: "presets-col"
      }, /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Color theme",
        value: this.state.theme,
        onChange: this.setTheme
      }, Object.keys(THEMES).map(function (t) {
        return /*#__PURE__*/React.createElement("option", {
          key: t,
          value: t
        }, t);
      })), /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Dark mode preference",
        value: this.state.darkModePref,
        onChange: this.setDarkModePref,
        title: "UI dark mode preference"
      }, /*#__PURE__*/React.createElement("option", {
        value: "system"
      }, "Mode: System"), /*#__PURE__*/React.createElement("option", {
        value: "light"
      }, "Mode: Light"), /*#__PURE__*/React.createElement("option", {
        value: "dark"
      }, "Mode: Dark"))));
    },
    renderRulesSection: function () {
      var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Rules"), /*#__PURE__*/React.createElement("div", {
        className: "presets-col"
      }, /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Rule preset",
        value: this.state.rulePreset,
        onChange: this.setRulePreset
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "Rule preset..."), RULE_PRESETS.map(function (p) {
        return /*#__PURE__*/React.createElement("option", {
          key: p.rule,
          value: p.rule
        }, p.name);
      })), /*#__PURE__*/React.createElement("label", {
        className: "slider-title rule-label"
      }, "Rule (B/S notation)"), /*#__PURE__*/React.createElement("input", {
        className: "rule-input" + (ruleValid ? "" : " rule-input-invalid"),
        type: "text",
        value: this.state.ruleString,
        onChange: this.setRule,
        title: "Birth/Survival rule string (e.g. B3/S23)"
      })));
    },
    renderBoardSliders: function () {
      var isUnbounded = this.state.boundary === 'unbounded';
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Width: " + this.state.pendingCols), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "20",
        max: "2000",
        step: "10",
        "aria-label": "Grid width",
        value: this.state.pendingCols,
        onChange: this.setWidth,
        onMouseUp: this.applyWidth,
        onKeyDown: this.onWidthKeyDown,
        onTouchEnd: this.applyWidth
      }))), !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Height: " + this.state.pendingRows), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "20",
        max: "2000",
        step: "10",
        "aria-label": "Grid height",
        value: this.state.pendingRows,
        onChange: this.setHeight,
        onMouseUp: this.applyHeight,
        onKeyDown: this.onHeightKeyDown,
        onTouchEnd: this.applyHeight
      }))), !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Grid presets"), /*#__PURE__*/React.createElement("div", {
        className: "grid-presets"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(100, 100);
        }.bind(this),
        title: "Set grid to 100\xD7100"
      }, "100\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(200, 200);
        }.bind(this),
        title: "Set grid to 200\xD7200"
      }, "200\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(400, 400);
        }.bind(this),
        title: "Set grid to 400\xD7400"
      }, "400\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(1000, 1000);
        }.bind(this),
        title: "Set grid to 1000\xD71000"
      }, "1000\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(2000, 2000);
        }.bind(this),
        title: "Set grid to 2000\xD72000"
      }, "2000\xB2"))), isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title",
        style: {
          fontStyle: 'italic'
        }
      }, "No bounding box \u2014 infinite canvas")), /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Fill Density (on Reset)"), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "2",
        max: "7",
        "aria-label": "Fill density",
        value: 9 - this.state.sparseness,
        onChange: this.setDensity
      }))));
    },
    renderSpeedSlider: function () {
      var delay = SPEED_DELAYS[this.state.speed - 1];
      var speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
      return /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Speed: " + speedLabel), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "1",
        max: "10",
        "aria-label": "Simulation speed",
        value: this.state.speed,
        onChange: this.setSpeed
      })));
    },
    renderZoomSlider: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Zoom: " + this.state.cellSize + "\u00a0px/cell"), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "1",
        max: "32",
        step: "1",
        "aria-label": "Zoom level",
        value: this.state.cellSize,
        onChange: this.setZoom
      })));
    },
    renderRLESection: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "rle-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "buttons rle-toggle-row"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rle-toggle btn-block" + (this.state.showRle ? " active" : ""),
        onClick: this.toggleRle
      }, "Import RLE / Plaintext")), this.state.showRle && /*#__PURE__*/React.createElement("div", {
        className: "rle-body"
      }, /*#__PURE__*/React.createElement("textarea", {
        className: "rle-input",
        rows: "5",
        placeholder: "Paste RLE or plaintext pattern\n(from LifeWiki or Golly)",
        value: this.state.rleInput,
        onChange: this.setRleInput
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-block",
        onClick: this.loadRle,
        title: "Load the RLE or plaintext pattern"
      }, "Load pattern"), this.state.rleError && /*#__PURE__*/React.createElement("p", {
        className: "rle-error"
      }, this.state.rleError))));
    },
    // ── Shared sub-components (used by all layout modes) ───────────

    renderCanvas: function (cs) {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "app-canvas-container"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "display",
        ref: function (c) {
          self._canvas = c;
        },
        width: cs.w,
        height: cs.h,
        style: {
          width: cs.displayW + 'px',
          height: cs.displayH + 'px',
          display: 'block',
          margin: '0 auto'
        },
        id: "life-canvas",
        role: "application",
        "aria-roledescription": "Game of Life grid",
        "aria-label": "Conway's Game of Life simulation canvas",
        draggable: false,
        onMouseDown: this.onMouseDown,
        onMouseMove: this.onMouseMove,
        onMouseUp: this.onMouseUp,
        onMouseLeave: this.onMouseLeave,
        onContextMenu: this.onContextMenu,
        onTouchStart: this.onTouchStart,
        onTouchMove: this.onTouchMove,
        onTouchEnd: this.onTouchEnd
      }), this.state.analysisResult ? /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "analysis-result" + (this.state.analyzing ? " analysis-cancellable" : ""),
        onClick: this.state.analyzing ? this.cancelAnalysis : null,
        "aria-live": "assertive"
      }, this.state.analysisResult) : null);
    },
    renderTransportControls: function (compact) {
      var self = this;
      if (compact) {
        return /*#__PURE__*/React.createElement("div", {
          className: "transport-controls transport-compact"
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn btn-toggle" + (this.state.running ? " active" : ""),
          onClick: this.toggleGame,
          title: "Play/Pause (Space)"
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
          "aria-hidden": "true"
        })), /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn",
          onClick: this.stepGame,
          title: "Step (.)"
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa fa-step-forward",
          "aria-hidden": "true"
        }), " Step"), /*#__PURE__*/React.createElement("span", {
          className: "transport-speed-label"
        }, "Gen " + this.state.generations.toLocaleString()));
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "transport-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        title: "Start or pause the simulation (Space)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
        "aria-hidden": "true"
      }), " ", this.state.running ? "Pause" : "Play"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        title: "Advance one generation (Enter)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      }), " Step"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepBack,
        title: "Step backward (,)",
        disabled: this._genHistory && this._genHistory.length === 0
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-backward",
        "aria-hidden": "true"
      }), " Back"), /*#__PURE__*/React.createElement("select", {
        className: "toolbar-step-select",
        value: this.state.stepCount,
        onChange: this.setStepCount,
        title: "Advance N generations"
      }, /*#__PURE__*/React.createElement("option", {
        value: "1"
      }, "+1"), /*#__PURE__*/React.createElement("option", {
        value: "10"
      }, "+10"), /*#__PURE__*/React.createElement("option", {
        value: "50"
      }, "+50"), /*#__PURE__*/React.createElement("option", {
        value: "100"
      }, "+100"), /*#__PURE__*/React.createElement("option", {
        value: "500"
      }, "+500")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.stepN(self.state.stepCount);
        },
        title: "Advance multiple generations"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-fast-forward",
        "aria-hidden": "true"
      }), " Go"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        title: "Randomize the board (R)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      }), " Reset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.emptyBoard,
        title: "Clear all cells (E)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-eraser",
        "aria-hidden": "true"
      }), " Empty"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.undo,
        title: "Undo last edit (Ctrl+Z)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      }), " Undo"));
    },
    renderViewControls: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "view-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitView,
        title: "Zoom to fit entire grid"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-arrows-alt",
        "aria-hidden": "true"
      }), " Fit Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitLiveCells,
        title: "Zoom to fit live cells"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-compress",
        "aria-hidden": "true"
      }), " Fit Cells"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.gridLines ? " active" : ""),
        onClick: this.toggleGridLines,
        title: "Toggle grid lines (G)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      }), " Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showTrails ? " active" : ""),
        onClick: this.toggleTrails,
        title: "Show ghost trails"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-eye",
        "aria-hidden": "true"
      }), " Trails"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showMinimap ? " active" : ""),
        onClick: this.toggleMinimap,
        title: "Show/hide minimap (M)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-map-o",
        "aria-hidden": "true"
      }), " Minimap"));
    },
    renderBoundaryControls: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "boundary-controls"
      }, /*#__PURE__*/React.createElement("label", {
        className: "control-group-label"
      }, "Boundary"), /*#__PURE__*/React.createElement("div", {
        className: "view-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : ""),
        onClick: this.toggleBoundary,
        title: "Cycle boundary: Wrap / Hard / Infinite"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      }), " ", this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E")));
    },
    renderModeControls: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "mode-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : ""),
        onClick: this.toggleDrawMode,
        title: "Freehand draw mode (D)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-pencil",
        "aria-hidden": "true"
      }), " Draw"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : ""),
        onClick: this.togglePresetMode,
        title: "Place preset patterns (P)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-puzzle-piece",
        "aria-hidden": "true"
      }), " Preset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : ""),
        onClick: this.toggleSelectMode,
        title: "Select and move cells (S)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-mouse-pointer",
        "aria-hidden": "true"
      }), " Select"), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'region' ? " active" : ""),
        onClick: this.toggleRegionMode,
        title: "Draw/erase region bounds (B)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      }), " Region"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.livePaintMode ? " active" : ""),
        onClick: this.toggleLivePaint,
        title: "Paint while running"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-paint-brush",
        "aria-hidden": "true"
      }), " Live Paint"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.analyzePattern,
        disabled: this.state.analyzing,
        title: "Detect oscillator/spaceship"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-crosshairs",
        "aria-hidden": "true"
      }), " Analyze"));
    },
    renderToolsContent: function () {
      var self = this;
      var filterLc = this.state.patternFilter.toLowerCase();
      var patternOptions = Object.keys(PATTERN_GROUPS).map(function (group) {
        var names = Object.keys(PATTERN_GROUPS[group]).filter(function (name) {
          return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
        });
        if (names.length === 0) {
          return null;
        }
        var opts = names.map(function (name) {
          var meta = PATTERN_META[name];
          var title = '';
          if (meta) {
            if (meta.type === 'Still life') title = 'Still life \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Oscillator') title = 'Oscillator \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Spaceship') title = 'Spaceship \xB7 Period\u00a0' + meta.period + (meta.note ? ' \xB7 ' + meta.note : '');else if (meta.type === 'Methuselah') title = 'Methuselah \xB7 ' + meta.lifespan + '\u00a0gen lifespan \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Gun') title = 'Gun \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
          }
          return /*#__PURE__*/React.createElement("option", {
            key: name,
            value: name,
            title: title
          }, name);
        });
        return /*#__PURE__*/React.createElement("optgroup", {
          key: group,
          label: group
        }, opts);
      }).filter(function (x) {
        return x !== null;
      });
      if (PATTERNS['Custom']) {
        patternOptions = patternOptions.concat(/*#__PURE__*/React.createElement("optgroup", {
          key: "custom",
          label: "Custom"
        }, /*#__PURE__*/React.createElement("option", {
          value: "Custom"
        }, "Custom")));
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "tools-content"
      }, /*#__PURE__*/React.createElement("div", {
        className: "btn-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Draw:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.drawTool,
        onChange: function (e) {
          self.setState({
            drawTool: e.target.value,
            drawMode: 'paint',
            selection: null
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "cell"
      }, "Cell paint"), /*#__PURE__*/React.createElement("option", {
        value: "line"
      }, "Line"), /*#__PURE__*/React.createElement("option", {
        value: "fill"
      }, "Flood fill"), /*#__PURE__*/React.createElement("option", {
        value: "shape-rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "shape-circle"
      }, "Circle"))), /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Select:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.selectTool,
        onChange: function (e) {
          self.setState({
            selectTool: e.target.value,
            drawMode: 'select',
            selection: null
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "ellipse"
      }, "Ellipse"), /*#__PURE__*/React.createElement("option", {
        value: "freeform"
      }, "Freeform"), /*#__PURE__*/React.createElement("option", {
        value: "all-visible"
      }, "All visible"))), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Region:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.regionTool,
        onChange: function (e) {
          self.setState({
            regionTool: e.target.value,
            drawMode: 'region'
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "cell"
      }, "Cell paint"), /*#__PURE__*/React.createElement("option", {
        value: "line"
      }, "Line"), /*#__PURE__*/React.createElement("option", {
        value: "fill"
      }, "Flood fill"), /*#__PURE__*/React.createElement("option", {
        value: "shape-rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "shape-circle"
      }, "Circle"))), /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Preset:"), /*#__PURE__*/React.createElement("select", {
        className: "preset-select" + (this.state.drawMode === 'preset' && this.state.selectedPattern ? " active" : ""),
        value: this.state.selectedPattern || "",
        onChange: this.selectPattern
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "Choose preset..."), patternOptions)), /*#__PURE__*/React.createElement("input", {
        className: "pattern-filter-input",
        type: "search",
        placeholder: "Filter patterns...",
        "aria-label": "Filter patterns",
        value: this.state.patternFilter,
        onChange: function (e) {
          self.setState({
            patternFilter: e.target.value
          });
        }
      }), this.state.drawMode === 'preset' && this.state.selectedPattern && /*#__PURE__*/React.createElement("div", {
        className: "rotation-row"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "rotation-preview",
        width: "96",
        height: "96",
        role: "img",
        "aria-label": "Pattern rotation preview",
        ref: function (c) {
          self._previewCanvas = c;
          if (c) requestAnimationFrame(function () {
            self.drawRotationPreview();
          });
        }
      }), /*#__PURE__*/React.createElement("div", {
        className: "rotation-btns"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCCW,
        title: "Rotate 90\xB0 counter-clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCW,
        title: "Rotate 90\xB0 clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self._previewPos = null;
          self.setState({
            selectedPattern: null,
            patternRotation: 0,
            drawMode: 'paint'
          }, function () {
            self.drawBoard();
          });
        },
        "aria-label": "Cancel pattern placement",
        title: "Cancel placement"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      })))), this.state.selection && /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-selection"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copySelection,
        title: "Copy selected cells",
        "aria-label": "Copy selected cells"
      }, "Copy"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.pasteAsPattern,
        disabled: !this.state.clipboard || this.state.clipboard.length === 0,
        title: "Paste copied cells",
        "aria-label": "Paste copied cells"
      }, "Paste"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.deleteSelection,
        title: "Delete selected cells",
        "aria-label": "Delete selected cells"
      }, "Delete"))));
    },
    renderExportContent: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "export-content"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Import / Export"), /*#__PURE__*/React.createElement("div", {
        className: "btn-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-export"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.exportPNG,
        title: "Save as PNG"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-camera",
        "aria-hidden": "true"
      }), " Export PNG"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copyRLE,
        title: "Copy board as RLE"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-clipboard",
        "aria-hidden": "true"
      }), " Copy RLE"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.recording ? " active btn-record" : ""),
        onClick: this.toggleRecording,
        title: "Record an animated GIF",
        "aria-label": this.state.recording ? "Stop recording" : "Record GIF"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.recording ? "fa-stop" : "fa-circle"),
        "aria-hidden": "true"
      }), " ", this.state.recording ? "Stop" : "Record"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.shareURL,
        title: "Copy shareable URL to clipboard",
        "aria-label": "Share simulation URL"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-share-alt",
        "aria-hidden": "true"
      }), " ", this.state.shareTooltip ? "Copied!" : "Share")), this.renderRLESection()));
    },
    renderLayoutSwitcher: function () {
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return null;
      }
      var self = this;
      var mode = this.state.layoutMode;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-switcher"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (mode === 'cartographer' ? " active" : ""),
        onClick: function () {
          self.setLayoutMode('cartographer');
        },
        title: "Cartographer: Edge rail with tabs",
        "aria-label": "Cartographer layout: edge rail with tabs"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-columns"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (mode === 'observatory' ? " active" : ""),
        onClick: function () {
          self.setLayoutMode('observatory');
        },
        title: "Observatory: Floating panels",
        "aria-label": "Observatory layout: floating panels"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th-large"
      })));
    },
    // ── Cartographer layout ─────────────────────────────────────────

    renderCartographer: function (cs) {
      var self = this;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return this.renderCartographerMobile(cs);
      }
      var railW = this.state.railHidden ? 0 : this.state.railCollapsed ? 40 : dc === 'tablet' ? 200 : 240;
      var railSide = this.state.railSide;
      var railClass = 'rail' + (this.state.railCollapsed ? ' rail-collapsed' : '') + (this.state.railHidden ? ' rail-hidden' : '') + (' rail-' + railSide);
      var tabContent = /*#__PURE__*/React.createElement("div", {
        className: "rail-tab-content"
      }, this._buildTabContent(this.state.railTab, {
        sectionTitle: true
      }));
      var tabs = this._MOBILE_TABS;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-cartographer"
      }, this.renderCanvas(cs), /*#__PURE__*/React.createElement("div", {
        className: railClass,
        style: {
          width: railW + 'px'
        },
        role: "complementary",
        "aria-label": "Controls panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "rail-header"
      }, /*#__PURE__*/React.createElement("span", {
        className: "rail-title"
      }, "Game of Life"), /*#__PURE__*/React.createElement("div", {
        className: "rail-header-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleRailSide,
        "aria-label": this.state.railSide === 'right' ? "Move panel to left" : "Move panel to right",
        title: this.state.railSide === 'right' ? "Move panel to left" : "Move panel to right"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.railSide === 'right' ? "fa-indent" : "fa-dedent"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn rail-collapse-btn",
        onClick: this.toggleRailCollapsed,
        "aria-expanded": !this.state.railCollapsed,
        "aria-label": this.state.railCollapsed ? "Expand controls panel" : "Collapse controls panel"
      }, this.state.railCollapsed ? /*#__PURE__*/React.createElement("i", {
        className: "fa fa-chevron-left",
        "aria-hidden": "true"
      }) : /*#__PURE__*/React.createElement("i", {
        className: "fa fa-chevron-right",
        "aria-hidden": "true"
      })))), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        className: "rail-stats"
      }, this.renderStats()), /*#__PURE__*/React.createElement("div", {
        className: "rail-tabs",
        role: "tablist",
        "aria-label": "Control categories"
      }, tabs.map(function (tab) {
        var isActive = self.state.railTab === tab.id;
        return /*#__PURE__*/React.createElement("button", {
          key: tab.id,
          className: "rail-tab" + (isActive ? " active" : ""),
          onClick: function () {
            self.setRailTab(tab.id);
          },
          role: "tab",
          "aria-selected": isActive,
          "aria-controls": "rail-panel-" + tab.id,
          "aria-label": tab.label
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + tab.icon,
          "aria-hidden": "true"
        }), !self.state.railCollapsed && /*#__PURE__*/React.createElement("span", {
          className: "rail-tab-label"
        }, tab.label));
      })), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        id: "rail-panel-" + this.state.railTab,
        role: "tabpanel",
        "aria-label": this.state.railTab + " controls",
        style: {
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }
      }, tabContent), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 12px',
          borderTop: '1px solid var(--panel-border)',
          flexShrink: 0
        }
      }, this.renderLayoutSwitcher())), /*#__PURE__*/React.createElement("div", {
        className: "transport-strip",
        role: "toolbar",
        "aria-label": "Simulation transport"
      }, this.renderTransportControls(true)), this.state.railHidden && /*#__PURE__*/React.createElement("div", {
        className: "rail-reveal rail-reveal-" + railSide,
        onMouseEnter: this.toggleRailHidden
      }), this.renderMobileMinimapArea());
    },
    renderCartographerMobile: function (cs) {
      var sheetContent = this._buildSheetContent();
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-cartographer layout-mobile"
      }, this.renderCanvas(cs), !this.state.bottomSheetOpen && !this._statsChipHidden && this._renderStatsChip(), !this.state.bottomSheetOpen && this.renderMobileContextPanel(), !this.state.bottomSheetOpen && this.renderMobileMinimapArea(), this._renderMobileTransportBar(), this.state.bottomSheetOpen && this._renderBottomSheet(sheetContent));
    },
    // ── Observatory layout ───────────────────────────────────────────

    renderObservatory: function (cs) {
      var self = this;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return this.renderObservatoryMobile(cs);
      }
      var panels = this.state.panelStates;
      var zenMode = this.state.zenMode;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-observatory" + (zenMode ? " zen-mode" : "")
      }, this.renderCanvas(cs), !zenMode && /*#__PURE__*/React.createElement("div", {
        className: "panel-overlay-container",
        role: "group",
        "aria-label": "Floating control panels"
      }, this._renderFloatPanel('transport', 'Simulate', /*#__PURE__*/React.createElement("div", null, this.renderTransportControls(false), this.renderSpeedSlider())), this._renderFloatPanel('board', 'Board', /*#__PURE__*/React.createElement("div", null, this.renderBoardSliders(), this.renderBoundaryControls())), this._renderFloatPanel('view', 'View', /*#__PURE__*/React.createElement("div", null, this.renderViewControls(), this.renderZoomSlider(), this.renderDisplaySettings())), this._renderFloatPanel('mode', 'Tools', /*#__PURE__*/React.createElement("div", null, this.renderModeControls(), this.renderToolsContent())), this._renderFloatPanel('rules', 'Rules', this.renderRulesSection()), this._renderFloatPanel('stats', 'Stats', this.renderStats()), this._renderFloatPanel('importExport', 'Import / Export', this.renderExportContent()), this.state.panelGroups.map(function (group) {
        return self._renderPanelGroup(group);
      }), /*#__PURE__*/React.createElement("div", {
        className: "panel-menu",
        role: "group",
        "aria-label": "Panel visibility"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn panel-menu-toggle",
        onClick: function () {
          self.setState({
            panelMenuOpen: !self.state.panelMenuOpen
          });
        },
        "aria-expanded": !!this.state.panelMenuOpen,
        "aria-label": "Toggle panel visibility menu"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      })), this.state.panelMenuOpen && /*#__PURE__*/React.createElement("div", {
        className: "panel-menu-list",
        role: "group",
        "aria-label": "Panel toggles"
      }, ['transport', 'board', 'view', 'mode', 'rules', 'stats', 'importExport'].map(function (id) {
        var PANEL_LABELS = {
          transport: 'Simulate',
          board: 'Board',
          view: 'View',
          mode: 'Tools',
          rules: 'Rules',
          stats: 'Stats',
          importExport: 'Import / Export'
        };
        var label = PANEL_LABELS[id] || id;
        return /*#__PURE__*/React.createElement("label", {
          key: id,
          className: "panel-menu-item"
        }, /*#__PURE__*/React.createElement("input", {
          type: "checkbox",
          checked: panels[id].open,
          onChange: function () {
            self._togglePanelOpen(id);
          },
          "aria-label": "Show " + label + " panel"
        }), /*#__PURE__*/React.createElement("span", null, label));
      })), this.renderLayoutSwitcher())), this.renderMobileMinimapArea());
    },
    renderObservatoryMobile: function (cs) {
      var sheetContent = this._buildSheetContent();
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-observatory layout-mobile"
      }, this.renderCanvas(cs), this._renderMobileTransportBar(), !this.state.bottomSheetOpen && !this._statsChipHidden && this._renderStatsChip(), !this.state.bottomSheetOpen && this.renderMobileContextPanel(), !this.state.bottomSheetOpen && this.renderMobileMinimapArea(), this.state.bottomSheetOpen && this._renderBottomSheet(sheetContent));
    },
    // ── Float panel helper (Observatory) ─────────────────────────────

    _renderFloatPanel: function (panelId, label, content) {
      var self = this;
      var ps = this.state.panelStates[panelId];
      if (!ps || !ps.open) {
        return null;
      }
      // Skip panels that are in a group — they render inside the group.
      if (this._findGroupForPanel(panelId)) {
        return null;
      }
      var isCompact = ps.compact && !ps.collapsed;
      var className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() + (ps.collapsed ? " float-panel-collapsed" : "") + (isCompact ? " float-panel-compact" : "");
      var style = {};
      if (ps.x >= 0) {
        style.left = ps.x;
        style.top = ps.y;
        style.right = 'auto';
        style.bottom = 'auto';
        style.transform = 'none';
      }
      if (ps.z) {
        style.zIndex = ps.z;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: className,
        style: style,
        "data-panel-id": panelId,
        onMouseDown: function () {
          self._bringPanelToFront(panelId);
        },
        onTouchStart: function () {
          self._bringPanelToFront(panelId);
        },
        role: "region",
        "aria-label": label + " panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "float-panel-header",
        onMouseDown: function (e) {
          self._startPanelDrag(panelId, e);
        },
        onTouchStart: function (e) {
          self._startPanelDrag(panelId, e);
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "float-panel-title",
        id: "panel-title-" + panelId
      }, label), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-compact-toggle",
        onClick: function () {
          self._togglePanelCompact(panelId);
        },
        "aria-label": isCompact ? "Expand " + label + " panel width" : "Compact " + label + " panel",
        title: isCompact ? "Expand panel" : "Compact panel"
      }, isCompact ? "\u00bb" : "\u00ab"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-collapse",
        onClick: function () {
          self._togglePanelCollapse(panelId);
        },
        "aria-expanded": !ps.collapsed,
        "aria-label": ps.collapsed ? "Expand " + label + " panel" : "Collapse " + label + " panel"
      }, ps.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-close",
        onClick: function () {
          self._togglePanelOpen(panelId);
        },
        "aria-label": "Close " + label + " panel"
      }, "\xD7")), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
        className: "float-panel-body"
      }, isCompact ? this._renderCompactBody(panelId) : content), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
        className: "float-panel-resize",
        onMouseDown: function (e) {
          self._startPanelResize(panelId, e);
        },
        onTouchStart: function (e) {
          self._startPanelResize(panelId, e);
        }
      }));
    },
    _renderCompactBody: function (panelId) {
      var self = this;
      var defs = this._getCompactDefs(panelId);
      if (!defs || defs.length === 0) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "compact-body"
      }, defs.map(function (def) {
        var isOpen = self._isPopOutOpen(panelId, def.id);
        return /*#__PURE__*/React.createElement("div", {
          key: def.id,
          className: "pop-out-trigger"
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn" + (def.active ? " active" : ""),
          onClick: def.popOut ? function () {
            isOpen ? self._closePopOut() : self._openPopOut(panelId, def.id);
          } : def.onClick,
          title: def.title
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + def.icon,
          "aria-hidden": "true"
        })), def.popOut && isOpen && /*#__PURE__*/React.createElement("div", {
          className: "pop-out-panel"
        }, def.popOut()));
      }));
    },
    _getCompactDefs: function (panelId) {
      var self = this;
      switch (panelId) {
        case 'transport':
          return [{
            id: 'play',
            icon: this.state.running ? 'fa-pause' : 'fa-play',
            title: 'Play/Pause (Space)',
            onClick: this.toggleGame,
            active: this.state.running
          }, {
            id: 'step',
            icon: 'fa-step-forward',
            title: 'Step (.)',
            onClick: this.stepGame
          }, {
            id: 'back',
            icon: 'fa-step-backward',
            title: 'Step backward (,)',
            onClick: this.stepBack
          }, {
            id: 'go',
            icon: 'fa-fast-forward',
            title: 'Advance multiple generations',
            onClick: function () {
              self.stepN(self.state.stepCount);
            }
          }, {
            id: 'reset',
            icon: 'fa-refresh',
            title: 'Randomize (R)',
            onClick: this.resetGame
          }, {
            id: 'empty',
            icon: 'fa-eraser',
            title: 'Clear all cells (E)',
            onClick: this.emptyBoard
          }, {
            id: 'undo',
            icon: 'fa-undo',
            title: 'Undo (Ctrl+Z)',
            onClick: this.undo
          }, {
            id: 'speed',
            icon: 'fa-tachometer',
            title: 'Speed',
            popOut: function () {
              return self.renderSpeedSlider();
            }
          }];
        case 'board':
          return [{
            id: 'boundary',
            icon: 'fa-repeat',
            title: 'Cycle boundary',
            onClick: this.toggleBoundary,
            active: this.state.boundary !== 'toroidal'
          }, {
            id: 'grid-size',
            icon: 'fa-th-large',
            title: 'Grid size',
            popOut: function () {
              return self.renderBoardSliders();
            }
          }];
        case 'view':
          return [{
            id: 'fit-grid',
            icon: 'fa-arrows-alt',
            title: 'Fit Grid',
            onClick: this.fitView
          }, {
            id: 'fit-cells',
            icon: 'fa-compress',
            title: 'Fit Cells',
            onClick: this.fitLiveCells
          }, {
            id: 'grid',
            icon: 'fa-th',
            title: 'Grid lines (G)',
            onClick: this.toggleGridLines,
            active: this.state.gridLines
          }, {
            id: 'trails',
            icon: 'fa-eye',
            title: 'Trails',
            onClick: this.toggleTrails,
            active: this.state.showTrails
          }, {
            id: 'minimap',
            icon: 'fa-map-o',
            title: 'Minimap (M)',
            onClick: this.toggleMinimap,
            active: this.state.showMinimap
          }, {
            id: 'zoom',
            icon: 'fa-search-plus',
            title: 'Zoom',
            popOut: function () {
              return self.renderZoomSlider();
            }
          }, {
            id: 'display',
            icon: 'fa-paint-brush',
            title: 'Display settings',
            popOut: function () {
              return self.renderDisplaySettings();
            }
          }];
        case 'mode':
          var defs = [{
            id: 'draw',
            icon: 'fa-pencil',
            title: 'Draw mode (D)',
            onClick: this.toggleDrawMode,
            active: this.state.drawMode === 'paint'
          }, {
            id: 'preset',
            icon: 'fa-puzzle-piece',
            title: 'Preset patterns (P)',
            onClick: this.togglePresetMode,
            active: this.state.drawMode === 'preset'
          }, {
            id: 'select',
            icon: 'fa-mouse-pointer',
            title: 'Select mode (S)',
            onClick: this.toggleSelectMode,
            active: this.state.drawMode === 'select'
          }, {
            id: 'live-paint',
            icon: 'fa-paint-brush',
            title: 'Live Paint',
            onClick: this.toggleLivePaint,
            active: this.state.livePaintMode
          }, {
            id: 'analyze',
            icon: 'fa-crosshairs',
            title: 'Analyze',
            onClick: this.analyzePattern
          }, {
            id: 'tools',
            icon: 'fa-wrench',
            title: 'Tool options',
            popOut: function () {
              return self.renderToolsContent();
            }
          }];
          if (this.state.boundary !== 'unbounded') {
            defs.splice(3, 0, {
              id: 'region',
              icon: 'fa-th',
              title: 'Region bounds (B)',
              onClick: this.toggleRegionMode,
              active: this.state.drawMode === 'region'
            });
          }
          return defs;
        case 'rules':
          return [{
            id: 'rules',
            icon: 'fa-cogs',
            title: 'Rules',
            popOut: function () {
              return self.renderRulesSection();
            }
          }];
        case 'stats':
          return [{
            id: 'stats',
            icon: 'fa-bar-chart',
            title: 'Statistics',
            popOut: function () {
              return self.renderStats();
            }
          }];
        case 'importExport':
          return [{
            id: 'io',
            icon: 'fa-exchange',
            title: 'Import/Export',
            popOut: function () {
              return self.renderExportContent();
            }
          }];
        default:
          return [];
      }
    },
    // ── Panel group rendering (Observatory docking) ──────────────────

    _getPanelLabel: function (panelId) {
      var PANEL_LABELS = {
        transport: 'Simulate',
        board: 'Board',
        view: 'View',
        mode: 'Tools',
        tools: 'Tools',
        rules: 'Rules',
        stats: 'Stats',
        importExport: 'Import / Export'
      };
      return PANEL_LABELS[panelId] || panelId;
    },
    _getPanelIcon: function (panelId) {
      var PANEL_ICONS = {
        transport: 'fa-play',
        board: 'fa-th-large',
        view: 'fa-arrows-alt',
        mode: 'fa-pencil',
        tools: 'fa-wrench',
        rules: 'fa-cogs',
        stats: 'fa-bar-chart',
        importExport: 'fa-exchange'
      };
      return PANEL_ICONS[panelId] || 'fa-circle-o';
    },
    _getPanelContent: function (panelId) {
      switch (panelId) {
        case 'transport':
          return /*#__PURE__*/React.createElement("div", null, this.renderTransportControls(false), this.renderSpeedSlider());
        case 'board':
          return /*#__PURE__*/React.createElement("div", null, this.renderBoardSliders(), this.renderBoundaryControls());
        case 'view':
          return /*#__PURE__*/React.createElement("div", null, this.renderViewControls(), this.renderZoomSlider(), this.renderDisplaySettings());
        case 'mode':
          return /*#__PURE__*/React.createElement("div", null, this.renderModeControls(), this.renderToolsContent());
        case 'rules':
          return this.renderRulesSection();
        case 'stats':
          return this.renderStats();
        case 'importExport':
          return this.renderExportContent();
        default:
          return null;
      }
    },
    _checkTabBarOverflow: function (bar) {
      bar.classList.remove('panel-tab-bar-icons');
      if (bar.scrollWidth > bar.clientWidth + 1) {
        bar.classList.add('panel-tab-bar-icons');
      }
    },
    _observeTabBars: function () {
      var self = this;
      if (this._tabBarObservers) {
        this._tabBarObservers.forEach(function (obs) {
          obs.disconnect();
        });
      }
      this._tabBarObservers = [];
      var tabBars = document.querySelectorAll('.panel-group .panel-tab-bar');
      for (var i = 0; i < tabBars.length; i++) {
        (function (bar) {
          var obs = new ResizeObserver(function () {
            self._checkTabBarOverflow(bar);
          });
          obs.observe(bar);
          self._tabBarObservers.push(obs);
        })(tabBars[i]);
      }
    },
    _renderPanelGroup: function (group) {
      var self = this;
      var panels = this.state.panelStates;
      var openPanels = group.panels.filter(function (pid) {
        return panels[pid] && panels[pid].open;
      });
      if (openPanels.length === 0) {
        return null;
      }
      if (openPanels.length === 1) {
        var soloId = openPanels[0];
        var soloLabel = this._getPanelLabel(soloId);
        return this._renderFloatPanelDirect(soloId, soloLabel, this._getPanelContent(soloId), group);
      }
      var activeTab = openPanels.indexOf(group.activeTab) !== -1 ? group.activeTab : openPanels[0];
      var isCompact = !!group.compact;
      var tabMode = group.compactTabMode || 'horizontal';
      var style = {};
      if (group.x >= 0) {
        style.left = group.x;
        style.top = group.y;
        style.right = 'auto';
        style.bottom = 'auto';
        style.transform = 'none';
      }
      if (group.z) {
        style.zIndex = group.z;
      }
      var className = "float-panel panel-group" + (isCompact ? " panel-group-compact panel-group-compact-" + tabMode : "");

      var tabButtons = openPanels.map(function (pid) {
        var label = self._getPanelLabel(pid);
        return /*#__PURE__*/React.createElement("button", {
          key: pid,
          type: "button",
          className: "panel-tab" + (pid === activeTab ? " panel-tab-active" : ""),
          onClick: function (e) {
            e.stopPropagation();
            self._setGroupActiveTab(group.id, pid);
          },
          onMouseDown: function (e) {
            if (!isCompact) self._startTabDrag(pid, group.id, e);
          },
          title: label
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + self._getPanelIcon(pid) + " panel-tab-icon",
          "aria-hidden": "true"
        }), /*#__PURE__*/React.createElement("span", {
          className: "panel-tab-label"
        }, label));
      });

      var tabArea;
      if (isCompact && tabMode === 'dropdown') {
        tabArea = /*#__PURE__*/React.createElement("div", {
          className: "panel-tab-dropdown"
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn panel-tab-dropdown-trigger",
          onClick: function (e) {
            e.stopPropagation();
            self.setState({ groupTabDropdownOpen: self.state.groupTabDropdownOpen === group.id ? null : group.id });
          },
          title: self._getPanelLabel(activeTab)
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + self._getPanelIcon(activeTab),
          "aria-hidden": "true"
        }), /*#__PURE__*/React.createElement("i", {
          className: "fa fa-caret-down panel-tab-dropdown-caret",
          "aria-hidden": "true"
        })), self.state.groupTabDropdownOpen === group.id && /*#__PURE__*/React.createElement("div", {
          className: "panel-tab-dropdown-menu"
        }, openPanels.map(function (pid) {
          return /*#__PURE__*/React.createElement("button", {
            key: pid,
            type: "button",
            className: "panel-tab-dropdown-item" + (pid === activeTab ? " active" : ""),
            onClick: function (e) {
              e.stopPropagation();
              self._setGroupActiveTab(group.id, pid);
              self.setState({ groupTabDropdownOpen: null });
            },
            title: self._getPanelLabel(pid)
          }, /*#__PURE__*/React.createElement("i", {
            className: "fa " + self._getPanelIcon(pid),
            "aria-hidden": "true"
          }), /*#__PURE__*/React.createElement("span", null, self._getPanelLabel(pid)));
        })));
      } else {
        tabArea = /*#__PURE__*/React.createElement("div", {
          className: "panel-tab-bar" + (isCompact ? " panel-tab-bar-icons" : "")
        }, tabButtons);
      }

      return /*#__PURE__*/React.createElement("div", {
        className: className,
        style: style,
        "data-group-id": group.id,
        onMouseDown: function () {
          self._bringGroupToFront(group.id);
        },
        role: "region",
        "aria-label": "Panel group"
      }, /*#__PURE__*/React.createElement("div", {
        className: "float-panel-header",
        onMouseDown: function (e) {
          self._startGroupDrag(group.id, e);
        },
        onTouchStart: function (e) {
          self._startGroupDrag(group.id, e);
        }
      }, tabArea, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-compact-toggle",
        onClick: function () {
          self._toggleGroupCompact(group.id);
        },
        title: isCompact ? "Expand group" : "Compact group"
      }, isCompact ? "\u00bb" : "\u00ab"), isCompact && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn panel-group-mode-toggle",
        onClick: function () {
          self._cycleGroupCompactTabMode(group.id);
        },
        title: "Tab layout: " + tabMode + " (click to cycle)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (tabMode === 'horizontal' ? 'fa-ellipsis-h' : tabMode === 'sidebar' ? 'fa-ellipsis-v' : 'fa-caret-down'),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-close",
        onClick: function () {
          self._togglePanelOpen(activeTab);
        },
        "aria-label": "Close active panel"
      }, "\xD7")), /*#__PURE__*/React.createElement("div", {
        className: "float-panel-body"
      }, isCompact ? this._renderCompactBody(activeTab) : this._getPanelContent(activeTab)), /*#__PURE__*/React.createElement("div", {
        className: "float-panel-resize",
        onMouseDown: function (e) {
          self._startGroupResize(group.id, e);
        },
        onTouchStart: function (e) {
          self._startGroupResize(group.id, e);
        }
      }));
    },
    // Render a standalone panel that belongs to a group (when group has only 1 open panel).
    _renderFloatPanelDirect: function (panelId, label, content, group) {
      var self = this;
      var ps = this.state.panelStates[panelId];
      if (!ps || !ps.open) {
        return null;
      }
      var style = {};
      if (group && group.x >= 0) {
        style.left = group.x;
        style.top = group.y;
        style.right = 'auto';
        style.bottom = 'auto';
        style.transform = 'none';
      } else if (ps.x >= 0) {
        style.left = ps.x;
        style.top = ps.y;
        style.right = 'auto';
        style.bottom = 'auto';
        style.transform = 'none';
      }
      if (ps.z) {
        style.zIndex = ps.z;
      }
      if (group && group.z) {
        style.zIndex = group.z;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase(),
        style: style,
        "data-panel-id": panelId,
        onMouseDown: function () {
          self._bringPanelToFront(panelId);
        },
        role: "region",
        "aria-label": label + " panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "float-panel-header",
        onMouseDown: function (e) {
          self._startPanelDrag(panelId, e);
        },
        onTouchStart: function (e) {
          self._startPanelDrag(panelId, e);
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "float-panel-title"
      }, label), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-collapse",
        onClick: function () {
          self._togglePanelCollapse(panelId);
        },
        "aria-expanded": !ps.collapsed
      }, ps.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-close",
        onClick: function () {
          self._togglePanelOpen(panelId);
        },
        "aria-label": "Close " + label + " panel"
      }, "\xD7")), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
        className: "float-panel-body"
      }, content));
    },
    _startGroupDrag: function (groupId, e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
        return;
      }
      e.preventDefault();
      var panel = e.currentTarget.parentElement;
      var rect = panel.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var offX = clientX - rect.left;
      var offY = clientY - rect.top;
      this._bringGroupToFront(groupId);
      panel.classList.add('dragging');
      var self = this;
      var move = function (ev) {
        ev.preventDefault();
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, cx - offX)) + 'px';
        panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, cy - offY)) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
      };
      var end = function () {
        panel.classList.remove('dragging');
        var finalRect = panel.getBoundingClientRect();
        var groups = JSON.parse(JSON.stringify(self.state.panelGroups));
        for (var i = 0; i < groups.length; i++) {
          if (groups[i].id === groupId) {
            groups[i].x = finalRect.left;
            groups[i].y = finalRect.top;
            break;
          }
        }
        self.setState({
          panelGroups: groups
        }, function () {
          self._persistLayout();
        });
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
      document.addEventListener('touchmove', move, {
        passive: false
      });
      document.addEventListener('touchend', end);
    },
    _startTabDrag: function (panelId, groupId, e) {
      // Only initiate tab-tear-off if the user drags far enough from starting point.
      var startX = e.clientX;
      var startY = e.clientY;
      var self = this;
      var threshold = 30;
      var tornOff = false;
      var move = function (ev) {
        if (tornOff) {
          return;
        }
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > threshold) {
          tornOff = true;
          self._separatePanel(panelId, groupId, ev.clientX - 40, ev.clientY - 10);
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', end);
        }
      };
      var end = function () {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
    },
    _startGroupResize: function (groupId, e) {
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
      var groups = this.state.panelGroups;
      for (var gi = 0; gi < groups.length; gi++) {
        if (groups[gi].id === groupId) { group = groups[gi]; break; }
      }
      var isCompact = group && !!group.compact;
      var didToggle = false;
      var move = function (ev) {
        ev.preventDefault();
        if (didToggle) return;
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        var newW = startW + (cx - startX);
        var newH = startH + (cy - startY);
        if (!isCompact && newW < 120) {
          didToggle = true;
          panel.style.width = '';
          panel.style.maxHeight = '';
          self2._toggleGroupCompact(groupId);
        } else if (isCompact && newW > 120) {
          didToggle = true;
          panel.style.width = Math.max(180, newW) + 'px';
          self2._toggleGroupCompact(groupId);
        } else if (!isCompact) {
          panel.style.width = Math.max(180, newW) + 'px';
          panel.style.maxHeight = Math.max(80, newH) + 'px';
        }
      };
      var end = function () {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
      document.addEventListener('touchmove', move, {
        passive: false
      });
      document.addEventListener('touchend', end);
    },
    // ── Panel drag (Observatory) ─────────────────────────────────────

    _startPanelDrag: function (panelId, e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
        return;
      }
      e.preventDefault();
      var panel = e.currentTarget.parentElement;
      var rect = panel.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      this._fpDragId = panelId;
      this._fpDragOffX = clientX - rect.left;
      this._fpDragOffY = clientY - rect.top;
      this._bringPanelToFront(panelId);
      panel.classList.add('dragging');
      var self = this;
      this._fpDragMove = function (ev) {
        ev.preventDefault();
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        var newX = Math.max(0, Math.min(window.innerWidth - 60, cx - self._fpDragOffX));
        var newY = Math.max(0, Math.min(window.innerHeight - 40, cy - self._fpDragOffY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
        // Highlight potential merge targets during drag.
        self._updateDropIndicator(panelId, newX, newY, panel);
      };
      this._fpDragEnd = function () {
        panel.classList.remove('dragging');
        self._clearDropIndicator();
        var finalRect = panel.getBoundingClientRect();
        // Check for merge target.
        var mergeTarget = self._findDropTarget(panelId, finalRect);
        if (mergeTarget) {
          self._mergePanels(panelId, mergeTarget);
        } else {
          var panels = JSON.parse(JSON.stringify(self.state.panelStates));
          panels[panelId].x = finalRect.left;
          panels[panelId].y = finalRect.top;
          self.setState({
            panelStates: panels
          }, function () {
            self._persistLayout();
          });
        }
        document.removeEventListener('mousemove', self._fpDragMove);
        document.removeEventListener('mouseup', self._fpDragEnd);
        document.removeEventListener('touchmove', self._fpDragMove);
        document.removeEventListener('touchend', self._fpDragEnd);
      };
      document.addEventListener('mousemove', this._fpDragMove);
      document.addEventListener('mouseup', this._fpDragEnd);
      document.addEventListener('touchmove', this._fpDragMove, {
        passive: false
      });
      document.addEventListener('touchend', this._fpDragEnd);
    },
    _updateDropIndicator: function (draggedId, dragX, dragY, dragPanel) {
      var allPanels = document.querySelectorAll('.float-panel, .panel-group');
      var dragRect = dragPanel.getBoundingClientRect();
      var found = false;
      for (var i = 0; i < allPanels.length; i++) {
        var other = allPanels[i];
        if (other === dragPanel) {
          allPanels[i].classList.remove('drop-target');
          continue;
        }
        var otherRect = other.getBoundingClientRect();
        var overlap = this._rectsOverlap(dragRect, otherRect);
        if (overlap > 0.3 && !found) {
          other.classList.add('drop-target');
          found = true;
        } else {
          other.classList.remove('drop-target');
        }
      }
    },
    _clearDropIndicator: function () {
      var els = document.querySelectorAll('.drop-target');
      for (var i = 0; i < els.length; i++) {
        els[i].classList.remove('drop-target');
      }
    },
    _rectsOverlap: function (a, b) {
      var overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      var overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      var overlapArea = overlapX * overlapY;
      var aArea = a.width * a.height;
      return aArea > 0 ? overlapArea / aArea : 0;
    },
    _findDropTarget: function (draggedId, dragRect) {
      var allPanels = document.querySelectorAll('.float-panel, .panel-group');
      for (var i = 0; i < allPanels.length; i++) {
        var el = allPanels[i];
        var targetId = el.getAttribute('data-panel-id');
        var targetGroupId = el.getAttribute('data-group-id');
        if (!targetId && !targetGroupId) {
          continue;
        }
        if (targetId === draggedId) {
          continue;
        }
        var otherRect = el.getBoundingClientRect();
        if (this._rectsOverlap(dragRect, otherRect) > 0.3) {
          return targetId || targetGroupId;
        }
      }
      return null;
    },
    // ── Panel resize (Observatory) ───────────────────────────────────

    _startPanelResize: function (panelId, e) {
      e.preventDefault();
      e.stopPropagation();
      var self2 = this;
      var panel = e.currentTarget.parentElement;
      var rect = panel.getBoundingClientRect();
      var startW = rect.width;
      var startH = rect.height;
      var startX = e.touches ? e.touches[0].clientX : e.clientX;
      var startY = e.touches ? e.touches[0].clientY : e.clientY;
      var isCompact = this.state.panelStates[panelId] && this.state.panelStates[panelId].compact;
      var didToggle = false;
      var move = function (ev) {
        ev.preventDefault();
        if (didToggle) return;
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        var newW = startW + (cx - startX);
        var newH = startH + (cy - startY);
        if (!isCompact && newW < 120) {
          didToggle = true;
          panel.style.width = '';
          panel.style.maxHeight = '';
          self2._togglePanelCompact(panelId);
        } else if (isCompact && newW > 120) {
          didToggle = true;
          panel.style.width = Math.max(180, newW) + 'px';
          self2._togglePanelCompact(panelId);
        } else if (!isCompact) {
          panel.style.width = Math.max(180, newW) + 'px';
          panel.style.maxHeight = Math.max(80, newH) + 'px';
        }
      };
      var end = function () {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
      document.addEventListener('touchmove', move, {
        passive: false
      });
      document.addEventListener('touchend', end);
    },
    // ── Panel state helpers (Observatory) ────────────────────────────

    _togglePanelOpen: function (panelId) {
      var panels = JSON.parse(JSON.stringify(this.state.panelStates));
      panels[panelId].open = !panels[panelId].open;
      var self = this;
      this.setState({
        panelStates: panels
      }, function () {
        self._persistLayout();
      });
    },
    _togglePanelCollapse: function (panelId) {
      var panels = JSON.parse(JSON.stringify(this.state.panelStates));
      panels[panelId].collapsed = !panels[panelId].collapsed;
      var self = this;
      this.setState({
        panelStates: panels
      }, function () {
        self._persistLayout();
      });
    },
    // ── Main render ───────────────────────────────────────────────────

    render: function () {
      var cs = this.getCanvasSize();
      var layout = this.state.layoutMode;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        layout = 'observatory';
      }
      var layoutContent;
      switch (layout) {
        case 'observatory':
          layoutContent = this.renderObservatory(cs);
          break;
        default:
          layoutContent = this.renderCartographer(cs);
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "app-root layout-" + layout,
        role: "application",
        "aria-label": "Conway's Game of Life"
      }, /*#__PURE__*/React.createElement("a", {
        className: "skip-to-content",
        href: "#life-canvas"
      }, "Skip to simulation"), /*#__PURE__*/React.createElement("div", {
        className: "sr-only",
        "aria-live": "polite",
        "aria-atomic": "true"
      }, this.state.srAnnouncement), this.renderHelpModal(), this.renderPopGraph(), layoutContent);
    }
  });
  ReactDOM.render(/*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LifeBoard, null)), document.getElementById("content"));
});

//# sourceMappingURL=script.compiled.js.map