"use strict";

/* global CanvasRenderer, SimEngine, THEMES, SPEED_DELAYS,
          InputHandler, LifeInputUtils, LifeViewUtils,
          LifeAnalysisUtils, parseKey */
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

const drawBoard = function drawBoard(stateRef, refs) {
  // eslint-disable-line no-unused-vars
  const state = stateRef.current;
  const canvas = refs.canvas;
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const cellSize = state.cellSize;
  const cols = state.cols;
  const rows = state.rows;
  const viewX = state.viewX;
  const viewY = state.viewY;
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const theme = THEMES[state.theme] || THEMES['Teal'];
  const liveCells = state.liveCells;
  const isUnbounded = state.boundary === 'unbounded';

  // Visible cell range.
  const startC = viewX,
    startR = viewY;
  const endC = viewX + Math.ceil(canvasW / cellSize) + 1;
  const endR = viewY + Math.ceil(canvasH / cellSize) + 1;

  // Clear canvas.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  if (!isUnbounded && state.regionMask && state.regionMask.size > 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--overlay-light').trim() || 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    CanvasRenderer.clearRegionCells(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
  }

  // Palette.
  const palettes = CanvasRenderer._ensurePalette(theme, state.theme);

  // Cells.
  CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

  // In-progress painted cells (drag-and-draw before mouseup commit).
  if (InputHandler._dragging && InputHandler._paintedCells) {
    const painted = InputHandler._paintedCells;
    const paintKeys = Object.keys(painted);
    if (paintKeys.length > 0) {
      const aliveColor = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
      for (let pi = 0; pi < paintKeys.length; pi++) {
        const k = paintKeys[pi];
        const rc = parseKey(k);
        const pr = rc[0],
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
      const rgPainted = InputHandler._regionPaintedKeys;
      const rgKeys = Object.keys(rgPainted);
      if (rgKeys.length > 0) {
        CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
      }
    }
  }

  // Pattern preview.
  if (state.drawMode === 'preset') {
    const previewMask = !isUnbounded && state.regionMask && state.regionMask.size > 0 ? state.regionMask : null;
    CanvasRenderer.drawPatternPreview(ctx, state.selectedPattern, state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme, previewMask);
  }

  // Minimap overlay.
  const useMobileMinimap = state.deviceClass === 'phone-portrait' || state.deviceClass === 'phone-landscape' || state.deviceClass === 'tablet' || typeof window !== 'undefined' && window.innerWidth <= 1200;
  if (state.showMinimap && (isUnbounded || cols > 0 && rows > 0)) {
    if (useMobileMinimap) {
      drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme);
      refs.minimapRect = null;
    } else {
      const mmDisplayScale = 1;
      if (canvas.style.width) {
        const cssW = parseFloat(canvas.style.width);
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
const drawMinimap = function drawMinimap(stateRef, refs, ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale) {
  // eslint-disable-line no-unused-vars
  const state = stateRef.current;
  const isUnbounded = state.boundary === 'unbounded';
  let mmOriginR = 0,
    mmOriginC = 0;
  if (isUnbounded) {
    const bb = SimEngine.getBoundingBox(liveCells);
    if (bb) {
      const pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
      let newMinR = bb.minR - pad,
        newMinC = bb.minC - pad;
      let newMaxR = bb.maxR + pad,
        newMaxC = bb.maxC + pad;
      const prev = refs.mmUnboundedRegion;
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
    const rb = state.regionBounds;
    let mmMinR = rb ? rb.minR : 0;
    let mmMinC = rb ? rb.minC : 0;
    let mmMaxR = rb ? rb.maxR + 1 : rows;
    let mmMaxC = rb ? rb.maxC + 1 : cols;
    const bbLive = SimEngine.getBoundingBox(liveCells);
    if (bbLive) {
      mmMinR = Math.min(mmMinR, bbLive.minR);
      mmMinC = Math.min(mmMinC, bbLive.minC);
      mmMaxR = Math.max(mmMaxR, bbLive.maxR + 1);
      mmMaxC = Math.max(mmMaxC, bbLive.maxC + 1);
    }
    const pad2 = Math.max(5, Math.round(Math.max(mmMaxR - mmMinR, mmMaxC - mmMinC) * 0.1));
    mmOriginR = mmMinR - pad2;
    mmOriginC = mmMinC - pad2;
    rows = mmMaxR - mmMinR + pad2 * 2;
    cols = mmMaxC - mmMinC + pad2 * 2;
  }
  const TARGET_CSS_SIZE = 160;
  const ds = displayScale && displayScale > 0 ? displayScale : 1;
  const aspect = cols / rows;
  const maxMmW = Math.floor(canvasW / 3);
  const maxMmH = Math.floor(canvasH / 3);
  let mmW, mmH;
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
  const marginBuf = Math.max(1, Math.round(6 / ds));
  const isMobileView2 = state.deviceClass === 'phone-portrait' || state.deviceClass === 'phone-landscape';
  const transportPad = state.layoutMode === 'cartographer' && !isMobileView2 ? Math.round(60 / ds) : 0;
  const mmOnLeft = state.layoutMode === 'cartographer' && state.railSide === 'right';
  const mmX = mmOnLeft ? marginBuf : canvasW - mmW - marginBuf;
  const mmY = canvasH - mmH - marginBuf - transportPad;
  if (refs.minimapDirty) {
    const mc = refs.minimapCanvas;
    const mctx = mc.getContext('2d');
    mctx.clearRect(0, 0, mmW, mmH);
    const _bgHex = theme.bg || '#0A0E1A';
    const _bgR = parseInt(_bgHex.slice(1, 3), 16),
      _bgG = parseInt(_bgHex.slice(3, 5), 16),
      _bgB = parseInt(_bgHex.slice(5, 7), 16);
    mctx.fillStyle = 'rgba(' + _bgR + ',' + _bgG + ',' + _bgB + ',0.85)';
    mctx.fillRect(0, 0, mmW, mmH);
    mctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
    const _mmOC = mmOriginC,
      _mmOR = mmOriginR,
      _mmCols = cols,
      _mmRows = rows;
    liveCells.forEach(function (age, key) {
      const _rc = parseKey(key),
        kr = _rc[0] - _mmOR,
        kc = _rc[1] - _mmOC;
      if (kr >= 0 && kr < _mmRows && kc >= 0 && kc < _mmCols) {
        mctx.fillRect(Math.floor(kc / _mmCols * mmW), Math.floor(kr / _mmRows * mmH), 1, 1);
      }
    });
    if (!isUnbounded && state.regionMask) {
      const _regionMask = state.regionMask;
      mctx.fillStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.12)';
      _regionMask.forEach(function (key) {
        const _i = key.indexOf(',');
        const _rr = parseInt(key.substring(0, _i), 10) - _mmOR;
        const _cc = parseInt(key.substring(_i + 1), 10) - _mmOC;
        if (_rr >= 0 && _rr < _mmRows && _cc >= 0 && _cc < _mmCols) {
          mctx.fillRect(Math.floor(_cc / _mmCols * mmW), Math.floor(_rr / _mmRows * mmH), 1, 1);
        }
      });
      const _comps = state.regionComponents;
      if (_comps && _comps.length > 0) {
        mctx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
        mctx.lineWidth = 1;
        mctx.setLineDash([3, 2]);
        for (let _ci = 0; _ci < _comps.length; _ci++) {
          const _comp = _comps[_ci];
          const _cx = Math.round((_comp.minC - _mmOC) / _mmCols * mmW);
          const _cy = Math.round((_comp.minR - _mmOR) / _mmRows * mmH);
          const _cw = Math.round((_comp.maxC - _comp.minC + 1) / _mmCols * mmW);
          const _ch = Math.round((_comp.maxR - _comp.minR + 1) / _mmRows * mmH);
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
  const visCols = Math.ceil(canvasW / cellSize);
  const visRows = Math.ceil(canvasH / cellSize);
  const vx1 = mmX + Math.round((viewX - mmOriginC) / cols * mmW);
  const vy1 = mmY + Math.round((viewY - mmOriginR) / rows * mmH);
  const vw = Math.max(2, Math.round(visCols / cols * mmW));
  const vh = Math.max(2, Math.round(visRows / rows * mmH));
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  const clampX = Math.max(vx1, mmX);
  const clampY = Math.max(vy1, mmY);
  const clampR = Math.min(vx1 + vw, mmX + mmW);
  const clampB = Math.min(vy1 + vh, mmY + mmH);
  if (clampR > clampX && clampB > clampY) {
    ctx.strokeRect(clampX + 0.5, clampY + 0.5, clampR - clampX, clampB - clampY);
  }
  const vpCenterC = viewX + visCols / 2;
  const vpCenterR = viewY + visRows / 2;
  const vpOutside = vpCenterC < mmOriginC || vpCenterC > mmOriginC + cols || vpCenterR < mmOriginR || vpCenterR > mmOriginR + rows;
  if (vpOutside) {
    const mmCenterC = mmOriginC + cols / 2;
    const mmCenterR = mmOriginR + rows / 2;
    const arrowAngle = Math.atan2(vpCenterR - mmCenterR, vpCenterC - mmCenterC);
    const arrowPx = mmX + mmW / 2 + Math.cos(arrowAngle) * (mmW / 2 - 8);
    const arrowPy = mmY + mmH / 2 + Math.sin(arrowAngle) * (mmH / 2 - 8);
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
const drawMinimapMobile = function drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme) {
  // eslint-disable-line no-unused-vars
  const state = stateRef.current;
  if (!refs.mobileMinimap || !refs.minimapCanvas) {
    return;
  }
  const isUnbounded = state.boundary === 'unbounded';
  let mmMobOriginR = 0,
    mmMobOriginC = 0;
  let mmRegionRows, mmRegionCols;
  if (isUnbounded) {
    const bb = SimEngine.getBoundingBox(liveCells);
    if (bb) {
      const pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
      let newMinR = bb.minR - pad,
        newMinC = bb.minC - pad;
      let newMaxR = bb.maxR + pad,
        newMaxC = bb.maxC + pad;
      const prev = refs.mmUnboundedRegion;
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
    const rbm = state.regionBounds;
    let mmMR = rbm ? rbm.minR : 0;
    let mmMC = rbm ? rbm.minC : 0;
    let mmMXR = rbm ? rbm.maxR + 1 : rows;
    let mmMXC = rbm ? rbm.maxC + 1 : cols;
    const bbMob = SimEngine.getBoundingBox(liveCells);
    if (bbMob) {
      mmMR = Math.min(mmMR, bbMob.minR);
      mmMC = Math.min(mmMC, bbMob.minC);
      mmMXR = Math.max(mmMXR, bbMob.maxR + 1);
      mmMXC = Math.max(mmMXC, bbMob.maxC + 1);
    }
    const pad2m = Math.max(5, Math.round(Math.max(mmMXR - mmMR, mmMXC - mmMC) * 0.1));
    mmMobOriginR = mmMR - pad2m;
    mmMobOriginC = mmMC - pad2m;
    mmRegionRows = mmMXR - mmMR + pad2m * 2;
    mmRegionCols = mmMXC - mmMC + pad2m * 2;
  }
  const MOBILE_MM_CSS_W = Math.min(120, Math.round(window.innerWidth * 0.3));
  const MOBILE_MM_CSS_H = Math.min(160, Math.round(window.innerHeight * 0.2));
  const mmAspect = mmRegionCols / Math.max(1, mmRegionRows);
  let mmW_css, mmH_css;
  if (mmAspect >= 1) {
    mmW_css = MOBILE_MM_CSS_W;
    mmH_css = Math.min(Math.round(mmW_css / mmAspect), MOBILE_MM_CSS_H);
  } else {
    mmH_css = MOBILE_MM_CSS_H;
    mmW_css = Math.min(Math.round(mmH_css * mmAspect), MOBILE_MM_CSS_W);
  }
  if (refs.minimapCanvas.width !== mmW_css || refs.minimapCanvas.height !== mmH_css) {
    refs.minimapCanvas.width = mmW_css;
    refs.minimapCanvas.height = mmH_css;
  }
  const mmCtx = refs.minimapCanvas.getContext('2d');
  const _mbHex = theme.bg || '#0A0E1A';
  const _mbR = parseInt(_mbHex.slice(1, 3), 16),
    _mbG = parseInt(_mbHex.slice(3, 5), 16),
    _mbB = parseInt(_mbHex.slice(5, 7), 16);
  mmCtx.fillStyle = 'rgba(' + _mbR + ',' + _mbG + ',' + _mbB + ',0.85)';
  mmCtx.fillRect(0, 0, mmW_css, mmH_css);
  const cellW = mmW_css / mmRegionCols;
  const cellH = mmH_css / mmRegionRows;
  mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
  const _mmMOR = mmMobOriginR,
    _mmMOC = mmMobOriginC,
    _mmMCols = mmRegionCols,
    _mmMRows = mmRegionRows;
  liveCells.forEach(function (_, key) {
    const rc = parseKey(key);
    const kr = rc[0] - _mmMOR;
    const kc = rc[1] - _mmMOC;
    if (kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
    const px = Math.floor(kc * cellW);
    const py = Math.floor(kr * cellH);
    const pw = Math.max(1, Math.ceil(cellW));
    const ph = Math.max(1, Math.ceil(cellH));
    mmCtx.fillRect(px, py, pw, ph);
  });
  if (!isUnbounded && state.regionComponents) {
    const _compsM = state.regionComponents;
    if (_compsM.length > 0) {
      mmCtx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
      mmCtx.lineWidth = 1;
      mmCtx.setLineDash([3, 2]);
      for (let _ciM = 0; _ciM < _compsM.length; _ciM++) {
        const _compM = _compsM[_ciM];
        const _cxM = Math.round((_compM.minC - mmMobOriginC) * cellW);
        const _cyM = Math.round((_compM.minR - mmMobOriginR) * cellH);
        const _cwM = Math.round((_compM.maxC - _compM.minC + 1) * cellW);
        const _chM = Math.round((_compM.maxR - _compM.minR + 1) * cellH);
        mmCtx.strokeRect(_cxM + 0.5, _cyM + 0.5, _cwM, _chM);
      }
      mmCtx.setLineDash([]);
    }
  }
  mmCtx.strokeStyle = 'rgba(255,255,255,0.2)';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(0.5, 0.5, mmW_css - 1, mmH_css - 1);
  const vpVisColsM = refs.canvas ? refs.canvas.width / cellSize : 100;
  const vpVisRowsM = refs.canvas ? refs.canvas.height / cellSize : 100;
  const vpW = vpVisColsM * cellW;
  const vpH = vpVisRowsM * cellH;
  const vpX = (viewX - mmMobOriginC) * cellW;
  const vpY = (viewY - mmMobOriginR) * cellH;
  const vpClampX = Math.max(0, vpX),
    vpClampY = Math.max(0, vpY);
  const vpClampR = Math.min(mmW_css, vpX + vpW),
    vpClampB = Math.min(mmH_css, vpY + vpH);
  if (vpClampR > vpClampX && vpClampB > vpClampY) {
    mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
  }
  const vpCenterCm = viewX + vpVisColsM / 2;
  const vpCenterRm = viewY + vpVisRowsM / 2;
  const vpOutsideM = vpCenterCm < mmMobOriginC || vpCenterCm > mmMobOriginC + mmRegionCols || vpCenterRm < mmMobOriginR || vpCenterRm > mmMobOriginR + mmRegionRows;
  if (vpOutsideM) {
    const mmCCm = mmMobOriginC + mmRegionCols / 2,
      mmCRm = mmMobOriginR + mmRegionRows / 2;
    const aaM = Math.atan2(vpCenterRm - mmCRm, vpCenterCm - mmCCm);
    const apxM = mmW_css / 2 + Math.cos(aaM) * (mmW_css / 2 - 8);
    const apyM = mmH_css / 2 + Math.sin(aaM) * (mmH_css / 2 - 8);
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
  const mobileCtx = refs.mobileMinimap.getContext('2d');
  mobileCtx.drawImage(refs.minimapCanvas, 0, 0);
  refs.mmMobileWorld = {
    originC: mmMobOriginC,
    originR: mmMobOriginR,
    cols: mmRegionCols,
    rows: mmRegionRows
  };
};
const drawRotationPreview = function drawRotationPreview(stateRef, refs) {
  // eslint-disable-line no-unused-vars
  const state = stateRef.current;
  const theme = THEMES[state.theme] || THEMES['Teal'];
  CanvasRenderer.drawRotationPreview(refs.previewCanvas, state.selectedPattern, state.patternRotation, theme);
};
const toggleTrails = function toggleTrails(stateRef, refs, dispatch) {
  // eslint-disable-line no-unused-vars
  const state = stateRef.current;
  const newVal = !state.showTrails;
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
  const state = stateRef.current;
  if (!refs.mobileMinimap) {
    return;
  }
  const rect = refs.mobileMinimap.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const frac_r = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  const mmWorld = refs.mmMobileWorld;
  const mmCols = mmWorld ? mmWorld.cols : state.cols;
  const mmRows = mmWorld ? mmWorld.rows : state.rows;
  const mmOC = mmWorld ? mmWorld.originC : 0;
  const mmOR = mmWorld ? mmWorld.originR : 0;
  const newVX = Math.round(frac_c * mmCols + mmOC - refs.canvas.width / state.cellSize / 2);
  const newVY = Math.round(frac_r * mmRows + mmOR - refs.canvas.height / state.cellSize / 2);
  const clamped = LifeViewUtils.clampView(stateRef, refs, dispatch, newVX, newVY);
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

const CanvasArea = function CanvasArea(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const cs = props.cs;
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
    "aria-description": "Click to toggle cells. Arrow keys to pan. Ctrl+scroll to zoom. Press ? for help.",
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
const _startMinimapDrag = function (e, refs) {
  e.preventDefault();
  const el = e.currentTarget.parentElement;
  const rect = el.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const offX = cx - rect.left;
  const offY = cy - rect.top;
  el.classList.add('dragging');
  const move = function (ev) {
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
  const end = function () {
    el.classList.remove('dragging');
    if (!refs.fixedPositions) refs.fixedPositions = {};
    const finalRect = el.getBoundingClientRect();
    refs.fixedPositions.minimap = {
      x: finalRect.left,
      y: finalRect.top
    };
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
const MobileMinimapArea = function MobileMinimapArea(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  if (!state.showMinimap || refs.minimapHidden) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-minimap-area draggable-fixed",
    ref: function (el) {
      if (el && refs.fixedPositions && refs.fixedPositions.minimap) {
        const pos = refs.fixedPositions.minimap;
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
      }
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "minimap-drag-handle",
    onMouseDown: function (e) {
      _startMinimapDrag(e, refs);
    },
    onTouchStart: function (e) {
      _startMinimapDrag(e, refs);
    },
    title: "Drag to reposition minimap"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-ellipsis-h",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("canvas", {
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

/* global LifeAnalysisUtils */
/**
 * HelpModal — keyboard shortcuts overlay dialog.
 * Props: showHelp, stateRef, refs, dispatch
 */
const HelpModal = function HelpModal(props) {
  // eslint-disable-line no-unused-vars
  if (!props.showHelp) {
    return null;
  }
  const stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const onClose = function () {
    LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
  };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const mod = isMac ? '\u2318' : 'Ctrl+';
  return /*#__PURE__*/React.createElement("div", {
    className: "help-overlay",
    onClick: onClose,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "help-dialog-title",
    onKeyDown: function (e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const modal = e.currentTarget.querySelector('.help-modal');
        if (!modal) return;
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0],
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
  }, "Quick Reference"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn help-close-x",
    onClick: onClose,
    "aria-label": "Close",
    title: "Close"
  }, "\xD7"), /*#__PURE__*/React.createElement("table", {
    className: "help-table"
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    colSpan: "2",
    scope: "colgroup",
    className: "help-section-heading"
  }, "Keyboard shortcuts")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Space"), /*#__PURE__*/React.createElement("td", null, "Play / Pause")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "key-label"
  }, "."), " ", /*#__PURE__*/React.createElement("span", {
    className: "key-hint"
  }, "(Period)")), /*#__PURE__*/React.createElement("td", null, "Step one generation")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Shift+."), /*#__PURE__*/React.createElement("td", null, "Step N generations")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "key-label"
  }, ","), " ", /*#__PURE__*/React.createElement("span", {
    className: "key-hint"
  }, "(Comma)")), /*#__PURE__*/React.createElement("td", null, "Step backward")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "R"), /*#__PURE__*/React.createElement("td", null, "Reset (random fill)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "E"), /*#__PURE__*/React.createElement("td", null, "Empty board")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, mod + "Z"), /*#__PURE__*/React.createElement("td", null, "Undo")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "S"), /*#__PURE__*/React.createElement("td", null, "Export PNG")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "X"), /*#__PURE__*/React.createElement("td", null, "Copy board as RLE")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "F"), /*#__PURE__*/React.createElement("td", null, "Fit live cells in view")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, mod + "Wheel"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Scroll / Trackpad"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Arrows"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Right-drag"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "["), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CCW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "]"), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, mod + "C"), /*#__PURE__*/React.createElement("td", null, "Copy selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, mod + "V"), /*#__PURE__*/React.createElement("td", null, "Paste selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Del"), /*#__PURE__*/React.createElement("td", null, "Delete selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Esc"), /*#__PURE__*/React.createElement("td", null, "Cancel / close")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "D"), /*#__PURE__*/React.createElement("td", null, "Switch to Draw mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "P"), /*#__PURE__*/React.createElement("td", null, "Switch to Preset mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "B"), /*#__PURE__*/React.createElement("td", null, "Switch to Region mode")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "G"), /*#__PURE__*/React.createElement("td", null, "Toggle grid lines")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "T"), /*#__PURE__*/React.createElement("td", null, "Toggle trails")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "M"), /*#__PURE__*/React.createElement("td", null, "Toggle minimap")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "?"), /*#__PURE__*/React.createElement("td", null, "Show / hide this help")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    colSpan: "2",
    scope: "colgroup",
    className: "help-section-heading"
  }, "Touch gestures")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tap"), /*#__PURE__*/React.createElement("td", null, "Paint / place cell")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Pinch"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "2-finger drag"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Long press"), /*#__PURE__*/React.createElement("td", null, "Show cell coordinates")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    colSpan: "2",
    scope: "colgroup",
    className: "help-section-heading"
  }, "File import")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Drag & drop"), /*#__PURE__*/React.createElement("td", null, "Drop .rle/.cells file on canvas")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, mod + "V"), /*#__PURE__*/React.createElement("td", null, "Paste RLE text from clipboard")))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn help-close",
    onClick: onClose,
    title: "Close",
    "aria-label": "Close help dialog"
  }, "Close")));
};
"use strict";

/* global LifeViewUtils, LifeAnalysisUtils,
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

const _MOBILE_TABS = [{
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

/**
 * Generic drag handler for fixed-position elements (stats, minimap, panel menu).
 * Attaches mousedown/touchstart to make the element freely draggable.
 */
const _startFixedDrag = function (e, refs, key) {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest && (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('label'))) {
    return;
  }
  e.preventDefault();
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const offX = cx - rect.left;
  const offY = cy - rect.top;
  el.classList.add('dragging');
  const move = function (ev) {
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
  const end = function () {
    el.classList.remove('dragging');
    // Persist position
    if (refs && key) {
      const finalRect = el.getBoundingClientRect();
      if (!refs.fixedPositions) refs.fixedPositions = {};
      refs.fixedPositions[key] = {
        x: finalRect.left,
        y: finalRect.top
      };
    }
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
const _applyFixedPos = function (el, refs, key) {
  if (el && refs && refs.fixedPositions && refs.fixedPositions[key]) {
    const pos = refs.fixedPositions[key];
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
  }
};
const TabContentBuilder = function TabContentBuilder(props) {
  // eslint-disable-line no-unused-vars
  const tabId = props.tabId,
    options = props.options || {};
  const state = props.state,
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
const BottomSheet = function BottomSheet(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const sheetContent = props.sheetContent;
  const tabs = _MOBILE_TABS;
  const layoutSwitcher = /*#__PURE__*/React.createElement(LayoutSwitcher, {
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
    const isActive = state.bottomSheetTab === tab.id;
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
    className: "sheet-footer"
  }, layoutSwitcher))));
};
const LayoutSwitcher = function LayoutSwitcher(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const dc = state.deviceClass;
  const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return null;
  }
  const mode = state.layoutMode;
  return /*#__PURE__*/React.createElement("div", {
    className: "layout-switcher"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (mode === 'cartographer' ? " active" : ""),
    onClick: function () {
      LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'cartographer');
    },
    title: "Cartographer: Edge rail with tabs",
    "aria-label": "Cartographer layout: edge rail with tabs",
    "aria-pressed": mode === 'cartographer',
    "data-tooltip": "Cartographer"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-columns"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (mode === 'observatory' ? " active" : ""),
    onClick: function () {
      LifeViewUtils.setLayoutMode(stateRef, refs, dispatch, 'observatory');
    },
    title: "Observatory: Floating panels",
    "aria-label": "Observatory layout: floating panels",
    "aria-pressed": mode === 'observatory',
    "data-tooltip": "Observatory"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-object-ungroup"
  })));
};
const CartographerLayout = function CartographerLayout(props) {
  // eslint-disable-line no-unused-vars
  const cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const dc = state.deviceClass;
  const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return /*#__PURE__*/React.createElement(CartographerMobile, {
      cs: cs,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }
  const railW = state.railHidden ? 0 : state.railCollapsed ? 40 : dc === 'tablet' ? 200 : 240;
  const railSide = state.railSide;
  const railClass = 'rail' + (state.railCollapsed ? ' rail-collapsed' : '') + (state.railHidden ? ' rail-hidden' : '') + (' rail-' + railSide);
  const tabContent = /*#__PURE__*/React.createElement("div", {
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
  const tabs = _MOBILE_TABS;
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
  })))), !state.railCollapsed && state.showStats !== false && /*#__PURE__*/React.createElement("div", {
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
    const isActive = state.railTab === tab.id;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.id,
      className: "rail-tab" + (isActive ? " active" : ""),
      onClick: function () {
        LifeViewUtils.setRailTab(stateRef, refs, dispatch, tab.id);
      },
      role: "tab",
      "aria-selected": isActive,
      "aria-controls": "rail-panel-" + tab.id,
      "aria-label": tab.label,
      title: tab.label
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
    className: "rail-footer"
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
const CartographerMobile = function CartographerMobile(props) {
  // eslint-disable-line no-unused-vars
  const cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const sheetContent = state.bottomSheetOpen ? /*#__PURE__*/React.createElement(TabContentBuilder, {
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
  }), !state.bottomSheetOpen && !refs.statsChipHidden && state.showStats !== false && /*#__PURE__*/React.createElement(StatsChip, {
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
const _ObservatoryHints = function _ObservatoryHints(props) {
  // eslint-disable-line no-unused-vars
  const dismissed = React.useState(function () {
    try {
      return localStorage.getItem('life-obs-hints-seen') === '1';
    } catch (e) {
      return false;
    }
  });
  const seen = dismissed[0],
    setSeen = dismissed[1];
  if (seen) {
    return null;
  }
  const dismiss = function () {
    setSeen(true);
    try {
      localStorage.setItem('life-obs-hints-seen', '1');
    } catch (e) {/* */}
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "obs-hints-overlay",
    role: "dialog",
    "aria-label": "Quick tips"
  }, /*#__PURE__*/React.createElement("div", {
    className: "obs-hints-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "obs-hints-title"
  }, "Observatory Tips"), /*#__PURE__*/React.createElement("ul", {
    className: "obs-hints-list"
  }, /*#__PURE__*/React.createElement("li", null, "Drag panel headers to reposition. Drop panels on each other to dock."), /*#__PURE__*/React.createElement("li", null, "Click ", /*#__PURE__*/React.createElement("b", null, "\u00ab"), " to compact a panel into icon buttons."), /*#__PURE__*/React.createElement("li", null, "In compact mode, the right column shows context-sensitive actions."), /*#__PURE__*/React.createElement("li", null, "Hover any icon to see what it does.")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn obs-hints-dismiss",
    onClick: dismiss
  }, "Got it")));
};
const ObservatoryLayout = function ObservatoryLayout(props) {
  // eslint-disable-line no-unused-vars
  const cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const dc = state.deviceClass;
  const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
  if (isMobile) {
    return /*#__PURE__*/React.createElement(ObservatoryMobile, {
      cs: cs,
      state: state,
      stateRef: stateRef,
      refs: refs,
      dispatch: dispatch
    });
  }
  const panels = state.panelStates;
  const zenMode = state.zenMode;
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
  })), state.showStats && /*#__PURE__*/React.createElement("div", {
    className: "stats-window draggable-fixed",
    role: "region",
    "aria-label": "Statistics",
    ref: function (el) {
      _applyFixedPos(el, refs, 'stats');
    },
    onMouseDown: function (e) {
      _startFixedDrag(e, refs, 'stats');
    },
    onTouchStart: function (e) {
      _startFixedDrag(e, refs, 'stats');
    }
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
    className: "panel-menu draggable-fixed",
    role: "group",
    "aria-label": "Panel visibility",
    ref: function (el) {
      _applyFixedPos(el, refs, 'panelMenu');
    },
    onMouseDown: function (e) {
      _startFixedDrag(e, refs, 'panelMenu');
    },
    onTouchStart: function (e) {
      _startFixedDrag(e, refs, 'panelMenu');
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
    },
    "aria-label": "Help",
    title: "Keyboard shortcuts (?)",
    "data-tooltip": "Help (?)"
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
    "aria-label": "Toggle panel visibility menu",
    "data-tooltip": "Panel visibility"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  })), state.panelMenuOpen && /*#__PURE__*/React.createElement("div", {
    className: "panel-menu-backdrop",
    "aria-hidden": "true",
    onClick: function () {
      dispatch({
        type: "MERGE",
        payload: {
          panelMenuOpen: false
        }
      });
    }
  }), state.panelMenuOpen && /*#__PURE__*/React.createElement("div", {
    className: "panel-menu-list",
    role: "group",
    "aria-label": "Panel toggles",
    tabIndex: "-1",
    ref: function (el) {
      if (el) el.focus();
    },
    onKeyDown: function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dispatch({
          type: "MERGE",
          payload: {
            panelMenuOpen: false
          }
        });
      }
    }
  }, ['transport', 'board', 'view', 'mode', 'rules', 'importExport'].map(function (id) {
    const label = ObservatoryPanelUtils.getPanelLabel(id);
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
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn panel-menu-toggle",
    onClick: function () {
      LifeViewUtils.toggleZenMode(stateRef, refs, dispatch);
    },
    title: "Zen mode \u2014 hide all panels (Z)",
    "aria-label": "Toggle zen mode",
    "data-tooltip": "Zen mode (Z)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-compress",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement(LayoutSwitcher, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }))), zenMode && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn zen-exit-btn",
    onClick: function () {
      LifeViewUtils.toggleZenMode(stateRef, refs, dispatch);
    },
    title: "Exit zen mode (Z or Escape)",
    "aria-label": "Exit zen mode"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-eye",
    "aria-hidden": "true"
  }), ' Exit Zen'), zenMode && state.zenNotify && /*#__PURE__*/React.createElement("div", {
    className: "zen-notify",
    role: "status",
    "aria-live": "polite"
  }, "Zen mode \u2014 press Z or Esc to exit"), /*#__PURE__*/React.createElement(MobileMinimapArea, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }), !zenMode && /*#__PURE__*/React.createElement(_ObservatoryHints, null));
};
const ObservatoryMobile = function ObservatoryMobile(props) {
  // eslint-disable-line no-unused-vars
  const cs = props.cs,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const sheetContent = state.bottomSheetOpen ? /*#__PURE__*/React.createElement(TabContentBuilder, {
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
  }), !state.bottomSheetOpen && !refs.statsChipHidden && state.showStats !== false && /*#__PURE__*/React.createElement(StatsChip, {
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

const _getPanelLabel = function (panelId) {
  const PANEL_LABELS = {
    transport: 'Simulate',
    board: 'Board',
    view: 'View',
    mode: 'Tools',
    rules: 'Rules',
    importExport: 'Share',
    stats: 'Stats'
  };
  return PANEL_LABELS[panelId] || panelId;
};
const _getPanelIcon = function (panelId) {
  const PANEL_ICONS = {
    transport: 'fa-play',
    board: 'fa-th-large',
    view: 'fa-eye',
    mode: 'fa-pencil',
    rules: 'fa-cogs',
    importExport: 'fa-exchange'
  };
  return PANEL_ICONS[panelId] || 'fa-circle-o';
};
const _getPanelContent = function (panelId, state, stateRef, refs, dispatch) {
  switch (panelId) {
    case 'transport':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
      }));
    case 'board':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
    case 'mode':
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
const _checkTabBarOverflow = function () {/* no-op: icon-only intermediate state removed */};
const _observeTabBars = function (stateRef, refs, dispatch) {
  // eslint-disable-line no-unused-vars
  if (refs.tabBarObservers) {
    refs.tabBarObservers.forEach(function (obs) {
      obs.disconnect();
    });
  }
  refs.tabBarObservers = [];
  const tabBars = document.querySelectorAll('.panel-group .panel-tab-bar');
  for (let i = 0; i < tabBars.length; i++) {
    (function (bar) {
      const obs = new ResizeObserver(function () {
        _checkTabBarOverflow(bar, stateRef, refs, dispatch);
      });
      obs.observe(bar);
      refs.tabBarObservers.push(obs);
    })(tabBars[i]);
  }
};

// ── State toggle helpers ─────────────────────────────────────────────

const _togglePanelOpen = function (panelId, stateRef, refs, dispatch) {
  const panels = Object.assign({}, stateRef.current.panelStates);
  panels[panelId] = Object.assign({}, panels[panelId], {
    open: !panels[panelId].open
  });
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
const _togglePanelCollapse = function (panelId, stateRef, refs, dispatch) {
  const panels = Object.assign({}, stateRef.current.panelStates);
  panels[panelId] = Object.assign({}, panels[panelId], {
    collapsed: !panels[panelId].collapsed
  });
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
const _toggleGroupCollapse = function (groupId, stateRef, refs, dispatch) {
  const groups = stateRef.current.panelGroups.map(function (g) {
    return g.id === groupId ? Object.assign({}, g, {
      collapsed: !g.collapsed
    }) : g;
  });
  dispatch({
    type: "MERGE",
    payload: {
      panelGroups: groups
    }
  });
  setTimeout(function () {
    LifeViewUtils._persistLayout(stateRef, refs);
  }, 0);
};

// ── Imperative drag/resize handlers ──────────────────────────────────

const _rectsOverlap = function (a, b) {
  const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const overlapArea = overlapX * overlapY;
  const aArea = a.width * a.height;
  return aArea > 0 ? overlapArea / aArea : 0;
};
const _updateDropIndicator = function (draggedId, dragX, dragY, dragPanel) {
  const allPanels = document.querySelectorAll('.float-panel, .panel-group');
  const dragRect = dragPanel.getBoundingClientRect();
  let found = false;
  for (let i = 0; i < allPanels.length; i++) {
    const other = allPanels[i];
    if (other === dragPanel) {
      allPanels[i].classList.remove('drop-target');
      continue;
    }
    const otherRect = other.getBoundingClientRect();
    const overlap = _rectsOverlap(dragRect, otherRect);
    if (overlap > 0.3 && !found) {
      other.classList.add('drop-target');
      found = true;
    } else {
      other.classList.remove('drop-target');
    }
  }
};
const _clearDropIndicator = function () {
  const els = document.querySelectorAll('.drop-target');
  for (let i = 0; i < els.length; i++) {
    els[i].classList.remove('drop-target');
  }
};
const _findDropTarget = function (draggedId, dragRect) {
  const allPanels = document.querySelectorAll('.float-panel, .panel-group');
  for (let i = 0; i < allPanels.length; i++) {
    const el = allPanels[i];
    const targetId = el.getAttribute('data-panel-id');
    const targetGroupId = el.getAttribute('data-group-id');
    if (!targetId && !targetGroupId) {
      continue;
    }
    if (targetId === draggedId) {
      continue;
    }
    const otherRect = el.getBoundingClientRect();
    if (_rectsOverlap(dragRect, otherRect) > 0.3) {
      return targetId || targetGroupId;
    }
  }
  return null;
};
const _startPanelDrag = function (panelId, e, stateRef, refs, dispatch) {
  if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
    return;
  }
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
  refs.fpDragMove = function (ev) {
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
  refs.fpDragEnd = function () {
    panel.classList.remove('dragging');
    _clearDropIndicator();
    const finalRect = panel.getBoundingClientRect();
    const mergeTarget = _findDropTarget(panelId, finalRect);
    if (mergeTarget) {
      LifeViewUtils._mergePanels(stateRef, refs, dispatch, panelId, mergeTarget);
    } else {
      const panels = Object.assign({}, stateRef.current.panelStates);
      panels[panelId] = Object.assign({}, panels[panelId], {
        x: finalRect.left,
        y: finalRect.top
      });
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
const _startPanelResize = function (panelId, e, stateRef, refs, dispatch) {
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
  const move = function (ev) {
    ev.preventDefault();
    if (didToggle) return;
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const newW = startW + (cx - startX);
    const newH = startH + (cy - startY);
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
  const end = function () {
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
const _startGroupDrag = function (groupId, e, stateRef, refs, dispatch) {
  if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
    return;
  }
  e.preventDefault();
  const panel = e.currentTarget.closest('.panel-group') || e.currentTarget.parentElement;
  const rect = panel.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const offX = clientX - rect.left;
  const offY = clientY - rect.top;
  LifeViewUtils._bringGroupToFront(stateRef, refs, dispatch, groupId);
  panel.classList.add('dragging');
  const move = function (ev) {
    ev.preventDefault();
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, cx - offX)) + 'px';
    panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, cy - offY)) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
  };
  const end = function () {
    panel.classList.remove('dragging');
    const finalRect = panel.getBoundingClientRect();
    const groups = stateRef.current.panelGroups.map(function (g) {
      return g.id === groupId ? Object.assign({}, g, {
        x: finalRect.left,
        y: finalRect.top
      }) : g;
    });
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
const _startTabDrag = function (panelId, groupId, e, stateRef, refs, dispatch) {
  const startX = e.clientX;
  const startY = e.clientY;
  const threshold = 30;
  let tornOff = false;
  const move = function (ev) {
    if (tornOff) {
      return;
    }
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (Math.sqrt(dx * dx + dy * dy) > threshold) {
      tornOff = true;
      LifeViewUtils._separatePanel(stateRef, refs, dispatch, panelId, groupId, ev.clientX - 40, ev.clientY - 10);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
    }
  };
  const end = function () {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
};
const _startGroupResize = function (groupId, e, stateRef, refs, dispatch) {
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
  for (let gi = 0; gi < gs.length; gi++) {
    if (gs[gi].id === groupId) {
      curGroup = gs[gi];
      break;
    }
  }
  const isCompact = curGroup && !!curGroup.compact;
  // Suppress _checkTabBarOverflow auto-compact during resize.
  refs.resizingGroup = true;
  const move = function (ev) {
    ev.preventDefault();
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const newH = startH + (cy - startY);
    if (isCompact) {
      // Compact: vertical resize only.
      const body = panel.querySelector('.compact-group-body') || panel.querySelector('.compact-body');
      const minH = 60;
      if (body) {
        minH = body.scrollHeight + (panel.offsetHeight - panel.clientHeight) + 40;
      }
      panel.style.maxHeight = Math.max(minH, newH) + 'px';
    } else {
      // Expanded: allow width to track cursor freely during drag.
      const newW = startW + (cx - startX);
      panel.style.width = Math.max(60, newW) + 'px';
      panel.style.maxHeight = Math.max(80, newH) + 'px';
    }
  };
  const end = function () {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    refs.resizingGroup = false;
    if (!isCompact) {
      // Snap to nearest of three sizes based on final width.
      const finalW = panel.getBoundingClientRect().width;
      if (finalW < compactSnapThreshold) {
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
  document.addEventListener('touchmove', move, {
    passive: false
  });
  document.addEventListener('touchend', end);
};

// ── Compact body definitions ─────────────────────────────────────────

const _getCompactDefs = function (panelId, state, stateRef, refs, dispatch) {
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
        title: 'Advance ' + state.stepCount + ' generations',
        onClick: function () {
          LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount);
        },
        popOut: function () {
          return /*#__PURE__*/React.createElement("div", {
            className: "compact-popout-content"
          }, /*#__PURE__*/React.createElement("select", {
            className: "toolbar-step-select full-width",
            value: state.stepCount,
            onChange: function (e) {
              LifeBoardUtils.setStepCount(stateRef, refs, dispatch, e);
            },
            title: "Step count"
          }, /*#__PURE__*/React.createElement("option", {
            value: "1"
          }, "1 gen"), /*#__PURE__*/React.createElement("option", {
            value: "10"
          }, "10 gen"), /*#__PURE__*/React.createElement("option", {
            value: "50"
          }, "50 gen"), /*#__PURE__*/React.createElement("option", {
            value: "100"
          }, "100 gen"), /*#__PURE__*/React.createElement("option", {
            value: "500"
          }, "500 gen")), /*#__PURE__*/React.createElement("button", {
            type: "button",
            className: "btn btn-block btn-block-spaced",
            onClick: function () {
              LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount);
            }
          }, "Go"));
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
      const boardDefs = [{
        id: 'boundary',
        icon: state.boundary === 'toroidal' ? 'fa-repeat' : state.boundary === 'finite' ? 'fa-stop' : null,
        label: state.boundary === 'unbounded' ? '\u221E' : null,
        title: 'Boundary: ' + (state.boundary === 'toroidal' ? 'Wrap' : state.boundary === 'finite' ? 'Hard' : '\u221E'),
        onClick: function () {
          LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch);
        },
        active: state.boundary !== 'toroidal'
      }];
      if (state.boundary !== 'unbounded') {
        boardDefs.push({
          id: 'grid-presets',
          icon: 'fa-table',
          title: 'Grid presets',
          popOut: function () {
            return /*#__PURE__*/React.createElement("div", {
              className: "compact-popout-content grid-presets"
            }, /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: "btn btn-xs",
              onClick: function () {
                LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 100, 100);
              },
              title: "100\\u00d7100"
            }, "100\\u00b2"), /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: "btn btn-xs",
              onClick: function () {
                LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 200, 200);
              },
              title: "200\\u00d7200"
            }, "200\\u00b2"), /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: "btn btn-xs",
              onClick: function () {
                LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 400, 400);
              },
              title: "400\\u00d7400"
            }, "400\\u00b2"), /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: "btn btn-xs",
              onClick: function () {
                LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 1000, 1000);
              },
              title: "1000\\u00d71000"
            }, "1000\\u00b2"), /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: "btn btn-xs",
              onClick: function () {
                LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 2000, 2000);
              },
              title: "2000\\u00d72000"
            }, "2000\\u00b2"));
          }
        }, {
          id: 'grid-size',
          icon: 'fa-arrows-h',
          title: 'Width & Height',
          popOut: function () {
            return /*#__PURE__*/React.createElement("div", {
              className: "compact-popout-content"
            }, /*#__PURE__*/React.createElement("div", {
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
              onTouchEnd: function () {
                LifeBoardUtils.applyWidth(stateRef, refs, dispatch);
              }
            }))), /*#__PURE__*/React.createElement("div", {
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
              onTouchEnd: function () {
                LifeBoardUtils.applyHeight(stateRef, refs, dispatch);
              }
            }))));
          }
        });
      }
      boardDefs.push({
        id: 'density',
        icon: 'fa-braille',
        title: 'Fill density',
        popOut: function () {
          return /*#__PURE__*/React.createElement("div", {
            className: "compact-popout-content sliders"
          }, /*#__PURE__*/React.createElement("label", {
            className: "slider-title"
          }, "Random Fill Density"), /*#__PURE__*/React.createElement("div", {
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
          })));
        }
      });
      return boardDefs;
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
        icon: 'fa-sun-o',
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
        id: 'stats',
        icon: 'fa-bar-chart',
        title: 'Stats',
        onClick: function () {
          dispatch({
            type: 'MERGE',
            payload: {
              showStats: !state.showStats
            }
          });
        },
        active: state.showStats
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
      const defs = [{
        id: 'draw',
        icon: 'fa-pencil',
        title: 'Draw mode (D)',
        onClick: function () {
          LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch);
        },
        active: state.drawMode === 'paint',
        popOut: function () {
          return /*#__PURE__*/React.createElement(DrawToolPopOut, {
            state: state,
            dispatch: dispatch
          });
        }
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
        active: state.drawMode === 'select',
        popOut: function () {
          return /*#__PURE__*/React.createElement(SelectToolPopOut, {
            state: state,
            dispatch: dispatch
          });
        }
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
      }];
      if (state.boundary !== 'unbounded') {
        defs.splice(3, 0, {
          id: 'region',
          icon: 'fa-th',
          title: 'Region bounds (B)',
          onClick: function () {
            LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch);
          },
          active: state.drawMode === 'region',
          popOut: function () {
            return /*#__PURE__*/React.createElement(RegionToolPopOut, {
              state: state,
              dispatch: dispatch
            });
          }
        });
      }
      return defs;
    case 'rules':
      return [{
        id: 'rule-preset',
        icon: 'fa-cogs',
        title: 'Rule presets',
        popOut: function () {
          return /*#__PURE__*/React.createElement("div", {
            className: "compact-popout-content"
          }, /*#__PURE__*/React.createElement("select", {
            className: "rule-preset-select",
            "aria-label": "Rule preset",
            value: state.rulePreset,
            onChange: function (e) {
              LifeBoardUtils.setRulePreset(stateRef, refs, dispatch, e);
            }
          }, /*#__PURE__*/React.createElement("option", {
            value: ""
          }, "Preset..."), RULE_PRESETS.map(function (p) {
            return /*#__PURE__*/React.createElement("option", {
              key: p.rule,
              value: p.rule
            }, p.name);
          })));
        }
      }, {
        id: 'rule-input',
        icon: 'fa-pencil-square-o',
        title: 'Edit rule (B/S notation)',
        popOut: function () {
          const ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(state.ruleString);
          return /*#__PURE__*/React.createElement("div", {
            className: "compact-popout-content"
          }, /*#__PURE__*/React.createElement("input", {
            className: "rule-input" + (ruleValid ? "" : " rule-input-invalid"),
            type: "text",
            value: state.ruleString,
            onChange: function (e) {
              LifeBoardUtils.setRule(stateRef, refs, dispatch, e);
            },
            title: "B/S notation (e.g. B3/S23)"
          }));
        }
      }];
    case 'importExport':
      return [{
        id: 'export-png',
        icon: 'fa-camera',
        title: 'Export PNG',
        onClick: function () {
          LifeIOUtils.exportPNG(stateRef, refs, dispatch);
        }
      }, {
        id: 'copy-rle',
        icon: 'fa-clipboard',
        title: 'Copy RLE',
        onClick: function () {
          LifeIOUtils.copyRLE(stateRef, refs, dispatch);
        }
      }, {
        id: 'record',
        icon: state.recording ? 'fa-stop' : 'fa-circle',
        title: state.recording ? 'Stop recording' : 'Record GIF',
        onClick: function () {
          LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch);
        },
        active: state.recording
      }, {
        id: 'share-url',
        icon: 'fa-share-alt',
        title: 'Share URL',
        onClick: function () {
          LifeIOUtils.shareURL(stateRef, refs, dispatch);
        }
      }, {
        id: 'import-rle',
        icon: 'fa-download',
        title: 'Import RLE/Plaintext',
        popOut: function () {
          return /*#__PURE__*/React.createElement(RLESection, {
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

const CompactBody = function CompactBody(props) {
  // eslint-disable-line no-unused-vars
  const panelId = props.panelId,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const defs = _getCompactDefs(panelId, state, stateRef, refs, dispatch);
  if (!defs || defs.length === 0) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "compact-body"
  }, defs.map(function (def) {
    const isOpen = LifeViewUtils._isPopOutOpen(stateRef, refs, dispatch, panelId, def.id);
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
      title: def.title,
      "data-tooltip": def.title
    }, def.icon ? /*#__PURE__*/React.createElement("i", {
      className: "fa " + def.icon,
      "aria-hidden": "true"
    }) : null, def.label ? /*#__PURE__*/React.createElement("span", {
      className: "compact-btn-label"
    }, def.label) : null), def.popOut && isOpen && /*#__PURE__*/React.createElement("div", {
      className: "pop-out-panel",
      tabIndex: "-1",
      ref: function (el) {
        if (el) el.focus();
      },
      onKeyDown: function (e) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          LifeViewUtils._closePopOut(stateRef, refs, dispatch);
        }
      }
    }, def.popOut()));
  }));
};
const FloatPanel = function FloatPanel(props) {
  // eslint-disable-line no-unused-vars
  const panelId = props.panelId,
    label = props.label,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const content = props.content || props.children;
  const ps = state.panelStates[panelId];
  if (!ps || !ps.open) {
    return null;
  }
  // Skip panels that are in a group — they render inside the group.
  if (LifeViewUtils._findGroupForPanel(stateRef, refs, dispatch, panelId)) {
    return null;
  }
  const isCompact = !!ps.compact;
  const className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() + (isCompact ? " float-panel-compact" : "");
  const style = {};
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
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + _getPanelIcon(panelId) + " float-panel-icon",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "float-panel-title",
    id: "panel-title-" + panelId
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-compact-toggle",
    onClick: function () {
      LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
    },
    "aria-label": isCompact ? "Expand " + label + " panel" : "Compact " + label + " panel",
    title: isCompact ? "Expand panel" : "Compact panel",
    "data-tooltip": isCompact ? "Expand" : "Compact"
  }, isCompact ? "\u00bb" : "\u00ab"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function () {
      _togglePanelOpen(panelId, stateRef, refs, dispatch);
    },
    "aria-label": "Close " + label + " panel",
    "data-tooltip": "Close"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, isCompact ? /*#__PURE__*/React.createElement(CompactBody, {
    panelId: panelId,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }) : content), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-resize",
    onMouseDown: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    },
    "data-tooltip": "Resize"
  }));
};
const FloatPanelDirect = function FloatPanelDirect(props) {
  // eslint-disable-line no-unused-vars
  const panelId = props.panelId,
    label = props.label,
    content = props.content,
    group = props.group,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const ps = state.panelStates[panelId];
  if (!ps || !ps.open) {
    return null;
  }
  const isCompact = !!ps.compact;
  const style = {};
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
  const className = "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() + (isCompact ? " float-panel-compact" : "");
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
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + _getPanelIcon(panelId) + " float-panel-icon",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "float-panel-title",
    id: "panel-title-" + panelId
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-compact-toggle",
    onClick: function () {
      LifeViewUtils._togglePanelCompact(stateRef, refs, dispatch, panelId);
    },
    "aria-label": isCompact ? "Expand " + label + " panel" : "Compact " + label + " panel",
    title: isCompact ? "Expand panel" : "Compact panel",
    "data-tooltip": isCompact ? "Expand" : "Compact"
  }, isCompact ? "\u00bb" : "\u00ab"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function () {
      _togglePanelOpen(panelId, stateRef, refs, dispatch);
    },
    "aria-label": "Close " + label + " panel",
    "data-tooltip": "Close"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, isCompact ? /*#__PURE__*/React.createElement(CompactBody, {
    panelId: panelId,
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  }) : content), /*#__PURE__*/React.createElement("div", {
    className: "float-panel-resize",
    onMouseDown: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    },
    onTouchStart: function (e) {
      _startPanelResize(panelId, e, stateRef, refs, dispatch);
    },
    "data-tooltip": "Resize"
  }));
};
const PanelGroup = function PanelGroup(props) {
  // eslint-disable-line no-unused-vars
  const group = props.group,
    state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const panels = state.panelStates;
  // Filter to only open panels in this group.
  const openPanels = group.panels.filter(function (pid) {
    return panels[pid] && panels[pid].open;
  });
  if (openPanels.length === 0) {
    return null;
  }
  // If only one panel remains open, render as standalone.
  if (openPanels.length === 1) {
    const soloId = openPanels[0];
    const soloLabel = _getPanelLabel(soloId);
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
  const activeTab = openPanels.indexOf(group.activeTab) !== -1 ? group.activeTab : openPanels[0];
  const isCompact = !!group.compact;
  const style = {};
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
  const className = "float-panel panel-group" + (isCompact ? " panel-group-compact" : "");

  // Tab buttons: icon-only rail in compact, full tabs in expanded.
  const tabButtons = openPanels.map(function (pid) {
    const label = _getPanelLabel(pid);
    return /*#__PURE__*/React.createElement("button", {
      key: pid,
      type: "button",
      className: "panel-tab" + (pid === activeTab ? " panel-tab-active" : ""),
      onClick: function (e) {
        e.stopPropagation();
        LifeViewUtils._setGroupActiveTab(stateRef, refs, dispatch, group.id, pid);
        if (group.collapsed) {
          _toggleGroupCollapse(group.id, stateRef, refs, dispatch);
        }
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
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + _getPanelIcon(activeTab) + " compact-active-icon",
      "aria-hidden": "true",
      title: _getPanelLabel(activeTab)
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn float-panel-compact-toggle",
      onClick: function (e) {
        e.stopPropagation();
        LifeViewUtils._toggleGroupCompact(stateRef, refs, dispatch, group.id);
      },
      title: "Expand group",
      "data-tooltip": "Expand"
    }, "\u00bb"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn float-panel-collapse",
      onClick: function (e) {
        e.stopPropagation();
        _toggleGroupCollapse(group.id, stateRef, refs, dispatch);
      },
      "aria-expanded": !group.collapsed,
      "aria-label": group.collapsed ? "Expand panel group" : "Collapse panel group",
      "data-tooltip": group.collapsed ? "Expand" : "Collapse"
    }, group.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn float-panel-close",
      onClick: function (e) {
        e.stopPropagation();
        _togglePanelOpen(activeTab, stateRef, refs, dispatch);
      },
      "aria-label": "Close active panel",
      "data-tooltip": "Close"
    }, "\xD7")), !group.collapsed && /*#__PURE__*/React.createElement("div", {
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
    }))), !group.collapsed && /*#__PURE__*/React.createElement("div", {
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
  const tabArea = /*#__PURE__*/React.createElement("div", {
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
    title: "Minimize to icon strip",
    "aria-label": "Minimize panel group to compact icon strip",
    "data-tooltip": "Compact"
  }, "\u00ab"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-collapse",
    onClick: function (e) {
      e.stopPropagation();
      _toggleGroupCollapse(group.id, stateRef, refs, dispatch);
    },
    "aria-expanded": !group.collapsed,
    "aria-label": group.collapsed ? "Expand panel group" : "Collapse panel group",
    "data-tooltip": group.collapsed ? "Expand" : "Collapse"
  }, group.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn float-panel-close",
    onClick: function (e) {
      e.stopPropagation();
      _togglePanelOpen(activeTab, stateRef, refs, dispatch);
    },
    "aria-label": "Close active panel",
    "data-tooltip": "Close"
  }, "\xD7")), !group.collapsed && /*#__PURE__*/React.createElement("div", {
    className: "float-panel-body"
  }, _getPanelContent(activeTab, state, stateRef, refs, dispatch)), !group.collapsed && /*#__PURE__*/React.createElement("div", {
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

const ObservatoryPanelUtils = {
  // eslint-disable-line no-unused-vars
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
  togglePanelOpen: function (panelId, state, stateRef, refs, dispatch) {
    _togglePanelOpen(panelId, stateRef, refs, dispatch);
  },
  togglePanelCollapse: function (panelId, state, stateRef, refs, dispatch) {
    _togglePanelCollapse(panelId, stateRef, refs, dispatch);
  },
  toggleGroupCollapse: function (groupId, state, stateRef, refs, dispatch) {
    _toggleGroupCollapse(groupId, stateRef, refs, dispatch);
  }
};
"use strict";

/* global LifeAnalysisUtils */
/**
 * PopGraphModal — full population history graph overlay.
 * Props: showPopGraph, popHistory, stateRef, refs, dispatch
 */
const PopGraphModal = function PopGraphModal(props) {
  // eslint-disable-line no-unused-vars
  if (!props.showPopGraph) {
    return null;
  }
  const hist = props.popHistory;
  if (!hist || hist.length < 2) {
    return null;
  }
  const stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const onClose = function () {
    LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
  };
  let maxPop = 0;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i] > maxPop) {
      maxPop = hist[i];
    }
  }
  if (maxPop === 0) {
    maxPop = 1;
  }
  const vbW = 600,
    vbH = 200,
    padT = 10,
    padB = 20,
    padL = 50,
    padR = 10;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;
  const points = hist.map(function (p, idx) {
    const x = padL + idx / (hist.length - 1) * plotW;
    const y = padT + (1 - p / maxPop) * plotH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const yLabels = [];
  const ySteps = 4;
  for (let yi = 0; yi <= ySteps; yi++) {
    const val = Math.round(maxPop * (1 - yi / ySteps));
    const yy = padT + yi / ySteps * plotH;
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
        const modal = e.currentTarget.querySelector('.pop-graph-modal');
        if (!modal) return;
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0],
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
    className: "pop-graph-subtitle"
  }, hist.length + ' generations recorded \xB7 peak ' + maxPop.toLocaleString()), /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    viewBox: "0 0 " + vbW + " " + vbH,
    className: "pop-graph-svg",
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
      stroke: 'var(--graph-grid)',
      strokeWidth: "0.5"
    }), /*#__PURE__*/React.createElement("text", {
      x: padL - 5,
      y: yl.y + 4,
      textAnchor: "end",
      fill: 'var(--graph-label)',
      fontSize: "10"
    }, yl.val.toLocaleString()));
  }), /*#__PURE__*/React.createElement("text", {
    x: padL + plotW / 2,
    y: vbH - 2,
    textAnchor: "middle",
    fill: 'var(--graph-label-secondary)',
    fontSize: "9"
  }, "Generation"), /*#__PURE__*/React.createElement("polyline", {
    fill: "none",
    stroke: 'var(--accent)',
    strokeWidth: "1.5",
    points: points
  }), /*#__PURE__*/React.createElement("polygon", {
    fill: 'rgba(var(--accent-rgb), 0.2)',
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

/* global LifeBoardUtils, LifeIOUtils, LifeAnalysisUtils, RULE_PRESETS */
/**
 * Rules and export panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 */

const RulesSection = function RulesSection(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(state.ruleString);
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
    className: "slider-title rule-label",
    "data-tooltip": "Birth/Survival rules. B3 = dead cell with 3 neighbors is born. S23 = live cell with 2 or 3 neighbors survives.",
    "data-tooltip-pos": "below"
  }, "Rule (B/S notation) ", /*#__PURE__*/React.createElement("i", {
    className: "fa fa-info-circle info-hint",
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("input", {
    className: "rule-input" + (ruleValid ? "" : " rule-input-invalid"),
    type: "text",
    value: state.ruleString,
    onChange: function (e) {
      LifeBoardUtils.setRule(stateRef, refs, dispatch, e);
    },
    title: "Birth/Survival rule string (e.g. B3/S23)"
  })));
};
const RLESection = function RLESection(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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
    },
    "aria-pressed": state.showRle
  }, "Import RLE / Plaintext")), state.showRle && /*#__PURE__*/React.createElement("div", {
    className: "rle-body"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "rle-input",
    rows: "5",
    placeholder: "Paste RLE or plaintext pattern here, or drag & drop a file\u2026\n(from LifeWiki or Golly)",
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
const ExportContent = function ExportContent(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "export-content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "btn-section"
  }, /*#__PURE__*/React.createElement("label", {
    className: "control-group-label"
  }, "Export"), /*#__PURE__*/React.createElement("div", {
    className: "buttons buttons-export"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeIOUtils.exportPNG(stateRef, refs, dispatch);
    },
    title: "Save as PNG",
    "data-tooltip": "Save board as PNG image"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-camera",
    "aria-hidden": "true"
  }), " Export PNG"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: function () {
      LifeIOUtils.copyRLE(stateRef, refs, dispatch);
    },
    title: "Copy board as RLE",
    "data-tooltip": "Copy pattern as RLE to clipboard"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-clipboard",
    "aria-hidden": "true"
  }), " ", state.copyRleTooltip ? "Copied!" : "Copy RLE"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.recording ? " active btn-record" : ""),
    onClick: function () {
      LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch);
    },
    title: "Record an animated GIF",
    "data-tooltip": "Record animated GIF",
    "aria-label": state.recording ? "Stop recording" : "Record GIF",
    "aria-pressed": state.recording
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
    "data-tooltip": "Copy shareable URL",
    "aria-label": "Share simulation URL"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-share-alt",
    "aria-hidden": "true"
  }), " ", state.shareTooltip ? "Copied!" : "Share Link")), /*#__PURE__*/React.createElement(RLESection, {
    state: state,
    stateRef: stateRef,
    refs: refs,
    dispatch: dispatch
  })));
};
"use strict";

/* global LifeViewUtils, LifeBoardUtils, THEMES, SPEED_DELAYS */
/**
 * Settings panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 * ViewControls also receives onToggleTrails.
 */

const ViewControls = function ViewControls(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const onToggleTrails = props.onToggleTrails;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "control-group-label"
  }, "Visibility"), /*#__PURE__*/React.createElement("div", {
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
    title: "Toggle grid lines (G)",
    "aria-pressed": state.gridLines
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  }), " Grid"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.showTrails ? " active" : ""),
    onClick: function () {
      onToggleTrails(stateRef, refs, dispatch);
    },
    title: "Show ghost trails",
    "aria-pressed": state.showTrails
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-sun-o",
    "aria-hidden": "true"
  }), " Trails"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.showMinimap ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch);
    },
    title: "Show/hide minimap (M)",
    "aria-pressed": state.showMinimap
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-map-o",
    "aria-hidden": "true"
  }), " Minimap"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.showStats ? " active" : ""),
    onClick: function () {
      dispatch({
        type: 'MERGE',
        payload: {
          showStats: !state.showStats
        }
      });
    },
    title: "Show/hide stats overlay",
    "aria-pressed": state.showStats
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-bar-chart",
    "aria-hidden": "true"
  }), " Stats")));
};
const ZoomSlider = function ZoomSlider(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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
const DisplaySettings = function DisplaySettings(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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
  })), /*#__PURE__*/React.createElement("label", {
    className: "control-group-label control-label-spaced"
  }, "Mode"), /*#__PURE__*/React.createElement("select", {
    className: "rule-preset-select",
    "aria-label": "Dark mode preference",
    value: state.darkModePref,
    onChange: function (e) {
      LifeBoardUtils.setDarkModePref(stateRef, refs, dispatch, e);
    },
    title: "UI dark mode preference"
  }, /*#__PURE__*/React.createElement("option", {
    value: "system"
  }, "System"), /*#__PURE__*/React.createElement("option", {
    value: "light"
  }, "Light"), /*#__PURE__*/React.createElement("option", {
    value: "dark"
  }, "Dark"))));
};
const BoundaryControls = function BoundaryControls(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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
    title: "Cycle boundary: Wrap / Hard / Infinite",
    "aria-pressed": state.boundary !== 'toroidal'
  }, state.boundary === 'toroidal' ? /*#__PURE__*/React.createElement("i", {
    className: "fa fa-repeat",
    "aria-hidden": "true"
  }) : state.boundary === 'finite' ? /*#__PURE__*/React.createElement("i", {
    className: "fa fa-stop",
    "aria-hidden": "true"
  }) : null, state.boundary === 'unbounded' ? /*#__PURE__*/React.createElement("span", {
    className: "boundary-infinity"
  }, "\u221E ") : " ", state.boundary === 'toroidal' ? "Wrap" : state.boundary === 'finite' ? "Hard" : "Infinite")));
};
const SpeedSlider = function SpeedSlider(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const delay = SPEED_DELAYS[state.speed - 1];
  const speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
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
const BoardSliders = function BoardSliders(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const isUnbounded = state.boundary === 'unbounded';
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
    className: "slider-title unbounded-label"
  }, "No bounding box \u2014 infinite canvas")), /*#__PURE__*/React.createElement("div", {
    className: "sliders"
  }, /*#__PURE__*/React.createElement("label", {
    className: "slider-title"
  }, "Random Fill Density"), /*#__PURE__*/React.createElement("div", {
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

/* global LifeAnalysisUtils */
/**
 * Stats-related render components extracted from LifeBoard.
 * Props: state, stateRef, refs, dispatch
 */

const SparklineSVG = function SparklineSVG(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const population = state.liveCells.size;
  const now2 = Date.now();
  const gpsText = refs.measuredGps > 0 && (state.running || now2 < (refs.gpsDisplayUntil || 0)) ? refs.measuredGps.toFixed(1) + '\u00a0gen/s' : '\u2014\u00a0gen/s';
  const fullHist = state.popHistory;
  let trendArrow = '';
  if (fullHist.length >= 5) {
    const delta = fullHist[fullHist.length - 1] - fullHist[fullHist.length - 5];
    trendArrow = delta > 2 ? '\u2009\u25b2' : delta < -2 ? '\u2009\u25bc' : '\u2009\u223c';
  }
  const histStart = Math.max(0, fullHist.length - 60);
  const hist = histStart > 0 ? fullHist.slice(histStart) : fullHist;
  let maxPop = 0;
  for (let hi = 0; hi < hist.length; hi++) {
    if (hist[hi] > maxPop) {
      maxPop = hist[hi];
    }
  }
  if (hist.length <= 1) {
    return null;
  }
  const vbW = 200,
    vbH = 36,
    padT = 2,
    innerH = vbH - padT * 2;
  const spMax = maxPop || 1;
  const sparkPts = hist.map(function (p, idx) {
    const x = hist.length === 1 ? vbW / 2 : idx / (hist.length - 1) * vbW;
    const y = padT + (1 - p / spMax) * innerH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const spanLabel = hist.length >= 60 ? 'last 60 gen' : hist.length + ' gen';
  return /*#__PURE__*/React.createElement("div", {
    className: "sparkline-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sparkline-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sparkline-title clickable",
    onClick: function () {
      LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch);
    },
    title: "Click for full population graph"
  }, "Pop: " + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
    className: "sparkline-peak"
  }, "peak " + maxPop.toLocaleString() + (state.sessionPeakPop > maxPop ? " \xb7 all-time " + state.sessionPeakPop.toLocaleString() : ""))), /*#__PURE__*/React.createElement("svg", {
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
    stroke: 'var(--graph-grid)',
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: padT + innerH / 2,
    x2: vbW,
    y2: padT + innerH / 2,
    stroke: 'var(--graph-grid)',
    strokeWidth: "0.5"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: sparkPts,
    fill: "none",
    stroke: 'var(--accent)',
    strokeWidth: "1.5",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sparkline-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sparkline-gps"
  }, gpsText || ''), /*#__PURE__*/React.createElement("span", null, spanLabel)));
};
const MobileSparkline = function MobileSparkline(props) {
  // eslint-disable-line no-unused-vars
  const svg = /*#__PURE__*/React.createElement(SparklineSVG, {
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
const StatsPanel = function StatsPanel(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const population = state.liveCells.size;
  const hc = state.hoverCell;
  const coordText = hc ? 'Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r : '\u2014';
  const sparkline = /*#__PURE__*/React.createElement(SparklineSVG, {
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
const StatsChip = function StatsChip(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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

/* global PATTERNS, PATTERN_GROUPS, PATTERN_META,
          InputHandler, LifeBoardUtils, LifeAnalysisUtils,
          drawBoard, drawRotationPreview */
/**
 * Tools-panel components extracted from LifeBoard.
 * ModeControls — draw mode toggle buttons + analyze.
 * ToolsContent — tool sub-type selectors, preset picker, selection actions.
 * MobileContextPanel — rotation / selection buttons shown on mobile.
 * Each component receives props: state, stateRef, refs, dispatch
 */

const ModeControls = function ModeControls(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "control-group-label"
  }, "Mode"), /*#__PURE__*/React.createElement("div", {
    className: "mode-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'paint' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch);
    },
    title: "Freehand draw mode (D)",
    "aria-pressed": state.drawMode === 'paint'
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-pencil",
    "aria-hidden": "true"
  }), " Draw"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'preset' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch);
    },
    title: "Place preset patterns (P)",
    "aria-pressed": state.drawMode === 'preset'
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-puzzle-piece",
    "aria-hidden": "true"
  }), " Preset"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'select' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch);
    },
    title: "Select and move cells (S)",
    "aria-pressed": state.drawMode === 'select'
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-mouse-pointer",
    "aria-hidden": "true"
  }), " Select"), state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.drawMode === 'region' ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch);
    },
    title: "Draw/erase region bounds (B)",
    "aria-pressed": state.drawMode === 'region'
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-th",
    "aria-hidden": "true"
  }), " Region"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.livePaintMode ? " active" : ""),
    onClick: function () {
      LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch);
    },
    title: "Paint while running",
    "aria-pressed": state.livePaintMode
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
  }), " Analyze")));
};
const ToolsContent = function ToolsContent(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const filterLc = state.patternFilter.toLowerCase();
  let patternOptions = Object.keys(PATTERN_GROUPS).map(function (group) {
    const names = Object.keys(PATTERN_GROUPS[group]).filter(function (name) {
      return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
    });
    if (names.length === 0) {
      return null;
    }
    const opts = names.map(function (name) {
      const meta = PATTERN_META[name];
      let title = '';
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
const PresetContent = function PresetContent(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const filterLc = state.patternFilter.toLowerCase();
  let patternOptions = Object.keys(PATTERN_GROUPS).map(function (group) {
    const names = Object.keys(PATTERN_GROUPS[group]).filter(function (name) {
      return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
    });
    if (names.length === 0) {
      return null;
    }
    const opts = names.map(function (name) {
      const meta = PATTERN_META[name];
      const title = '';
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

/**
 * DrawToolPopOut — draw tool sub-type selector for compact mode pop-out.
 */
const DrawToolPopOut = function DrawToolPopOut(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "tools-content"
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
  }, "Circle"))));
};

/**
 * SelectToolPopOut — select tool sub-type selector for compact mode pop-out.
 */
const SelectToolPopOut = function SelectToolPopOut(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "tools-content"
  }, /*#__PURE__*/React.createElement("div", {
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
  }, "All visible"))));
};

/**
 * RegionToolPopOut — region tool sub-type selector for compact mode pop-out.
 */
const RegionToolPopOut = function RegionToolPopOut(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    dispatch = props.dispatch;
  return /*#__PURE__*/React.createElement("div", {
    className: "tools-content"
  }, /*#__PURE__*/React.createElement("div", {
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
  }, "Circle"))));
};
const MobileContextPanel = function MobileContextPanel(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const showRotation = state.drawMode === 'preset' && state.selectedPattern;
  const showSelection = state.selection !== null;
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

/* global LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils, LifeViewUtils, SPEED_DELAYS */
/**
 * TransportControls — Play/pause/step buttons + step count.
 * Props: compact, state, stateRef, refs, dispatch
 */
const TransportControls = function TransportControls(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
    stateRef = props.stateRef,
    refs = props.refs,
    dispatch = props.dispatch;
  const compact = props.compact;
  if (compact) {
    const compactDelay = SPEED_DELAYS[state.speed - 1];
    const compactSpeedLabel = compactDelay === 0 ? 'Max' : compactDelay + '\u2009ms';
    return /*#__PURE__*/React.createElement("div", {
      className: "transport-controls transport-compact"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn btn-toggle" + (state.running ? " active" : ""),
      onClick: function () {
        LifeSimUtils.toggleGame(stateRef, refs, dispatch);
      },
      title: "Play/Pause (Space)",
      "data-tooltip": state.running ? "Pause (Space)" : "Play (Space)",
      "aria-label": state.running ? "Pause" : "Play",
      "aria-pressed": state.running
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa " + (state.running ? "fa-pause" : "fa-play"),
      "aria-hidden": "true"
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn",
      onClick: function () {
        LifeSimUtils.stepGame(stateRef, refs, dispatch);
      },
      title: "Step one generation (.)",
      "data-tooltip": "Step (.)",
      "aria-label": "Step one generation"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-step-forward",
      "aria-hidden": "true"
    })), /*#__PURE__*/React.createElement("span", {
      className: "transport-gen-label"
    }, "Gen " + state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", {
      className: "transport-speed-label",
      "data-tooltip": "Simulation speed"
    }, compactSpeedLabel));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "transport-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-toggle" + (state.running ? " active" : ""),
    onClick: function () {
      LifeSimUtils.toggleGame(stateRef, refs, dispatch);
    },
    title: "Start or pause the simulation (Space)",
    "aria-pressed": state.running
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
  }, "1 gen"), /*#__PURE__*/React.createElement("option", {
    value: "10"
  }, "10 gen"), /*#__PURE__*/React.createElement("option", {
    value: "50"
  }, "50 gen"), /*#__PURE__*/React.createElement("option", {
    value: "100"
  }, "100 gen"), /*#__PURE__*/React.createElement("option", {
    value: "500"
  }, "500 gen")), /*#__PURE__*/React.createElement("button", {
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
    title: "Undo last board edit (Ctrl+Z)"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-undo",
    "aria-hidden": "true"
  }), " Undo"));
};

/**
 * MobileTransportBar — Mobile transport bar.
 * Props: state, stateRef, refs, dispatch
 */
const MobileTransportBar = function MobileTransportBar(props) {
  // eslint-disable-line no-unused-vars
  const state = props.state,
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

/* global HashLife, SimRunner, InputHandler, RegionUtil, SimEngine, THEMES,
          LifeSimUtils, LifeIOUtils, LifeInputUtils, LifeViewUtils,
          LifeBoardUtils, drawBoard, drawMinimapMobile, drawRotationPreview,
          CartographerLayout, ObservatoryLayout, ObservatoryPanelUtils */
/**
 * Conway's Game of Life — React UI component (React 19 functional).
 * Constants, SimEngine, and helpers are loaded from constants.js.
 */

function lifeReducer(state, action) {
  switch (action.type) {
    case 'MERGE':
      return Object.assign({}, state, action.payload);
    default:
      if (typeof console !== 'undefined') {
        console.warn('lifeReducer: unrecognized action type:', action.type);
      }
      return state;
  }
}
function initState() {
  const cols = 100;
  const rows = 100;
  // On mobile, default to 8px/cell; on desktop, 10px/cell.
  // Center the view on the grid for all screen sizes.
  const isMobileInit = window.innerWidth <= 900 || window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 550px)').matches;
  const cellSize = isMobileInit ? 8 : 10;
  const initViewX = Math.round(cols / 2 - window.innerWidth / (2 * cellSize));
  const initViewY = Math.round(rows / 2 - window.innerHeight / (2 * cellSize));
  // Load persisted layout preferences from localStorage.
  // Schema v1: {layoutMode, railCollapsed, railTab, railSide, panelStates}
  const savedLayout = {};
  try {
    const raw = localStorage.getItem('life-layout-prefs');
    if (raw) {
      const parsed = JSON.parse(raw);
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
          const validPanels = ['transport', 'view', 'mode', 'board', 'rules', 'stats', 'importExport'];
          const ps = {};
          let allValid = true;
          let maxZ = 0;
          for (let vi = 0; vi < validPanels.length; vi++) {
            const pid = validPanels[vi];
            if (parsed.panelStates[pid] && typeof parsed.panelStates[pid] === 'object') {
              const pz = typeof parsed.panelStates[pid].z === 'number' ? parsed.panelStates[pid].z : 0;
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
  const initRegionMask = RegionUtil.buildRect(cols, rows);
  const initRegionComponents = [{
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
    theme: 'Midnight',
    drawMode: 'paint',
    selectTool: 'rect',
    drawTool: 'cell',
    regionTool: 'shape-rect',
    selection: null,
    clipboard: null,
    showMinimap: !isMobileInit,
    showStats: true,
    recording: false,
    showMobileTools: false,
    showTrails: true,
    darkModePref: function () {
      try {
        return localStorage.getItem('life-dark-mode-pref') || 'dark';
      } catch (e) {
        return 'dark';
      }
    }(),
    stepCount: 1,
    shareTooltip: false,
    copyRleTooltip: false,
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
      panels: ['transport', 'view', 'mode', 'board', 'rules', 'importExport'],
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
    const _r = React.useReducer(lifeReducer, undefined, initState);
    const state = _r[0],
      dispatch = _r[1];
    const stateRef = React.useRef(state);
    stateRef.current = state;
    let refs = React.useRef(null);
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
    const fr = React.useReducer(function (x) {
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
      // Set initial theme accent color (16.2)
      const accentMap = {
        Teal: '#70959A',
        Midnight: '#4A9ECD',
        Ember: '#C47138'
      };
      const accentRgbMap = {
        Teal: '112, 149, 154',
        Midnight: '74, 158, 205',
        Ember: '196, 113, 56'
      };
      const initTheme = stateRef.current.theme || 'Midnight';
      document.documentElement.style.setProperty('--accent', accentMap[initTheme] || '#70959A');
      document.documentElement.style.setProperty('--accent-rgb', accentRgbMap[initTheme] || '112, 149, 154');
      document.documentElement.setAttribute('data-theme', initTheme.toLowerCase());
      // Slider filled-track gradient (WebKit doesn't support ::-webkit-slider-progress)
      const updateSliderFill = function (slider) {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const val = parseFloat(slider.value);
        const pct = (val - min) / (max - min) * 100;
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#70959A';
        slider.style.background = 'linear-gradient(to right, ' + accentColor + ' 0%, ' + accentColor + ' ' + pct + '%, transparent ' + pct + '%, transparent 100%)';
      };
      const initSliderFills = function () {
        const sliders = document.querySelectorAll('input[type="range"]');
        for (let si = 0; si < sliders.length; si++) {
          updateSliderFill(sliders[si]);
          sliders[si].addEventListener('input', function () {
            updateSliderFill(this);
          });
        }
      };
      // Defer to allow initial render
      setTimeout(initSliderFills, 100);
      // Re-init on dynamic content changes via MutationObserver
      const sliderObserver = new MutationObserver(function (mutations) {
        for (let mi = 0; mi < mutations.length; mi++) {
          if (mutations[mi].addedNodes.length > 0) {
            setTimeout(initSliderFills, 50);
            break;
          }
        }
      });
      sliderObserver.observe(document.getElementById('content') || document.body, {
        childList: true,
        subtree: true
      });
      refs.sliderObserver = sliderObserver;
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
      const handleKey = function (e) {
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
          const popOut = e.target.closest && e.target.closest('.pop-out-trigger');
          if (!popOut) {
            LifeViewUtils._closePopOut(stateRef, refs, dispatch);
          }
        }
      };
      document.addEventListener('mousedown', refs.onPopOutDismiss);
      document.addEventListener('keydown', refs.onPopOutDismiss);
      // Drag-and-drop file import (desktop).
      const canvasContainer = refs.canvas.parentNode;
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
            LifeBoardUtils._applyDarkMode(stateRef, refs, dispatch, e.matches);
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
        if (stateRef.current.darkModePref === 'dark') {
          LifeBoardUtils._applyDarkMode(stateRef, refs, dispatch, true);
        } else if (stateRef.current.darkModePref === 'system') {
          LifeBoardUtils._applyDarkMode(stateRef, refs, dispatch, refs.darkModeQuery.matches);
        }
      }
      // Respond to viewport resize (throttled) to update canvas dimensions.
      refs.onResize = function () {
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        const widthChanged = Math.abs(newW - refs.lastResizeW) > 10;
        const heightBigChange = Math.abs(newH - refs.lastResizeH) > 100;
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
        let dc;
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
              const s = stateRef.current;
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
        const container = refs.canvas.parentNode;
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
          const mqList = [refs.mqPhone, refs.mqPhoneLandscape, refs.mqTablet, refs.mqLandscape];
          for (let mi = 0; mi < mqList.length; mi++) {
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
        if (refs.sliderObserver) {
          refs.sliderObserver.disconnect();
        }
      };
    }, []);

    // ── Update effect (replaces componentDidUpdate) ──
    const prevSelectedPattern = React.useRef(state.selectedPattern);
    const prevPatternRotation = React.useRef(state.patternRotation);
    const prevBottomSheetOpen = React.useRef(state.bottomSheetOpen);
    const prevBottomSheetTab = React.useRef(state.bottomSheetTab);
    const prevLayoutMode = React.useRef(state.layoutMode);
    const prevPanelGroups = React.useRef(state.panelGroups);
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

    const cs = LifeViewUtils.getCanvasSize(stateRef, refs, dispatch);
    let layout = state.layoutMode;
    const dc = state.deviceClass;
    const isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
    if (isMobile) {
      layout = 'observatory';
    }
    let layoutContent;
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

  const root = ReactDOM.createRoot(document.getElementById("content"));
  root.render(/*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LifeBoard, null)));
});

//# sourceMappingURL=script.compiled.js.map