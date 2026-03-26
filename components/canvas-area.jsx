import React from 'react';
import { CanvasRenderer } from '../canvas-renderer.js';
import { SimEngine, THEMES, SPEED_DELAYS, parseKey } from '../constants.js';
import { InputHandler } from '../input-handler.js';
import { LifeInputUtils } from '../life-input-utils.js';
import { LifeViewUtils } from '../life-view-utils.js';
import { LifeAnalysisUtils } from '../life-analysis-utils.js';
/**
 * Canvas-area components and imperative drawing functions extracted from LifeBoard.
 *
 * Components:
 *   CanvasArea         — main simulation canvas + analysis result overlay.
 *   MobileMinimapArea  — mobile/tablet minimap canvas element.
 *
 * Imperative canvas functions (top-level, accessed as globals):
 *   drawBoard(stateRef, refs)
 *   drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme)
 *   drawRotationPreview(stateRef, refs)
 *   toggleTrails(stateRef, refs, dispatch)
 *
 * Helper functions (file-local, used by MobileMinimapArea):
 *   onMinimapElementDown, onMinimapElementMove, onMinimapElementUp, panMinimapElement
 */

// ── Imperative canvas functions ──────────────────────────────────────

const drawBoard = function drawBoard(stateRef, refs) { // eslint-disable-line no-unused-vars
                const state = stateRef.current;
                const canvas = refs.canvas;
                if(!canvas){ return; }
                const ctx = canvas.getContext("2d");
                if(!ctx){ return; }
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
                const startC = viewX, startR = viewY;
                const endC = viewX + Math.ceil(canvasW / cellSize) + 1;
                const endR = viewY + Math.ceil(canvasH / cellSize) + 1;

                // Clear canvas.
                ctx.fillStyle = theme.bg;
                ctx.fillRect(0, 0, canvasW, canvasH);
                if(!isUnbounded && state.regionMask && state.regionMask.size > 0){
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--overlay-light').trim() || 'rgba(0,0,0,0.35)';
                    ctx.fillRect(0, 0, canvasW, canvasH);
                    CanvasRenderer.clearRegionCells(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
                }

                // Palette.
                const palettes = CanvasRenderer._ensurePalette(theme, state.theme);

                // Cells.
                CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

                // In-progress painted cells (drag-and-draw before mouseup commit).
                if(InputHandler._dragging && InputHandler._paintedCells){
                    const painted = InputHandler._paintedCells;
                    const paintKeys = Object.keys(painted);
                    if(paintKeys.length > 0){
                        const aliveColor = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
                        for(let pi = 0; pi < paintKeys.length; pi++){
                            const k = paintKeys[pi];
                            const rc = parseKey(k);
                            const pr = rc[0], pc = rc[1];
                            if(pr >= startR && pr <= endR && pc >= startC && pc <= endC){
                                ctx.fillStyle = painted[k] === 1 ? aliveColor : theme.bg;
                                ctx.fillRect((pc - viewX) * cellSize, (pr - viewY) * cellSize, cellSize, cellSize);
                            }
                        }
                    }
                }

                // Trails.
                if(refs.trailEnabled && refs.trailMap && refs.trailMap.size > 0){
                    CanvasRenderer.drawTrails(ctx, refs.trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.trail);
                }

                // Grid.
                if(state.gridLines){
                    CanvasRenderer.drawGrid(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme.grid);
                }

                // Region overlay.
                if(!isUnbounded){
                    CanvasRenderer.drawRegionOverlay(ctx, state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme, state.boundary);
                }

                // Selection.
                CanvasRenderer.drawSelection(ctx, state.selection, viewX, viewY, cellSize, theme);

                // Tool preview (paint mode).
                CanvasRenderer.drawToolPreview(ctx, InputHandler._drawPreviewCells, InputHandler._drawErasing, viewX, viewY, cellSize, theme);

                // Region tool preview.
                if(state.drawMode === 'region'){
                    if(InputHandler._regionPreviewKeys.length > 0){
                        CanvasRenderer.drawRegionPreview(ctx, InputHandler._regionPreviewKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
                    }
                    if(InputHandler._regionDragging){
                        const rgPainted = InputHandler._regionPaintedKeys;
                        const rgKeys = Object.keys(rgPainted);
                        if(rgKeys.length > 0){
                            CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
                        }
                    }
                }

                // Pattern preview.
                if(state.drawMode === 'preset'){
                    const previewMask = (!isUnbounded && state.regionMask && state.regionMask.size > 0) ? state.regionMask : null;
                    CanvasRenderer.drawPatternPreview(ctx, state.selectedPattern, state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme, previewMask);
                }

                // Minimap is rendered by the floating MobileMinimapArea component;
                // clear the legacy canvas-overlay rect so input handler ignores it.
                refs.minimapRect = null;

                // GIF recording: capture frame.
                if(state.recording && refs.gif){
                    refs.gif.addFrame(ctx, {copy: true, delay: SPEED_DELAYS[state.speed - 1] || 50});
                }
};

const drawMinimapMobile = function drawMinimapMobile(stateRef, refs, liveCells, cols, rows, viewX, viewY, cellSize, theme) { // eslint-disable-line no-unused-vars
                const state = stateRef.current;
                if(!refs.mobileMinimap || !refs.minimapCanvas){ return; }
                const isUnbounded = state.boundary === 'unbounded';
                let mmMobOriginR = 0, mmMobOriginC = 0;
                let mmRegionRows, mmRegionCols;
                if(isUnbounded){
                    const bb = SimEngine.getBoundingBox(liveCells);
                    if(bb){
                        const pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        let newMinR = bb.minR - pad, newMinC = bb.minC - pad;
                        let newMaxR = bb.maxR + pad, newMaxC = bb.maxC + pad;
                        const prev = refs.mmUnboundedRegion;
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
                    const rbm = state.regionBounds;
                    let mmMR = rbm ? rbm.minR : 0;
                    let mmMC = rbm ? rbm.minC : 0;
                    let mmMXR = rbm ? rbm.maxR + 1 : rows;
                    let mmMXC = rbm ? rbm.maxC + 1 : cols;
                    const bbMob = SimEngine.getBoundingBox(liveCells);
                    if(bbMob){
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
                const mmAspect = mmRegionCols / Math.max(1, mmRegionRows);
                let mmW_css, mmH_css;
                if(refs.minimapSize && refs.minimapSize.w > 0){
                    // User has resized the minimap — honour their preferred width, derive height from aspect ratio.
                    mmW_css = refs.minimapSize.w;
                    mmH_css = Math.round(mmW_css / mmAspect);
                } else {
                    const MOBILE_MM_CSS_W = Math.min(120, Math.round(window.innerWidth * 0.3));
                    const MOBILE_MM_CSS_H = Math.min(160, Math.round(window.innerHeight * 0.2));
                    if(mmAspect >= 1){
                        mmW_css = MOBILE_MM_CSS_W;
                        mmH_css = Math.min(Math.round(mmW_css / mmAspect), MOBILE_MM_CSS_H);
                    } else {
                        mmH_css = MOBILE_MM_CSS_H;
                        mmW_css = Math.min(Math.round(mmH_css * mmAspect), MOBILE_MM_CSS_W);
                    }
                }

                if(refs.minimapCanvas.width !== mmW_css || refs.minimapCanvas.height !== mmH_css){
                    refs.minimapCanvas.width  = mmW_css;
                    refs.minimapCanvas.height = mmH_css;
                }

                const mmCtx = refs.minimapCanvas.getContext('2d');
                const _mbHex = theme.bg || '#0A0E1A';
                const _mbR = parseInt(_mbHex.slice(1,3),16), _mbG = parseInt(_mbHex.slice(3,5),16), _mbB = parseInt(_mbHex.slice(5,7),16);
                mmCtx.fillStyle = 'rgba(' + _mbR + ',' + _mbG + ',' + _mbB + ',0.85)';
                mmCtx.fillRect(0, 0, mmW_css, mmH_css);

                const cellW = mmW_css / mmRegionCols;
                const cellH = mmH_css / mmRegionRows;
                mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';

                const _mmMOR = mmMobOriginR, _mmMOC = mmMobOriginC, _mmMCols = mmRegionCols, _mmMRows = mmRegionRows;
                liveCells.forEach(function(_, key){
                    const rc = parseKey(key);
                    const kr = rc[0] - _mmMOR;
                    const kc = rc[1] - _mmMOC;
                    if(kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
                    const px = Math.floor(kc * cellW);
                    const py = Math.floor(kr * cellH);
                    const pw = Math.max(1, Math.ceil(cellW));
                    const ph = Math.max(1, Math.ceil(cellH));
                    mmCtx.fillRect(px, py, pw, ph);
                });

                if(!isUnbounded && state.regionComponents){
                    const _compsM = state.regionComponents;
                    if(_compsM.length > 0){
                        mmCtx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
                        mmCtx.lineWidth = 1;
                        mmCtx.setLineDash([3, 2]);
                        for(let _ciM = 0; _ciM < _compsM.length; _ciM++){
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
                const vpClampX = Math.max(0, vpX), vpClampY = Math.max(0, vpY);
                const vpClampR = Math.min(mmW_css, vpX + vpW), vpClampB = Math.min(mmH_css, vpY + vpH);
                if(vpClampR > vpClampX && vpClampB > vpClampY){
                    mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
                    mmCtx.lineWidth = 1;
                    mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
                }

                const vpCenterCm = viewX + vpVisColsM / 2;
                const vpCenterRm = viewY + vpVisRowsM / 2;
                const vpOutsideM = vpCenterCm < mmMobOriginC || vpCenterCm > mmMobOriginC + mmRegionCols ||
                                 vpCenterRm < mmMobOriginR || vpCenterRm > mmMobOriginR + mmRegionRows;
                if(vpOutsideM){
                    const mmCCm = mmMobOriginC + mmRegionCols / 2, mmCRm = mmMobOriginR + mmRegionRows / 2;
                    const aaM = Math.atan2(vpCenterRm - mmCRm, vpCenterCm - mmCCm);
                    let apxM = mmW_css / 2 + Math.cos(aaM) * (mmW_css / 2 - 8);
                    let apyM = mmH_css / 2 + Math.sin(aaM) * (mmH_css / 2 - 8);
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

                if(refs.mobileMinimap.width !== mmW_css || refs.mobileMinimap.height !== mmH_css){
                    refs.mobileMinimap.width  = mmW_css;
                    refs.mobileMinimap.height = mmH_css;
                }
                const mobileCtx = refs.mobileMinimap.getContext('2d');
                mobileCtx.drawImage(refs.minimapCanvas, 0, 0);
                refs.mmMobileWorld = {originC: mmMobOriginC, originR: mmMobOriginR, cols: mmRegionCols, rows: mmRegionRows};
};

const drawRotationPreview = function drawRotationPreview(stateRef, refs) { // eslint-disable-line no-unused-vars
                const state = stateRef.current;
                const theme = THEMES[state.theme] || THEMES['Teal'];
                CanvasRenderer.drawRotationPreview(refs.previewCanvas, state.selectedPattern, state.patternRotation, theme);
};

const toggleTrails = function toggleTrails(stateRef, refs, dispatch) { // eslint-disable-line no-unused-vars
                const state = stateRef.current;
                const newVal = !state.showTrails;
                refs.trailEnabled = newVal;
                if(!newVal){ refs.trailMap = new Map(); }

                dispatch({type:"MERGE", payload:{showTrails: newVal}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
};

// ── Minimap element interaction helpers ──────────────────────────────

function onMinimapElementDown(e, stateRef, refs, dispatch){
                e.preventDefault();
                refs.mmElemDragging = true;
                panMinimapElement(e, stateRef, refs, dispatch);
}

function onMinimapElementMove(e, stateRef, refs, dispatch){
                if(!refs.mmElemDragging){ return; }
                e.preventDefault();
                panMinimapElement(e, stateRef, refs, dispatch);
}

function onMinimapElementUp(stateRef, refs){
                refs.mmElemDragging = false;
}

function panMinimapElement(e, stateRef, refs, dispatch){
                const state = stateRef.current;
                if(!refs.mobileMinimap){ return; }
                const rect = refs.mobileMinimap.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const frac_r = Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height));
                const mmWorld = refs.mmMobileWorld;
                const mmCols = mmWorld ? mmWorld.cols : state.cols;
                const mmRows = mmWorld ? mmWorld.rows : state.rows;
                const mmOC = mmWorld ? mmWorld.originC : 0;
                const mmOR = mmWorld ? mmWorld.originR : 0;
                const newVX = Math.round(frac_c * mmCols + mmOC - (refs.canvas.width  / state.cellSize) / 2);
                const newVY = Math.round(frac_r * mmRows + mmOR - (refs.canvas.height / state.cellSize) / 2);
                const clamped = LifeViewUtils.clampView(stateRef, refs, dispatch, newVX, newVY);

                dispatch({type:"MERGE", payload:{viewX: clamped.viewX, viewY: clamped.viewY}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
}

// ── React components ─────────────────────────────────────────────────

const CanvasArea = function CanvasArea(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const cs = props.cs;

                return (
                    <div className="app-canvas-container">
                        <canvas className="display"
                            ref    = {function(c){ refs.canvas = c; if(c){ refs.drawPending = true; } }}
                            width  = {cs.w}
                            height = {cs.h}
                            style  = {{width: cs.displayW + 'px', height: cs.displayH + 'px', display: 'block', margin: '0 auto'}}
                            id = "life-canvas"
                            role = "application"
                            aria-roledescription = "Game of Life grid"
                            aria-label = "Conway's Game of Life simulation canvas"
                            aria-description = "Click to toggle cells. Arrow keys to pan. Ctrl+scroll to zoom. Press ? for help."
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
};

const _startMinimapDrag = function(e, refs) {
    e.preventDefault();
    const el = e.currentTarget.parentElement;
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
        if(!refs.fixedPositions) refs.fixedPositions = {};
        const finalRect = el.getBoundingClientRect();
        refs.fixedPositions.minimap = {x: finalRect.left, y: finalRect.top};
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

const _startMinimapResize = function(e, refs) {
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget.parentElement;
    const canvas = refs.mobileMinimap;
    if(!canvas) return;
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startW = canvas.width;
    const aspect = canvas.width / Math.max(1, canvas.height);
    container.classList.add('dragging');

    const move = function(ev) {
        ev.preventDefault();
        const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const newW = Math.max(80, Math.min(Math.round(window.innerWidth * 0.5), startW + (mx - startX)));
        refs.minimapSize = {w: newW};
        refs.drawPending = true;
        // Update canvas element size immediately for responsive feel.
        canvas.width = newW;
        canvas.height = Math.round(newW / aspect);
    };
    const end = function() {
        container.classList.remove('dragging');
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

const MobileMinimapArea = function MobileMinimapArea(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const isDesktop = state.deviceClass !== 'phone-portrait' &&
        state.deviceClass !== 'phone-landscape' &&
        state.deviceClass !== 'tablet';

                if(!state.showMinimap || refs.minimapHidden){ return null; }

                return (
                    <div className="mobile-minimap-area draggable-fixed"
                        ref={function(el){
                            if(el && refs.fixedPositions && refs.fixedPositions.minimap){
                                const pos = refs.fixedPositions.minimap;
                                el.style.left = pos.x + 'px';
                                el.style.top = pos.y + 'px';
                                el.style.right = 'auto';
                                el.style.bottom = 'auto';
                                el.style.transform = 'none';
                            }
                        }}>
                        <div className="minimap-drag-handle"
                            onMouseDown={function(e){ _startMinimapDrag(e, refs); }}
                            onTouchStart={function(e){ _startMinimapDrag(e, refs); }}
                            title="Drag to reposition minimap">
                        </div>
                        <canvas className="mobile-minimap-canvas"
                            ref={function(c){ refs.mobileMinimap = c; }}
                            role="img" aria-label="Minimap navigation"
                            onMouseDown={function(e){ onMinimapElementDown(e, stateRef, refs, dispatch); }}
                            onMouseMove={function(e){ onMinimapElementMove(e, stateRef, refs, dispatch); }}
                            onTouchStart={function(e){ onMinimapElementDown(e, stateRef, refs, dispatch); }}
                            onTouchMove={function(e){ onMinimapElementMove(e, stateRef, refs, dispatch); }}
                            onMouseUp={function(){ onMinimapElementUp(stateRef, refs); }}
                            onTouchEnd={function(){ onMinimapElementUp(stateRef, refs); }} />
                        {isDesktop && <div className="minimap-resize-handle"
                            onMouseDown={function(e){ _startMinimapResize(e, refs); }}
                            onTouchStart={function(e){ _startMinimapResize(e, refs); }}
                            title="Drag to resize minimap" />}
                    </div>
                );
};

export { drawBoard, drawMinimapMobile, drawRotationPreview, toggleTrails, CanvasArea, MobileMinimapArea };
