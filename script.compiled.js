"use strict";

/* global React, CanvasRenderer, SimEngine, THEMES, SPEED_DELAYS,
          InputHandler, LifeInputUtils, LifeViewUtils, LifeBoardUtils,
          LifeAnalysisUtils, parseKey, RegionUtil */
/**
 * Canvas-area components and imperative drawing functions extracted from LifeBoard.
 *
 * Components:
 *   CanvasArea         — main simulation canvas + analysis result overlay.
 *   MobileMinimapArea  — mobile/tablet minimap canvas element.
 *
 * Imperative canvas functions (top-level, accessed as globals):
 *   drawBoard(stateRef, refs)
 *   drawMinimap(stateRef, refs, ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale)
 *   drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme)
 *   drawRotationPreview(stateRef, refs)
 *   toggleTrails(stateRef, refs, dispatch)
 *
 * Helper functions (file-local, used by MobileMinimapArea):
 *   onMinimapElementDown, onMinimapElementMove, onMinimapElementUp, panMinimapElement
 */

// ── Imperative canvas functions ──────────────────────────────────────

var drawBoard = function drawBoard(stateRef, refs) {
  // eslint-disable-line no-unused-vars
  var state = stateRef.current;
  var canvas = refs.canvas;
  if (!canvas) {
    return;
  }
  var ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
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
  var startC = viewX,
    startR = viewY;
  var endC = viewX + Math.ceil(canvasW / cellSize) + 1;
  var endR = viewY + Math.ceil(canvasH / cellSize) + 1;

  // Clear canvas.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  if (!isUnbounded && state.regionMask && state.regionMask.size > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    CanvasRenderer.clearRegionCells(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
  }

  // Palette.
  var palettes = CanvasRenderer._ensurePalette(theme, state.theme);

  // Cells.
  CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

  // In-progress painted cells (drag-and-draw before mouseup commit).
  if (InputHandler._dragging && InputHandler._paintedCells) {
    var painted = InputHandler._paintedCells;
    var paintKeys = Object.keys(painted);
    if (paintKeys.length > 0) {
      var aliveColor = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
      for (var pi = 0; pi < paintKeys.length; pi++) {
        var k = paintKeys[pi];
        var rc = parseKey(k);
        var pr = rc[0],
          pc = rc[1];
        if (pr >= startR && pr <= endR && pc >= startC && pc <= endC) {
          ctx.fillStyle = painted[k] === 1 ? aliveColor : theme.bg;
          ctx.fillRect((pc - viewX) * cellSize, (pr - viewY) * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  // Trails.
  if (refs.trailEnabled && refs.trailMap && refs.trailMap.size > 0) {
    CanvasRenderer.drawTrails(ctx, refs.trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.trail);
  }

  // Grid.
  if (state.gridLines) {
    CanvasRenderer.drawGrid(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme.grid);
  }

  // Region overlay.
  if (!isUnbounded) {
    CanvasRenderer.drawRegionOverlay(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme, state.boundary);
  }

  // Selection.
  CanvasRenderer.drawSelection(ctx, state.selection, viewX, viewY, cellSize, theme);

  // Tool preview (paint mode).
  CanvasRenderer.drawToolPreview(ctx, InputHandler._drawPreviewCells, InputHandler._drawErasing, viewX, viewY, cellSize, theme);

  // Region tool preview.
  if (state.drawMode === 'region') {
    if (InputHandler._regionPreviewKeys.length > 0) {
      CanvasRenderer.drawRegionPreview(ctx, InputHandler._regionPreviewKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
    }
    if (InputHandler._regionDragging) {
      var rgPainted = InputHandler._regionPaintedKeys;
      var rgKeys = Object.keys(rgPainted);
      if (rgKeys.length > 0) {
        CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
      }
    }
  }

  // Pattern preview.
  if (state.drawMode === 'preset') {
    var previewMask = !isUnbounded && state.regionMask && state.regionMask.size > 0 ? state.regionMask : null;
    CanvasRenderer.drawPatternPreview(ctx, state.selectedPattern, state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme, previewMask);
  }

  // Minimap overlay.
  var useMobileMinimap = state.deviceClass === 'phone-portrait' || state.deviceClass === 'phone-landscape' || state.deviceClass === 'tablet' || typeof window !== 'undefined' && window.innerWidth <= 1200;
  if (state.showMinimap && (isUnbounded || cols > 0 && rows > 0)) {
    if (useMobileMinimap) {
      drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme);
      refs.minimapRect = null;
    } else {
      var mmDisplayScale = 1;
      if (canvas.style.width) {
        var cssW = parseFloat(canvas.style.width);
        if (cssW > 0 && canvasW > 0) {
          mmDisplayScale = cssW / canvasW;
        }
      }
      drawMinimap(stateRef, refs, ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, mmDisplayScale);
    }
  }

  // GIF recording: capture frame.
  if (state.recording && refs.gif) {
    refs.gif.addFrame(ctx, {
      copy: true,
      delay: SPEED_DELAYS[state.speed - 1] || 50
    });
  }
};
var drawMinimap = function drawMinimap(stateRef, refs, ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale) {
  // eslint-disable-line no-unused-vars
  var state = stateRef.current;
  var isUnbounded = state.boundary === 'unbounded';
  var mmOriginR = 0,
    mmOriginC = 0;
  if (isUnbounded) {
    var bb = SimEngine.getBoundingBox(liveCells);
    if (bb) {
      var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
      var newMinR = bb.minR - pad,
        newMinC = bb.minC - pad;
      var newMaxR = bb.maxR + pad,
        newMaxC = bb.maxC + pad;
      var prev = refs.mmUnboundedRegion;
      if (prev) {
        newMinR = Math.min(prev.minR, newMinR);
        newMinC = Math.min(prev.minC, newMinC);
        newMaxR = Math.max(prev.maxR, newMaxR);
        newMaxC = Math.max(prev.maxC, newMaxC);
      }
      refs.mmUnboundedRegion = {
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
      refs.mmUnboundedRegion = null;
    }
  } else {
    var rb = state.regionBounds;
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
  var TARGET_CSS_SIZE = 160;
  var ds = displayScale && displayScale > 0 ? displayScale : 1;
  var aspect = cols / rows;
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
  if (refs.minimapCanvas.width !== mmW || refs.minimapCanvas.height !== mmH) {
    refs.minimapCanvas.width = mmW;
    refs.minimapCanvas.height = mmH;
    refs.minimapDirty = true;
  }
  var marginBuf = Math.max(1, Math.round(6 / ds));
  var isMobileView2 = state.deviceClass === 'phone-portrait' || state.deviceClass === 'phone-landscape';
  var transportPad = state.layoutMode === 'cartographer' && !isMobileView2 ? Math.round(60 / ds) : 0;
  var mmOnLeft = state.layoutMode === 'cartographer' && state.railSide === 'right';
  var mmX = mmOnLeft ? marginBuf : canvasW - mmW - marginBuf;
  var mmY = canvasH - mmH - marginBuf - transportPad;
  if (refs.minimapDirty) {
    var mc = refs.minimapCanvas;
    var mctx = mc.getContext('2d');
    mctx.clearRect(0, 0, mmW, mmH);
    mctx.fillStyle = 'rgba(10,14,26,0.85)';
    mctx.fillRect(0, 0, mmW, mmH);
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
    if (!isUnbounded && state.regionMask) {
      var _regionMask = state.regionMask;
      mctx.fillStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.12)';
      _regionMask.forEach(function (key) {
        var _i = key.indexOf(',');
        var _rr = parseInt(key.substring(0, _i), 10) - _mmOR;
        var _cc = parseInt(key.substring(_i + 1), 10) - _mmOC;
        if (_rr >= 0 && _rr < _mmRows && _cc >= 0 && _cc < _mmCols) {
          mctx.fillRect(Math.floor(_cc / _mmCols * mmW), Math.floor(_rr / _mmRows * mmH), 1, 1);
        }
      });
      var _comps = state.regionComponents;
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
    mctx.strokeStyle = 'rgba(255,255,255,0.2)';
    mctx.lineWidth = 1;
    mctx.strokeRect(0.5, 0.5, mmW - 1, mmH - 1);
    refs.minimapDirty = false;
  }
  ctx.drawImage(refs.minimapCanvas, mmX, mmY);
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
  var vpCenterC = viewX + visCols / 2;
  var vpCenterR = viewY + visRows / 2;
  var vpOutside = vpCenterC < mmOriginC || vpCenterC > mmOriginC + cols || vpCenterR < mmOriginR || vpCenterR > mmOriginR + rows;
  if (vpOutside) {
    var mmCenterC = mmOriginC + cols / 2;
    var mmCenterR = mmOriginR + rows / 2;
    var arrowAngle = Math.atan2(vpCenterR - mmCenterR, vpCenterC - mmCenterC);
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
  refs.minimapRect = {
    x: mmX,
    y: mmY,
    w: mmW,
    h: mmH,
    originC: mmOriginC,
    originR: mmOriginR,
    worldCols: cols,
    worldRows: rows
  };
};
var drawMinimapMobile = function drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme) {
  // eslint-disable-line no-unused-vars
  var state = stateRef.current;
  if (!refs.mobileMinimap || !refs.minimapCanvas) {
    return;
  }
  var isUnbounded = state.boundary === 'unbounded';
  var mmMobOriginR = 0,
    mmMobOriginC = 0;
  var mmRegionRows, mmRegionCols;
  if (isUnbounded) {
    var bb = SimEngine.getBoundingBox(liveCells);
    if (bb) {
      var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
      var newMinR = bb.minR - pad,
        newMinC = bb.minC - pad;
      var newMaxR = bb.maxR + pad,
        newMaxC = bb.maxC + pad;
      var prev = refs.mmUnboundedRegion;
      if (prev) {
        newMinR = Math.min(prev.minR, newMinR);
        newMinC = Math.min(prev.minC, newMinC);
        newMaxR = Math.max(prev.maxR, newMaxR);
        newMaxC = Math.max(prev.maxC, newMaxC);
      }
      refs.mmUnboundedRegion = {
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
    var rbm = state.regionBounds;
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
  if (refs.minimapCanvas.width !== mmW_css || refs.minimapCanvas.height !== mmH_css) {
    refs.minimapCanvas.width = mmW_css;
    refs.minimapCanvas.height = mmH_css;
  }
  var mmCtx = refs.minimapCanvas.getContext('2d');
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
  if (!isUnbounded && state.regionComponents) {
    var _compsM = state.regionComponents;
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
  mmCtx.strokeStyle = 'rgba(255,255,255,0.2)';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(0.5, 0.5, mmW_css - 1, mmH_css - 1);
  var vpVisColsM = refs.canvas ? refs.canvas.width / cellSize : 100;
  var vpVisRowsM = refs.canvas ? refs.canvas.height / cellSize : 100;
  var vpW = vpVisColsM * cellW;
  var vpH = vpVisRowsM * cellH;
  var vpX = (viewX - mmMobOriginC) * cellW;
  var vpY = (viewY - mmMobOriginR) * cellH;
  var vpClampX = Math.max(0, vpX),
    vpClampY = Math.max(0, vpY);
  var vpClampR = Math.min(mmW_css, vpX + vpW),
    vpClampB = Math.min(mmH_css, vpY + vpH);
  if (vpClampR > vpClampX && vpClampB > vpClampY) {
    mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
  }
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
  if (refs.mobileMinimap.width !== mmW_css || refs.mobileMinimap.height !== mmH_css) {
    refs.mobileMinimap.width = mmW_css;
    refs.mobileMinimap.height = mmH_css;
  }
  var mobileCtx = refs.mobileMinimap.getContext('2d');
  mobileCtx.drawImage(refs.minimapCanvas, 0, 0);
  refs.mmMobileWorld = {
    originC: mmMobOriginC,
    originR: mmMobOriginR,
    cols: mmRegionCols,
    rows: mmRegionRows
  };
};
var drawRotationPreview = function drawRotationPreview(stateRef, refs) {
  // eslint-disable-line no-unused-vars
  var state = stateRef.current;
  var theme = THEMES[state.theme] || THEMES['Teal'];
  CanvasRenderer.drawRotationPreview(refs.previewCanvas, state.selectedPattern, state.patternRotation, theme);
};
var toggleTrails = function toggleTrails(stateRef, refs, dispatch) {
  // eslint-disable-line no-unused-vars
  var state = stateRef.current;
  var newVal = !state.showTrails;
  refs.trailEnabled = newVal;
  if (!newVal) {
    refs.trailMap = new Map();
  }
  dispatch({
    type: "MERGE",
    payload: {
      showTrails: newVal
    }
  });
  setTimeout(function () {
    drawBoard(stateRef, refs);
  }, 0);
};

// ── Minimap element interaction helpers ──────────────────────────────

function onMinimapElementDown(e, stateRef, refs, dispatch) {
  e.preventDefault();
  refs.mmElemDragging = true;
  panMinimapElement(e, stateRef, refs, dispatch);
}
function onMinimapElementMove(e, stateRef, refs, dispatch) {
  if (!refs.mmElemDragging) {
    return;
  }
  e.preventDefault();
  panMinimapElement(e, stateRef, refs, dispatch);
}
function onMinimapElementUp(stateRef, refs) {
  refs.mmElemDragging = false;
}
function panMinimapElement(e, stateRef, refs, dispatch) {
  var state = stateRef.current;
  if (!refs.mobileMinimap) {
    return;
  }
  var rect = refs.mobileMinimap.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  var frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  var frac_r = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  var mmWorld = refs.mmMobileWorld;
  var mmCols = mmWorld ? mmWorld.cols : state.cols;
  var mmRows = mmWorld ? mmWorld.rows : state.rows;
  var mmOC = mmWorld ? mmWorld.originC : 0;
  var mmOR = mmWorld ? mmWorld.originR : 0;
  var newVX = Math.round(frac_c * mmCols + mmOC - refs.canvas.width / state.cellSize / 2);
  var newVY = Math.round(frac_r * mmRows + mmOR - refs.canvas.height / state.cellSize / 2);
  var clamped = LifeViewUtils.clampView(stateRef, refs, dispatch, newVX, newVY, state.cols, state.rows, state.cellSize);
  dispatch({
    type: "MERGE",
    payload: {
      viewX: clamped.viewX,
      viewY: clamped.viewY
    }
  });
  setTimeout(function () {
    drawBoard(stateRef, refs);
  }, 0);
}

// ── React components ─────────────────────────────────────────────────

var CanvasArea = function CanvasArea(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var cs = props.cs;
  return /*#__PURE__*/React.createElement("div", {
    className: "app-canvas-container"
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "display",
    ref: function (c) {
      refs.canvas = c;
      if (c) {
        refs.drawPending = true;
      }
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
    onMouseDown: function (e) {
      LifeInputUtils.onMouseDown(stateRef, refs, dispatch, e);
    },
    onMouseMove: function (e) {
      LifeInputUtils.onMouseMove(stateRef, refs, dispatch, e);
    },
    onMouseUp: function (e) {
      LifeInputUtils.onMouseUp(stateRef, refs, dispatch, e);
    },
    onMouseLeave: function (e) {
      LifeInputUtils.onMouseLeave(stateRef, refs, dispatch, e);
    },
    onContextMenu: function (e) {
      LifeInputUtils.onContextMenu(stateRef, refs, dispatch, e);
    },
    onTouchStart: function (e) {
      LifeInputUtils.onTouchStart(stateRef, refs, dispatch, e);
    },
    onTouchMove: function (e) {
      LifeInputUtils.onTouchMove(stateRef, refs, dispatch, e);
    },
    onTouchEnd: function (e) {
      LifeInputUtils.onTouchEnd(stateRef, refs, dispatch, e);
    }
  }), state.analysisResult ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "analysis-result" + (state.analyzing ? " analysis-cancellable" : ""),
    onClick: state.analyzing ? function () {
      LifeAnalysisUtils.cancelAnalysis(stateRef, refs, dispatch);
    } : null,
    "aria-live": "assertive"
  }, state.analysisResult) : null);
};
var MobileMinimapArea = function MobileMinimapArea(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  if (!state.showMinimap || refs.minimapHidden) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-minimap-area"
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "mobile-minimap-canvas",
    ref: function (c) {
      refs.mobileMinimap = c;
    },
    role: "img",
    "aria-label": "Minimap navigation",
    onMouseDown: function (e) {
      onMinimapElementDown(e, stateRef, refs, dispatch);
    },
    onMouseMove: function (e) {
      onMinimapElementMove(e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      onMinimapElementDown(e, stateRef, refs, dispatch);
    },
    onTouchMove: function (e) {
      onMinimapElementMove(e, stateRef, refs, dispatch);
    },
    onMouseUp: function () {
      onMinimapElementUp(stateRef, refs);
    },
    onTouchEnd: function () {
      onMinimapElementUp(stateRef, refs);
    }
  }));
};
"use strict";

/* global React, LifeAnalysisUtils */
/**
 * HelpModal — keyboard shortcuts overlay dialog.
 * Props: showHelp, stateRef, refs, dispatch
 */
var HelpModal = function HelpModal(props) {
  // eslint-disable-line no-unused-vars
  if (!props.showHelp) {
    return null;
  }
  var stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var onClose = function () {
    LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "help-overlay",
    onClick: onClose,
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
    onClick: onClose,
    title: "Close",
    "aria-label": "Close help dialog"
  }, "Close")));
};
"use strict";

/* global React, LifeViewUtils, LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils,
          CanvasArea, StatsPanel, StatsChip, MobileSparkline,
          TransportControls, SpeedSlider, MobileTransportBar,
          BoardSliders, BoundaryControls, ViewControls, ZoomSlider, DisplaySettings,
          ModeControls, ToolsContent, MobileContextPanel, RulesSection, ExportContent,
          MobileMinimapArea, toggleTrails,
          FloatPanel, PanelGroup, ObservatoryPanelUtils */
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

var _MOBILE_TABS = [{
  id: 'simulate',
  icon: 'fa-play',
  label: 'Simulate'
}, {
  id: 'board',
  icon: 'fa-th-large',
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
  icon: 'fa-cogs',
  label: 'Rules'
}, {
  id: 'export',
  icon: 'fa-exchange',
  label: 'Share'
}]; // eslint-disable-line no-unused-vars

var TabContentBuilder = function TabContentBuilder(props) {
  // eslint-disable-line no-unused-vars
  var tabId = props.tabId,
    options = props.options || {};
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  switch (tabId) {
    case 'simulate':
      return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Simulate"), /*#__PURE__*/React.createElement(TransportControls, {
        compact: false,
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(SpeedSlider, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), options.sparkline && /*#__PURE__*/React.createElement(MobileSparkline, {
        state: state,
        refs: refs,
        stateRef: stateRef,
        dispatch: dispatch
      }));
    case 'board':
      return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Board"), /*#__PURE__*/React.createElement(BoardSliders, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(BoundaryControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'view':
      return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "View"), /*#__PURE__*/React.createElement(ViewControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch,
        onToggleTrails: toggleTrails
      }), /*#__PURE__*/React.createElement(ZoomSlider, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(DisplaySettings, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'tools':
      return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Tools"), /*#__PURE__*/React.createElement(ModeControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(ToolsContent, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'rules':
      return /*#__PURE__*/React.createElement(RulesSection, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      });
    case 'export':
      return /*#__PURE__*/React.createElement(ExportContent, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      });
    default:
      return null;
  }
};
var BottomSheet = function BottomSheet(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var sheetContent = props.sheetContent;
  var tabs = _MOBILE_TABS;
  var layoutSwitcher = /*#__PURE__*/React.createElement(LayoutSwitcher, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "bottom-sheet-container",
    onKeyDown: function (e) {
      LifeViewUtils._onSheetKeyDown(stateRef, refs, dispatch, e);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bottom-sheet-backdrop",
    onClick: function () {
      LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch);
    },
    role: "presentation",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bottom-sheet" + (state.bottomSheetClosing ? " sheet-closing" : ""),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Controls panel",
    onTouchStart: function (e) {
      LifeViewUtils._onSheetTouchStart(stateRef, refs, e);
    },
    onTouchMove: function (e) {
      LifeViewUtils._onSheetTouchMove(stateRef, refs, e);
    },
    onTouchEnd: function (e) {
      LifeViewUtils._onSheetTouchEnd(stateRef, refs, dispatch, e);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bottom-sheet-handle"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bottom-sheet-tabs",
    role: "tablist",
    "aria-label": "Control categories"
  }, tabs.map(function (tab) {
    var isActive = state.bottomSheetTab === tab.id;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.id,
      className: "rail-tab" + (isActive ? " active" : ""),
      onClick: function () {
        LifeViewUtils.setBottomSheetTab(stateRef, refs, dispatch, tab.id);
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
    id: "sheet-panel-" + state.bottomSheetTab,
    role: "tabpanel",
    "aria-label": state.bottomSheetTab + " controls"
  }, sheetContent, layoutSwitcher && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px 0',
      borderTop: '1px solid var(--panel-border)'
    }
  }, layoutSwitcher))));
};
var LayoutSwitcher = function LayoutSwitcher(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var dc = state.deviceClass;
  var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return null;
  }
  var mode = state.layoutMode;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-switcher"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (mode === 'cartographer' ? " active" : ""),
    onClick: function () {
      LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'cartographer');
    },
    title: "Cartographer: Edge rail with tabs",
    "aria-label": "Cartographer layout: edge rail with tabs"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-columns"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (mode === 'observatory' ? " active" : ""),
    onClick: function () {
      LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'observatory');
    },
    title: "Observatory: Floating panels",
    "aria-label": "Observatory layout: floating panels"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th-large"
  })));
};
var CartographerLayout = function CartographerLayout(props) {
  // eslint-disable-line no-unused-vars
  var cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var dc = state.deviceClass;
  var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return /*#__PURE__*/React.createElement(CartographerMobile, {
      cs: cs,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }
  var railW = state.railHidden ? 0 : state.railCollapsed ? 40 : dc === 'tablet' ? 200 : 240;
  var railSide = state.railSide;
  var railClass = 'rail' + (state.railCollapsed ? ' rail-collapsed' : '') + (state.railHidden ? ' rail-hidden' : '') + (' rail-' + railSide);
  var tabContent = /*#__PURE__*/React.createElement("div", {
    className: "rail-tab-content"
  }, /*#__PURE__*/React.createElement(TabContentBuilder, {
    tabId: state.railTab,
    options: {
      sectionTitle: true
    },
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }));
  var tabs = _MOBILE_TABS;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-cartographer"
  }, /*#__PURE__*/React.createElement(CanvasArea, {
    cs: cs,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement("div", {
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
    onClick: function () {
      LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
    },
    "aria-label": "Help",
    title: "Keyboard shortcuts (?)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-question-circle",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeViewUtils.toggleRailSide(stateRef, refs, dispatch);
    },
    "aria-label": state.railSide === 'right' ? "Move panel to left" : "Move panel to right",
    title: state.railSide === 'right' ? "Move panel to left" : "Move panel to right"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.railSide === 'right' ? "fa-indent" : "fa-dedent"),
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn rail-collapse-btn",
    onClick: function () {
      LifeViewUtils.toggleRailCollapsed(stateRef, refs, dispatch);
    },
    "aria-expanded": !state.railCollapsed,
    "aria-label": state.railCollapsed ? "Expand controls panel" : "Collapse controls panel"
  }, state.railCollapsed ? /*#__PURE__*/React.createElement("i", {
    className: "fa fa-chevron-left",
    "aria-hidden": "true"
  }) : /*#__PURE__*/React.createElement("i", {
    className: "fa fa-chevron-right",
    "aria-hidden": "true"
  })))), !state.railCollapsed && /*#__PURE__*/React.createElement("div", {
    className: "rail-stats"
  }, /*#__PURE__*/React.createElement(StatsPanel, {
    state: state,
    refs: refs,
    stateRef: stateRef,
    dispatch: dispatch
  })), /*#__PURE__*/React.createElement("div", {
    className: "rail-tabs",
    role: "tablist",
    "aria-label": "Control categories"
  }, tabs.map(function (tab) {
    var isActive = state.railTab === tab.id;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.id,
      className: "rail-tab" + (isActive ? " active" : ""),
      onClick: function () {
        LifeViewUtils.setRailTab(stateRef, refs, dispatch, tab.id);
      },
      role: "tab",
      "aria-selected": isActive,
      "aria-controls": "rail-panel-" + tab.id,
      "aria-label": tab.label
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + tab.icon,
      "aria-hidden": "true"
    }), !state.railCollapsed && /*#__PURE__*/React.createElement("span", {
      className: "rail-tab-label"
    }, tab.label));
  })), !state.railCollapsed && /*#__PURE__*/React.createElement("div", {
    id: "rail-panel-" + state.railTab,
    role: "tabpanel",
    "aria-label": state.railTab + " controls",
    style: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, tabContent), !state.railCollapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      borderTop: '1px solid var(--panel-border)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(LayoutSwitcher, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement("div", {
    className: "transport-strip",
    role: "toolbar",
    "aria-label": "Simulation transport"
  }, /*#__PURE__*/React.createElement(TransportControls, {
    compact: true,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })), state.railHidden && /*#__PURE__*/React.createElement("div", {
    className: "rail-reveal rail-reveal-" + railSide,
    onMouseEnter: function () {
      LifeViewUtils.toggleRailHidden(stateRef, refs, dispatch);
    }
  }), /*#__PURE__*/React.createElement(MobileMinimapArea, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }));
};
var CartographerMobile = function CartographerMobile(props) {
  // eslint-disable-line no-unused-vars
  var cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var sheetContent = state.bottomSheetOpen ? /*#__PURE__*/React.createElement(TabContentBuilder, {
    tabId: state.bottomSheetTab,
    options: {
      sectionTitle: true,
      sparkline: true
    },
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-cartographer layout-mobile"
  }, /*#__PURE__*/React.createElement(CanvasArea, {
    cs: cs,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && !refs.statsChipHidden && /*#__PURE__*/React.createElement(StatsChip, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && /*#__PURE__*/React.createElement(MobileContextPanel, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && /*#__PURE__*/React.createElement(MobileMinimapArea, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(MobileTransportBar, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), state.bottomSheetOpen && /*#__PURE__*/React.createElement(BottomSheet, {
    sheetContent: sheetContent,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }));
};
var ObservatoryLayout = function ObservatoryLayout(props) {
  // eslint-disable-line no-unused-vars
  var cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var dc = state.deviceClass;
  var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return /*#__PURE__*/React.createElement(ObservatoryMobile, {
      cs: cs,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }
  var panels = state.panelStates;
  var zenMode = state.zenMode;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-observatory" + (zenMode ? " zen-mode" : "")
  }, /*#__PURE__*/React.createElement(CanvasArea, {
    cs: cs,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement("div", {
    className: "transport-strip",
    role: "toolbar",
    "aria-label": "Simulation transport"
  }, /*#__PURE__*/React.createElement(TransportControls, {
    compact: true,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })), !zenMode && /*#__PURE__*/React.createElement("div", {
    className: "panel-overlay-container",
    role: "group",
    "aria-label": "Floating control panels"
  }, /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "transport",
    label: "Simulate",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TransportControls, {
    compact: false,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(SpeedSlider, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "board",
    label: "Board",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(BoardSliders, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(BoundaryControls, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "view",
    label: "View",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewControls, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch,
    onToggleTrails: toggleTrails
  }), /*#__PURE__*/React.createElement(ZoomSlider, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(DisplaySettings, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "mode",
    label: "Tools",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ModeControls, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(ToolsContent, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "rules",
    label: "Rules",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement(RulesSection, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "stats",
    label: "Stats",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement(StatsPanel, {
    state: state,
    refs: refs,
    stateRef: stateRef,
    dispatch: dispatch
  })), /*#__PURE__*/React.createElement(FloatPanel, {
    panelId: "importExport",
    label: "Share",
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }, /*#__PURE__*/React.createElement(ExportContent, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })), state.panelGroups.map(function (group) {
    return /*#__PURE__*/React.createElement(PanelGroup, {
      key: group.id,
      group: group,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel-menu",
    role: "group",
    "aria-label": "Panel visibility"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
    },
    "aria-label": "Help",
    title: "Keyboard shortcuts (?)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-question-circle",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn panel-menu-toggle",
    onClick: function () {
      dispatch({
        type: "MERGE",
        payload: {
          panelMenuOpen: !state.panelMenuOpen
        }
      });
    },
    "aria-expanded": !!state.panelMenuOpen,
    "aria-label": "Toggle panel visibility menu"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  })), state.panelMenuOpen && /*#__PURE__*/React.createElement("div", {
    className: "panel-menu-list",
    role: "group",
    "aria-label": "Panel toggles"
  }, ['transport', 'board', 'view', 'mode', 'rules', 'stats', 'importExport'].map(function (id) {
    var label = ObservatoryPanelUtils.getPanelLabel(id);
    return /*#__PURE__*/React.createElement("label", {
      key: id,
      className: "panel-menu-item"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: panels[id].open,
      onChange: function () {
        ObservatoryPanelUtils.togglePanelOpen(id, state, stateRef, refs, dispatch);
      },
      "aria-label": "Show " + label + " panel"
    }), /*#__PURE__*/React.createElement("span", null, label));
  })), /*#__PURE__*/React.createElement(LayoutSwitcher, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), /*#__PURE__*/React.createElement(MobileMinimapArea, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }));
};
var ObservatoryMobile = function ObservatoryMobile(props) {
  // eslint-disable-line no-unused-vars
  var cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var sheetContent = state.bottomSheetOpen ? /*#__PURE__*/React.createElement(TabContentBuilder, {
    tabId: state.bottomSheetTab,
    options: {
      sectionTitle: true,
      sparkline: true
    },
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-observatory layout-mobile"
  }, /*#__PURE__*/React.createElement(CanvasArea, {
    cs: cs,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), /*#__PURE__*/React.createElement(MobileTransportBar, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && !refs.statsChipHidden && /*#__PURE__*/React.createElement(StatsChip, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && /*#__PURE__*/React.createElement(MobileContextPanel, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !state.bottomSheetOpen && /*#__PURE__*/React.createElement(MobileMinimapArea, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), state.bottomSheetOpen && /*#__PURE__*/React.createElement(BottomSheet, {
    sheetContent: sheetContent,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }));
};
"use strict";

/* global React, LifeViewUtils, LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils,
          TransportControls, SpeedSlider, BoardSliders, BoundaryControls,
          ViewControls, ZoomSlider, DisplaySettings, ModeControls, ToolsContent, PresetContent,
          RulesSection, ExportContent, StatsPanel,
          toggleTrails */
/**
 * Observatory panel system — extracted from LifeBoard.
 * Render components: FloatPanel, FloatPanelDirect, PanelGroup, CompactBody
 * Helper functions and imperative handlers: ObservatoryPanelUtils
 */

// ── Helper functions ─────────────────────────────────────────────────

var _getPanelLabel = function (panelId) {
  var PANEL_LABELS = {
    transport: 'Simulate',
    board: 'Board',
    view: 'View',
    mode: 'Tools',
    rules: 'Rules',
    stats: 'Stats',
    importExport: 'Share'
  };
  return PANEL_LABELS[panelId] || panelId;
};
var _getPanelIcon = function (panelId) {
  var PANEL_ICONS = {
    transport: 'fa-play',
    board: 'fa-th-large',
    view: 'fa-eye',
    mode: 'fa-pencil',
    rules: 'fa-cogs',
    stats: 'fa-bar-chart',
    importExport: 'fa-exchange'
  };
  return PANEL_ICONS[panelId] || 'fa-circle-o';
};
var _getPanelContent = function (panelId, state, stateRef, refs, dispatch) {
  switch (panelId) {
    case 'transport':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TransportControls, {
        compact: false,
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(SpeedSlider, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'board':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(BoardSliders, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(BoundaryControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'view':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch,
        onToggleTrails: toggleTrails
      }), /*#__PURE__*/React.createElement(ZoomSlider, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(DisplaySettings, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'mode':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ModeControls, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }), /*#__PURE__*/React.createElement(ToolsContent, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      }));
    case 'rules':
      return /*#__PURE__*/React.createElement(RulesSection, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      });
    case 'stats':
      return /*#__PURE__*/React.createElement(StatsPanel, {
        state: state,
        refs: refs,
        stateRef: stateRef,
        dispatch: dispatch
      });
    case 'importExport':
      return /*#__PURE__*/React.createElement(ExportContent, {
        state: state,
        stateRef: stateRef,
        refs: refs,
        dispatch: dispatch
      });
    default:
      return null;
  }
};
var _checkTabBarOverflow = function (bar, stateRef, refs, dispatch) {
  bar.classList.remove('panel-tab-bar-icons');
  if (bar.scrollWidth > bar.clientWidth + 1) {
    bar.classList.add('panel-tab-bar-icons');
    // If even icon-only tabs still overflow, switch the group to compact mode.
    if (stateRef && refs && dispatch) {
      // Re-check after class change settles.
      requestAnimationFrame(function () {
        if (bar.scrollWidth > bar.clientWidth + 1) {
          var groupEl = bar.closest('.panel-group');
          if (groupEl) {
            var groupId = groupEl.getAttribute('data-group-id');
            if (groupId) {
              LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, groupId);
            }
          }
        }
      });
    }
  }
};
var _observeTabBars = function (stateRef, refs, dispatch) {
  // eslint-disable-line no-unused-vars
  if (refs.tabBarObservers) {
    refs.tabBarObservers.forEach(function (obs) {
      obs.disconnect();
    });
  }
  refs.tabBarObservers = [];
  var tabBars = document.querySelectorAll('.panel-group .panel-tab-bar');
  for (var i = 0; i < tabBars.length; i++) {
    (function (bar) {
      var obs = new ResizeObserver(function () {
        _checkTabBarOverflow(bar, stateRef, refs, dispatch);
      });
      obs.observe(bar);
      refs.tabBarObservers.push(obs);
    })(tabBars[i]);
  }
};

// ── State toggle helpers ─────────────────────────────────────────────

var _togglePanelOpen = function (panelId, stateRef, refs, dispatch) {
  var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
  panels[panelId].open = !panels[panelId].open;
  dispatch({
    type: "MERGE",
    payload: {
      panelStates: panels
    }
  });
  setTimeout(function () {
    LifeViewUtils._persistLayout(stateRef, refs);
  }, 0);
};
var _togglePanelCollapse = function (panelId, stateRef, refs, dispatch) {
  var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
  panels[panelId].collapsed = !panels[panelId].collapsed;
  dispatch({
    type: "MERGE",
    payload: {
      panelStates: panels
    }
  });
  setTimeout(function () {
    LifeViewUtils._persistLayout(stateRef, refs);
  }, 0);
};

// ── Imperative drag/resize handlers ──────────────────────────────────

var _rectsOverlap = function (a, b) {
  var overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  var overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  var overlapArea = overlapX * overlapY;
  var aArea = a.width * a.height;
  return aArea > 0 ? overlapArea / aArea : 0;
};
var _updateDropIndicator = function (draggedId, dragX, dragY, dragPanel) {
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
    var overlap = _rectsOverlap(dragRect, otherRect);
    if (overlap > 0.3 && !found) {
      other.classList.add('drop-target');
      found = true;
    } else {
      other.classList.remove('drop-target');
    }
  }
};
var _clearDropIndicator = function () {
  var els = document.querySelectorAll('.drop-target');
  for (var i = 0; i < els.length; i++) {
    els[i].classList.remove('drop-target');
  }
};
var _findDropTarget = function (draggedId, dragRect) {
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
    if (_rectsOverlap(dragRect, otherRect) > 0.3) {
      return targetId || targetGroupId;
    }
  }
  return null;
};
var _startPanelDrag = function (panelId, e, stateRef, refs, dispatch) {
  if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
    return;
  }
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
  refs.fpDragMove = function (ev) {
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
    _updateDropIndicator(panelId, newX, newY, panel);
  };
  refs.fpDragEnd = function () {
    panel.classList.remove('dragging');
    _clearDropIndicator();
    var finalRect = panel.getBoundingClientRect();
    var mergeTarget = _findDropTarget(panelId, finalRect);
    if (mergeTarget) {
      LifeViewUtils._mergePanels(stateRef, refs, dispatch, panelId, mergeTarget);
    } else {
      var panels = JSON.parse(JSON.stringify(stateRef.current.panelStates));
      panels[panelId].x = finalRect.left;
      panels[panelId].y = finalRect.top;
      dispatch({
        type: "MERGE",
        payload: {
          panelStates: panels
        }
      });
      setTimeout(function () {
        LifeViewUtils._persistLayout(stateRef, refs);
      }, 0);
    }
    document.removeEventListener('mousemove', refs.fpDragMove);
    document.removeEventListener('mouseup', refs.fpDragEnd);
    document.removeEventListener('touchmove', refs.fpDragMove);
    document.removeEventListener('touchend', refs.fpDragEnd);
  };
  document.addEventListener('mousemove', refs.fpDragMove);
  document.addEventListener('mouseup', refs.fpDragEnd);
  document.addEventListener('touchmove', refs.fpDragMove, {
    passive: false
  });
  document.addEventListener('touchend', refs.fpDragEnd);
};
var _startPanelResize = function (panelId, e, stateRef, refs, dispatch) {
  e.preventDefault();
  e.stopPropagation();
  var panel = e.currentTarget.parentElement;
  var rect = panel.getBoundingClientRect();
  var startW = rect.width;
  var startH = rect.height;
  var startX = e.touches ? e.touches[0].clientX : e.clientX;
  var startY = e.touches ? e.touches[0].clientY : e.clientY;
  var isCompact = stateRef.current.panelStates[panelId] && stateRef.current.panelStates[panelId].compact;
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
      LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
    } else if (isCompact && newW > 120) {
      didToggle = true;
      panel.style.width = Math.max(180, newW) + 'px';
      LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
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
};
var _startGroupDrag = function (groupId, e, stateRef, refs, dispatch) {
  if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
    return;
  }
  e.preventDefault();
  var panel = e.currentTarget.closest('.panel-group') || e.currentTarget.parentElement;
  var rect = panel.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  var offX = clientX - rect.left;
  var offY = clientY - rect.top;
  LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, groupId);
  panel.classList.add('dragging');
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
    var groups = JSON.parse(JSON.stringify(stateRef.current.panelGroups));
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) {
        groups[i].x = finalRect.left;
        groups[i].y = finalRect.top;
        break;
      }
    }
    dispatch({
      type: "MERGE",
      payload: {
        panelGroups: groups
      }
    });
    setTimeout(function () {
      LifeViewUtils._persistLayout(stateRef, refs);
    }, 0);
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
};
var _startTabDrag = function (panelId, groupId, e, stateRef, refs, dispatch) {
  var startX = e.clientX;
  var startY = e.clientY;
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
      LifeViewUtils._separatePanel(stateRef, refs, dispatch, panelId, groupId, ev.clientX - 40, ev.clientY - 10);
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
};
var _startGroupResize = function (groupId, e, stateRef, refs, dispatch) {
  e.preventDefault();
  e.stopPropagation();
  var panel = e.currentTarget.parentElement;
  var rect = panel.getBoundingClientRect();
  var startW = rect.width;
  var startH = rect.height;
  var startX = e.touches ? e.touches[0].clientX : e.clientX;
  var startY = e.touches ? e.touches[0].clientY : e.clientY;
  var group = null;
  var groups = stateRef.current.panelGroups;
  for (var gi = 0; gi < groups.length; gi++) {
    if (groups[gi].id === groupId) {
      group = groups[gi];
      break;
    }
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
      LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, groupId);
    } else if (isCompact && newW > 120) {
      didToggle = true;
      // Clear inline styles — let CSS handle the expanded layout.
      panel.style.width = '';
      panel.style.maxHeight = '';
      LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, groupId);
    } else if (isCompact) {
      // In compact mode, only resize vertically.
      panel.style.maxHeight = Math.max(100, newH) + 'px';
    } else {
      panel.style.width = Math.max(180, newW) + 'px';
      panel.style.maxHeight = Math.max(80, newH) + 'px';
    }
  };
  var end = function () {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    // If we toggled compact mode during resize, ensure no stale inline
    // styles remain that would conflict with the new CSS layout.
    if (didToggle) {
      panel.style.width = '';
      panel.style.maxHeight = '';
    }
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', move, {
    passive: false
  });
  document.addEventListener('touchend', end);
};

// ── Compact body definitions ─────────────────────────────────────────

var _getCompactDefs = function (panelId, state, stateRef, refs, dispatch) {
  switch (panelId) {
    case 'transport':
      return [{
        id: 'play',
        icon: state.running ? 'fa-pause' : 'fa-play',
        title: 'Play/Pause (Space)',
        onClick: function () {
          LifeSimUtils.toggleGame(stateRef, refs, dispatch);
        },
        active: state.running
      }, {
        id: 'step',
        icon: 'fa-step-forward',
        title: 'Step (.)',
        onClick: function () {
          LifeSimUtils.stepGame(stateRef, refs, dispatch);
        }
      }, {
        id: 'back',
        icon: 'fa-step-backward',
        title: 'Step backward (,)',
        onClick: function () {
          LifeSimUtils.stepBack(stateRef, refs, dispatch);
        }
      }, {
        id: 'go',
        icon: 'fa-fast-forward',
        title: 'Advance multiple generations',
        onClick: function () {
          LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount);
        }
      }, {
        id: 'reset',
        icon: 'fa-refresh',
        title: 'Randomize (R)',
        onClick: function () {
          LifeBoardUtils.resetGame(stateRef, refs, dispatch);
        }
      }, {
        id: 'empty',
        icon: 'fa-eraser',
        title: 'Clear all cells (E)',
        onClick: function () {
          LifeBoardUtils.emptyBoard(stateRef, refs, dispatch);
        }
      }, {
        id: 'undo',
        icon: 'fa-undo',
        title: 'Undo (Ctrl+Z)',
        onClick: function () {
          LifeSimUtils.undo(stateRef, refs, dispatch);
        }
      }, {
        id: 'speed',
        icon: 'fa-tachometer',
        title: 'Speed',
        popOut: function () {
          return /*#__PURE__*/React.createElement(SpeedSlider, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
    case 'board':
      return [{
        id: 'boundary',
        icon: 'fa-repeat',
        title: 'Cycle boundary',
        onClick: function () {
          LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch);
        },
        active: state.boundary !== 'toroidal'
      }, {
        id: 'grid-size',
        icon: 'fa-th-large',
        title: 'Grid size',
        popOut: function () {
          return /*#__PURE__*/React.createElement(BoardSliders, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
    case 'view':
      return [{
        id: 'fit-grid',
        icon: 'fa-arrows-alt',
        title: 'Fit Grid',
        onClick: function () {
          LifeViewUtils.fitView(stateRef, refs, dispatch);
        }
      }, {
        id: 'fit-cells',
        icon: 'fa-compress',
        title: 'Fit Cells',
        onClick: function () {
          LifeViewUtils.fitLiveCells(stateRef, refs, dispatch);
        }
      }, {
        id: 'grid',
        icon: 'fa-th',
        title: 'Grid lines (G)',
        onClick: function () {
          LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch);
        },
        active: state.gridLines
      }, {
        id: 'trails',
        icon: 'fa-eye',
        title: 'Trails',
        onClick: function () {
          toggleTrails(stateRef, refs, dispatch);
        },
        active: state.showTrails
      }, {
        id: 'minimap',
        icon: 'fa-map-o',
        title: 'Minimap (M)',
        onClick: function () {
          LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch);
        },
        active: state.showMinimap
      }, {
        id: 'zoom',
        icon: 'fa-search-plus',
        title: 'Zoom',
        popOut: function () {
          return /*#__PURE__*/React.createElement(ZoomSlider, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }, {
        id: 'display',
        icon: 'fa-paint-brush',
        title: 'Display settings',
        popOut: function () {
          return /*#__PURE__*/React.createElement(DisplaySettings, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
    case 'mode':
      var defs = [{
        id: 'draw',
        icon: 'fa-pencil',
        title: 'Draw mode (D)',
        onClick: function () {
          LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch);
        },
        active: state.drawMode === 'paint'
      }, {
        id: 'preset',
        icon: 'fa-puzzle-piece',
        title: 'Preset patterns (P)',
        onClick: function () {
          LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch);
        },
        active: state.drawMode === 'preset',
        popOut: function () {
          return /*#__PURE__*/React.createElement(PresetContent, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }, {
        id: 'select',
        icon: 'fa-mouse-pointer',
        title: 'Select mode (S)',
        onClick: function () {
          LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch);
        },
        active: state.drawMode === 'select'
      }, {
        id: 'live-paint',
        icon: 'fa-paint-brush',
        title: 'Live Paint',
        onClick: function () {
          LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch);
        },
        active: state.livePaintMode
      }, {
        id: 'analyze',
        icon: 'fa-crosshairs',
        title: 'Analyze',
        onClick: function () {
          LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch);
        }
      }, {
        id: 'tools',
        icon: 'fa-wrench',
        title: 'Tool options',
        popOut: function () {
          return /*#__PURE__*/React.createElement(ToolsContent, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
      if (state.boundary !== 'unbounded') {
        defs.splice(3, 0, {
          id: 'region',
          icon: 'fa-th',
          title: 'Region bounds (B)',
          onClick: function () {
            LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch);
          },
          active: state.drawMode === 'region'
        });
      }
      return defs;
    case 'rules':
      return [{
        id: 'rules',
        icon: 'fa-cogs',
        title: 'Rules',
        popOut: function () {
          return /*#__PURE__*/React.createElement(RulesSection, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
    case 'stats':
      return [{
        id: 'stats',
        icon: 'fa-bar-chart',
        title: 'Statistics',
        popOut: function () {
          return /*#__PURE__*/React.createElement(StatsPanel, {
            state: state,
            refs: refs,
            stateRef: stateRef,
            dispatch: dispatch
          });
        }
      }];
    case 'importExport':
      return [{
        id: 'io',
        icon: 'fa-exchange',
        title: 'Share',
        popOut: function () {
          return /*#__PURE__*/React.createElement(ExportContent, {
            state: state,
            stateRef: stateRef,
            refs: refs,
            dispatch: dispatch
          });
        }
      }];
    default:
      return [];
  }
};

// ── Render components ────────────────────────────────────────────────

var CompactBody = function CompactBody(props) {
  // eslint-disable-line no-unused-vars
  var panelId = props.panelId,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var defs = _getCompactDefs(panelId, state, stateRef, refs, dispatch);
  if (!defs || defs.length === 0) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "compact-body"
  }, defs.map(function (def) {
    var isOpen = LifeViewUtils._isPopOutOpen(stateRef, refs, dispatch, panelId, def.id);
    return /*#__PURE__*/React.createElement("div", {
      key: def.id,
      className: "pop-out-trigger"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn" + (def.active ? " active" : ""),
      onClick: def.popOut ? function () {
        if (def.onClick) def.onClick();
        isOpen ? LifeViewUtils._closePopOut(stateRef, refs, dispatch) : LifeViewUtils._openPopOut(stateRef, refs, dispatch, panelId, def.id);
      } : def.onClick,
      title: def.title
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + def.icon,
      "aria-hidden": "true"
    })), def.popOut && isOpen && /*#__PURE__*/React.createElement("div", {
      className: "pop-out-panel"
    }, def.popOut()));
  }));
};
var FloatPanel = function FloatPanel(props) {
  // eslint-disable-line no-unused-vars
  var panelId = props.panelId,
    label = props.label,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var content = props.content || props.children;
  var ps = state.panelStates[panelId];
  if (!ps || !ps.open) {
    return null;
  }
  // Skip panels that are in a group — they render inside the group.
  if (LifeViewUtils._findGroupForPanel(stateRef, refs, dispatch, panelId)) {
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
      LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId);
    },
    onTouchStart: function () {
      LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId);
    },
    role: "region",
    "aria-label": label + " panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "float-panel-header",
    onMouseDown: function (e) {
      _startPanelDrag(panelId, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startPanelDrag(panelId, e, stateRef, refs, dispatch);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "float-panel-title",
    id: "panel-title-" + panelId
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-compact-toggle",
    onClick: function () {
      LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
    },
    "aria-label": isCompact ? "Expand " + label + " panel width" : "Compact " + label + " panel",
    title: isCompact ? "Expand panel" : "Compact panel"
  }, isCompact ? "\u00bb" : "\u00ab"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-collapse",
    onClick: function () {
      _togglePanelCollapse(panelId, stateRef, refs, dispatch);
    },
    "aria-expanded": !ps.collapsed,
    "aria-label": ps.collapsed ? "Expand " + label + " panel" : "Collapse " + label + " panel"
  }, ps.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function () {
      _togglePanelOpen(panelId, stateRef, refs, dispatch);
    },
    "aria-label": "Close " + label + " panel"
  }, "\xD7")), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, isCompact ? /*#__PURE__*/React.createElement(CompactBody, {
    panelId: panelId,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }) : content), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
    className: "float-panel-resize",
    onMouseDown: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    }
  }));
};
var FloatPanelDirect = function FloatPanelDirect(props) {
  // eslint-disable-line no-unused-vars
  var panelId = props.panelId,
    label = props.label,
    content = props.content,
    group = props.group,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var ps = state.panelStates[panelId];
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
      LifeViewUtils._bringPanelToFront(stateRef, refs, dispatch, panelId);
    },
    role: "region",
    "aria-label": label + " panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "float-panel-header",
    onMouseDown: function (e) {
      _startPanelDrag(panelId, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startPanelDrag(panelId, e, stateRef, refs, dispatch);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "float-panel-title"
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-collapse",
    onClick: function () {
      _togglePanelCollapse(panelId, stateRef, refs, dispatch);
    },
    "aria-expanded": !ps.collapsed
  }, ps.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function () {
      _togglePanelOpen(panelId, stateRef, refs, dispatch);
    },
    "aria-label": "Close " + label + " panel"
  }, "\xD7")), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, content));
};
var PanelGroup = function PanelGroup(props) {
  // eslint-disable-line no-unused-vars
  var group = props.group,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var panels = state.panelStates;
  // Filter to only open panels in this group.
  var openPanels = group.panels.filter(function (pid) {
    return panels[pid] && panels[pid].open;
  });
  if (openPanels.length === 0) {
    return null;
  }
  // If only one panel remains open, render as standalone.
  if (openPanels.length === 1) {
    var soloId = openPanels[0];
    var soloLabel = _getPanelLabel(soloId);
    return /*#__PURE__*/React.createElement(FloatPanelDirect, {
      panelId: soloId,
      label: soloLabel,
      content: _getPanelContent(soloId, state, stateRef, refs, dispatch),
      group: group,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }
  var activeTab = openPanels.indexOf(group.activeTab) !== -1 ? group.activeTab : openPanels[0];
  var isCompact = !!group.compact;
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
  var className = "float-panel panel-group" + (isCompact ? " panel-group-compact" : "");

  // Tab buttons: icon-only rail in compact, full tabs in expanded.
  var tabButtons = openPanels.map(function (pid) {
    var label = _getPanelLabel(pid);
    return /*#__PURE__*/React.createElement("button", {
      key: pid,
      type: "button",
      className: "panel-tab" + (pid === activeTab ? " panel-tab-active" : ""),
      onClick: function (e) {
        e.stopPropagation();
        LifeViewUtils._setGroupActiveTab(stateRef, refs, dispatch, group.id, pid);
      },
      onMouseDown: function (e) {
        if (!isCompact) _startTabDrag(pid, group.id, e, stateRef, refs, dispatch);
      },
      title: label
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + _getPanelIcon(pid) + " panel-tab-icon",
      "aria-hidden": "true"
    }), !isCompact && /*#__PURE__*/React.createElement("span", {
      className: "panel-tab-label"
    }, label));
  });
  if (isCompact) {
    // Compact layout: drag bar on top spanning full width, then icon rail + content side by side below.
    return /*#__PURE__*/React.createElement("div", {
      className: className,
      style: style,
      "data-group-id": group.id,
      onMouseDown: function () {
        LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, group.id);
      },
      role: "region",
      "aria-label": "Panel group"
    }, /*#__PURE__*/React.createElement("div", {
      className: "compact-group-header",
      onMouseDown: function (e) {
        _startGroupDrag(group.id, e, stateRef, refs, dispatch);
      },
      onTouchStart: function (e) {
        _startGroupDrag(group.id, e, stateRef, refs, dispatch);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "compact-active-label"
    }, _getPanelLabel(activeTab)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn float-panel-compact-toggle",
      onClick: function (e) {
        e.stopPropagation();
        LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, group.id);
      },
      title: "Expand group"
    }, "\u00bb"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn float-panel-close",
      onClick: function (e) {
        e.stopPropagation();
        _togglePanelOpen(activeTab, stateRef, refs, dispatch);
      },
      "aria-label": "Close active panel"
    }, "\xD7")), /*#__PURE__*/React.createElement("div", {
      className: "compact-group-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "compact-icon-rail"
    }, tabButtons), /*#__PURE__*/React.createElement("div", {
      className: "compact-main"
    }, /*#__PURE__*/React.createElement(CompactBody, {
      panelId: activeTab,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    }))), /*#__PURE__*/React.createElement("div", {
      className: "float-panel-resize",
      onMouseDown: function (e) {
        _startGroupResize(group.id, e, stateRef, refs, dispatch);
      },
      onTouchStart: function (e) {
        _startGroupResize(group.id, e, stateRef, refs, dispatch);
      }
    }));
  }

  // Expanded layout: tabs across the top.
  var tabArea = /*#__PURE__*/React.createElement("div", {
    className: "panel-tab-bar"
  }, tabButtons);
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style,
    "data-group-id": group.id,
    onMouseDown: function () {
      LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, group.id);
    },
    role: "region",
    "aria-label": "Panel group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "float-panel-header",
    onMouseDown: function (e) {
      _startGroupDrag(group.id, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startGroupDrag(group.id, e, stateRef, refs, dispatch);
    }
  }, tabArea, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-compact-toggle",
    onClick: function () {
      LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, group.id);
    },
    title: "Compact group"
  }, "\u00ab"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function () {
      _togglePanelOpen(activeTab, stateRef, refs, dispatch);
    },
    "aria-label": "Close active panel"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, _getPanelContent(activeTab, state, stateRef, refs, dispatch)), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-resize",
    onMouseDown: function (e) {
      _startGroupResize(group.id, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startGroupResize(group.id, e, stateRef, refs, dispatch);
    }
  }));
};

// ── Exported utils object ────────────────────────────────────────────

var ObservatoryPanelUtils = {
  // eslint-disable-line no-unused-vars
  _getPanelLabel: _getPanelLabel,
  _getPanelIcon: _getPanelIcon,
  _getPanelContent: _getPanelContent,
  _getCompactDefs: _getCompactDefs,
  _checkTabBarOverflow: _checkTabBarOverflow,
  _observeTabBars: _observeTabBars,
  _togglePanelOpen: _togglePanelOpen,
  _togglePanelCollapse: _togglePanelCollapse,
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
  togglePanelOpen: function (panelId, state, stateRef, refs, dispatch) {
    _togglePanelOpen(panelId, stateRef, refs, dispatch);
  },
  togglePanelCollapse: function (panelId, state, stateRef, refs, dispatch) {
    _togglePanelCollapse(panelId, stateRef, refs, dispatch);
  }
};
"use strict";

/* global React, CanvasRenderer, LifeAnalysisUtils */
/**
 * PopGraphModal — full population history graph overlay.
 * Props: showPopGraph, popHistory, stateRef, refs, dispatch
 */
var PopGraphModal = function PopGraphModal(props) {
  // eslint-disable-line no-unused-vars
  if (!props.showPopGraph) {
    return null;
  }
  var hist = props.popHistory;
  if (!hist || hist.length < 2) {
    return null;
  }
  var stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var onClose = function () {
    LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
  };
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
  var points = hist.map(function (p, idx) {
    var x = padL + idx / (hist.length - 1) * plotW;
    var y = padT + (1 - p / maxPop) * plotH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
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
    onClick: onClose,
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
    onClick: onClose,
    title: "Close",
    "aria-label": "Close population graph"
  }, "Close")));
};
"use strict";

/* global React, LifeBoardUtils, LifeIOUtils, LifeAnalysisUtils, RULE_PRESETS */
/**
 * Rules and export panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 */

var RulesSection = function RulesSection(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(state.ruleString);
  return /*#__PURE__*/React.createElement("div", {
    className: "sidebar-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sidebar-section-title"
  }, "Rules"), /*#__PURE__*/React.createElement("div", {
    className: "presets-col"
  }, /*#__PURE__*/React.createElement("select", {
    className: "rule-preset-select",
    "aria-label": "Rule preset",
    value: state.rulePreset,
    onChange: function (e) {
      LifeBoardUtils.setRulePreset(stateRef, refs, dispatch, e);
    }
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
    value: state.ruleString,
    onChange: function (e) {
      LifeBoardUtils.setRule(stateRef, refs, dispatch, e);
    },
    title: "Birth/Survival rule string (e.g. B3/S23)"
  })));
};
var RLESection = function RLESection(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "sidebar-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rle-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "buttons rle-toggle-row"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rle-toggle btn-block" + (state.showRle ? " active" : ""),
    onClick: function () {
      LifeIOUtils.toggleRle(stateRef, refs, dispatch);
    }
  }, "Import RLE / Plaintext")), state.showRle && /*#__PURE__*/React.createElement("div", {
    className: "rle-body"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "rle-input",
    rows: "5",
    placeholder: "Paste RLE or plaintext pattern\n(from LifeWiki or Golly)",
    value: state.rleInput,
    onChange: function (e) {
      LifeIOUtils.setRleInput(stateRef, refs, dispatch, e);
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-block",
    onClick: function () {
      LifeIOUtils.loadRle(stateRef, refs, dispatch);
    },
    title: "Load the RLE or plaintext pattern"
  }, "Load pattern"), state.rleError && /*#__PURE__*/React.createElement("p", {
    className: "rle-error"
  }, state.rleError))));
};
var ExportContent = function ExportContent(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "export-content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sidebar-section-title"
  }, "Share"), /*#__PURE__*/React.createElement("div", {
    className: "btn-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "buttons buttons-export"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeIOUtils.exportPNG(stateRef, refs, dispatch);
    },
    title: "Save as PNG"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-camera",
    "aria-hidden": "true"
  }), " Export PNG"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeIOUtils.copyRLE(stateRef, refs, dispatch);
    },
    title: "Copy board as RLE"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-clipboard",
    "aria-hidden": "true"
  }), " Copy RLE"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.recording ? " active btn-record" : ""),
    onClick: function () {
      LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch);
    },
    title: "Record an animated GIF",
    "aria-label": state.recording ? "Stop recording" : "Record GIF"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.recording ? "fa-stop" : "fa-circle"),
    "aria-hidden": "true"
  }), " ", state.recording ? "Stop" : "Record"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeIOUtils.shareURL(stateRef, refs, dispatch);
    },
    title: "Copy shareable URL to clipboard",
    "aria-label": "Share simulation URL"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-share-alt",
    "aria-hidden": "true"
  }), " ", state.shareTooltip ? "Copied!" : "Share")), /*#__PURE__*/React.createElement(RLESection, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })));
};
"use strict";

/* global React, LifeViewUtils, LifeBoardUtils, THEMES, SPEED_DELAYS */
/**
 * Settings panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 * ViewControls also receives onToggleTrails.
 */

var ViewControls = function ViewControls(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var onToggleTrails = props.onToggleTrails;
  return /*#__PURE__*/React.createElement("div", {
    className: "view-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeViewUtils.fitView(stateRef, refs, dispatch);
    },
    title: "Zoom to fit entire grid"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-arrows-alt",
    "aria-hidden": "true"
  }), " Fit Grid"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeViewUtils.fitLiveCells(stateRef, refs, dispatch);
    },
    title: "Zoom to fit live cells"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-compress",
    "aria-hidden": "true"
  }), " Fit Cells"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.gridLines ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch);
    },
    title: "Toggle grid lines (G)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  }), " Grid"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.showTrails ? " active" : ""),
    onClick: function () {
      onToggleTrails(stateRef, refs, dispatch);
    },
    title: "Show ghost trails"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-eye",
    "aria-hidden": "true"
  }), " Trails"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.showMinimap ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch);
    },
    title: "Show/hide minimap (M)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-map-o",
    "aria-hidden": "true"
  }), " Minimap"));
};
var ZoomSlider = function ZoomSlider(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "sliders"
  }, /*#__PURE__*/React.createElement("label", {
    className: "slider-title"
  }, "Zoom: " + state.cellSize + "\u00a0px/cell"), /*#__PURE__*/React.createElement("div", {
    className: "slider-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "1",
    max: "32",
    step: "1",
    "aria-label": "Zoom level",
    value: state.cellSize,
    onChange: function (e) {
      LifeViewUtils.setZoom(stateRef, refs, dispatch, e);
    }
  })));
};
var DisplaySettings = function DisplaySettings(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "display-settings"
  }, /*#__PURE__*/React.createElement("label", {
    className: "control-group-label"
  }, "Display"), /*#__PURE__*/React.createElement("div", {
    className: "presets-col"
  }, /*#__PURE__*/React.createElement("select", {
    className: "rule-preset-select",
    "aria-label": "Color theme",
    value: state.theme,
    onChange: function (e) {
      LifeBoardUtils.setTheme(stateRef, refs, dispatch, e);
    }
  }, Object.keys(THEMES).map(function (t) {
    return /*#__PURE__*/React.createElement("option", {
      key: t,
      value: t
    }, t);
  })), /*#__PURE__*/React.createElement("select", {
    className: "rule-preset-select",
    "aria-label": "Dark mode preference",
    value: state.darkModePref,
    onChange: function (e) {
      LifeBoardUtils.setDarkModePref(stateRef, refs, dispatch, e);
    },
    title: "UI dark mode preference"
  }, /*#__PURE__*/React.createElement("option", {
    value: "system"
  }, "Mode: System"), /*#__PURE__*/React.createElement("option", {
    value: "light"
  }, "Mode: Light"), /*#__PURE__*/React.createElement("option", {
    value: "dark"
  }, "Mode: Dark"))));
};
var BoundaryControls = function BoundaryControls(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "boundary-controls"
  }, /*#__PURE__*/React.createElement("label", {
    className: "control-group-label"
  }, "Boundary"), /*#__PURE__*/React.createElement("div", {
    className: "view-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.boundary !== 'toroidal' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch);
    },
    title: "Cycle boundary: Wrap / Hard / Infinite"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-repeat",
    "aria-hidden": "true"
  }), " ", state.boundary === 'toroidal' ? "Wrap" : state.boundary === 'finite' ? "Hard" : "\u221E")));
};
var SpeedSlider = function SpeedSlider(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var delay = SPEED_DELAYS[state.speed - 1];
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
    value: state.speed,
    onChange: function (e) {
      LifeBoardUtils.setSpeed(stateRef, refs, dispatch, e);
    }
  })));
};
var BoardSliders = function BoardSliders(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var isUnbounded = state.boundary === 'unbounded';
  return /*#__PURE__*/React.createElement("div", {
    className: "sidebar-section"
  }, !isUnbounded && /*#__PURE__*/React.createElement("div", {
    className: "sliders"
  }, /*#__PURE__*/React.createElement("label", {
    className: "slider-title"
  }, "Width: " + state.pendingCols), /*#__PURE__*/React.createElement("div", {
    className: "slider-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "20",
    max: "2000",
    step: "10",
    "aria-label": "Grid width",
    value: state.pendingCols,
    onChange: function (e) {
      LifeBoardUtils.setWidth(stateRef, refs, dispatch, e);
    },
    onMouseUp: function () {
      LifeBoardUtils.applyWidth(stateRef, refs, dispatch);
    },
    onKeyDown: function (e) {
      LifeBoardUtils.onWidthKeyDown(stateRef, refs, dispatch, e);
    },
    onTouchEnd: function () {
      LifeBoardUtils.applyWidth(stateRef, refs, dispatch);
    }
  }))), !isUnbounded && /*#__PURE__*/React.createElement("div", {
    className: "sliders"
  }, /*#__PURE__*/React.createElement("label", {
    className: "slider-title"
  }, "Height: " + state.pendingRows), /*#__PURE__*/React.createElement("div", {
    className: "slider-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "20",
    max: "2000",
    step: "10",
    "aria-label": "Grid height",
    value: state.pendingRows,
    onChange: function (e) {
      LifeBoardUtils.setHeight(stateRef, refs, dispatch, e);
    },
    onMouseUp: function () {
      LifeBoardUtils.applyHeight(stateRef, refs, dispatch);
    },
    onKeyDown: function (e) {
      LifeBoardUtils.onHeightKeyDown(stateRef, refs, dispatch, e);
    },
    onTouchEnd: function () {
      LifeBoardUtils.applyHeight(stateRef, refs, dispatch);
    }
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
      LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 100, 100);
    },
    title: "Set grid to 100\xD7100"
  }, "100\xB2"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-xs",
    onClick: function () {
      LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 200, 200);
    },
    title: "Set grid to 200\xD7200"
  }, "200\xB2"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-xs",
    onClick: function () {
      LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 400, 400);
    },
    title: "Set grid to 400\xD7400"
  }, "400\xB2"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-xs",
    onClick: function () {
      LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 1000, 1000);
    },
    title: "Set grid to 1000\xD71000"
  }, "1000\xB2"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-xs",
    onClick: function () {
      LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 2000, 2000);
    },
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
    value: 9 - state.sparseness,
    onChange: function (e) {
      LifeBoardUtils.setDensity(stateRef, refs, dispatch, e);
    }
  }))));
};
"use strict";

/* global React, CanvasRenderer, LifeAnalysisUtils, GPS_DISPLAY_DURATION */
/**
 * Stats-related render components extracted from LifeBoard.
 * Props: state, stateRef, refs, dispatch
 */

var SparklineSVG = function SparklineSVG(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var population = state.liveCells.size;
  var now2 = Date.now();
  var gpsText = refs.measuredGps > 0 && (state.running || now2 < (refs.gpsDisplayUntil || 0)) ? refs.measuredGps.toFixed(1) + '\u00a0gen/s' : null;
  var fullHist = state.popHistory;
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
    onClick: function () {
      LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
    },
    style: {
      cursor: 'pointer'
    },
    title: "Click for full population graph"
  }, "Pop: " + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
    className: "sparkline-peak"
  }, "peak " + maxPop.toLocaleString() + (state.sessionPeakPop > maxPop ? " \xb7 all " + state.sessionPeakPop.toLocaleString() : ""))), /*#__PURE__*/React.createElement("svg", {
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
};
var MobileSparkline = function MobileSparkline(props) {
  // eslint-disable-line no-unused-vars
  var svg = /*#__PURE__*/React.createElement(SparklineSVG, {
    state: props.state,
    refs: props.refs,
    stateRef: props.stateRef,
    dispatch: props.dispatch
  });
  if (!svg) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-sparkline"
  }, svg);
};
var StatsPanel = function StatsPanel(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var population = state.liveCells.size;
  var hc = state.hoverCell;
  var coordText = hc ? 'Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r : '\u2014';
  var sparkline = /*#__PURE__*/React.createElement(SparklineSVG, {
    state: state,
    refs: refs,
    stateRef: stateRef,
    dispatch: dispatch
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, /*#__PURE__*/React.createElement("span", null, "Gen: " + state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    className: "board-dims"
  }, state.cols + "\u00d7" + state.rows)), /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "status-badges"
  }, /*#__PURE__*/React.createElement("span", {
    className: "status-indicator " + (state.running ? "status-running" : "status-paused")
  }, state.running ? "Running" : "Paused"), state.stable && /*#__PURE__*/React.createElement("span", {
    className: "status-indicator status-stable"
  }, "Stable")), /*#__PURE__*/React.createElement("div", {
    className: "coord-display"
  }, coordText)), sparkline || /*#__PURE__*/React.createElement("div", {
    className: "sparkline-placeholder"
  }, "Pop: " + population.toLocaleString()));
};
var StatsChip = function StatsChip(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "stats-chip",
    onClick: function () {
      LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
    },
    role: "button",
    tabIndex: "0",
    "aria-atomic": "true",
    "aria-live": "off",
    onKeyDown: function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
      }
    }
  }, /*#__PURE__*/React.createElement("span", null, "Gen " + state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", null, "\u2002Pop " + state.liveCells.size.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    className: "status-indicator status-icon " + (state.running ? "status-running" : "status-paused")
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.stable ? "fa-check-circle" : state.running ? "fa-play" : "fa-pause")
  }), " ", state.stable ? "Stable" : state.running ? "Run" : "Pause"));
};
"use strict";

/* global React, CanvasRenderer, PATTERNS, PATTERN_GROUPS, PATTERN_META,
          InputHandler, LifeBoardUtils, LifeAnalysisUtils,
          drawBoard, drawRotationPreview */
/**
 * Tools-panel components extracted from LifeBoard.
 * ModeControls — draw mode toggle buttons + analyze.
 * ToolsContent — tool sub-type selectors, preset picker, selection actions.
 * MobileContextPanel — rotation / selection buttons shown on mobile.
 * Each component receives props: state, stateRef, refs, dispatch
 */

var ModeControls = function ModeControls(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "mode-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'paint' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch);
    },
    title: "Freehand draw mode (D)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-pencil",
    "aria-hidden": "true"
  }), " Draw"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'preset' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch);
    },
    title: "Place preset patterns (P)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-puzzle-piece",
    "aria-hidden": "true"
  }), " Preset"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'select' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch);
    },
    title: "Select and move cells (S)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-mouse-pointer",
    "aria-hidden": "true"
  }), " Select"), state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'region' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch);
    },
    title: "Draw/erase region bounds (B)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  }), " Region"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.livePaintMode ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch);
    },
    title: "Paint while running"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-paint-brush",
    "aria-hidden": "true"
  }), " Live Paint"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch);
    },
    disabled: state.analyzing,
    title: "Detect oscillator/spaceship"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-crosshairs",
    "aria-hidden": "true"
  }), " Analyze"));
};
var ToolsContent = function ToolsContent(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var filterLc = state.patternFilter.toLowerCase();
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
    value: state.drawTool,
    onChange: function (e) {
      dispatch({
        type: "MERGE",
        payload: {
          drawTool: e.target.value,
          drawMode: 'paint',
          selection: null
        }
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
    value: state.selectTool,
    onChange: function (e) {
      dispatch({
        type: "MERGE",
        payload: {
          selectTool: e.target.value,
          drawMode: 'select',
          selection: null
        }
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
  }, "All visible"))), state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("div", {
    className: "tool-subtype-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "tool-label"
  }, "Region:"), /*#__PURE__*/React.createElement("select", {
    value: state.regionTool,
    onChange: function (e) {
      dispatch({
        type: "MERGE",
        payload: {
          regionTool: e.target.value,
          drawMode: 'region'
        }
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
    className: "preset-select" + (state.drawMode === 'preset' && state.selectedPattern ? " active" : ""),
    value: state.selectedPattern || "",
    onChange: function (e) {
      LifeBoardUtils.selectPattern(stateRef, refs, dispatch, e);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose preset..."), patternOptions)), /*#__PURE__*/React.createElement("input", {
    className: "pattern-filter-input",
    type: "search",
    placeholder: "Filter patterns...",
    "aria-label": "Filter patterns",
    value: state.patternFilter,
    onChange: function (e) {
      dispatch({
        type: "MERGE",
        payload: {
          patternFilter: e.target.value
        }
      });
    }
  }), state.drawMode === 'preset' && state.selectedPattern && /*#__PURE__*/React.createElement("div", {
    className: "rotation-row"
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "rotation-preview",
    width: "96",
    height: "96",
    role: "img",
    "aria-label": "Pattern rotation preview",
    ref: function (c) {
      refs.previewCanvas = c;
      if (c) requestAnimationFrame(function () {
        drawRotationPreview(stateRef, refs);
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "rotation-btns"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rotate",
    onClick: function () {
      LifeBoardUtils.rotateCCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\xB0 counter-clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-undo",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rotate",
    onClick: function () {
      LifeBoardUtils.rotateCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\xB0 clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-repeat",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      refs.previewPos = null;
      dispatch({
        type: "MERGE",
        payload: {
          selectedPattern: null,
          patternRotation: 0,
          drawMode: "paint"
        }
      });
      setTimeout(function () {
        drawBoard(stateRef, refs);
      }, 0);
    },
    "aria-label": "Cancel pattern placement",
    title: "Cancel placement"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times",
    "aria-hidden": "true"
  })))), state.selection && /*#__PURE__*/React.createElement("div", {
    className: "buttons buttons-selection"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.copySelection(stateRef, refs, dispatch);
    },
    title: "Copy selected cells",
    "aria-label": "Copy selected cells"
  }, "Copy"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch);
    },
    disabled: !state.clipboard || state.clipboard.length === 0,
    title: "Paste copied cells",
    "aria-label": "Paste copied cells"
  }, "Paste"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.deleteSelection(stateRef, refs, dispatch);
    },
    title: "Delete selected cells",
    "aria-label": "Delete selected cells"
  }, "Delete"))));
};

/**
 * PresetContent — preset selector for use in compact mode pop-out.
 * Renders only the preset dropdown, filter, and rotation preview.
 */
var PresetContent = function PresetContent(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var filterLc = state.patternFilter.toLowerCase();
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
  }, /*#__PURE__*/React.createElement("select", {
    className: "preset-select" + (state.drawMode === 'preset' && state.selectedPattern ? " active" : ""),
    value: state.selectedPattern || "",
    onChange: function (e) {
      LifeBoardUtils.selectPattern(stateRef, refs, dispatch, e);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose preset..."), patternOptions), /*#__PURE__*/React.createElement("input", {
    className: "pattern-filter-input",
    type: "search",
    placeholder: "Filter patterns...",
    "aria-label": "Filter patterns",
    value: state.patternFilter,
    onChange: function (e) {
      dispatch({
        type: "MERGE",
        payload: {
          patternFilter: e.target.value
        }
      });
    }
  }), state.drawMode === 'preset' && state.selectedPattern && /*#__PURE__*/React.createElement("div", {
    className: "rotation-row"
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "rotation-preview",
    width: "96",
    height: "96",
    role: "img",
    "aria-label": "Pattern rotation preview",
    ref: function (c) {
      refs.previewCanvas = c;
      if (c) requestAnimationFrame(function () {
        drawRotationPreview(stateRef, refs);
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "rotation-btns"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rotate",
    onClick: function () {
      LifeBoardUtils.rotateCCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\\xB0 counter-clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-undo",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rotate",
    onClick: function () {
      LifeBoardUtils.rotateCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\\xB0 clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-repeat",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      refs.previewPos = null;
      dispatch({
        type: "MERGE",
        payload: {
          selectedPattern: null,
          patternRotation: 0,
          drawMode: "paint"
        }
      });
      setTimeout(function () {
        drawBoard(stateRef, refs);
      }, 0);
    },
    "aria-label": "Cancel pattern placement",
    title: "Cancel placement"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times",
    "aria-hidden": "true"
  })))));
};
var MobileContextPanel = function MobileContextPanel(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var showRotation = state.drawMode === 'preset' && state.selectedPattern;
  var showSelection = state.selection !== null;
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
    onClick: function () {
      LifeBoardUtils.rotateCCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\xB0 counter-clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-undo",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-rotate",
    onClick: function () {
      LifeBoardUtils.rotateCW(stateRef, refs, dispatch);
    },
    title: "Rotate 90\xB0 clockwise"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-repeat",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      InputHandler._previewPos = null;
      dispatch({
        type: "MERGE",
        payload: {
          selectedPattern: null,
          patternRotation: 0,
          drawMode: "paint"
        }
      });
      setTimeout(function () {
        drawBoard(stateRef, refs);
      }, 0);
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
    onClick: function () {
      LifeBoardUtils.copySelection(stateRef, refs, dispatch);
    },
    disabled: !state.selection,
    title: "Copy selected cells",
    "aria-label": "Copy selected cells"
  }, "Copy"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch);
    },
    disabled: !state.clipboard || state.clipboard.length === 0,
    title: "Paste copied cells",
    "aria-label": "Paste copied cells"
  }, "Paste"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.deleteSelection(stateRef, refs, dispatch);
    },
    disabled: !state.selection,
    title: "Delete selected cells",
    "aria-label": "Delete selected cells"
  }, "Delete"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      dispatch({
        type: "MERGE",
        payload: {
          selection: null
        }
      });
      setTimeout(function () {
        drawBoard(stateRef, refs);
      }, 0);
    },
    title: "Clear selection",
    "aria-label": "Clear selection"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times",
    "aria-hidden": "true"
  }))));
};
"use strict";

/* global React, LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils, LifeViewUtils, LifeInputUtils */
/**
 * TransportControls — Play/pause/step buttons + step count.
 * Props: compact, state, stateRef, refs, dispatch
 */
var TransportControls = function TransportControls(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  var compact = props.compact;
  if (compact) {
    return /*#__PURE__*/React.createElement("div", {
      className: "transport-controls transport-compact"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn btn-toggle" + (state.running ? " active" : ""),
      onClick: function () {
        LifeSimUtils.toggleGame(stateRef, refs, dispatch);
      },
      title: "Play/Pause (Space)"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + (state.running ? "fa-pause" : "fa-play"),
      "aria-hidden": "true"
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn",
      onClick: function () {
        LifeSimUtils.stepGame(stateRef, refs, dispatch);
      },
      title: "Step (.)"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-step-forward",
      "aria-hidden": "true"
    }), " Step"), /*#__PURE__*/React.createElement("span", {
      className: "transport-speed-label"
    }, "Gen " + state.generations.toLocaleString()));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "transport-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.running ? " active" : ""),
    onClick: function () {
      LifeSimUtils.toggleGame(stateRef, refs, dispatch);
    },
    title: "Start or pause the simulation (Space)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.running ? "fa-pause" : "fa-play"),
    "aria-hidden": "true"
  }), " ", state.running ? "Pause" : "Play"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeSimUtils.stepGame(stateRef, refs, dispatch);
    },
    title: "Advance one generation (Enter)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-step-forward",
    "aria-hidden": "true"
  }), " Step"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeSimUtils.stepBack(stateRef, refs, dispatch);
    },
    title: "Step backward (,)",
    disabled: refs.genHistory && refs.genHistory.length === 0
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-step-backward",
    "aria-hidden": "true"
  }), " Back"), /*#__PURE__*/React.createElement("select", {
    className: "toolbar-step-select",
    value: state.stepCount,
    onChange: function (e) {
      LifeBoardUtils.setStepCount(stateRef, refs, dispatch, e);
    },
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
      LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount);
    },
    title: "Advance multiple generations"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-fast-forward",
    "aria-hidden": "true"
  }), " Go"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.resetGame(stateRef, refs, dispatch);
    },
    title: "Randomize the board (R)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-refresh",
    "aria-hidden": "true"
  }), " Reset"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.emptyBoard(stateRef, refs, dispatch);
    },
    title: "Clear all cells (E)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-eraser",
    "aria-hidden": "true"
  }), " Empty"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeSimUtils.undo(stateRef, refs, dispatch);
    },
    title: "Undo last edit (Ctrl+Z)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-undo",
    "aria-hidden": "true"
  }), " Undo"));
};

/**
 * MobileTransportBar — Mobile transport bar.
 * Props: state, stateRef, refs, dispatch
 */
var MobileTransportBar = function MobileTransportBar(props) {
  // eslint-disable-line no-unused-vars
  var state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-transport-bar",
    role: "toolbar",
    "aria-label": "Simulation transport"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.running ? " active" : ""),
    onClick: function () {
      LifeSimUtils.toggleGame(stateRef, refs, dispatch);
    },
    "aria-label": state.running ? "Pause simulation" : "Play simulation"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.running ? "fa-pause" : "fa-play"),
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeSimUtils.stepGame(stateRef, refs, dispatch);
    },
    "aria-label": "Step one generation"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-step-forward",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeBoardUtils.resetGame(stateRef, refs, dispatch);
    },
    "aria-label": "Reset simulation"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-refresh",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.panMode ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.togglePanMode(stateRef, refs, dispatch);
    },
    "aria-label": state.panMode ? "Switch to " + (state.drawMode === 'select' ? "select" : state.drawMode === 'preset' ? "preset" : state.drawMode === 'region' ? "region" : "draw") + " mode" : "Switch to pan mode",
    "aria-pressed": state.panMode
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (state.panMode ? state.drawMode === 'select' ? "fa-crosshairs" : state.drawMode === 'preset' ? "fa-puzzle-piece" : state.drawMode === 'region' ? "fa-th" : "fa-pencil" : "fa-hand-paper-o"),
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mobile-transport-mode",
    "aria-live": "polite"
  }, state.panMode ? 'Pan' : state.drawMode === 'preset' && state.selectedPattern ? state.selectedPattern : state.drawMode === 'select' ? 'Select' : state.drawMode === 'region' ? 'Region' : 'Draw'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
    },
    "aria-label": "Help",
    title: "Keyboard shortcuts (?)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-question-circle",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle btn-sheet-toggle" + (state.bottomSheetOpen ? " active" : ""),
    onClick: function () {
      LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch);
    },
    "aria-expanded": state.bottomSheetOpen,
    "aria-label": "Open controls panel"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-ellipsis-h",
    "aria-hidden": "true"
  })));
};
"use strict";

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
  switch (action.type) {
    case 'MERGE':
      return Object.assign({}, state, action.payload);
    default:
      return Object.assign({}, state, action.payload);
  }
}
function initState() {
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
          var validPanels = ['transport', 'view', 'mode', 'board', 'rules', 'stats', 'importExport'];
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
        open: true,
        x: -1,
        y: -1,
        collapsed: false,
        z: 0,
        compact: false
      }
    },
    panelZCounter: savedLayout.panelZCounter || 1,
    panelGroups: savedLayout.panelGroups || [{
      id: 'g-default',
      panels: ['transport', 'view', 'mode', 'board', 'rules', 'stats', 'importExport'],
      activeTab: 'transport',
      x: 10,
      y: 50,
      z: 1,
      compact: true,
      compactTabMode: 'sidebar'
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
}
document.addEventListener('DOMContentLoaded', function () {
  function LifeBoard() {
    var _r = React.useReducer(lifeReducer, undefined, initState);
    var state = _r[0],
      dispatch = _r[1];
    var stateRef = React.useRef(state);
    stateRef.current = state;
    var refs = React.useRef(null);
    if (!refs.current) {
      refs.current = {
        mounted: false,
        canvas: null,
        minimapCanvas: document.createElement('canvas'),
        previewCanvas: null,
        mobileMinimap: null,
        genHistory: [],
        genHistoryMax: 200,
        genHistoryInterval: 1,
        genHistoryCounter: 0,
        trailMap: new Map(),
        trailEnabled: true,
        loopRunning: false,
        tickId: 0,
        undoStack: [],
        redoStack: [],
        prevBoardHash: null,
        stableCount: 0,
        genTimestamps: [],
        measuredGps: 0,
        gif: null,
        minimapDirty: true,
        minimapCanvas2: document.createElement('canvas'),
        mmElemDragging: false,
        statsChipHidden: false,
        statsChipTimer: null,
        minimapHidden: false,
        minimapTimer: null,
        drawPending: false,
        tabBarObservers: [],
        shortcuts: {},
        rafId: null,
        loopTimeout: null,
        prevFocusEl: null,
        resizeTimer: null,
        lastResizeW: window.innerWidth,
        lastResizeH: window.innerHeight,
        canvasSizeCacheKey: null,
        canvasSizeCache: null,
        sheetTouchY: null,
        sheetEl: null,
        gpsDisplayUntil: 0,
        previewPos: null,
        analysisCancelled: false,
        darkModeQuery: null,
        onDarkModeChange: null,
        mqPhone: null,
        mqPhoneLandscape: null,
        mqTablet: null,
        mqLandscape: null,
        updateDeviceClass: null,
        onResize: null,
        onOrientationChange: null,
        onPopOutDismiss: null,
        onPaste: null,
        onDragOver: null,
        onDragLeave: null,
        onDrop: null,
        forceRender: null,
        drawRotationPreview: null
      };
    }
    refs = refs.current;
    var fr = React.useReducer(function (x) {
      return x + 1;
    }, 0);
    refs.forceRender = fr[1];
    // ── Mount effect (replaces componentDidMount + componentWillUnmount) ──
    React.useEffect(function () {
      refs.mounted = true;
      refs.minimapCanvas2.width = 100;
      refs.minimapCanvas2.height = 75;
      InputHandler.reset();
      SimRunner.invalidate();
      // Attach wheel listener as non-passive so preventDefault works.
      refs.canvas.addEventListener('wheel', function (e) {
        LifeInputUtils.onWheel(stateRef, refs, dispatch, e);
      }, {
        passive: false
      });
      // Prevent browser zoom (Ctrl+scroll) anywhere on the page.
      document.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        }
      }, {
        passive: false
      });
      var handleKey = function (e) {
        LifeInputUtils.handleKeyDown(stateRef, refs, dispatch, e);
      };
      document.addEventListener('keydown', handleKey);
      // System clipboard paste: import RLE/pattern text from clipboard.
      refs.onPaste = function (e) {
        LifeIOUtils._handleClipboardPaste(stateRef, refs, dispatch, e);
      };
      document.addEventListener('paste', refs.onPaste);
      // Close pop-outs on click outside or Escape.
      refs.onPopOutDismiss = function (e) {
        if (!stateRef.current.activePopOut) {
          return;
        }
        if (e.type === 'keydown' && e.key === 'Escape') {
          LifeViewUtils._closePopOut(stateRef, refs, dispatch);
          return;
        }
        if (e.type === 'mousedown') {
          var popOut = e.target.closest && e.target.closest('.pop-out-trigger');
          if (!popOut) {
            LifeViewUtils._closePopOut(stateRef, refs, dispatch);
          }
        }
      };
      document.addEventListener('mousedown', refs.onPopOutDismiss);
      document.addEventListener('keydown', refs.onPopOutDismiss);
      // Drag-and-drop file import (desktop).
      var canvasContainer = refs.canvas.parentNode;
      refs.onDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.add('drop-active');
      };
      refs.onDragLeave = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.remove('drop-active');
      };
      refs.onDrop = function (e) {
        LifeIOUtils._handleFileDrop(stateRef, refs, dispatch, e);
      };
      canvasContainer.addEventListener('dragover', refs.onDragOver);
      canvasContainer.addEventListener('dragleave', refs.onDragLeave);
      canvasContainer.addEventListener('drop', refs.onDrop);
      // Dark mode: respect system preference.
      refs.darkModeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      if (refs.darkModeQuery) {
        refs.onDarkModeChange = function (e) {
          if (stateRef.current.darkModePref === 'system') {
            LifeBoardUtils._applyDarkMode(e.matches);
          }
        };
        try {
          refs.darkModeQuery.addEventListener('change', refs.onDarkModeChange);
        } catch (ex) {
          try {
            refs.darkModeQuery.addListener(refs.onDarkModeChange);
          } catch (ex2) {}
        }
        // Apply initial dark mode state.
        if (stateRef.current.darkModePref === 'system') {
          LifeBoardUtils._applyDarkMode(refs.darkModeQuery.matches);
        }
      }
      // Respond to viewport resize (throttled) to update canvas dimensions.
      refs.onResize = function () {
        var newW = window.innerWidth;
        var newH = window.innerHeight;
        var widthChanged = Math.abs(newW - refs.lastResizeW) > 10;
        var heightBigChange = Math.abs(newH - refs.lastResizeH) > 100;
        if (!widthChanged && !heightBigChange) {
          return;
        }
        refs.lastResizeW = newW;
        refs.lastResizeH = newH;
        clearTimeout(refs.resizeTimer);
        refs.resizeTimer = setTimeout(function () {
          refs.forceRender();
          drawBoard(stateRef, refs);
        }, 120);
      };
      window.addEventListener('resize', refs.onResize);
      refs.onOrientationChange = function () {
        clearTimeout(refs.resizeTimer);
        refs.resizeTimer = setTimeout(function () {
          refs.forceRender();
          drawBoard(stateRef, refs);
        }, 300);
      };
      window.addEventListener('orientationchange', refs.onOrientationChange);
      // ── Device class detection via matchMedia ──────────────────
      refs.mqPhone = window.matchMedia('(max-width: 900px)');
      refs.mqPhoneLandscape = window.matchMedia('(orientation: landscape) and (max-height: 550px)');
      refs.mqTablet = window.matchMedia('(min-width: 901px) and (max-width: 1200px)');
      refs.mqLandscape = window.matchMedia('(orientation: landscape)');
      refs.updateDeviceClass = function () {
        var dc;
        if (refs.mqPhone.matches) {
          dc = refs.mqLandscape.matches ? 'phone-landscape' : 'phone-portrait';
        } else if (refs.mqPhoneLandscape.matches) {
          dc = 'phone-landscape';
        } else if (refs.mqTablet.matches) {
          dc = 'tablet';
        } else {
          dc = 'desktop';
        }
        if (dc !== stateRef.current.deviceClass) {
          dispatch({
            type: 'MERGE',
            payload: {
              deviceClass: dc
            }
          });
          setTimeout(function () {
            drawBoard(stateRef, refs);
          }, 0);
        }
      };
      refs.updateDeviceClass();
      try {
        refs.mqPhone.addEventListener('change', refs.updateDeviceClass);
        refs.mqPhoneLandscape.addEventListener('change', refs.updateDeviceClass);
        refs.mqTablet.addEventListener('change', refs.updateDeviceClass);
        refs.mqLandscape.addEventListener('change', refs.updateDeviceClass);
      } catch (ex) {
        try {
          refs.mqPhone.addListener(refs.updateDeviceClass);
          refs.mqPhoneLandscape.addListener(refs.updateDeviceClass);
          refs.mqTablet.addListener(refs.updateDeviceClass);
          refs.mqLandscape.addListener(refs.updateDeviceClass);
        } catch (ex2) {}
      }

      // ── Keyboard shortcut registry ──────────────────────────────
      LifeInputUtils._registerCoreShortcuts(stateRef, refs, dispatch);

      // Initialize HashLife engine with current rules.
      HashLife.init(stateRef.current.birthRule, stateRef.current.surviveRule);
      SimRunner._hlRuleKey = stateRef.current.birthRule.join(',') + '/' + stateRef.current.surviveRule.join(',');
      drawBoard(stateRef, refs);
      // Render loop: consume drawPending flag each frame.
      (function renderLoop() {
        refs.rafId = requestAnimationFrame(function () {
          try {
            if (refs.drawPending) {
              refs.drawPending = false;
              drawBoard(stateRef, refs);
              var s = stateRef.current;
              if (refs.mobileMinimap) {
                drawMinimapMobile(stateRef, refs, s.liveCells, s.cols, s.rows, s.viewX, s.viewY, s.cellSize, THEMES[s.theme] || THEMES['Teal']);
              }
            }
          } catch (e) {/* prevent loop death */}
          if (refs.mounted) {
            renderLoop();
          }
        });
      })();
      LifeIOUtils._loadFromURLHash(stateRef, refs, dispatch);
      LifeSimUtils._startLoop(stateRef, refs, dispatch);
      ObservatoryPanelUtils._observeTabBars(stateRef, refs, dispatch);

      // ── Cleanup (replaces componentWillUnmount) ──
      return function () {
        if (refs.tabBarObservers) {
          refs.tabBarObservers.forEach(function (obs) {
            obs.disconnect();
          });
        }
        if (!refs.canvas) {
          return;
        }
        document.removeEventListener('keydown', handleKey);
        document.removeEventListener('paste', refs.onPaste);
        document.removeEventListener('mousedown', refs.onPopOutDismiss);
        document.removeEventListener('keydown', refs.onPopOutDismiss);
        window.removeEventListener('resize', refs.onResize);
        window.removeEventListener('orientationchange', refs.onOrientationChange);
        var container = refs.canvas.parentNode;
        if (container) {
          container.removeEventListener('dragover', refs.onDragOver);
          container.removeEventListener('dragleave', refs.onDragLeave);
          container.removeEventListener('drop', refs.onDrop);
        }
        if (refs.gif) {
          refs.gif.abort();
          refs.gif = null;
        }
        if (refs.darkModeQuery && refs.onDarkModeChange) {
          try {
            refs.darkModeQuery.removeEventListener('change', refs.onDarkModeChange);
          } catch (ex) {
            try {
              refs.darkModeQuery.removeListener(refs.onDarkModeChange);
            } catch (ex2) {}
          }
        }
        if (refs.updateDeviceClass) {
          var mqList = [refs.mqPhone, refs.mqPhoneLandscape, refs.mqTablet, refs.mqLandscape];
          for (var mi = 0; mi < mqList.length; mi++) {
            if (mqList[mi]) {
              try {
                mqList[mi].removeEventListener('change', refs.updateDeviceClass);
              } catch (ex) {
                try {
                  mqList[mi].removeListener(refs.updateDeviceClass);
                } catch (ex2) {}
              }
            }
          }
        }
        refs.mounted = false;
        if (refs.rafId) {
          cancelAnimationFrame(refs.rafId);
          refs.rafId = null;
        }
        if (refs.loopTimeout) {
          clearTimeout(refs.loopTimeout);
          refs.loopTimeout = null;
        }
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
    React.useEffect(function () {
      if (prevSelectedPattern.current !== state.selectedPattern || prevPatternRotation.current !== state.patternRotation || prevBottomSheetOpen.current !== state.bottomSheetOpen || prevBottomSheetTab.current !== state.bottomSheetTab || prevLayoutMode.current !== state.layoutMode) {
        drawRotationPreview(stateRef, refs);
      }
      if (prevPanelGroups.current !== state.panelGroups) {
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
    if (isMobile) {
      layout = 'observatory';
    }
    var layoutContent;
    switch (layout) {
      case 'observatory':
        layoutContent = /*#__PURE__*/React.createElement(ObservatoryLayout, {
          cs: cs,
          state: state,
          stateRef: stateRef,
          refs: refs,
          dispatch: dispatch
        });
        break;
      default:
        layoutContent = /*#__PURE__*/React.createElement(CartographerLayout, {
          cs: cs,
          state: state,
          stateRef: stateRef,
          refs: refs,
          dispatch: dispatch
        });
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
    }, state.srAnnouncement), /*#__PURE__*/React.createElement(HelpModal, {
      showHelp: state.showHelp,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    }), /*#__PURE__*/React.createElement(PopGraphModal, {
      showPopGraph: state.showPopGraph,
      popHistory: state.popHistory,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    }), layoutContent);
  } // end LifeBoard

  var root = ReactDOM.createRoot(document.getElementById("content"));
  root.render(/*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LifeBoard, null)));
});

//# sourceMappingURL=script.compiled.js.map