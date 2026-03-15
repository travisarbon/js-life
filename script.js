/**
 * Conway's Game of Life
 */

// ── Preset patterns ───────────────────────────────────────────────────────────
// All cells are [row, col] offsets (0-indexed from top-left of bounding box).
var PATTERN_GROUPS = {
    'Still lifes': {
        'Block':     [[0,0],[0,1],[1,0],[1,1]],
        'Beehive':   [[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],
        'Loaf':      [[0,1],[0,2],[1,0],[1,3],[2,1],[2,3],[3,2]],
        'Boat':      [[0,0],[0,1],[1,0],[1,2],[2,1]],
        'Tub':       [[0,1],[1,0],[1,2],[2,1]],
        'Ship':      [[0,0],[0,1],[1,0],[1,2],[2,1],[2,2]],
        'Barge':     [[0,1],[1,0],[1,2],[2,1],[2,3],[3,2]],
        'Long boat': [[0,0],[0,1],[1,0],[1,2],[2,1],[2,3],[3,2]],
        'Pond':      [[0,1],[0,2],[1,0],[1,3],[2,0],[2,3],[3,1],[3,2]]
    },
    'Oscillators': {
        'Blinker':        [[0,0],[0,1],[0,2]],
        'Toad':           [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],
        'Beacon':         [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
        'Pulsar':         [
                            [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
                            [2,0],[2,5],[2,7],[2,12],
                            [3,0],[3,5],[3,7],[3,12],
                            [4,0],[4,5],[4,7],[4,12],
                            [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
                            [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
                            [8,0],[8,5],[8,7],[8,12],
                            [9,0],[9,5],[9,7],[9,12],
                            [10,0],[10,5],[10,7],[10,12],
                            [12,2],[12,3],[12,4],[12,8],[12,9],[12,10]
                          ],
        // Period-15 oscillator.
        'Pentadecathlon': [[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],
        // Period-4 oscillator.
        'Mold':           [[0,1],[0,2],[0,3],[1,1],[1,3],[2,0],[2,2],[3,0],[3,1],[3,2]],
        // Period-14 oscillator.
        'Tumbler':        [[0,1],[0,2],[0,4],[0,5],
                           [1,1],[1,3],[1,5],
                           [2,0],[2,2],[2,4],[2,6],
                           [3,0],[3,1],[3,5],[3,6]]
    },
    'Spaceships': {
        'Glider': [[0,1],[1,2],[2,0],[2,1],[2,2]],
        // Lightweight spaceship — moves horizontally.
        'LWSS':   [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
        // Middleweight spaceship.
        'MWSS':   [[0,3],[1,1],[1,5],[2,0],[3,0],[3,5],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // Heavyweight spaceship.
        'HWSS':   [[0,3],[0,4],[1,1],[1,6],[2,0],[3,0],[3,6],[4,0],[4,1],[4,2],[4,3],[4,4],[4,5]]
    },
    'Methuselahs': {
        'R-pentomino':  [[0,1],[0,2],[1,0],[1,1],[2,1]],
        'Acorn':        [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]],
        // Diehard: vanishes completely after 130 generations.
        'Diehard':      [[0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]],
        // Pi heptomino: stabilises after 173 generations.
        'Pi heptomino': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2]],
        // Thunderbird: lives 243 generations.
        'Thunderbird':  [[0,0],[0,1],[0,2],[1,1],[2,1],[3,1]],
        // Herschel: 7-cell signal used in conduit chains.
        'Herschel':     [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2],[3,2]]
    },
    'Guns': {
        'Gosper Glider Gun': [
                            [0,24],
                            [1,22],[1,24],
                            [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
                            [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
                            [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
                            [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
                            [6,10],[6,16],[6,24],
                            [7,11],[7,15],
                            [8,12],[8,13]
                          ],
        // Simkin glider gun: period 120, more compact than Gosper.
        'Simkin Glider Gun': [
                            [0,0],[0,1],[0,7],[0,8],
                            [1,0],[1,1],[1,7],[1,8],
                            [4,4],[4,5],
                            [5,4],[5,5],
                            [10,2],[10,3],[11,2],[11,3],
                            [15,25],[15,26],
                            [16,24],[16,28],
                            [17,24],[17,28],
                            [18,25],[18,27],
                            [19,26],
                            [20,24],[20,25],[20,26],
                            [23,22],[23,23],
                            [24,22],[24,23]
                          ]
    }
};

// Flat lookup keyed by pattern name for O(1) access.
var PATTERNS = {};
Object.keys(PATTERN_GROUPS).forEach(function(group){
    Object.keys(PATTERN_GROUPS[group]).forEach(function(name){
        PATTERNS[name] = PATTERN_GROUPS[group][name];
    });
});

// Metadata for pattern tooltips (period, type, cell count, notes).
var PATTERN_META = {
    'Block':               { type: 'Still life',  cells: 4 },
    'Beehive':             { type: 'Still life',  cells: 6 },
    'Loaf':                { type: 'Still life',  cells: 7 },
    'Boat':                { type: 'Still life',  cells: 5 },
    'Tub':                 { type: 'Still life',  cells: 4 },
    'Ship':                { type: 'Still life',  cells: 6 },
    'Barge':               { type: 'Still life',  cells: 7 },
    'Long boat':           { type: 'Still life',  cells: 7 },
    'Pond':                { type: 'Still life',  cells: 8 },
    'Blinker':             { type: 'Oscillator',  period: 2,  cells: 3 },
    'Toad':                { type: 'Oscillator',  period: 2,  cells: 6 },
    'Beacon':              { type: 'Oscillator',  period: 2,  cells: 6 },
    'Pulsar':              { type: 'Oscillator',  period: 3,  cells: 48 },
    'Pentadecathlon':      { type: 'Oscillator',  period: 15, cells: 12 },
    'Mold':                { type: 'Oscillator',  period: 4,  cells: 10 },
    'Tumbler':             { type: 'Oscillator',  period: 14, cells: 15 },
    'Glider':              { type: 'Spaceship',   period: 4,  cells: 5,  note: 'c/4 diagonal' },
    'LWSS':                { type: 'Spaceship',   period: 4,  cells: 9,  note: 'c/2 orthogonal' },
    'MWSS':                { type: 'Spaceship',   period: 4,  cells: 11, note: 'c/2 orthogonal' },
    'HWSS':                { type: 'Spaceship',   period: 4,  cells: 13, note: 'c/2 orthogonal' },
    'R-pentomino':         { type: 'Methuselah',  lifespan: 1103, cells: 5 },
    'Acorn':               { type: 'Methuselah',  lifespan: 5206, cells: 7 },
    'Diehard':             { type: 'Methuselah',  lifespan: 130,  cells: 7 },
    'Pi heptomino':        { type: 'Methuselah',  lifespan: 173,  cells: 7 },
    'Thunderbird':         { type: 'Methuselah',  lifespan: 243,  cells: 6 },
    'Herschel':            { type: 'Methuselah',  lifespan: 128,  cells: 7 },
    'Gosper Glider Gun':   { type: 'Gun',         period: 30, cells: 36 },
    'Simkin Glider Gun':   { type: 'Gun',         period: 120, cells: 36 }
};

// ── Rule presets ──────────────────────────────────────────────────────────────
var RULE_PRESETS = [
    { name: 'Conway (B3/S23)',                rule: 'B3/S23' },
    { name: 'HighLife (B36/S23)',             rule: 'B36/S23' },
    { name: 'Day & Night (B3678/S34678)',     rule: 'B3678/S34678' },
    { name: 'Maze (B3/S12345)',               rule: 'B3/S12345' },
    { name: 'Seeds (B2/S)',                   rule: 'B2/S' },
    { name: 'Replicator (B1357/S1357)',       rule: 'B1357/S1357' },
    { name: 'Life w/o Death (B3/S012345678)', rule: 'B3/S012345678' },
    { name: 'Anneal (B4678/S35678)',          rule: 'B4678/S35678' }
];

// Delay in ms per generation, indexed by speed 1-10.
var SPEED_DELAYS = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];

// ── Color themes ──────────────────────────────────────────────────────────────
// Each theme defines alive/young RGB channels for age-gradient rendering plus
// canvas background and grid/selection overlay colours.
var THEMES = {
    'Teal': {
        bg: '#FFFFFF',
        aliveR: 112,  aliveG: 149,  aliveB: 154,
        youngR: 200,  youngG: 220,  youngB: 222,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(112,149,154,0.25)'
    },
    'Midnight': {
        bg: '#0A0E1A',
        aliveR: 74,   aliveG: 158,  aliveB: 205,
        youngR: 150,  youngG: 190,  youngB: 225,
        grid:   'rgba(255,255,255,0.12)',
        sel:    'rgba(74,158,205,0.25)'
    },
    'Ember': {
        bg: '#FFF8F0',
        aliveR: 196,  aliveG: 113,  aliveB: 58,
        youngR: 230,  youngG: 200,  youngB: 160,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(196,113,58,0.25)'
    }
};

$(document).ready(function(){
    (function(){

        var LifeBoard = React.createClass({

            // ── Lifecycle ─────────────────────────────────────────────────────

            getInitialState : function(){
                var cellSize = 5;
                var cols = 100;
                var rows = 100;
                return {
                    running :        true,
                    cellSize :       cellSize,
                    cols :           cols,
                    rows :           rows,
                    viewX :          0,
                    viewY :          0,
                    sparseness :     2,
                    liveCells :      this.buildLiveCells(cols, rows, 2),
                    generations :    0,
                    liveClickMode :  false,
                    speed :          5,
                    gridLines :      false,
                    boundary :       'toroidal',
                    birthRule :      [3],
                    surviveRule :    [2, 3],
                    ruleString :     'B3/S23',
                    rulePreset :     'B3/S23',
                    selectedPattern: null,
                    patternRotation: 0,
                    pendingCols :    cols,
                    pendingRows :    rows,
                    popHistory :     [],
                    stable :         false,
                    showHelp :       false,
                    showRle :        false,
                    rleInput :       '',
                    rleError :       '',
                    patternFilter :  '',
                    hoverCell :      null,
                    theme :          'Teal',
                    drawMode :       'paint',
                    selection :      null,
                    clipboard :      null,
                    showMinimap :    true,
                    recording :      false
                };
            },

            componentDidMount : function(){
                this._dragging = false;
                this._dragStatus = null;
                this._paintedCells = {};
                this._previewPos = null;
                this._loopRunning = false;
                this._tickId = 0;
                this._undoStack = [];
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._genTimestamps = [];
                this._measuredGps = 0;
                this._selStart = null;
                this._panDragging = false;
                this._panStart = null;
                this._worker = null;
                this._gif = null;
                this._minimapDirty = true;
                this._minimapCanvas = document.createElement('canvas');
                this._minimapCanvas.width  = 100;
                this._minimapCanvas.height = 75;
                this._canvas = document.getElementById("life-canvas");
                // Attach wheel listener as non-passive so preventDefault works.
                this._canvas.addEventListener('wheel', this.onWheel, {passive: false});
                document.addEventListener('keydown', this.handleKeyDown);
                // Initialise Web Worker for async simulation (falls back to sync).
                if(typeof Worker !== 'undefined'){
                    try {
                        this._worker = new Worker('life-worker.js');
                        var self = this;
                        this._worker.onmessage = function(e){ self._handleWorkerMessage(e.data); };
                        this._worker.onerror   = function(){ self._worker = null; };
                    } catch(ex){ this._worker = null; }
                }
                this.drawBoard();
                this._startLoop();
            },

            componentDidUpdate : function(prevProps, prevState){
                if(prevState.selectedPattern !== this.state.selectedPattern ||
                   prevState.patternRotation !== this.state.patternRotation){
                    this.drawRotationPreview();
                }
            },

            componentWillUnmount : function(){
                this._canvas.removeEventListener('wheel', this.onWheel);
                document.removeEventListener('keydown', this.handleKeyDown);
                if(this._worker){ this._worker.terminate(); }
                if(this._gif){ this._gif.abort(); this._gif = null; }
            },

            // ── Board construction ─────────────────────────────────────────────

            // Returns a sparse Map: key = "r,c", value = age (1 for fresh cells).
            buildLiveCells : function(cols, rows, sparseness){
                var map = new Map();
                for(var r = 0; r < rows; r++){
                    for(var c = 0; c < cols; c++){
                        if(Math.random() < (1 / sparseness)){
                            map.set(r + ',' + c, 1);
                        }
                    }
                }
                return map;
            },

            // ── Rendering ─────────────────────────────────────────────────────

            drawBoard : function(){
                var canvas = this._canvas;
                var ctx = canvas.getContext("2d");
                var cellSize = this.state.cellSize;
                var cols = this.state.cols;
                var rows = this.state.rows;
                var viewX = this.state.viewX;
                var viewY = this.state.viewY;
                var canvasW = canvas.width;
                var canvasH = canvas.height;
                var theme = THEMES[this.state.theme] || THEMES['Teal'];
                var liveCells = this.state.liveCells;

                // Clear canvas with background colour.
                ctx.fillStyle = theme.bg;
                ctx.fillRect(0, 0, canvasW, canvasH);

                // Compute visible cell range.
                var startC = Math.max(0, viewX);
                var startR = Math.max(0, viewY);
                var endC   = Math.min(cols, viewX + Math.ceil(canvasW / cellSize) + 1);
                var endR   = Math.min(rows, viewY + Math.ceil(canvasH / cellSize) + 1);

                // Draw live cells with age-based coloring.
                var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
                var yR = theme.youngR, yG = theme.youngG, yB = theme.youngB;
                for(var r = startR; r < endR; r++){
                    for(var c = startC; c < endC; c++){
                        var age = liveCells.get(r + ',' + c);
                        if(age !== undefined){
                            var t = Math.min(age / 10, 1);
                            ctx.fillStyle = 'rgb(' +
                                Math.round(yR + (aR - yR) * t) + ',' +
                                Math.round(yG + (aG - yG) * t) + ',' +
                                Math.round(yB + (aB - yB) * t) + ')';
                            ctx.fillRect((c - viewX) * cellSize, (r - viewY) * cellSize, cellSize, cellSize);
                        }
                    }
                }

                // Grid lines.
                if(this.state.gridLines){
                    ctx.strokeStyle = theme.grid;
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
                }

                // Selection rectangle overlay.
                var sel = this.state.selection;
                if(sel){
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
                }

                // Pattern placement preview.
                if(this.state.selectedPattern && this._previewPos){
                    var pattern = this.rotatePattern(PATTERNS[this.state.selectedPattern], this.state.patternRotation);
                    var maxPR = 0, maxPC = 0;
                    for(var pi = 0; pi < pattern.length; pi++){
                        if(pattern[pi][0] > maxPR){ maxPR = pattern[pi][0]; }
                        if(pattern[pi][1] > maxPC){ maxPC = pattern[pi][1]; }
                    }
                    var offsetPR = this._previewPos.r - Math.floor(maxPR / 2);
                    var offsetPC = this._previewPos.c - Math.floor(maxPC / 2);
                    ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',0.55)';
                    for(var pj = 0; pj < pattern.length; pj++){
                        var pvR = pattern[pj][0] + offsetPR;
                        var pvC = pattern[pj][1] + offsetPC;
                        if(pvR >= 0 && pvR < rows && pvC >= 0 && pvC < cols){
                            ctx.fillRect((pvC - viewX) * cellSize, (pvR - viewY) * cellSize, cellSize, cellSize);
                        }
                    }
                }

                // Minimap overlay (bottom-right corner).
                if(this.state.showMinimap && cols > 0 && rows > 0){
                    this.drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme);
                }

                // GIF recording: capture frame.
                if(this.state.recording && this._gif){
                    this._gif.addFrame(ctx, {copy: true, delay: SPEED_DELAYS[this.state.speed - 1] || 50});
                }
            },

            drawMinimap : function(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme){
                var mmW = 100, mmH = 75;
                var mmX = canvasW - mmW - 6, mmY = canvasH - mmH - 6;

                // Redraw minimap off-screen canvas only when marked dirty.
                if(this._minimapDirty){
                    var mc = this._minimapCanvas;
                    var mctx = mc.getContext('2d');
                    mctx.clearRect(0, 0, mmW, mmH);
                    // Background.
                    mctx.fillStyle = 'rgba(10,14,26,0.85)';
                    mctx.fillRect(0, 0, mmW, mmH);
                    // Draw all live cells as 1-px dots.
                    mctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
                    liveCells.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        var kr = parseInt(key.substring(0, comma));
                        var kc = parseInt(key.substring(comma + 1));
                        mctx.fillRect(Math.floor(kc / cols * mmW), Math.floor(kr / rows * mmH), 1, 1);
                    });
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
                var vx1 = mmX + Math.round(viewX / cols * mmW);
                var vy1 = mmY + Math.round(viewY / rows * mmH);
                var vw  = Math.max(2, Math.round(visCols / cols * mmW));
                var vh  = Math.max(2, Math.round(visRows / rows * mmH));
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1;
                ctx.strokeRect(vx1 + 0.5, vy1 + 0.5, vw, vh);

                // Store minimap rect for click detection.
                this._minimapRect = {x: mmX, y: mmY, w: mmW, h: mmH};
            },

            drawRotationPreview : function(){
                var canvas = this._previewCanvas;
                if(!canvas || !this.state.selectedPattern){ return; }
                var theme = THEMES[this.state.theme] || THEMES['Teal'];
                var pattern = this.rotatePattern(
                    PATTERNS[this.state.selectedPattern], this.state.patternRotation);
                var maxR = 0, maxC = 0;
                for(var i = 0; i < pattern.length; i++){
                    if(pattern[i][0] > maxR){ maxR = pattern[i][0]; }
                    if(pattern[i][1] > maxC){ maxC = pattern[i][1]; }
                }
                var patRows = maxR + 1, patCols = maxC + 1;
                var size   = canvas.width;
                var pad    = 4;
                var cellPx = Math.max(1, Math.floor((size - pad * 2) / Math.max(patRows, patCols)));
                var offX   = Math.floor((size - patCols * cellPx) / 2);
                var offY   = Math.floor((size - patRows * cellPx) / 2);
                var ctx    = canvas.getContext('2d');
                ctx.fillStyle = theme.bg;
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
                for(var j = 0; j < pattern.length; j++){
                    ctx.fillRect(offX + pattern[j][1] * cellPx,
                                 offY + pattern[j][0] * cellPx, cellPx, cellPx);
                }
            },

            // ── Sparse generation logic ────────────────────────────────────────
            // Runs in O(k) where k = number of live cells, not O(rows × cols).

            // Returns a new Map of live cells for the next generation.
            computeNextGeneration : function(liveCells, cols, rows, birth, survive, boundary){
                var toroidal = boundary === 'toroidal';
                // Build candidate set: every live cell plus each of its 8 neighbours.
                var candidates = new Map();
                liveCells.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    var kr = parseInt(key.substring(0, comma));
                    var kc = parseInt(key.substring(comma + 1));
                    candidates.set(key, [kr, kc]);
                    for(var dr = -1; dr <= 1; dr++){
                        for(var dc = -1; dc <= 1; dc++){
                            if(dr === 0 && dc === 0){ continue; }
                            var nr, nc;
                            if(toroidal){
                                nr = (kr + dr + rows) % rows;
                                nc = (kc + dc + cols) % cols;
                            } else {
                                nr = kr + dr; nc = kc + dc;
                                if(nr < 0 || nr >= rows || nc < 0 || nc >= cols){ continue; }
                            }
                            var nk = nr + ',' + nc;
                            if(!candidates.has(nk)){ candidates.set(nk, [nr, nc]); }
                        }
                    }
                });
                // Apply rules to each candidate.
                var newLiveCells = new Map();
                candidates.forEach(function(pos, key){
                    var r = pos[0], c = pos[1];
                    var count = 0;
                    for(var dr = -1; dr <= 1; dr++){
                        for(var dc = -1; dc <= 1; dc++){
                            if(dr === 0 && dc === 0){ continue; }
                            var nr, nc;
                            if(toroidal){
                                nr = (r + dr + rows) % rows;
                                nc = (c + dc + cols) % cols;
                            } else {
                                nr = r + dr; nc = c + dc;
                                if(nr < 0 || nr >= rows || nc < 0 || nc >= cols){ continue; }
                            }
                            if(liveCells.has(nr + ',' + nc)){ count++; }
                        }
                    }
                    var wasAlive = liveCells.has(key);
                    var alive = wasAlive ? survive.indexOf(count) !== -1 : birth.indexOf(count) !== -1;
                    if(alive){
                        newLiveCells.set(key, wasAlive ? (liveCells.get(key) || 0) + 1 : 1);
                    }
                });
                return newLiveCells;
            },

            // ── Animation loop ─────────────────────────────────────────────────

            _startLoop : function(){
                if(this._loopRunning){ return; }
                this._loopRunning = true;
                var tickId = ++this._tickId;
                var self = this;
                requestAnimationFrame(function(){ self.findNewStates(tickId); });
            },

            findNewStates : function(tickId){
                if(tickId !== this._tickId){ this._loopRunning = false; return; }
                if(this.state.running !== true){ this._loopRunning = false; return; }

                var liveCells = this.state.liveCells;
                var cols     = this.state.cols;
                var rows     = this.state.rows;
                var birth    = this.state.birthRule;
                var survive  = this.state.surviveRule;
                var boundary = this.state.boundary;

                if(this._worker){
                    // Async path: serialise sparse Map as [[r, c, age], ...].
                    var payload = [];
                    liveCells.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        payload.push([parseInt(key.substring(0, comma)),
                                      parseInt(key.substring(comma + 1)), age]);
                    });
                    this._worker.postMessage({
                        liveCells: payload, cols: cols, rows: rows,
                        birth: birth, survive: survive, boundary: boundary,
                        tickId: tickId
                    });
                } else {
                    var newLiveCells = this.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
                    this._applyNewStates(newLiveCells, tickId);
                }
            },

            // Called by the worker response handler and the sync path.
            _applyNewStates : function(newLiveCells, tickId){
                if(tickId !== this._tickId){ this._loopRunning = false; return; }

                // Stability detection via sorted key set.
                var keys = [];
                newLiveCells.forEach(function(age, key){ keys.push(key); });
                var boardHash = keys.sort().join('|');
                var isStable  = (boardHash === this._prevBoardHash);
                this._prevBoardHash = boardHash;
                this._stableCount = isStable ? this._stableCount + 1 : 0;
                var hitStable = this._stableCount >= 2;

                var newPop = newLiveCells.size;
                var newHistory = this.state.popHistory.concat([newPop]);
                if(newHistory.length > 60){ newHistory = newHistory.slice(newHistory.length - 60); }

                // Gen/sec tracking.
                this._genTimestamps.push(Date.now());
                if(this._genTimestamps.length > 20){ this._genTimestamps.shift(); }
                if(this._genTimestamps.length >= 2){
                    var ts = this._genTimestamps;
                    var dt = ts[ts.length - 1] - ts[0];
                    if(dt > 0){ this._measuredGps = (ts.length - 1) / dt * 1000; }
                }

                this._minimapDirty = true;
                var self = this;
                var myTickId = tickId;
                this.setState({
                    liveCells :   newLiveCells,
                    generations : this.state.generations + 1,
                    popHistory :  newHistory,
                    stable :      hitStable,
                    running :     hitStable ? false : this.state.running
                }, function(){
                    self.drawBoard();
                    if(hitStable){ self._loopRunning = false; return; }
                    var delay = SPEED_DELAYS[self.state.speed - 1];
                    setTimeout(function(){
                        requestAnimationFrame(function(){ self.findNewStates(myTickId); });
                    }, delay);
                });
            },

            // Receives computation results from the Web Worker.
            _handleWorkerMessage : function(data){
                // Reconstruct sparse Map from [[r, c, age], ...] payload.
                var newLiveCells = new Map();
                for(var i = 0; i < data.liveCells.length; i++){
                    var cell = data.liveCells[i];
                    newLiveCells.set(cell[0] + ',' + cell[1], cell[2]);
                }
                this._applyNewStates(newLiveCells, data.tickId);
            },

            stepGame : function(){
                this.pushUndo();
                var liveCells = this.state.liveCells;
                var cols      = this.state.cols;
                var rows      = this.state.rows;
                var birth     = this.state.birthRule;
                var survive   = this.state.surviveRule;
                var boundary  = this.state.boundary;
                var newLiveCells = this.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
                var newPop = newLiveCells.size;
                var newHistory = this.state.popHistory.concat([newPop]);
                if(newHistory.length > 60){ newHistory = newHistory.slice(newHistory.length - 60); }
                this._minimapDirty = true;
                var self = this;
                this.setState({
                    liveCells :   newLiveCells,
                    running :     false,
                    generations : this.state.generations + 1,
                    popHistory :  newHistory,
                    stable :      false
                }, function(){ self.drawBoard(); });
            },

            // ── Undo ──────────────────────────────────────────────────────────

            pushUndo : function(){
                this._undoStack.push({
                    liveCells :   new Map(this.state.liveCells),
                    generations : this.state.generations
                });
                if(this._undoStack.length > 30){ this._undoStack.shift(); }
            },

            undo : function(){
                if(this._undoStack.length === 0){ return; }
                var entry = this._undoStack.pop();
                this._tickId++;
                this._loopRunning = false;
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._minimapDirty = true;
                var self = this;
                this.setState({
                    liveCells :   entry.liveCells,
                    generations : entry.generations,
                    running :     false,
                    stable :      false
                }, function(){ self.drawBoard(); });
            },

            // ── Export ─────────────────────────────────────────────────────────

            exportPNG : function(){
                var link = document.createElement('a');
                link.download = 'game-of-life-gen-' + this.state.generations + '.png';
                link.href = this._canvas.toDataURL('image/png');
                link.click();
            },

            // ── RLE export ────────────────────────────────────────────────────

            boardToRLE : function(){
                var liveCells = this.state.liveCells;
                var rule = this.state.ruleString;
                var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                liveCells.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    var kr = parseInt(key.substring(0, comma));
                    var kc = parseInt(key.substring(comma + 1));
                    if(kr < minR){ minR = kr; } if(kr > maxR){ maxR = kr; }
                    if(kc < minC){ minC = kc; } if(kc > maxC){ maxC = kc; }
                });
                if(!isFinite(maxR)){ return ''; }
                var W = maxC - minC + 1;
                var H = maxR - minR + 1;
                var header = 'x = ' + W + ', y = ' + H + ', rule = ' + rule + '\n';
                var rleData = '';
                for(var row = minR; row <= maxR; row++){
                    var runChar = null, runLen = 0, rowStr = '';
                    for(var col = minC; col <= maxC; col++){
                        var ch = liveCells.has(row + ',' + col) ? 'o' : 'b';
                        if(ch === runChar){
                            runLen++;
                        } else {
                            if(runChar !== null){
                                rowStr += (runLen > 1 ? runLen : '') + runChar;
                            }
                            runChar = ch; runLen = 1;
                        }
                    }
                    if(runChar === 'o'){ rowStr += (runLen > 1 ? runLen : '') + runChar; }
                    if(row < maxR){ rowStr += '$'; }
                    rleData += rowStr;
                }
                rleData += '!';
                var wrapped = '';
                for(var k = 0; k < rleData.length; k += 70){
                    wrapped += rleData.slice(k, k + 70) + '\n';
                }
                return header + wrapped;
            },

            copyRLE : function(){
                var rle = this.boardToRLE();
                if(!rle){ return; }
                var self = this;
                this.setState({showRle: true, rleInput: rle, rleError: ''}, function(){
                    if(navigator.clipboard && navigator.clipboard.writeText){
                        navigator.clipboard.writeText(rle);
                    }
                });
            },

            // ── Help modal ─────────────────────────────────────────────────────

            toggleHelp : function(){
                this.setState({showHelp : !this.state.showHelp});
            },

            // ── Mouse / painting ───────────────────────────────────────────────

            getMousePos : function(event){
                var canvasEl = this._canvas;
                var rect = canvasEl.getBoundingClientRect();
                var scaleX = canvasEl.width  / rect.width;
                var scaleY = canvasEl.height / rect.height;
                return {
                    x : (event.clientX - rect.left) * scaleX,
                    y : (event.clientY - rect.top)  * scaleY
                };
            },

            paintCellDirect : function(c, r){
                var canvas = this._canvas;
                var ctx = canvas.getContext("2d");
                var cellSize = this.state.cellSize;
                var viewX = this.state.viewX;
                var viewY = this.state.viewY;
                var theme = THEMES[this.state.theme] || THEMES['Teal'];
                var px = (c - viewX) * cellSize;
                var py = (r - viewY) * cellSize;
                ctx.fillStyle = this._dragStatus === 1
                    ? ('rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')')
                    : theme.bg;
                ctx.fillRect(px, py, cellSize, cellSize);
                if(this.state.gridLines){
                    ctx.strokeStyle = theme.grid;
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(px, py, cellSize, cellSize);
                }
            },

            // Convert a mouse event to board cell coordinates using the viewport.
            getCellPos : function(event){
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                return {
                    c : this.state.viewX + Math.floor(mouse.x / cellSize),
                    r : this.state.viewY + Math.floor(mouse.y / cellSize)
                };
            },

            // Clamp view offsets to valid range given current canvas and cell size.
            clampView : function(viewX, viewY, cols, rows, cellSize){
                var canvasW = this._canvas ? this._canvas.width  : cols * cellSize;
                var canvasH = this._canvas ? this._canvas.height : rows * cellSize;
                var maxVX = Math.max(0, cols - Math.ceil(canvasW / cellSize));
                var maxVY = Math.max(0, rows - Math.ceil(canvasH / cellSize));
                return {
                    viewX : Math.max(0, Math.min(maxVX, viewX)),
                    viewY : Math.max(0, Math.min(maxVY, viewY))
                };
            },

            onMouseDown : function(event){
                event.preventDefault();
                // Click on minimap: pan viewport to that position.
                if(event.button === 0 && this._minimapRect && this.state.showMinimap){
                    var mouse = this.getMousePos(event);
                    var mm = this._minimapRect;
                    if(mouse.x >= mm.x && mouse.x <= mm.x + mm.w &&
                       mouse.y >= mm.y && mouse.y <= mm.y + mm.h){
                        var frac_c = (mouse.x - mm.x) / mm.w;
                        var frac_r = (mouse.y - mm.y) / mm.h;
                        var newVX = Math.round(frac_c * this.state.cols - (this._canvas.width  / this.state.cellSize) / 2);
                        var newVY = Math.round(frac_r * this.state.rows - (this._canvas.height / this.state.cellSize) / 2);
                        var clamped = this.clampView(newVX, newVY, this.state.cols, this.state.rows, this.state.cellSize);
                        var self0 = this;
                        this.setState({viewX: clamped.viewX, viewY: clamped.viewY}, function(){ self0.drawBoard(); });
                        return;
                    }
                }
                // Middle-mouse or Space+left starts pan drag.
                if(event.button === 1){
                    this._panDragging = true;
                    this._panStart = {x: event.clientX, y: event.clientY,
                                      vx: this.state.viewX, vy: this.state.viewY};
                    return;
                }
                // Right-click exits pattern placement mode.
                if(event.button === 2 && this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0},
                        function(){ self.drawBoard(); });
                    return;
                }
                if(event.button !== 0){ return; }
                var pos = this.getCellPos(event);
                var c = pos.c, r = pos.r;
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }

                // Selection mode: begin drag-select.
                if(this.state.drawMode === 'select'){
                    this._selStart = {c : c, r : r};
                    var self2 = this;
                    this.setState({selection : {c1: c, r1: r, c2: c, r2: r}},
                        function(){ self2.drawBoard(); });
                    return;
                }

                // Pattern placement mode.
                if(this.state.selectedPattern){
                    if(!this.state.liveClickMode){ this.setState({running : false}); }
                    this.placePattern(this.state.selectedPattern, c, r);
                    return;
                }

                // Paint mode.
                if(!this.state.liveClickMode){ this.setState({running : false}); }
                var key = r + ',' + c;
                this.pushUndo();
                this._dragging = true;
                this._dragStatus = this.state.liveCells.has(key) ? 0 : 1;
                this._paintedCells = {};
                this._paintedCells[key] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseMove : function(event){
                // Pan drag (middle mouse button).
                if(this._panDragging && this._panStart){
                    var dx = event.clientX - this._panStart.x;
                    var dy = event.clientY - this._panStart.y;
                    var cellSize = this.state.cellSize;
                    var dcells = -Math.round(dx / cellSize);
                    var drows  = -Math.round(dy / cellSize);
                    var clamped = this.clampView(
                        this._panStart.vx + dcells, this._panStart.vy + drows,
                        this.state.cols, this.state.rows, cellSize);
                    var self0 = this;
                    this.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                        function(){ self0.drawBoard(); });
                    return;
                }

                var pos = this.getCellPos(event);
                var c = pos.c, r = pos.r;
                var inBounds = c >= 0 && c < this.state.cols && r >= 0 && r < this.state.rows;

                // Always update hover cell for coordinate display.
                var newHover = inBounds ? {c : c, r : r} : null;
                var ph = this.state.hoverCell;
                var hoverChanged = (!!newHover !== !!ph) ||
                    (newHover && ph && (newHover.c !== ph.c || newHover.r !== ph.r));
                if(hoverChanged){ this.setState({hoverCell : newHover}); }

                // Update selection rect while dragging in select mode.
                if(this.state.drawMode === 'select' && this._selStart){
                    var bc = Math.max(0, Math.min(this.state.cols - 1, c));
                    var br = Math.max(0, Math.min(this.state.rows - 1, r));
                    var prev2 = this.state.selection;
                    if(prev2 && prev2.c2 === bc && prev2.r2 === br){ return; }
                    var self1 = this;
                    this.setState({selection: {c1: this._selStart.c, r1: this._selStart.r, c2: bc, r2: br}},
                        function(){ self1.drawBoard(); });
                    return;
                }

                if(this.state.selectedPattern){
                    var newPos = inBounds ? {c : c, r : r} : null;
                    var prev = this._previewPos;
                    if(prev === newPos){ return; }
                    if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
                    this._previewPos = newPos;
                    this.drawBoard();
                    return;
                }
                if(!this._dragging){ return; }
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }
                var paintKey = r + ',' + c;
                if(this._paintedCells[paintKey] !== undefined){ return; }
                this._paintedCells[paintKey] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseUp : function(){
                if(this._panDragging){
                    this._panDragging = false;
                    this._panStart = null;
                }
                if(this.state.drawMode === 'select' && this._selStart){
                    // Normalise selection bounds (ensure r1≤r2, c1≤c2).
                    var sel = this.state.selection;
                    if(sel){
                        this.setState({selection: {
                            r1: Math.min(sel.r1, sel.r2), c1: Math.min(sel.c1, sel.c2),
                            r2: Math.max(sel.r1, sel.r2), c2: Math.max(sel.c1, sel.c2)
                        }});
                    }
                    this._selStart = null;
                    return;
                }
                if(!this._dragging){ return; }
                this._dragging = false;
                var paintedCells = this._paintedCells;
                var newLiveCells = new Map(this.state.liveCells);
                Object.keys(paintedCells).forEach(function(k){
                    if(paintedCells[k] === 1){ newLiveCells.set(k, 1); }
                    else { newLiveCells.delete(k); }
                });
                this._paintedCells = {};
                this._minimapDirty = true;
                var self = this;
                this.setState({liveCells: newLiveCells, stable: false}, function(){ self.drawBoard(); });
            },

            onMouseLeave : function(){
                if(this.state.hoverCell){ this.setState({hoverCell : null}); }
                this._panDragging = false;
                this._panStart = null;
                if(this.state.selectedPattern){
                    this._previewPos = null;
                    this.drawBoard();
                    return;
                }
                this.onMouseUp();
            },

            onContextMenu : function(event){
                event.preventDefault();
                if(this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0},
                        function(){ self.drawBoard(); });
                }
            },

            // ── Zoom and pan ──────────────────────────────────────────────────

            onWheel : function(event){
                event.preventDefault();
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                var viewX = this.state.viewX;
                var viewY = this.state.viewY;
                // Cell under cursor before zoom.
                var cellC = viewX + Math.floor(mouse.x / cellSize);
                var cellR = viewY + Math.floor(mouse.y / cellSize);
                var step  = Math.max(1, Math.round(cellSize / 8));
                var newCS = event.deltaY < 0
                    ? Math.min(32, cellSize + step)
                    : Math.max(2, cellSize - step);
                if(newCS === cellSize){ return; }
                // Keep the cell under cursor in the same pixel position.
                var newVX = Math.round(cellC - mouse.x / newCS);
                var newVY = Math.round(cellR - mouse.y / newCS);
                var clamped = this.clampView(newVX, newVY,
                    this.state.cols, this.state.rows, newCS);
                var self = this;
                this.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                    function(){ self.drawBoard(); });
            },

            pan : function(dc, dr){
                var clamped = this.clampView(
                    this.state.viewX + dc, this.state.viewY + dr,
                    this.state.cols, this.state.rows, this.state.cellSize);
                var self = this;
                this.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                    function(){ self.drawBoard(); });
            },

            fitView : function(){
                var liveCells = this.state.liveCells;
                var cols  = this.state.cols;
                var rows  = this.state.rows;
                var canvas = this._canvas;
                if(!canvas){ return; }
                var canvasW = canvas.width;
                var canvasH = canvas.height;
                var self = this;
                if(liveCells.size === 0){
                    this.setState({viewX: 0, viewY: 0}, function(){ self.drawBoard(); });
                    return;
                }
                var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                liveCells.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    var kr = parseInt(key.substring(0, comma));
                    var kc = parseInt(key.substring(comma + 1));
                    if(kr < minR){ minR = kr; } if(kr > maxR){ maxR = kr; }
                    if(kc < minC){ minC = kc; } if(kc > maxC){ maxC = kc; }
                });
                var patCols = maxC - minC + 1;
                var patRows = maxR - minR + 1;
                var newCS = Math.max(2, Math.min(32,
                    Math.min(Math.floor(canvasW / (patCols * 1.15)),
                             Math.floor(canvasH / (patRows * 1.15)))));
                var visCols = Math.ceil(canvasW / newCS);
                var visRows = Math.ceil(canvasH / newCS);
                var centerC = Math.floor((minC + maxC) / 2);
                var centerR = Math.floor((minR + maxR) / 2);
                var clamped = this.clampView(
                    centerC - Math.floor(visCols / 2),
                    centerR - Math.floor(visRows / 2),
                    cols, rows, newCS);
                this.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                    function(){ self.drawBoard(); });
            },

            setZoom : function(e){
                var newCS = parseInt(e.target.value);
                var clamped = this.clampView(
                    this.state.viewX, this.state.viewY,
                    this.state.cols, this.state.rows, newCS);
                var self = this;
                this.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                    function(){ self.drawBoard(); });
            },

            setTheme : function(e){
                var self = this;
                this.setState({theme: e.target.value}, function(){ self.drawBoard(); });
            },

            // ── Selection ─────────────────────────────────────────────────────

            copySelection : function(){
                var sel = this.state.selection;
                if(!sel){ return; }
                var liveCells = this.state.liveCells;
                var r1 = sel.r1, c1 = sel.c1, r2 = sel.r2, c2 = sel.c2;
                var cells = [];
                for(var r = r1; r <= r2; r++){
                    for(var c = c1; c <= c2; c++){
                        if(liveCells.has(r + ',' + c)){
                            cells.push([r - r1, c - c1]);
                        }
                    }
                }
                this.setState({clipboard: cells});
            },

            pasteAsPattern : function(){
                if(!this.state.clipboard || this.state.clipboard.length === 0){ return; }
                PATTERNS['Clipboard'] = this.state.clipboard;
                this._previewPos = null;
                var self = this;
                this.setState({selectedPattern: 'Clipboard', patternRotation: 0,
                               drawMode: 'paint', selection: null},
                    function(){ self.drawBoard(); });
            },

            deleteSelection : function(){
                var sel = this.state.selection;
                if(!sel){ return; }
                this.pushUndo();
                var newLiveCells = new Map(this.state.liveCells);
                var r1 = sel.r1, c1 = sel.c1, r2 = sel.r2, c2 = sel.c2;
                for(var r = r1; r <= r2; r++){
                    for(var c = c1; c <= c2; c++){
                        newLiveCells.delete(r + ',' + c);
                    }
                }
                this._minimapDirty = true;
                var self = this;
                this.setState({liveCells: newLiveCells, stable: false},
                    function(){ self.drawBoard(); });
            },

            clearSelection : function(){
                var self = this;
                this.setState({selection: null, drawMode: 'paint'},
                    function(){ self.drawBoard(); });
            },

            toggleSelectMode : function(){
                if(this.state.drawMode === 'select'){
                    this.clearSelection();
                } else {
                    var self = this;
                    this.setState({drawMode: 'select', selectedPattern: null},
                        function(){ self.drawBoard(); });
                }
            },

            toggleMinimap : function(){
                var self = this;
                this.setState({showMinimap: !this.state.showMinimap}, function(){ self.drawBoard(); });
            },

            // ── GIF recording ─────────────────────────────────────────────────

            toggleRecording : function(){
                if(this.state.recording){
                    // Stop recording and render.
                    if(this._gif){ this._gif.render(); }
                    this.setState({recording: false});
                } else {
                    // Start recording (requires gif.js loaded).
                    if(typeof GIF === 'undefined'){
                        alert('gif.js is not loaded. Add it to index.html to enable GIF export.');
                        return;
                    }
                    var delay = Math.max(20, SPEED_DELAYS[this.state.speed - 1] || 50);
                    var self = this;
                    this._gif = new GIF({
                        workers:   2,
                        quality:   10,
                        workerScript: 'js/gif.worker.js'
                    });
                    this._gif.on('finished', function(blob){
                        var url  = URL.createObjectURL(blob);
                        var link = document.createElement('a');
                        link.href = url;
                        link.download = 'life-gen' + self.state.generations + '.gif';
                        link.click();
                        setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
                        self._gif = null;
                    });
                    this.setState({recording: true});
                }
            },

            // ── Touch support ─────────────────────────────────────────────────

            onTouchStart : function(event){
                event.preventDefault();
                var t = event.touches[0];
                this.onMouseDown({preventDefault: function(){}, button: 0,
                    clientX: t.clientX, clientY: t.clientY});
            },

            onTouchMove : function(event){
                event.preventDefault();
                var t = event.touches[0];
                this.onMouseMove({clientX: t.clientX, clientY: t.clientY});
            },

            onTouchEnd : function(event){
                event.preventDefault();
                this.onMouseUp();
            },

            // ── Keyboard ──────────────────────────────────────────────────────

            handleKeyDown : function(e){
                if(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].indexOf(e.target.tagName) !== -1){ return; }
                var self = this;
                switch(e.key){
                    case ' ':
                        e.preventDefault();
                        this.toggleGame();
                        break;
                    case '.':
                        e.preventDefault();
                        this.stepGame();
                        break;
                    case 'r': case 'R':
                        this.resetGame();
                        break;
                    case 'e': case 'E':
                        this.emptyBoard();
                        break;
                    case 'z': case 'Z':
                        if(e.ctrlKey || e.metaKey){ e.preventDefault(); this.undo(); }
                        break;
                    case 'c': case 'C':
                        if((e.ctrlKey || e.metaKey) && this.state.selection){
                            e.preventDefault(); this.copySelection();
                        }
                        break;
                    case 'v': case 'V':
                        if((e.ctrlKey || e.metaKey) && this.state.clipboard){
                            e.preventDefault(); this.pasteAsPattern();
                        }
                        break;
                    case 'Delete': case 'Backspace':
                        if(this.state.selection){ this.deleteSelection(); }
                        break;
                    case 's': case 'S':
                        if(!e.ctrlKey && !e.metaKey){ this.exportPNG(); }
                        break;
                    case 'x': case 'X':
                        if(!e.ctrlKey && !e.metaKey){ this.copyRLE(); }
                        break;
                    case 'f': case 'F':
                        this.fitView();
                        break;
                    case '[':
                        if(this.state.selectedPattern){ this.rotateCCW(); }
                        break;
                    case ']':
                        if(this.state.selectedPattern){ this.rotateCW(); }
                        break;
                    case 'ArrowLeft':
                        e.preventDefault(); this.pan(-5, 0);
                        break;
                    case 'ArrowRight':
                        e.preventDefault(); this.pan(5, 0);
                        break;
                    case 'ArrowUp':
                        e.preventDefault(); this.pan(0, -5);
                        break;
                    case 'ArrowDown':
                        e.preventDefault(); this.pan(0, 5);
                        break;
                    case 'Escape':
                        if(this.state.selection){ this.clearSelection(); break; }
                        if(this.state.selectedPattern){
                            this._previewPos = null;
                            this.setState({selectedPattern : null, patternRotation : 0},
                                function(){ self.drawBoard(); });
                            break;
                        }
                        if(this.state.showHelp){
                            this.setState({showHelp : false});
                        }
                        break;
                    case '?':
                        this.toggleHelp();
                        break;
                    case 'm': case 'M':
                        this.toggleMinimap();
                        break;
                }
            },

            // ── Toggles ───────────────────────────────────────────────────────

            toggleClickMode : function(){
                this.setState({liveClickMode : !this.state.liveClickMode});
            },

            toggleGridLines : function(){
                var self = this;
                this.setState({gridLines : !this.state.gridLines}, function(){
                    self.drawBoard();
                });
            },

            toggleBoundary : function(){
                this.setState({boundary : this.state.boundary === 'toroidal' ? 'finite' : 'toroidal'});
            },

            toggleGame : function(){
                if(this.state.running){
                    this.setState({running : false});
                } else {
                    this._prevBoardHash = null;
                    this._stableCount = 0;
                    this.setState({running : true, stable : false});
                    this._startLoop();
                }
            },

            // ── Sliders ───────────────────────────────────────────────────────

            resizeBoard : function(newCols, newRows){
                // Keep only cells that still fall within the new bounds.
                var oldLiveCells = this.state.liveCells;
                var newLiveCells = new Map();
                oldLiveCells.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    var kr = parseInt(key.substring(0, comma));
                    var kc = parseInt(key.substring(comma + 1));
                    if(kr < newRows && kc < newCols){ newLiveCells.set(key, age); }
                });
                var clamped = this.clampView(
                    this.state.viewX, this.state.viewY, newCols, newRows, this.state.cellSize);
                this._minimapDirty = true;
                var self = this;
                this.setState({
                    cols :        newCols,
                    rows :        newRows,
                    pendingCols : newCols,
                    pendingRows : newRows,
                    liveCells :   newLiveCells,
                    viewX :       clamped.viewX,
                    viewY :       clamped.viewY,
                    selection :   null
                }, function(){ self.drawBoard(); });
            },

            setWidth : function(e){
                var self = this;
                this.setState({pendingCols : parseInt(e.target.value)}, function(){
                    self.drawBoard();
                });
            },

            applyWidth : function(){
                this.resizeBoard(this.state.pendingCols, this.state.rows);
            },

            onWidthKeyDown : function(e){
                if(e.key === 'Enter'){ this.applyWidth(); }
            },

            setHeight : function(e){
                var self = this;
                this.setState({pendingRows : parseInt(e.target.value)}, function(){
                    self.drawBoard();
                });
            },

            applyHeight : function(){
                this.resizeBoard(this.state.cols, this.state.pendingRows);
            },

            onHeightKeyDown : function(e){
                if(e.key === 'Enter'){ this.applyHeight(); }
            },

            setDensity : function(e){
                this.setState({sparseness : 9 - parseInt(e.target.value)});
            },

            setSpeed : function(e){
                this.setState({speed : parseInt(e.target.value)});
            },

            // ── Rules ─────────────────────────────────────────────────────────

            parseRuleString : function(val){
                var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
                if(!match){ return null; }
                return {
                    birth :   match[1].split('').filter(Boolean).map(Number),
                    survive : match[2].split('').filter(Boolean).map(Number)
                };
            },

            setRule : function(e){
                var val = e.target.value;
                var parsed = this.parseRuleString(val);
                if(parsed){
                    this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                        ruleString : val, rulePreset : val.toUpperCase()});
                } else {
                    this.setState({ruleString : val, rulePreset : ''});
                }
            },

            setRulePreset : function(e){
                var rule = e.target.value;
                if(!rule){ return; }
                var parsed = this.parseRuleString(rule);
                if(parsed){
                    this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                        ruleString : rule, rulePreset : rule});
                }
            },

            // ── RLE import ────────────────────────────────────────────────────

            setRleInput : function(e){
                this.setState({rleInput : e.target.value, rleError : ''});
            },

            toggleRle : function(){
                this.setState({showRle : !this.state.showRle, rleError : ''});
            },

            loadRle : function(){
                var text = this.state.rleInput.trim();
                if(!text){ this.setState({rleError : 'Paste a pattern first.'}); return; }
                try {
                    // Auto-detect format: use RLE if text contains b/o/$  with a !
                    var isRle = /[bo\$]/.test(text) && /!/.test(text);
                    var result = isRle ? this.parseRLE(text) : this.parsePlaintext(text);
                    if(result.cells.length === 0){
                        this.setState({rleError : 'No live cells found in pattern.'}); return;
                    }
                    PATTERNS['Custom'] = result.cells;
                    var self = this;
                    this._previewPos = null;
                    this.setState({
                        selectedPattern : 'Custom',
                        patternRotation : 0,
                        showRle :         false,
                        rleError :        ''
                    }, function(){ self.drawBoard(); });
                } catch(ex){
                    this.setState({rleError : 'Could not parse pattern: ' + ex.message});
                }
            },

            // Parses standard RLE format into an array of [row, col] cell coordinates.
            parseRLE : function(text){
                var lines = text.split(/\r?\n/);
                var dataLines = lines.filter(function(l){ return l.charAt(0) !== '#'; });
                var headerIdx = -1;
                for(var i = 0; i < dataLines.length; i++){
                    if(/x\s*=/i.test(dataLines[i])){ headerIdx = i; break; }
                }
                var dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
                var data = dataLines.slice(dataStart).join('').replace(/\s/g, '');
                var cells = [];
                var row = 0, col = 0, countStr = '';
                for(var k = 0; k < data.length; k++){
                    var ch = data[k];
                    if(ch >= '0' && ch <= '9'){
                        countStr += ch;
                    } else if(ch === 'b' || ch === 'o'){
                        var n = countStr ? parseInt(countStr, 10) : 1;
                        if(ch === 'o'){
                            for(var j = 0; j < n; j++){ cells.push([row, col + j]); }
                        }
                        col += n;
                        countStr = '';
                    } else if(ch === '$'){
                        var n2 = countStr ? parseInt(countStr, 10) : 1;
                        row += n2;
                        col = 0;
                        countStr = '';
                    } else if(ch === '!'){
                        break;
                    }
                }
                return {cells : cells};
            },

            // Parses LifeWiki plaintext (.cells) format into [row, col] coordinates.
            parsePlaintext : function(text){
                var lines = text.split(/\r?\n/);
                var cells = [];
                var row = 0;
                for(var i = 0; i < lines.length; i++){
                    var line = lines[i];
                    if(line.charAt(0) === '!' || line.charAt(0) === '#'){ continue; }
                    for(var col = 0; col < line.length; col++){
                        var ch = line.charAt(col);
                        if(ch === 'O' || ch === 'o' || ch === '*'){
                            cells.push([row, col]);
                        }
                    }
                    row++;
                }
                return {cells : cells};
            },

            // ── Patterns ──────────────────────────────────────────────────────

            rotatePattern : function(cells, steps){
                var result = cells.slice();
                for(var s = 0; s < steps; s++){
                    var maxR = 0;
                    for(var k = 0; k < result.length; k++){
                        if(result[k][0] > maxR){ maxR = result[k][0]; }
                    }
                    result = result.map(function(cell){
                        return [cell[1], maxR - cell[0]];
                    });
                }
                return result;
            },

            rotateCW : function(){
                var self = this;
                this.setState({patternRotation : (this.state.patternRotation + 1) % 4},
                    function(){ self.drawBoard(); });
            },

            rotateCCW : function(){
                var self = this;
                this.setState({patternRotation : (this.state.patternRotation + 3) % 4},
                    function(){ self.drawBoard(); });
            },

            selectPattern : function(e){
                var name = e.target.value || null;
                this._previewPos = null;
                var self = this;
                this.setState({selectedPattern : name, patternRotation : 0},
                    function(){ self.drawBoard(); });
            },

            placePattern : function(name, centerC, centerR){
                this.pushUndo();
                var pattern = this.rotatePattern(PATTERNS[name], this.state.patternRotation);
                var cols = this.state.cols;
                var rows = this.state.rows;
                var maxR = 0, maxC = 0;
                for(var k = 0; k < pattern.length; k++){
                    if(pattern[k][0] > maxR){ maxR = pattern[k][0]; }
                    if(pattern[k][1] > maxC){ maxC = pattern[k][1]; }
                }
                var offsetR = centerR - Math.floor(maxR / 2);
                var offsetC = centerC - Math.floor(maxC / 2);
                var newLiveCells = new Map(this.state.liveCells);
                for(var i = 0; i < pattern.length; i++){
                    var pr = pattern[i][0] + offsetR;
                    var pc = pattern[i][1] + offsetC;
                    if(pr >= 0 && pr < rows && pc >= 0 && pc < cols){
                        newLiveCells.set(pr + ',' + pc, 1);
                    }
                }
                this._previewPos = null;
                this._minimapDirty = true;
                var self = this;
                this.setState({liveCells: newLiveCells, stable: false}, function(){ self.drawBoard(); });
            },

            // ── Board actions ─────────────────────────────────────────────────

            emptyBoard : function(){
                this.pushUndo();
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._minimapDirty = true;
                var self = this;
                this.setState({running : false, generations : 0, liveCells : new Map(),
                    popHistory : [], stable : false}, function(){ self.drawBoard(); });
            },

            resetGame : function(){
                this.pushUndo();
                var newLiveCells = this.buildLiveCells(
                    this.state.cols, this.state.rows, this.state.sparseness);
                var wasRunning = this.state.running;
                this._tickId++;
                this._loopRunning = false;
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._minimapDirty = true;
                var self = this;
                this.setState({running : false, generations : 0, liveCells : newLiveCells,
                    popHistory : [], stable : false}, function(){
                    self.drawBoard();
                    if(wasRunning){
                        self.setState({running : true}, function(){ self._startLoop(); });
                    }
                });
            },

            // ── Render ────────────────────────────────────────────────────────

            render : function(){
                var self = this;
                var population = this.state.liveCells.size;

                var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
                var delay = SPEED_DELAYS[this.state.speed - 1];
                var speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
                var hc = this.state.hoverCell;
                var coordText = hc ? ('Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r) : '\u2014';
                var gpsText = (this.state.running && this._measuredGps > 0)
                    ? this._measuredGps.toFixed(1) + '\u00a0gen/s' : null;

                // Build sparkline from population history.
                // The SVG uses a fixed viewBox (200×36) and width="100%" so it
                // scales to fill the sidebar without distorting the line height.
                // y maps population linearly into [2, 34] leaving 2px top padding.
                var sparkline = null;
                if(this.state.popHistory.length > 1){
                    var hist    = this.state.popHistory;
                    var maxPop  = Math.max.apply(null, hist);
                    if(maxPop === 0){ maxPop = 1; }
                    var vbW = 200, vbH = 36, padT = 2, innerH = vbH - padT * 2;
                    var sparkPts = hist.map(function(p, idx){
                        var x = hist.length === 1 ? vbW / 2 : (idx / (hist.length - 1)) * vbW;
                        var y = padT + (1 - p / maxPop) * innerH;
                        return x.toFixed(1) + ',' + y.toFixed(1);
                    }).join(' ');
                    sparkline = (
                        <div className="sparkline-wrap">
                            <div className="sparkline-header">
                                <span className="sparkline-title">Population</span>
                                <span className="sparkline-peak">{maxPop}</span>
                            </div>
                            <svg className="sparkline" width="100%" height={vbH}
                                 viewBox={"0 0 " + vbW + " " + vbH}
                                 preserveAspectRatio="none">
                                <line x1="0" y1={vbH - 0.5} x2={vbW} y2={vbH - 0.5}
                                      stroke="rgba(244,233,225,0.25)" strokeWidth="1"/>
                                <line x1="0" y1={padT + innerH / 2} x2={vbW} y2={padT + innerH / 2}
                                      stroke="rgba(244,233,225,0.1)" strokeWidth="0.5"/>
                                <polyline points={sparkPts} fill="none" stroke="#70959A"
                                          strokeWidth="1.5" strokeLinejoin="round"
                                          strokeLinecap="round"/>
                            </svg>
                            <div className="sparkline-footer">
                                <span>0</span>
                                <span>{hist.length + " gen"}</span>
                            </div>
                        </div>
                    );
                }

                // Build categorised pattern dropdown, filtered by patternFilter.
                var filterLc = this.state.patternFilter.toLowerCase();
                var patternOptions = Object.keys(PATTERN_GROUPS).map(function(group){
                    var names = Object.keys(PATTERN_GROUPS[group]).filter(function(name){
                        return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
                    });
                    if(names.length === 0){ return null; }
                    var opts = names.map(function(name){
                        var meta = PATTERN_META[name];
                        var title = '';
                        if(meta){
                            if(meta.type === 'Still life'){
                                title = 'Still life \xB7 ' + meta.cells + ' cells';
                            } else if(meta.type === 'Oscillator'){
                                title = 'Oscillator \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
                            } else if(meta.type === 'Spaceship'){
                                title = 'Spaceship \xB7 Period\u00a0' + meta.period +
                                    (meta.note ? ' \xB7 ' + meta.note : '');
                            } else if(meta.type === 'Methuselah'){
                                title = 'Methuselah \xB7 ' + meta.lifespan + '\u00a0gen lifespan \xB7 ' + meta.cells + ' cells';
                            } else if(meta.type === 'Gun'){
                                title = 'Gun \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
                            }
                        }
                        return <option key={name} value={name} title={title}>{name}</option>;
                    });
                    return <optgroup key={group} label={group}>{opts}</optgroup>;
                }).filter(function(x){ return x !== null; });
                if(PATTERNS['Custom']){
                    patternOptions = patternOptions.concat(
                        <optgroup key="custom" label="Custom">
                            <option value="Custom">Custom</option>
                        </optgroup>
                    );
                }

                return (
                    <div>
                        {this.state.showHelp &&
                            <div className="help-overlay" onClick={this.toggleHelp}>
                                <div className="help-modal" onClick={function(e){ e.stopPropagation(); }}>
                                    <h3 className="help-title">Keyboard Shortcuts</h3>
                                    <table className="help-table">
                                        <tbody>
                                            <tr><td>Space</td><td>Play / Pause</td></tr>
                                            <tr><td>.</td><td>Step one generation</td></tr>
                                            <tr><td>R</td><td>Reset (random fill)</td></tr>
                                            <tr><td>E</td><td>Empty board</td></tr>
                                            <tr><td>Ctrl+Z</td><td>Undo</td></tr>
                                            <tr><td>S</td><td>Export PNG</td></tr>
                                            <tr><td>X</td><td>Copy board as RLE</td></tr>
                                            <tr><td>F</td><td>Fit live cells in view</td></tr>
                                            <tr><td>Wheel</td><td>Zoom in / out</td></tr>
                                            <tr><td>Arrows</td><td>Pan viewport</td></tr>
                                            <tr><td>[</td><td>Rotate pattern CCW</td></tr>
                                            <tr><td>]</td><td>Rotate pattern CW</td></tr>
                                            <tr><td>Ctrl+C</td><td>Copy selection</td></tr>
                                            <tr><td>Ctrl+V</td><td>Paste selection</td></tr>
                                            <tr><td>Del</td><td>Delete selection</td></tr>
                                            <tr><td>Esc</td><td>Cancel / close</td></tr>
                                            <tr><td>M</td><td>Toggle minimap</td></tr>
                                            <tr><td>?</td><td>Show / hide this help</td></tr>
                                        </tbody>
                                    </table>
                                    <button className="btn help-close" onClick={this.toggleHelp}>Close</button>
                                </div>
                            </div>
                        }
                        <h2 className="top">Conway's Game of Life</h2>
                        <div className="content-body">
                            <div className={"canvas-container" + (this.state.boundary === 'toroidal' ? " boundary-wrap" : "")}>
                                <canvas className="display"
                                    width  = {Math.min(this.state.pendingCols * this.state.cellSize, 800)}
                                    height = {Math.min(this.state.pendingRows * this.state.cellSize, 600)}
                                    id = "life-canvas"
                                    draggable     = {false}
                                    onMouseDown   = {this.onMouseDown}
                                    onMouseMove   = {this.onMouseMove}
                                    onMouseUp     = {this.onMouseUp}
                                    onMouseLeave  = {this.onMouseLeave}
                                    onContextMenu = {this.onContextMenu}
                                    onTouchStart  = {this.onTouchStart}
                                    onTouchMove   = {this.onTouchMove}
                                    onTouchEnd    = {this.onTouchEnd}></canvas>
                            </div>
                            <div className="sidebar">
                                <div className="stats">
                                    <div className="stat-row">
                                        <span>{"Gen: " + this.state.generations}</span>
                                        <span className="board-dims">{this.state.cols + " \xD7 " + this.state.rows}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span>{"Pop: " + population}</span>
                                        {gpsText && <span className="gps-display">{gpsText}</span>}
                                    </div>
                                    <div className="coord-display">{coordText}</div>
                                    <div className="status-badges">
                                        <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                            {this.state.running ? "Running" : "Paused"}
                                        </span>
                                        {this.state.stable &&
                                            <span className="status-indicator status-stable">Stable</span>
                                        }
                                    </div>
                                    {sparkline}
                                </div>

                                <div className="btn-section">
                                    <div className="buttons">
                                        <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame}>{this.state.running ? "Pause" : "Play"}</button>
                                        <button className="btn" onClick={this.stepGame}>Step</button>
                                        <button className="btn" onClick={this.resetGame}>Reset</button>
                                        <button className="btn" onClick={this.emptyBoard}>Empty</button>
                                        <button className="btn" onClick={this.undo}>Undo</button>
                                        <button className="btn" onClick={this.fitView}>Fit</button>
                                        <button className="btn" onClick={this.exportPNG}>Export PNG</button>
                                        <button className="btn" onClick={this.copyRLE}>Copy RLE</button>
                                    </div>
                                    <div className="buttons buttons-secondary">
                                        <button className={"btn btn-toggle" + (this.state.liveClickMode ? " active" : "")} onClick={this.toggleClickMode}>{this.state.liveClickMode ? "Draw: On" : "Draw: Off"}</button>
                                        <button className={"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick={this.toggleGridLines}>Grid</button>
                                        <button className={"btn btn-toggle" + (this.state.boundary === 'finite' ? " active" : "")} onClick={this.toggleBoundary}>{this.state.boundary === 'toroidal' ? "Wrap" : "Dead"}</button>
                                        <button className={"btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : "")} onClick={this.toggleSelectMode}>Select</button>
                                        <button className={"btn btn-toggle" + (this.state.showMinimap ? " active" : "")} onClick={this.toggleMinimap}>Map</button>
                                        <button className={"btn btn-toggle" + (this.state.recording ? " active btn-record" : "")} onClick={this.toggleRecording}>{this.state.recording ? "Stop GIF" : "Rec GIF"}</button>
                                        <button className="btn" onClick={this.toggleHelp}>Help</button>
                                    </div>
                                </div>

                                <div className="presets-col">
                                    <select className="rule-preset-select"
                                        value={this.state.rulePreset}
                                        onChange={this.setRulePreset}>
                                        <option value="">Rule preset...</option>
                                        {RULE_PRESETS.map(function(p){
                                            return <option key={p.rule} value={p.rule}>{p.name}</option>;
                                        })}
                                    </select>
                                    <select className="rule-preset-select"
                                        value={this.state.theme}
                                        onChange={this.setTheme}>
                                        {Object.keys(THEMES).map(function(t){
                                            return <option key={t} value={t}>{t}</option>;
                                        })}
                                    </select>
                                    <label className="slider-title rule-label">Rule (B/S notation)</label>
                                    <input className={"rule-input" + (ruleValid ? "" : " rule-input-invalid")}
                                        type="text"
                                        value={this.state.ruleString}
                                        onChange={this.setRule}
                                        title="Birth/Survival rule string (e.g. B3/S23)" />
                                    <input className="pattern-filter-input"
                                        type="text"
                                        placeholder="Filter patterns..."
                                        value={this.state.patternFilter}
                                        onChange={function(e){ self.setState({patternFilter: e.target.value}); }} />
                                    <select className={"preset-select" + (this.state.selectedPattern ? " active" : "")}
                                        value={this.state.selectedPattern || ""}
                                        onChange={this.selectPattern}>
                                        <option value="">Draw mode</option>
                                        {patternOptions}
                                    </select>
                                </div>

                                {this.state.selectedPattern &&
                                    <div className="rotation-row">
                                        <canvas className="rotation-preview"
                                            width="96" height="96"
                                            ref={function(c){ self._previewCanvas = c; }} />
                                        <div className="rotation-btns">
                                            <button className="btn btn-rotate" onClick={this.rotateCCW} title="Rotate 90° counter-clockwise">&#8634;</button>
                                            <button className="btn btn-rotate" onClick={this.rotateCW}  title="Rotate 90° clockwise">&#8635;</button>
                                        </div>
                                    </div>
                                }
                                {this.state.selectedPattern &&
                                    <p className="placement-hint">
                                        {"Click canvas to place \xB7 " + this.state.selectedPattern}
                                        <br/>
                                        <span className="placement-hint-sub">Right-click or Esc to cancel</span>
                                    </p>
                                }

                                <div className="sliders">
                                    <label className="slider-title">{"Width: " + this.state.pendingCols}</label>
                                    <div className="slider-row">
                                        <input type="range" min="20" max="400" step="10"
                                            value={this.state.pendingCols}
                                            onChange={this.setWidth}
                                            onMouseUp={this.applyWidth}
                                            onKeyDown={this.onWidthKeyDown}
                                            onTouchEnd={this.applyWidth} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">{"Height: " + this.state.pendingRows}</label>
                                    <div className="slider-row">
                                        <input type="range" min="20" max="400" step="10"
                                            value={this.state.pendingRows}
                                            onChange={this.setHeight}
                                            onMouseUp={this.applyHeight}
                                            onKeyDown={this.onHeightKeyDown}
                                            onTouchEnd={this.applyHeight} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">Density (on Reset)</label>
                                    <div className="slider-row">
                                        <input type="range" min="2" max="7"
                                            value={9 - this.state.sparseness}
                                            onChange={this.setDensity} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">{"Speed: " + speedLabel}</label>
                                    <div className="slider-row">
                                        <input type="range" min="1" max="10"
                                            value={this.state.speed}
                                            onChange={this.setSpeed} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">{"Zoom: " + this.state.cellSize + "\u00a0px/cell"}</label>
                                    <div className="slider-row">
                                        <input type="range" min="2" max="32" step="2"
                                            value={this.state.cellSize}
                                            onChange={this.setZoom} />
                                    </div>
                                </div>

                                <div className="rle-section">
                                    <div className="buttons rle-toggle-row">
                                        <button className={"btn btn-rle-toggle btn-block" + (this.state.showRle ? " active" : "")}
                                            onClick={this.toggleRle}>Import RLE / Plaintext</button>
                                    </div>
                                    {this.state.showRle &&
                                        <div className="rle-body">
                                            <textarea className="rle-input"
                                                rows="5"
                                                placeholder={"Paste RLE or plaintext pattern\n(from LifeWiki or Golly)"}
                                                value={this.state.rleInput}
                                                onChange={this.setRleInput} />
                                            <button className="btn btn-block" onClick={this.loadRle}>Load pattern</button>
                                            {this.state.rleError &&
                                                <p className="rle-error">{this.state.rleError}</p>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});
