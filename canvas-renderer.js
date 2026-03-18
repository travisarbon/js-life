/**
 * Canvas rendering module for Game of Life (R02, R05).
 * Decouples imperative canvas drawing from the React component.
 *
 * Global exposed: CanvasRenderer
 * Dependencies: parseKey, SimEngine, PATTERNS, THEMES (loaded before this file)
 */

var CanvasRenderer = {

    // ── Palette caching ──────────────────────────────────────────────────────
    _colorPalette: null,
    _trailPalette: null,
    _paletteTheme: null,
    _aliveRGB: null,

    _ensurePalette: function(theme, themeName){
        var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
        var yR = theme.youngR, yG = theme.youngG, yB = theme.youngB;
        var STEPS = 63;
        if(!this._colorPalette || this._paletteTheme !== themeName){
            this._colorPalette = new Array(STEPS + 1);
            for(var i = 0; i <= STEPS; i++){
                var t = i / STEPS;
                this._colorPalette[i] = 'rgb(' +
                    Math.round(yR + (aR - yR) * t) + ',' +
                    Math.round(yG + (aG - yG) * t) + ',' +
                    Math.round(yB + (aB - yB) * t) + ')';
            }
            this._aliveRGB = 'rgb(' + aR + ',' + aG + ',' + aB + ')';
            this._trailPalette = null;
            this._paletteTheme = themeName;
        }
        if(!this._trailPalette){
            this._trailPalette = new Array(21);
            for(var ti = 0; ti <= 20; ti++){
                var alpha = (ti / 20) * 0.35;
                this._trailPalette[ti] = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + alpha.toFixed(2) + ')';
            }
        }
        return { color: this._colorPalette, trail: this._trailPalette };
    },

    // ── Cell rendering ───────────────────────────────────────────────────────

    drawCells: function(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, colorPalette){
        var COLOR_STEPS = 63;
        var viewArea = (endR - startR) * (endC - startC);
        if(liveCells.size < viewArea * 0.3){
            // Sparse: iterate live cells, batch by color.
            var buckets = new Array(COLOR_STEPS + 1);
            liveCells.forEach(function(age, key){
                var _rc = parseKey(key), cr = _rc[0], cc = _rc[1];
                if(cr < startR || cr >= endR || cc < startC || cc >= endC) return;
                var ci = Math.min(Math.round(Math.min(age / 10, 1) * COLOR_STEPS), COLOR_STEPS);
                if(!buckets[ci]) buckets[ci] = [];
                buckets[ci].push((cc - viewX) * cellSize, (cr - viewY) * cellSize);
            });
            for(var bi = 0; bi <= COLOR_STEPS; bi++){
                if(!buckets[bi]) continue;
                ctx.fillStyle = colorPalette[bi];
                var coords = buckets[bi];
                for(var bj = 0; bj < coords.length; bj += 2){
                    ctx.fillRect(coords[bj], coords[bj+1], cellSize, cellSize);
                }
            }
        } else {
            // Dense: row lookup.
            var rowLookup = {};
            liveCells.forEach(function(age, key){
                var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r < startR || r >= endR || c < startC || c >= endC) return;
                if(!rowLookup[r]) rowLookup[r] = {};
                rowLookup[r][c] = age;
            });
            for(var r = startR; r < endR; r++){
                var rowData = rowLookup[r];
                if(!rowData) continue;
                for(var c = startC; c < endC; c++){
                    var age = rowData[c];
                    if(age !== undefined){
                        var ci2 = Math.min(Math.round(Math.min(age / 10, 1) * COLOR_STEPS), COLOR_STEPS);
                        ctx.fillStyle = colorPalette[ci2];
                        ctx.fillRect((c - viewX) * cellSize, (r - viewY) * cellSize, cellSize, cellSize);
                    }
                }
            }
        }
    },

    // ── Trail rendering ──────────────────────────────────────────────────────

    drawTrails: function(ctx, trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, trailPalette){
        trailMap.forEach(function(val, key){
            var _rc = parseKey(key), tr = _rc[0], tc = _rc[1];
            if(tr >= startR && tr < endR && tc >= startC && tc < endC){
                ctx.fillStyle = trailPalette[val] || trailPalette[20];
                ctx.fillRect((tc - viewX) * cellSize, (tr - viewY) * cellSize, cellSize, cellSize);
            }
        });
    },

    // ── Grid lines ───────────────────────────────────────────────────────────

    drawGrid: function(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, gridColor){
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for(var cv = startC; cv <= endC; cv++){
            var gx = (cv - viewX) * cellSize;
            ctx.moveTo(gx, 0); ctx.lineTo(gx, canvasH);
        }
        for(var rv = startR; rv <= endR; rv++){
            var gy = (rv - viewY) * cellSize;
            ctx.moveTo(0, gy); ctx.lineTo(canvasW, gy);
        }
        ctx.stroke();
    },

    // ── Bounding box overlay ─────────────────────────────────────────────────

    drawBoundingBox: function(ctx, cols, rows, viewX, viewY, cellSize, canvasW, canvasH, theme){
        var bbX1 = (0 - viewX) * cellSize;
        var bbY1 = (0 - viewY) * cellSize;
        var bbW = cols * cellSize;
        var bbH = rows * cellSize;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        if(bbY1 > 0) ctx.fillRect(0, 0, canvasW, Math.min(bbY1, canvasH));
        var bbBot = bbY1 + bbH;
        if(bbBot < canvasH) ctx.fillRect(0, Math.max(0, bbBot), canvasW, canvasH - Math.max(0, bbBot));
        var clipTop = Math.max(0, bbY1);
        var clipBot = Math.min(canvasH, bbBot);
        if(clipBot > clipTop && bbX1 > 0){
            ctx.fillRect(0, clipTop, Math.min(bbX1, canvasW), clipBot - clipTop);
        }
        var bbRight = bbX1 + bbW;
        if(clipBot > clipTop && bbRight < canvasW){
            ctx.fillRect(Math.max(0, bbRight), clipTop, canvasW - Math.max(0, bbRight), clipBot - clipTop);
        }
        ctx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(bbX1 + 0.5, bbY1 + 0.5, bbW, bbH);
        ctx.setLineDash([]);
    },

    // ── Selection overlay ────────────────────────────────────────────────────

    drawSelection: function(ctx, sel, viewX, viewY, cellSize, theme){
        if(!sel) return;
        var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
        var selType = sel.type || 'rect';
        if(selType === 'rect'){
            var sx1 = (Math.min(sel.c1, sel.c2) - viewX) * cellSize;
            var sy1 = (Math.min(sel.r1, sel.r2) - viewY) * cellSize;
            var sx2 = (Math.max(sel.c1, sel.c2) - viewX + 1) * cellSize;
            var sy2 = (Math.max(sel.r1, sel.r2) - viewY + 1) * cellSize;
            ctx.fillStyle = theme.sel;
            ctx.fillRect(sx1, sy1, sx2 - sx1, sy2 - sy1);
            ctx.strokeStyle = 'rgb(' + aR + ',' + aG + ',' + aB + ')';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1);
            ctx.setLineDash([]);
        } else if(selType === 'ellipse'){
            var sx1e = (Math.min(sel.c1, sel.c2) - viewX) * cellSize;
            var sy1e = (Math.min(sel.r1, sel.r2) - viewY) * cellSize;
            var sw = (Math.abs(sel.c2 - sel.c1) + 1) * cellSize;
            var sh = (Math.abs(sel.r2 - sel.r1) + 1) * cellSize;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(sx1e + sw/2, sy1e + sh/2, sw/2, sh/2, 0, 0, 2*Math.PI);
            ctx.fillStyle = theme.sel;
            ctx.fill();
            ctx.strokeStyle = 'rgb(' + aR + ',' + aG + ',' + aB + ')';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        } else if(selType === 'freeform'){
            if(sel.path && sel.path.length > 1){
                ctx.beginPath();
                ctx.moveTo((sel.path[0].c - viewX + 0.5)*cellSize, (sel.path[0].r - viewY + 0.5)*cellSize);
                for(var fi = 1; fi < sel.path.length; fi++)
                    ctx.lineTo((sel.path[fi].c - viewX + 0.5)*cellSize, (sel.path[fi].r - viewY + 0.5)*cellSize);
                ctx.closePath();
                ctx.fillStyle = theme.sel;
                ctx.fill();
                ctx.strokeStyle = 'rgb(' + aR + ',' + aG + ',' + aB + ')';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if(selType === 'all-visible'){
            if(sel.cells && sel.cells.length > 0){
                ctx.fillStyle = theme.sel;
                sel.cells.forEach(function(rc){
                    ctx.fillRect((rc[1]-viewX)*cellSize, (rc[0]-viewY)*cellSize, cellSize, cellSize);
                });
                ctx.strokeStyle = 'rgb(' + aR + ',' + aG + ',' + aB + ')';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 2]);
                var avMinC = Math.min(sel.c1, sel.c2) - viewX;
                var avMinR = Math.min(sel.r1, sel.r2) - viewY;
                ctx.strokeRect(avMinC*cellSize, avMinR*cellSize,
                    (Math.abs(sel.c2-sel.c1)+1)*cellSize, (Math.abs(sel.r2-sel.r1)+1)*cellSize);
                ctx.setLineDash([]);
            }
        }
    },

    // ── Draw tool preview ────────────────────────────────────────────────────

    drawToolPreview: function(ctx, previewCells, erasing, viewX, viewY, cellSize, theme){
        if(!previewCells || previewCells.length === 0) return;
        var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
        ctx.fillStyle = erasing
            ? 'rgba(200,80,80,0.45)'
            : 'rgba(' + aR + ',' + aG + ',' + aB + ',0.4)';
        for(var di = 0; di < previewCells.length; di++){
            var dpr = previewCells[di][0], dpc = previewCells[di][1];
            ctx.fillRect((dpc-viewX)*cellSize, (dpr-viewY)*cellSize, cellSize, cellSize);
        }
    },

    // ── Pattern placement preview ────────────────────────────────────────────

    _rotatedPatternCache: null,
    _rotatedPatternKey: null,

    drawPatternPreview: function(ctx, patternName, rotation, previewPos, viewX, viewY, cellSize, theme){
        if(!patternName || !previewPos || !PATTERNS[patternName]) return;
        var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
        var cacheKey = patternName + ':' + rotation;
        if(this._rotatedPatternKey !== cacheKey){
            this._rotatedPatternCache = SimEngine.rotatePattern(PATTERNS[patternName], rotation);
            this._rotatedPatternKey = cacheKey;
        }
        var pattern = this._rotatedPatternCache;
        var maxPR = 0, maxPC = 0;
        for(var pi = 0; pi < pattern.length; pi++){
            if(pattern[pi][0] > maxPR){ maxPR = pattern[pi][0]; }
            if(pattern[pi][1] > maxPC){ maxPC = pattern[pi][1]; }
        }
        var offsetPR = previewPos.r - Math.floor(maxPR / 2);
        var offsetPC = previewPos.c - Math.floor(maxPC / 2);
        ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',0.55)';
        for(var pj = 0; pj < pattern.length; pj++){
            var pvR = pattern[pj][0] + offsetPR;
            var pvC = pattern[pj][1] + offsetPC;
            ctx.fillRect((pvC - viewX) * cellSize, (pvR - viewY) * cellSize, cellSize, cellSize);
        }
    },

    // ── Rotation preview canvas ──────────────────────────────────────────────

    drawRotationPreview: function(canvas, patternName, rotation, theme){
        if(!patternName || !PATTERNS[patternName] || !canvas || !canvas.isConnected) return;
        var pattern = SimEngine.rotatePattern(PATTERNS[patternName], rotation);
        var maxR = 0, maxC = 0;
        for(var i = 0; i < pattern.length; i++){
            if(pattern[i][0] > maxR){ maxR = pattern[i][0]; }
            if(pattern[i][1] > maxC){ maxC = pattern[i][1]; }
        }
        var patRows = maxR + 1, patCols = maxC + 1;
        var pad = 4;
        var size = canvas.width;
        var cellPx = Math.max(1, Math.floor((size - pad * 2) / Math.max(patRows, patCols)));
        var offX = Math.floor((size - patCols * cellPx) / 2);
        var offY = Math.floor((size - patRows * cellPx) / 2);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
        for(var j = 0; j < pattern.length; j++){
            ctx.fillRect(offX + pattern[j][1] * cellPx, offY + pattern[j][0] * cellPx, cellPx, cellPx);
        }
    }
};
