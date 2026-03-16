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
                           [3,0],[3,1],[3,5],[3,6]],
        // Period-8 oscillator — two interacting traffic lights.
        'Figure eight':   [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],
                           [3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5]],
        // Period-30 oscillator — two queen bees shuttling.
        'Queen Bee Shuttle':[[0,9],[1,7],[1,9],[2,6],[2,8],[3,0],[3,1],[3,5],[3,10],[3,20],[3,21],[4,0],[4,1],[4,6],[4,10],[4,20],[4,21],[5,7],[5,9],[6,9]]
    },
    'Spaceships': {
        'Glider': [[0,1],[1,2],[2,0],[2,1],[2,2]],
        // Lightweight spaceship — moves horizontally.
        'LWSS':   [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
        // Middleweight spaceship.
        'MWSS':   [[0,3],[1,1],[1,5],[2,0],[3,0],[3,5],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // Heavyweight spaceship.
        'HWSS':   [[0,3],[0,4],[1,1],[1,6],[2,0],[3,0],[3,6],[4,0],[4,1],[4,2],[4,3],[4,4],[4,5]],
        // Loafer: c/7 orthogonal spaceship, discovered 2013.
        'Loafer': [[0,1],[0,2],[0,5],[0,7],[0,8],[1,0],[1,3],[1,6],[1,7],[2,1],[2,3],[3,2],[4,8],[5,6],[5,7],[5,8],[6,5],[7,6],[8,7],[8,8]],
        // Copperhead: c/10 orthogonal spaceship, discovered 2016.
        'Copperhead': [[0,1],[0,2],[0,5],[0,6],[1,3],[1,4],[2,3],[2,4],[3,0],[3,2],[3,5],[3,7],[4,0],[4,7],[6,0],[6,7],[7,1],[7,2],[7,5],[7,6],[8,2],[8,3],[8,4],[8,5],[10,3],[10,4],[11,3],[11,4]]
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
        'Herschel':     [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2],[3,2]],
        // Rabbits: stabilises after 17,331 generations with 1,744 cells.
        'Rabbits':      [[0,0],[0,4],[0,5],[0,6],[1,0],[1,1],[1,2],[1,5],[2,1]]
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
    'Figure eight':        { type: 'Oscillator',  period: 8,  cells: 18 },
    'Queen Bee Shuttle':   { type: 'Oscillator',  period: 30, cells: 20 },
    'Glider':              { type: 'Spaceship',   period: 4,  cells: 5,  note: 'c/4 diagonal' },
    'LWSS':                { type: 'Spaceship',   period: 4,  cells: 9,  note: 'c/2 orthogonal' },
    'MWSS':                { type: 'Spaceship',   period: 4,  cells: 11, note: 'c/2 orthogonal' },
    'HWSS':                { type: 'Spaceship',   period: 4,  cells: 13, note: 'c/2 orthogonal' },
    'Loafer':              { type: 'Spaceship',   period: 7,  cells: 20, note: 'c/7 orthogonal' },
    'Copperhead':          { type: 'Spaceship',   period: 10, cells: 28, note: 'c/10 orthogonal' },
    'R-pentomino':         { type: 'Methuselah',  lifespan: 1103, cells: 5 },
    'Acorn':               { type: 'Methuselah',  lifespan: 5206, cells: 7 },
    'Diehard':             { type: 'Methuselah',  lifespan: 130,  cells: 7 },
    'Pi heptomino':        { type: 'Methuselah',  lifespan: 173,  cells: 7 },
    'Thunderbird':         { type: 'Methuselah',  lifespan: 243,  cells: 6 },
    'Herschel':            { type: 'Methuselah',  lifespan: 128,  cells: 7 },
    'Rabbits':             { type: 'Methuselah',  lifespan: 17331, cells: 9 },
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

// ── Age overlay for HashLife ──────────────────────────────────────────────────
// Computes cell ages by diffing old Map (key→age) against new cell list [[r,c],...].
function overlayAges(oldLiveCells, newCellList) {
    var newMap = new Map();
    for (var i = 0; i < newCellList.length; i++) {
        var key = newCellList[i][0] + ',' + newCellList[i][1];
        var oldAge = oldLiveCells.get(key);
        newMap.set(key, oldAge !== undefined ? Math.min(oldAge + 1, 65535) : 1);
    }
    return newMap;
}

// ── SimEngine ─────────────────────────────────────────────────────────────────
// Pure simulation functions isolated from React state for testability and reuse.
var SimEngine = {

    // Returns a sparse Map keyed by "r,c" with value = age.
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

    // Async version of buildLiveCells for large boards (> 250K cells).
    // Yields to the browser via setTimeout every ~50K cells to prevent UI freeze.
    buildLiveCellsAsync : function(cols, rows, sparseness, callback){
        var map = new Map();
        var r = 0;
        var CHUNK = Math.max(1, Math.floor(50000 / cols));
        function doChunk(){
            var end = Math.min(r + CHUNK, rows);
            for(; r < end; r++){
                for(var c = 0; c < cols; c++){
                    if(Math.random() < (1 / sparseness)){
                        map.set(r + ',' + c, 1);
                    }
                }
            }
            if(r < rows){ setTimeout(doChunk, 0); }
            else { callback(map); }
        }
        doChunk();
    },

    // Returns bounding box {minR, maxR, minC, maxC} of live cells, or null if empty.
    getBoundingBox : function(liveCells){
        if(liveCells.size === 0) return null;
        var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(age, key){
            var comma = key.indexOf(',');
            var r = parseInt(key.substring(0, comma));
            var c = parseInt(key.substring(comma + 1));
            if(r < minR) minR = r; if(r > maxR) maxR = r;
            if(c < minC) minC = c; if(c > maxC) maxC = c;
        });
        return {minR: minR, maxR: maxR, minC: minC, maxC: maxC};
    },

    // Returns next-generation sparse Map in O(k) where k = live cell count.
    computeNextGeneration : function(liveCells, cols, rows, birth, survive, boundary){
        var toroidal = boundary === 'toroidal';
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

    // Serialises live cells to RLE string (header + wrapped body).
    boardToRLE : function(liveCells, ruleString){
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
        var header = 'x = ' + W + ', y = ' + H + ', rule = ' + ruleString + '\n';
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

    // Parses standard RLE format into [[row, col], ...].
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
            } else if(ch === '!'){ break; }
        }
        var truncated = cells.length > 100000;
        if(truncated){ cells.length = 100000; }
        return {cells : cells, truncated: truncated};
    },

    // Parses LifeWiki plaintext (.cells) format into [[row, col], ...].
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
        var truncated = cells.length > 100000;
        if(truncated){ cells.length = 100000; }
        return {cells : cells, truncated: truncated};
    },

    // Parses Life 1.06 format: header "#Life 1.06", then one "x y" per live cell.
    parseLife106 : function(text){
        var lines = text.split(/\r?\n/);
        var cells = [];
        for(var i = 0; i < lines.length; i++){
            var line = lines[i].trim();
            if(line === '' || line.charAt(0) === '#'){ continue; }
            var parts = line.split(/\s+/);
            if(parts.length >= 2){
                var x = parseInt(parts[0], 10);
                var y = parseInt(parts[1], 10);
                if(!isNaN(x) && !isNaN(y)){
                    cells.push([y, x]); // Life 1.06 uses x,y; we store row,col
                }
            }
        }
        var truncated = cells.length > 100000;
        if(truncated){ cells.length = 100000; }
        return {cells : cells, truncated: truncated};
    },

    // Parses Life 1.05 format: header "#Life 1.05", #D descriptions, #P x y origin blocks.
    parseLife105 : function(text){
        var lines = text.split(/\r?\n/);
        var cells = [];
        var originX = 0, originY = 0;
        for(var i = 0; i < lines.length; i++){
            var line = lines[i];
            if(line.indexOf('#P') === 0){
                var parts = line.substring(2).trim().split(/\s+/);
                originX = parseInt(parts[0], 10) || 0;
                originY = parseInt(parts[1], 10) || 0;
                var rowOffset = 0;
                for(var j = i + 1; j < lines.length; j++){
                    var bline = lines[j];
                    if(bline.charAt(0) === '#' || bline.trim() === ''){ i = j - 1; break; }
                    for(var col = 0; col < bline.length; col++){
                        if(bline.charAt(col) === '*'){
                            cells.push([originY + rowOffset, originX + col]);
                        }
                    }
                    rowOffset++;
                    if(j === lines.length - 1){ i = j; }
                }
            }
        }
        // Normalize to non-negative coordinates.
        if(cells.length > 0){
            var minR = cells[0][0], minC = cells[0][1];
            for(var k = 1; k < cells.length; k++){
                if(cells[k][0] < minR){ minR = cells[k][0]; }
                if(cells[k][1] < minC){ minC = cells[k][1]; }
            }
            if(minR < 0 || minC < 0){
                for(var k2 = 0; k2 < cells.length; k2++){
                    cells[k2] = [cells[k2][0] - minR, cells[k2][1] - minC];
                }
            }
        }
        var truncated = cells.length > 100000;
        if(truncated){ cells.length = 100000; }
        return {cells : cells, truncated: truncated};
    },

    // Rotates a [[row,col],...] pattern 90° CW, `steps` times.
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
    }
};

document.addEventListener('DOMContentLoaded', function(){
    (function(){

        var LifeBoard = React.createClass({

            // ── Lifecycle ─────────────────────────────────────────────────────

            getInitialState : function(){
                var cellSize = 5;
                var cols = 100;
                var rows = 100;
                // Load persisted layout preferences from localStorage.
                // Schema v1: {layoutMode, railCollapsed, railTab, railSide, panelStates}
                var LAYOUT_SCHEMA_VERSION = 1;
                var savedLayout = {};
                try {
                    var raw = localStorage.getItem('life-layout-prefs');
                    if(raw){
                        var parsed = JSON.parse(raw);
                        // Validate schema version — if missing or mismatched, discard.
                        if(parsed && typeof parsed === 'object'){
                            // Validate layoutMode is a known value.
                            if(parsed.layoutMode && ['cartographer','specimen','observatory'].indexOf(parsed.layoutMode) !== -1){
                                savedLayout.layoutMode = parsed.layoutMode;
                            }
                            if(typeof parsed.railCollapsed === 'boolean'){
                                savedLayout.railCollapsed = parsed.railCollapsed;
                            }
                            if(parsed.railTab && ['simulate','tools','board','rules','export'].indexOf(parsed.railTab) !== -1){
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
                                for(var vi = 0; vi < validPanels.length; vi++){
                                    var pid = validPanels[vi];
                                    if(parsed.panelStates[pid] && typeof parsed.panelStates[pid] === 'object'){
                                        ps[pid] = {
                                            open: typeof parsed.panelStates[pid].open === 'boolean' ? parsed.panelStates[pid].open : true,
                                            x: typeof parsed.panelStates[pid].x === 'number' ? parsed.panelStates[pid].x : -1,
                                            y: typeof parsed.panelStates[pid].y === 'number' ? parsed.panelStates[pid].y : -1,
                                            collapsed: typeof parsed.panelStates[pid].collapsed === 'boolean' ? parsed.panelStates[pid].collapsed : false
                                        };
                                    } else {
                                        allValid = false;
                                        break;
                                    }
                                }
                                if(allValid){ savedLayout.panelStates = ps; }
                            }
                        }
                    }
                } catch(e){
                    // Corrupted localStorage — silently ignore, use defaults.
                    try { localStorage.removeItem('life-layout-prefs'); } catch(e2){}
                }

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
                    livePaintMode :  false,
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
                    selection :      null,
                    clipboard :      null,
                    showMinimap :     true,
                    recording :       false,
                    showMobileTools : false,
                    showTrails :      false,
                    darkModePref :    'system',
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
                    // Specimen state
                    contextTrayOpen :  false,
                    contextTrayContent: null,
                    contextTrayPinned: false,
                    // Observatory state
                    zenMode :          false,
                    _panelMenuOpen :   false,
                    panelStates :      savedLayout.panelStates || {
                        transport: { open: true, x: -1, y: -1, collapsed: false },
                        view:      { open: true, x: -1, y: -1, collapsed: false },
                        mode:      { open: true, x: -1, y: -1, collapsed: false },
                        tools:     { open: true, x: -1, y: -1, collapsed: false },
                        board:     { open: true, x: -1, y: -1, collapsed: false },
                        rules:     { open: true, x: -1, y: -1, collapsed: false },
                        stats:     { open: true, x: -1, y: -1, collapsed: false },
                        importExport: { open: false, x: -1, y: -1, collapsed: false }
                    },
                    // Responsive device class
                    deviceClass :      'desktop',
                    // Bottom sheet (phone modes)
                    bottomSheetOpen :  false,
                    bottomSheetClosing: false,
                    bottomSheetTab :   'simulate',
                    panMode :          false
                };
            },

            componentWillMount : function(){
                // Initialize instance properties accessed during render,
                // before the first render() call.
                this._genHistory = [];
                this._genHistoryMax = 200;
                this._genHistoryInterval = 1;
                this._genHistoryCounter = 0;
                this._trailMap = new Map();
                this._trailEnabled = false;
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
                this._lassoPath = [];
                this._drawToolStart = null;
                this._drawPreviewCells = [];
                this._drawErasing = false;
                this._panDragging = false;
                this._panStart = null;
                this._hlRoot = null;
                this._hlOffR = 0;
                this._hlOffC = 0;
                this._hlStale = true;
                this._hlRuleKey = null;
                this._gif = null;
                this._minimapDirty = true;
                this._minimapDragging = false;
                this._minimapCanvas = document.createElement('canvas');
                this._mobilePreviewCanvas = null;
                this._mobileMinimap = null;
                this._mmElemDragging = false;
                this._minimapCanvas.width  = 100;
                this._minimapCanvas.height = 75;
                this._pinchStart = null;
                this._longPressTimer = null;
                this._canvas = document.getElementById("life-canvas");
                // Attach wheel listener as non-passive so preventDefault works.
                this._canvas.addEventListener('wheel', this.onWheel, {passive: false});
                document.addEventListener('keydown', this.handleKeyDown);
                // Drag-and-drop file import (desktop).
                var canvasContainer = this._canvas.parentNode;
                this._onDragOver = function(e){ e.preventDefault(); e.stopPropagation(); canvasContainer.classList.add('drop-active'); };
                this._onDragLeave = function(e){ e.preventDefault(); e.stopPropagation(); canvasContainer.classList.remove('drop-active'); };
                this._onDrop = this._handleFileDrop.bind(this);
                canvasContainer.addEventListener('dragover', this._onDragOver);
                canvasContainer.addEventListener('dragleave', this._onDragLeave);
                canvasContainer.addEventListener('drop', this._onDrop);
                // Dark mode: respect system preference.
                this._darkModeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
                if(this._darkModeQuery){
                    var self2 = this;
                    this._onDarkModeChange = function(e){
                        if(self2.state.darkModePref === 'system'){
                            self2._applyDarkMode(e.matches);
                        }
                    };
                    try { this._darkModeQuery.addEventListener('change', this._onDarkModeChange); }
                    catch(ex){ try { this._darkModeQuery.addListener(this._onDarkModeChange); } catch(ex2){} }
                    // Apply initial dark mode state.
                    if(this.state.darkModePref === 'system'){
                        this._applyDarkMode(this._darkModeQuery.matches);
                    }
                }
                // Respond to viewport resize (throttled) to update canvas dimensions.
                var self = this;
                // Cache initial dimensions to filter out browser-chrome-only height changes on mobile.
                this._lastResizeW = window.innerWidth;
                this._lastResizeH = window.innerHeight;
                this._onResize = function(){
                    var newW = window.innerWidth;
                    var newH = window.innerHeight;
                    var widthChanged = Math.abs(newW - self._lastResizeW) > 10;
                    var heightBigChange = Math.abs(newH - self._lastResizeH) > 100;
                    // Ignore height-only changes < 100px (mobile browser chrome show/hide on scroll).
                    if(!widthChanged && !heightBigChange){ return; }
                    self._lastResizeW = newW;
                    self._lastResizeH = newH;
                    clearTimeout(self._resizeTimer);
                    self._resizeTimer = setTimeout(function(){ self.forceUpdate(function(){ self.drawBoard(); }); }, 120);
                };
                window.addEventListener('resize', this._onResize);
                // orientationchange fires before dimensions settle on iOS; use a longer debounce.
                this._onOrientationChange = function(){
                    clearTimeout(self._resizeTimer);
                    self._resizeTimer = setTimeout(function(){ self.forceUpdate(function(){ self.drawBoard(); }); }, 300);
                };
                window.addEventListener('orientationchange', this._onOrientationChange);
                // ── Device class detection via matchMedia ──────────────────
                var self3 = this;
                this._mqPhone = window.matchMedia('(max-width: 620px)');
                this._mqPhoneLandscape = window.matchMedia('(max-width: 900px) and (orientation: landscape) and (max-height: 500px)');
                this._mqTablet = window.matchMedia('(min-width: 621px) and (max-width: 900px)');
                this._mqLandscape = window.matchMedia('(orientation: landscape)');
                this._updateDeviceClass = function(){
                    var dc;
                    if(self3._mqPhone.matches){
                        dc = self3._mqLandscape.matches ? 'phone-landscape' : 'phone-portrait';
                    } else if(self3._mqPhoneLandscape.matches){
                        dc = 'phone-landscape';
                    } else if(self3._mqTablet.matches){
                        dc = 'tablet';
                    } else {
                        dc = 'desktop';
                    }
                    if(dc !== self3.state.deviceClass){
                        self3.setState({deviceClass: dc}, function(){ self3.drawBoard(); });
                    }
                };
                this._updateDeviceClass();
                try {
                    this._mqPhone.addEventListener('change', this._updateDeviceClass);
                    this._mqPhoneLandscape.addEventListener('change', this._updateDeviceClass);
                    this._mqTablet.addEventListener('change', this._updateDeviceClass);
                    this._mqLandscape.addEventListener('change', this._updateDeviceClass);
                } catch(ex){
                    try {
                        this._mqPhone.addListener(this._updateDeviceClass);
                        this._mqPhoneLandscape.addListener(this._updateDeviceClass);
                        this._mqTablet.addListener(this._updateDeviceClass);
                        this._mqLandscape.addListener(this._updateDeviceClass);
                    } catch(ex2){}
                }

                // ── Keyboard shortcut registry ──────────────────────────────
                this._shortcuts = {};
                this._registerCoreShortcuts();

                // Initialize HashLife engine with current rules.
                HashLife.init(this.state.birthRule, this.state.surviveRule);
                this._hlRuleKey = this.state.birthRule.join(',') + '/' + this.state.surviveRule.join(',');
                this.drawBoard();
                this._loadFromURLHash();
                this._startLoop();
            },

            componentDidUpdate : function(prevProps, prevState){
                if(prevState.selectedPattern !== this.state.selectedPattern ||
                   prevState.patternRotation !== this.state.patternRotation){
                    this.drawRotationPreview();
                }
            },

            // Compute canvas pixel dimensions that fit the device viewport.
            getCanvasSize : function(){
                var cellSize   = this.state.cellSize;
                var pendingCols = this.state.pendingCols;
                var pendingRows = this.state.pendingRows;
                var dc = this.state.deviceClass;
                var layout = this.state.layoutMode;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
                var maxW, maxH;

                if(typeof window === 'undefined'){
                    maxW = 846; maxH = 900;
                } else {
                    // In new layout modes, canvas fills the viewport.
                    // Reserve space for UI overlays.
                    var winW = window.innerWidth;
                    var winH = window.innerHeight;

                    if(layout === 'cartographer'){
                        // Desktop/tablet: subtract rail width if not collapsed/hidden
                        var railW = 0;
                        if(!isMobile && !this.state.railHidden){
                            railW = this.state.railCollapsed ? 40 : (dc === 'tablet' ? 200 : 240);
                        }
                        maxW = Math.max(1, winW - railW);
                        // Reserve space for transport strip at bottom
                        var transportH = isMobile ? 48 : 50;
                        maxH = Math.max(1, winH - transportH);
                    } else if(layout === 'specimen'){
                        maxW = winW;
                        // Reserve top bar height
                        var topBarH = 40;
                        maxH = Math.max(1, winH - topBarH);
                    } else if(layout === 'observatory'){
                        maxW = winW;
                        maxH = winH;
                    } else {
                        // Fallback: legacy mode
                        var contentPad = isMobile ? 24 : 40;
                        var sidebarW = isMobile ? 0 : (dc === 'tablet' ? 160 : 180) + 14;
                        maxW = Math.max(1, Math.min(winW, 1100) - contentPad - sidebarW);
                        var isMobileToolsOpen = isMobile && this.state.showMobileTools;
                        var hFrac = isMobile ? (isMobileToolsOpen ? 0.36 : 0.82) : 0.90;
                        maxH = Math.min(Math.round(winH * hFrac), 1400);
                    }
                }

                var isUnbounded = this.state.boundary === 'unbounded';
                var w, h;
                if(isUnbounded){
                    w = maxW;
                    h = maxH;
                } else {
                    w = Math.min(pendingCols * cellSize, maxW);
                    h = Math.min(pendingRows * cellSize, maxH);
                    var gridAspect = pendingCols / pendingRows;
                    if(w / h > gridAspect){
                        w = Math.max(1, Math.round(h * gridAspect));
                    } else if(h / w > 1 / gridAspect){
                        h = Math.max(1, Math.round(w / gridAspect));
                    }
                }
                var displayScale = isUnbounded ? 1 : ((w > 0 && h > 0) ? Math.min(maxW / w, maxH / h) : 1);
                var displayW = Math.round(w * displayScale);
                var displayH = Math.round(h * displayScale);
                return {w: w, h: h, displayW: displayW, displayH: displayH};
            },

            componentWillUnmount : function(){
                this._canvas.removeEventListener('wheel', this.onWheel);
                document.removeEventListener('keydown', this.handleKeyDown);
                window.removeEventListener('resize', this._onResize);
                window.removeEventListener('orientationchange', this._onOrientationChange);
                var container = this._canvas.parentNode;
                if(container){
                    container.removeEventListener('dragover', this._onDragOver);
                    container.removeEventListener('dragleave', this._onDragLeave);
                    container.removeEventListener('drop', this._onDrop);
                }
                if(this._gif){ this._gif.abort(); this._gif = null; }
            },

            // ── Drag-and-drop file import ──────────────────────────────────────

            _handleFileDrop : function(e){
                e.preventDefault();
                e.stopPropagation();
                var container = this._canvas.parentNode;
                container.classList.remove('drop-active');
                var files = e.dataTransfer && e.dataTransfer.files;
                if(!files || files.length === 0){ return; }
                var file = files[0];
                if(file.size > 500000){
                    this.setState({rleError: 'File too large (max 500 KB).'});
                    return;
                }
                var self = this;
                var reader = new FileReader();
                reader.onerror = function(){
                    self.setState({rleError: 'Unable to read file.'});
                };
                reader.onload = function(ev){
                    var text = ev.target.result;
                    // Strip non-printable control characters (keep tabs, newlines, CR).
                    text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
                    try {
                        var result;
                        if(/^#Life\s+1\.06/m.test(text)){
                            result = SimEngine.parseLife106(text);
                        } else if(/^#Life\s+1\.05/m.test(text)){
                            result = SimEngine.parseLife105(text);
                        } else if(/[bo\$]/.test(text) && /!/.test(text)){
                            result = SimEngine.parseRLE(text);
                        } else {
                            result = SimEngine.parsePlaintext(text);
                        }
                        if(result.cells.length === 0){
                            self.setState({rleError: 'No live cells found in file.'});
                            return;
                        }
                        PATTERNS['Custom'] = result.cells;
                        self._previewPos = null;
                        self.setState({
                            selectedPattern : 'Custom',
                            patternRotation : 0,
                            drawMode :        'preset',
                            showRle :         false,
                            rleError :        result.truncated ? 'Pattern truncated to 100,000 cells.' : ''
                        }, function(){ self.drawBoard(); });
                    } catch(ex){
                        self.setState({rleError: 'Could not parse file: ' + (ex.message || 'unknown error')});
                    }
                };
                reader.readAsText(file);
            },

            // ── Dark mode ──────────────────────────────────────────────────────

            _applyDarkMode : function(dark){
                var el = document.documentElement;
                if(dark){ el.classList.add('dark-mode'); }
                else { el.classList.remove('dark-mode'); }
            },

            setDarkModePref : function(e){
                var pref = e.target.value;
                var dark;
                if(pref === 'dark'){ dark = true; }
                else if(pref === 'light'){ dark = false; }
                else { dark = this._darkModeQuery && this._darkModeQuery.matches; }
                this._applyDarkMode(dark);
                this.setState({darkModePref: pref});
            },

            // ── Board construction ─────────────────────────────────────────────

            buildLiveCells : function(cols, rows, sparseness){
                return SimEngine.buildLiveCells(cols, rows, sparseness);
            },

            // ── Rendering ─────────────────────────────────────────────────────

            drawBoard : function(){
                var canvas = this._canvas;
                if(!canvas){ return; }
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
                var isUnbounded = this.state.boundary === 'unbounded';
                var startC = isUnbounded ? viewX : Math.max(0, viewX);
                var startR = isUnbounded ? viewY : Math.max(0, viewY);
                var endC   = isUnbounded ? viewX + Math.ceil(canvasW / cellSize) + 1 : Math.min(cols, viewX + Math.ceil(canvasW / cellSize) + 1);
                var endR   = isUnbounded ? viewY + Math.ceil(canvasH / cellSize) + 1 : Math.min(rows, viewY + Math.ceil(canvasH / cellSize) + 1);

                // Pre-compute color palette (64 steps from young to alive color).
                var aR = theme.aliveR, aG = theme.aliveG, aB = theme.aliveB;
                var yR = theme.youngR, yG = theme.youngG, yB = theme.youngB;
                var COLOR_STEPS = 63;
                var colorPalette = this._colorPalette;
                if(!colorPalette || this._paletteTheme !== this.state.theme){
                    colorPalette = new Array(COLOR_STEPS + 1);
                    for(var pi = 0; pi <= COLOR_STEPS; pi++){
                        var pt = pi / COLOR_STEPS;
                        colorPalette[pi] = 'rgb(' +
                            Math.round(yR + (aR - yR) * pt) + ',' +
                            Math.round(yG + (aG - yG) * pt) + ',' +
                            Math.round(yB + (aB - yB) * pt) + ')';
                    }
                    this._colorPalette = colorPalette;
                    this._paletteTheme = this.state.theme;
                }

                // Draw live cells: iterate live cells when sparse, viewport grid when dense.
                var viewArea = (endR - startR) * (endC - startC);
                if(liveCells.size < viewArea * 0.3){
                    // Sparse mode: iterate live cells, skip off-screen ones, batch by color.
                    var buckets = new Array(COLOR_STEPS + 1);
                    liveCells.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        var cr = parseInt(key.substring(0, comma));
                        var cc = parseInt(key.substring(comma + 1));
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
                    // Dense mode: iterate viewport grid.
                    for(var r = startR; r < endR; r++){
                        for(var c = startC; c < endC; c++){
                            var age = liveCells.get(r + ',' + c);
                            if(age !== undefined){
                                var ci2 = Math.min(Math.round(Math.min(age / 10, 1) * COLOR_STEPS), COLOR_STEPS);
                                ctx.fillStyle = colorPalette[ci2];
                                ctx.fillRect((c - viewX) * cellSize, (r - viewY) * cellSize, cellSize, cellSize);
                            }
                        }
                    }
                }

                // Cell trails (heat map).
                if(this._trailEnabled && this._trailMap.size > 0){
                    var trailMap = this._trailMap;
                    trailMap.forEach(function(val, key){
                        var comma = key.indexOf(',');
                        var tr = parseInt(key.substring(0, comma));
                        var tc = parseInt(key.substring(comma + 1));
                        if(tr >= startR && tr < endR && tc >= startC && tc < endC){
                            var alpha = (val / 20) * 0.35;
                            ctx.fillStyle = 'rgba(' + aR + ',' + aG + ',' + aB + ',' + alpha.toFixed(2) + ')';
                            ctx.fillRect((tc - viewX) * cellSize, (tr - viewY) * cellSize, cellSize, cellSize);
                        }
                    });
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

                // Selection overlay.
                var sel = this.state.selection;
                if(sel){
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
                        // Draw bounding box outline + shade cells inside ellipse.
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
                        // Draw lasso path as filled polygon (preview during drag and after).
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
                        // Shade each selected cell.
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
                }

                // Draw tool preview overlay (rubber-band tools).
                if(this._drawPreviewCells && this._drawPreviewCells.length > 0){
                    ctx.fillStyle = this._drawErasing
                        ? 'rgba(200,80,80,0.45)'
                        : 'rgba(' + aR + ',' + aG + ',' + aB + ',0.4)';
                    var dpCells = this._drawPreviewCells;
                    for(var di = 0; di < dpCells.length; di++){
                        var dpr = dpCells[di][0], dpc = dpCells[di][1];
                        if(isUnbounded || (dpr >= 0 && dpr < rows && dpc >= 0 && dpc < cols)){
                            ctx.fillRect((dpc-viewX)*cellSize, (dpr-viewY)*cellSize, cellSize, cellSize);
                        }
                    }
                }

                // Pattern placement preview.
                if(this.state.drawMode === 'preset' && this.state.selectedPattern && this._previewPos && PATTERNS[this.state.selectedPattern]){
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
                        if(isUnbounded || (pvR >= 0 && pvR < rows && pvC >= 0 && pvC < cols)){
                            ctx.fillRect((pvC - viewX) * cellSize, (pvR - viewY) * cellSize, cellSize, cellSize);
                        }
                    }
                }

                // Minimap overlay (bottom-right corner on desktop; separate element on mobile).
                var isMobileView = this.state.deviceClass === 'phone-portrait' || this.state.deviceClass === 'phone-landscape';
                if(this.state.showMinimap && (isUnbounded || (cols > 0 && rows > 0))){
                    if(isMobileView){
                        this.drawMinimapMobile(liveCells, cols, rows, viewX, viewY, cellSize, theme);
                    } else {
                        var cs2 = this.getCanvasSize();
                        var mmDisplayScale = (cs2.w > 0) ? cs2.displayW / cs2.w : 1;
                        this.drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, mmDisplayScale);
                    }
                }

                // GIF recording: capture frame.
                if(this.state.recording && this._gif){
                    this._gif.addFrame(ctx, {copy: true, delay: SPEED_DELAYS[this.state.speed - 1] || 50});
                }
            },

            drawMinimap : function(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale){
                // In unbounded mode, derive cols/rows from live cell bounding box.
                var isUnbounded = this.state.boundary === 'unbounded';
                var mmOriginR = 0, mmOriginC = 0;
                if(isUnbounded){
                    var bb = SimEngine.getBoundingBox(liveCells);
                    if(bb){
                        var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        mmOriginR = bb.minR - pad;
                        mmOriginC = bb.minC - pad;
                        rows = bb.maxR - bb.minR + 1 + pad * 2;
                        cols = bb.maxC - bb.minC + 1 + pad * 2;
                    } else {
                        // No live cells — show a tiny empty minimap.
                        mmOriginR = viewY - 50;
                        mmOriginC = viewX - 50;
                        rows = 100; cols = 100;
                    }
                }
                // Target a fixed CSS display size of ~160px for the minimap.
                // The buffer size is inversely proportional to displayScale so the CSS display size stays constant.
                var TARGET_CSS_SIZE = 160;
                var ds = (displayScale && displayScale > 0) ? displayScale : 1;
                var aspect = cols / rows;
                var mmW, mmH;
                if(aspect >= 1){
                    mmW = Math.max(100, Math.round(TARGET_CSS_SIZE / ds));
                    mmH = Math.max(40, Math.round(mmW / aspect));
                } else {
                    mmH = Math.max(100, Math.round(TARGET_CSS_SIZE / ds));
                    mmW = Math.max(40, Math.round(mmH * aspect));
                }
                // Resize the off-screen canvas if dimensions changed.
                if(this._minimapCanvas.width !== mmW || this._minimapCanvas.height !== mmH){
                    this._minimapCanvas.width  = mmW;
                    this._minimapCanvas.height = mmH;
                    this._minimapDirty = true;
                }
                // Express the margin in CSS-space pixels by scaling by 1/ds,
                // so the visual gap from the canvas corner stays ~6px at all zoom levels.
                var marginBuf = Math.max(1, Math.round(6 / ds));
                var mmX = canvasW - mmW - marginBuf, mmY = canvasH - mmH - marginBuf;

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
                    var _mmOC = mmOriginC, _mmOR = mmOriginR, _mmCols = cols, _mmRows = rows;
                    liveCells.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        var kr = parseInt(key.substring(0, comma)) - _mmOR;
                        var kc = parseInt(key.substring(comma + 1)) - _mmOC;
                        if(kr >= 0 && kr < _mmRows && kc >= 0 && kc < _mmCols){
                            mctx.fillRect(Math.floor(kc / _mmCols * mmW), Math.floor(kr / _mmRows * mmH), 1, 1);
                        }
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
                var vx1 = mmX + Math.round((viewX - mmOriginC) / cols * mmW);
                var vy1 = mmY + Math.round((viewY - mmOriginR) / rows * mmH);
                var vw  = Math.max(2, Math.round(visCols / cols * mmW));
                var vh  = Math.max(2, Math.round(visRows / rows * mmH));
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1;
                ctx.strokeRect(vx1 + 0.5, vy1 + 0.5, vw, vh);

                // Store minimap rect for click detection.
                this._minimapRect = {x: mmX, y: mmY, w: mmW, h: mmH};
            },

            drawRotationPreview : function(){
                if(!this.state.selectedPattern || !PATTERNS[this.state.selectedPattern]){ return; }
                var theme = THEMES[this.state.theme] || THEMES['Teal'];
                var pattern = this.rotatePattern(
                    PATTERNS[this.state.selectedPattern], this.state.patternRotation);
                var maxR = 0, maxC = 0;
                for(var i = 0; i < pattern.length; i++){
                    if(pattern[i][0] > maxR){ maxR = pattern[i][0]; }
                    if(pattern[i][1] > maxC){ maxC = pattern[i][1]; }
                }
                var patRows = maxR + 1, patCols = maxC + 1;
                var pad = 4;
                var drawOn = function(canvas){
                    if(!canvas){ return; }
                    var size   = canvas.width;
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
                };
                drawOn(this._previewCanvas);
                drawOn(this._mobilePreviewCanvas);
            },

            // ── Sparse generation logic ────────────────────────────────────────

            computeNextGeneration : function(liveCells, cols, rows, birth, survive, boundary){
                return SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
            },

            // ── HashLife step ────────────────────────────────────────────────────
            // Advances the HashLife quadtree by 1 generation and returns a new
            // sparse Map<"r,c", age> with diff-based age tracking.

            _hashLifeStep : function(liveCells, birth, survive){
                // 1. Init/re-init if rules changed
                var ruleKey = birth.join(',') + '/' + survive.join(',');
                if(ruleKey !== this._hlRuleKey){
                    HashLife.init(birth, survive);
                    this._hlRuleKey = ruleKey;
                    this._hlStale = true;
                }
                // 2. Rebuild quadtree from Map if stale
                if(this._hlStale || !this._hlRoot){
                    var cells = [];
                    liveCells.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        cells.push([parseInt(key.substring(0, comma)),
                                    parseInt(key.substring(comma + 1))]);
                    });
                    var tree = HashLife.fromCellList(cells);
                    this._hlRoot = tree.root;
                    this._hlOffR = tree.offR;
                    this._hlOffC = tree.offC;
                    this._hlStale = false;
                }
                // 3. Pre-expand until pattern has margin for growth, then expand+advance+trim
                while(HashLife.needsExpand(this._hlRoot)){
                    var lvl = this._hlRoot.level;
                    this._hlRoot = HashLife.expandTree(this._hlRoot);
                    this._hlOffR += (1 << (lvl - 1));
                    this._hlOffC += (1 << (lvl - 1));
                }
                var level = this._hlRoot.level;
                this._hlRoot = HashLife.expandTree(this._hlRoot);
                this._hlOffR += (1 << (level - 1));
                this._hlOffC += (1 << (level - 1));

                level = this._hlRoot.level;
                this._hlRoot = HashLife.advance(this._hlRoot, 1);
                this._hlOffR -= (1 << (level - 2));
                this._hlOffC -= (1 << (level - 2));

                var prevLevel = this._hlRoot.level;
                this._hlRoot = HashLife.trimTree(this._hlRoot);
                var newLevel = this._hlRoot.level;
                for(var lvl = prevLevel; lvl > newLevel; lvl--){
                    this._hlOffR -= (1 << (lvl - 2));
                    this._hlOffC -= (1 << (lvl - 2));
                }

                // 4. Extract cells and overlay ages
                var newCells = HashLife.toCellList(this._hlRoot, this._hlOffR, this._hlOffC);
                var result = overlayAges(liveCells, newCells);

                // 5. GC check
                if(HashLife.poolSize() > 2000000){
                    HashLife.gc(this._hlRoot);
                }
                return result;
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

                if(boundary !== 'toroidal'){
                    // HashLife path — compute on main thread.
                    var newLiveCells = this._hashLifeStep(liveCells, birth, survive);
                    if(boundary === 'finite'){
                        // Clip to grid bounds.
                        var clipped = new Map();
                        newLiveCells.forEach(function(age, key){
                            var comma = key.indexOf(',');
                            var r = parseInt(key.substring(0, comma));
                            var c = parseInt(key.substring(comma + 1));
                            if(r >= 0 && r < rows && c >= 0 && c < cols){
                                clipped.set(key, age);
                            }
                        });
                        newLiveCells = clipped;
                        this._hlStale = true; // tree must rebuild from clipped cells
                    }
                    this._applyNewStates(newLiveCells, tickId);
                } else {
                    // Toroidal fallback: SimEngine on main thread.
                    var newLiveCells2 = SimEngine.computeNextGeneration(
                        liveCells, cols, rows, birth, survive, boundary);
                    this._applyNewStates(newLiveCells2, tickId);
                }
            },

            // Called by the worker response handler and the sync path.
            _applyNewStates : function(newLiveCells, tickId){
                if(tickId !== this._tickId){ this._loopRunning = false; return; }

                // While the user is mid-stroke in Live Paint mode, merge the
                // cells being painted so they aren't erased by the incoming
                // generation (which was computed from the pre-stroke snapshot).
                if(this._dragging && this.state.livePaintMode){
                    var painted = this._paintedCells;
                    var hasPainted = false;
                    Object.keys(painted).forEach(function(k){
                        if(painted[k] === 1){ newLiveCells.set(k, 1); }
                        else { newLiveCells.delete(k); }
                        hasPainted = true;
                    });
                    if(hasPainted){ this._hlStale = true; }
                }

                // Cell trail tracking: record recently-dead cells.
                if(this._trailEnabled){
                    var trailMap = this._trailMap;
                    var prevCells = this.state.liveCells;
                    var TRAIL_MAX = 20;
                    // Cells that were alive but are now dead → add to trail.
                    prevCells.forEach(function(age, key){
                        if(!newLiveCells.has(key)){ trailMap.set(key, TRAIL_MAX); }
                    });
                    // Decay existing trail values.
                    var toDelete = [];
                    trailMap.forEach(function(val, key){
                        if(newLiveCells.has(key)){ toDelete.push(key); }
                        else {
                            var nv = val - 1;
                            if(nv <= 0){ toDelete.push(key); }
                            else { trailMap.set(key, nv); }
                        }
                    });
                    for(var ti = 0; ti < toDelete.length; ti++){ trailMap.delete(toDelete[ti]); }
                    // Cap trail map size for performance.
                    if(trailMap.size > 50000){
                        var excess = trailMap.size - 50000;
                        var iter = trailMap.keys();
                        for(var ei = 0; ei < excess; ei++){ trailMap.delete(iter.next().value); }
                    }
                }

                // Generation history snapshot for step-backward.
                this._pushGenHistory();

                // Stability detection via O(n) order-independent hash.
                var _h1 = 0, _h2 = 0, _hCount = 0;
                newLiveCells.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    var kr = parseInt(key.substring(0, comma));
                    var kc = parseInt(key.substring(comma + 1));
                    var paired = kr >= kc ? kr * kr + kr + kc : kc * kc + kr;
                    _h1 = (_h1 + paired) | 0;
                    _h2 = (_h2 ^ Math.imul(paired, 2654435761)) | 0;
                    _hCount++;
                });
                var boardHash = _hCount + '|' + _h1 + '|' + _h2;
                var isStable  = (boardHash === this._prevBoardHash);
                this._prevBoardHash = boardHash;
                this._stableCount = isStable ? this._stableCount + 1 : 0;
                var hitStable = this._stableCount >= 2;

                var newPop = newLiveCells.size;
                var newHistory = this.state.popHistory.concat([newPop]);
                if(newHistory.length > 10000){ newHistory = newHistory.slice(newHistory.length - 10000); }
                var newSessionPeak = Math.max(this.state.sessionPeakPop || 0, newPop);
                // Store last measured GPS so it persists briefly after pausing.
                this._gpsDisplayUntil = this._gpsDisplayUntil || 0;

                // Gen/sec tracking.
                var now = Date.now();
                this._genTimestamps.push(now);
                if(this._genTimestamps.length > 20){ this._genTimestamps.shift(); }
                if(this._genTimestamps.length >= 2){
                    var ts = this._genTimestamps;
                    var dt = ts[ts.length - 1] - ts[0];
                    if(dt > 0){ this._measuredGps = (ts.length - 1) / dt * 1000; }
                }
                // Keep GPS visible for 3 s after pausing.
                this._gpsDisplayUntil = now + 3000;

                this._minimapDirty = true;
                var self = this;
                var myTickId = tickId;
                this.setState({
                    liveCells :      newLiveCells,
                    generations :    this.state.generations + 1,
                    popHistory :     newHistory,
                    sessionPeakPop : newSessionPeak,
                    stable :         hitStable,
                    running :        hitStable ? false : this.state.running
                }, function(){
                    self.drawBoard();
                    if(hitStable){ self._loopRunning = false; return; }
                    var delay = SPEED_DELAYS[self.state.speed - 1];
                    setTimeout(function(){
                        requestAnimationFrame(function(){ self.findNewStates(myTickId); });
                    }, delay);
                });
            },

            stepGame : function(){
                this.pushUndo();
                this._pushGenHistory();
                var liveCells = this.state.liveCells;
                var cols      = this.state.cols;
                var rows      = this.state.rows;
                var birth     = this.state.birthRule;
                var survive   = this.state.surviveRule;
                var boundary  = this.state.boundary;
                var newLiveCells;
                if(boundary === 'toroidal'){
                    newLiveCells = SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
                } else {
                    newLiveCells = this._hashLifeStep(liveCells, birth, survive);
                    if(boundary === 'finite'){
                        var clipped = new Map();
                        newLiveCells.forEach(function(age, key){
                            var comma = key.indexOf(',');
                            var r = parseInt(key.substring(0, comma));
                            var c = parseInt(key.substring(comma + 1));
                            if(r >= 0 && r < rows && c >= 0 && c < cols){
                                clipped.set(key, age);
                            }
                        });
                        newLiveCells = clipped;
                        this._hlStale = true;
                    }
                }
                var newPop = newLiveCells.size;
                var newHistory = this.state.popHistory.concat([newPop]);
                if(newHistory.length > 10000){ newHistory = newHistory.slice(newHistory.length - 10000); }
                var newSessionPeakStep = Math.max(this.state.sessionPeakPop || 0, newPop);
                this._minimapDirty = true;
                var self = this;
                this.setState({
                    liveCells :      newLiveCells,
                    running :        false,
                    generations :    this.state.generations + 1,
                    popHistory :     newHistory,
                    sessionPeakPop : newSessionPeakStep,
                    stable :         false
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

            popUndo : function(){
                if(this._undoStack && this._undoStack.length > 0){
                    this._undoStack.pop();
                }
            },

            cancelDrawTool : function(){
                if(!this._drawToolStart){ return; }
                this._drawToolStart = null;
                this._drawPreviewCells = [];
                this.popUndo();
                this.drawBoard();
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
                this._hlStale = true;
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
                return SimEngine.boardToRLE(this.state.liveCells, this.state.ruleString);
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

            // ── URL sharing ──────────────────────────────────────────────────

            shareURL : function(){
                var rle = this.boardToRLE();
                if(!rle){ return; }
                // Build URL hash with compact parameters.
                var params = 'rle=' + encodeURIComponent(rle) +
                    '&cols=' + (this.state.boundary === 'unbounded' ? 200 : this.state.cols) +
                    '&rows=' + (this.state.boundary === 'unbounded' ? 200 : this.state.rows);
                if(this.state.ruleString !== 'B3/S23'){
                    params += '&rule=' + encodeURIComponent(this.state.ruleString);
                }
                // Check total length — use compression for large patterns if available.
                if(params.length > 4000){
                    // Too large for URL; fall back to copying RLE.
                    this.copyRLE();
                    return;
                }
                var url = window.location.origin + window.location.pathname + '#' + params;
                if(navigator.clipboard && navigator.clipboard.writeText){
                    navigator.clipboard.writeText(url);
                }
                // Brief visual feedback.
                var self = this;
                this.setState({shareTooltip: true});
                setTimeout(function(){ self.setState({shareTooltip: false}); }, 2000);
            },

            _loadFromURLHash : function(){
                var hash = window.location.hash;
                if(!hash || hash.length < 5){ return; }
                try {
                    var params = {};
                    hash.substring(1).split('&').forEach(function(pair){
                        var eq = pair.indexOf('=');
                        if(eq > 0){ params[decodeURIComponent(pair.substring(0, eq))] = decodeURIComponent(pair.substring(eq + 1)); }
                    });
                    if(!params.rle){ return; }
                    var cols = parseInt(params.cols) || 100;
                    var rows = parseInt(params.rows) || 100;
                    var rule = params.rule || 'B3/S23';
                    var parsed = this.parseRuleString(rule);
                    var result = SimEngine.parseRLE(params.rle);
                    if(result.cells.length === 0){ return; }
                    PATTERNS['Custom'] = result.cells;
                    var self = this;
                    var updates = {
                        cols: cols, rows: rows, pendingCols: cols, pendingRows: rows,
                        selectedPattern: 'Custom', patternRotation: 0, drawMode: 'preset',
                        ruleString: rule
                    };
                    if(parsed){
                        updates.birthRule = parsed.birth;
                        updates.surviveRule = parsed.survive;
                        updates.rulePreset = rule.toUpperCase();
                        this._hlStale = true;
                    }
                    this.setState(updates, function(){ self.drawBoard(); });
                    // Clear hash so reloads don't re-import.
                    if(history.replaceState){ history.replaceState(null, '', window.location.pathname); }
                } catch(ex){}
            },

            // ── Help modal ─────────────────────────────────────────────────────

            toggleHelp : function(){
                var opening = !this.state.showHelp;
                if(opening){ this._saveFocus(); }
                var self = this;
                this.setState({showHelp : opening}, function(){
                    if(opening){ self._focusFirst('.help-modal'); }
                    else { self._restoreFocus(); }
                });
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
                // In unbounded mode, allow unlimited panning.
                if(this.state.boundary === 'unbounded'){
                    return {viewX: Math.round(viewX), viewY: Math.round(viewY)};
                }
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
                // Click on minimap: pan viewport to that position (skip in select mode to allow selection to start there).
                if(event.button === 0 && this._minimapRect && this.state.showMinimap && this.state.drawMode !== 'select'){
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
                        this._minimapDragging = true;
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
                if(event.button === 2 && this.state.drawMode === 'preset' && this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0, drawMode : 'paint'},
                        function(){ self.drawBoard(); });
                    return;
                }
                if(event.button !== 0){ return; }
                var pos = this.getCellPos(event);
                var c = pos.c, r = pos.r;
                if(this.state.boundary !== 'unbounded' && (c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows)){ return; }

                // Selection mode: begin drag-select.
                if(this.state.drawMode === 'select'){
                    var selectTool = this.state.selectTool || 'rect';
                    if(selectTool === 'all-visible'){
                        this.selectAllVisible();
                        return;
                    }
                    this._selStart = {c : c, r : r};
                    this._lassoPath = [];
                    var selType = selectTool === 'ellipse' ? 'ellipse' : (selectTool === 'freeform' ? 'freeform' : 'rect');
                    var self2 = this;
                    this.setState({selection : {type: selType, c1: c, r1: r, c2: c, r2: r, path: [], cells: []}},
                        function(){ self2.drawBoard(); });
                    return;
                }

                // Pattern placement mode.
                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    if(!this.state.livePaintMode){ this.setState({running : false}); }
                    this.placePattern(this.state.selectedPattern, c, r);
                    return;
                }

                // Paint mode — handle draw tool subtypes.
                if(!this.state.livePaintMode){ this.setState({running : false}); }
                var drawTool = this.state.drawTool || 'cell';
                if(drawTool === 'fill'){
                    // Bidirectional flood fill: erase if starting on live cell, birth if dead.
                    var startAlive = this.state.liveCells.has(r + ',' + c);
                    this._drawErasing = startAlive;
                    this.pushUndo();
                    var fillCells = this.floodFillCells(c, r, this.state.liveCells, this.state.cols, this.state.rows, startAlive);
                    var self3 = this;
                    this._minimapDirty = true;
                    this._hlStale = true;
                    this.setState(function(prevState){
                        var newLiveCells = new Map(prevState.liveCells);
                        fillCells.forEach(function(rc){
                            if(startAlive){ newLiveCells.delete(rc[0]+','+rc[1]); }
                            else { newLiveCells.set(rc[0]+','+rc[1], 1); }
                        });
                        return {liveCells: newLiveCells, stable: false};
                    }, function(){ self3.drawBoard(); });
                    return;
                }
                if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                    // Rubber-band tools: start drag. Bidirectional based on start cell state.
                    this._drawErasing = this.state.liveCells.has(r + ',' + c);
                    this.pushUndo();
                    this._drawToolStart = {c: c, r: r};
                    this._drawPreviewCells = [[r, c]];
                    this.drawBoard();
                    return;
                }
                // Default: single-cell paint.
                var key = r + ',' + c;
                this.pushUndo();
                this._dragging = true;
                this._dragStatus = this.state.liveCells.has(key) ? 0 : 1;
                this._paintedCells = {};
                this._paintedCells[key] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseMove : function(event){
                // Pan drag (middle mouse button) — highest priority.
                if(this._panDragging && this._panStart){
                    var dx = event.clientX - this._panStart.x;
                    var dy = event.clientY - this._panStart.y;
                    var cellSize = this.state.cellSize;
                    // Account for CSS display scale: pan speed must match visual cell size.
                    var rect = this._canvas.getBoundingClientRect();
                    var displayCellSize = (rect.width > 0 && this._canvas.width > 0)
                        ? cellSize * (rect.width / this._canvas.width) : cellSize;
                    var dcells = -Math.round(dx / displayCellSize);
                    var drows  = -Math.round(dy / displayCellSize);
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
                var newHover = (inBounds || this.state.boundary === 'unbounded') ? {c : c, r : r} : null;
                var ph = this.state.hoverCell;
                var hoverChanged = (!!newHover !== !!ph) ||
                    (newHover && ph && (newHover.c !== ph.c || newHover.r !== ph.r));
                if(hoverChanged){ this.setState({hoverCell : newHover}); }

                // Update selection while dragging in select mode (takes priority over minimap).
                if(this.state.drawMode === 'select' && this._selStart){
                    var bc = this.state.boundary === 'unbounded' ? c : Math.max(0, Math.min(this.state.cols - 1, c));
                    var br = this.state.boundary === 'unbounded' ? r : Math.max(0, Math.min(this.state.rows - 1, r));
                    var selectTool = this.state.selectTool || 'rect';
                    var self1 = this;
                    if(selectTool === 'freeform'){
                        // Accumulate lasso path, only add if position changed.
                        var path = this._lassoPath;
                        var last = path.length > 0 ? path[path.length - 1] : null;
                        if(!last || last.c !== bc || last.r !== br){
                            path.push({c: bc, r: br});
                            this.setState({selection: {type:'freeform', path: path.slice(), cells: []}},
                                function(){ self1.drawBoard(); });
                        }
                        return;
                    }
                    // rect / ellipse: update bounding box.
                    var prev2 = this.state.selection;
                    if(prev2 && prev2.c2 === bc && prev2.r2 === br){ return; }
                    var selType = selectTool === 'ellipse' ? 'ellipse' : 'rect';
                    this.setState({selection: {type: selType, c1: this._selStart.c, r1: this._selStart.r, c2: bc, r2: br}},
                        function(){ self1.drawBoard(); });
                    return;
                }

                // Update draw tool preview while dragging (rubber-band tools).
                if(this._drawToolStart && this.state.drawMode === 'paint'){
                    var drawTool = this.state.drawTool || 'cell';
                    if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                        var tc = this.state.boundary === 'unbounded' ? c : Math.max(0, Math.min(this.state.cols - 1, c));
                        var tr = this.state.boundary === 'unbounded' ? r : Math.max(0, Math.min(this.state.rows - 1, r));
                        var ds = this._drawToolStart;
                        if(drawTool === 'line'){
                            this._drawPreviewCells = this.bresenhamLine(ds.r, ds.c, tr, tc);
                        } else if(drawTool === 'shape-rect'){
                            var prCells = [];
                            var rMin = Math.min(ds.r, tr), rMax = Math.max(ds.r, tr);
                            var cMin = Math.min(ds.c, tc), cMax = Math.max(ds.c, tc);
                            for(var pr = rMin; pr <= rMax; pr++)
                                for(var pc = cMin; pc <= cMax; pc++)
                                    prCells.push([pr, pc]);
                            this._drawPreviewCells = prCells;
                        } else if(drawTool === 'shape-circle'){
                            this._drawPreviewCells = this.ellipseCells(ds.c, ds.r, tc, tr);
                        }
                        this.drawBoard();
                        return;
                    }
                }

                // Minimap drag: pan viewport continuously while dragging on minimap.
                if(this._minimapDragging && this._minimapRect && this.state.showMinimap){
                    var mm = this._minimapRect;
                    var mmMouse = this.getMousePos(event);
                    var frac_c = Math.max(0, Math.min(1, (mmMouse.x - mm.x) / mm.w));
                    var frac_r = Math.max(0, Math.min(1, (mmMouse.y - mm.y) / mm.h));
                    var newVX = Math.round(frac_c * this.state.cols - (this._canvas.width  / this.state.cellSize) / 2);
                    var newVY = Math.round(frac_r * this.state.rows - (this._canvas.height / this.state.cellSize) / 2);
                    var clampedMm = this.clampView(newVX, newVY, this.state.cols, this.state.rows, this.state.cellSize);
                    var selfMm = this;
                    this.setState({viewX: clampedMm.viewX, viewY: clampedMm.viewY}, function(){ selfMm.drawBoard(); });
                    return;
                }

                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    var newPos = (inBounds || this.state.boundary === 'unbounded') ? {c : c, r : r} : null;
                    var prev = this._previewPos;
                    if(prev === newPos){ return; }
                    if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
                    this._previewPos = newPos;
                    this.drawBoard();
                    return;
                }
                if(!this._dragging){ return; }
                if(this.state.boundary !== 'unbounded' && (c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows)){ return; }
                var paintKey = r + ',' + c;
                if(this._paintedCells[paintKey] !== undefined){ return; }
                this._paintedCells[paintKey] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseUp : function(){
                this._minimapDragging = false;
                if(this._panDragging){
                    this._panDragging = false;
                    this._panStart = null;
                }
                if(this.state.drawMode === 'select' && this._selStart){
                    var selectTool = this.state.selectTool || 'rect';
                    if(selectTool === 'freeform'){
                        // Compute polygon cells from lasso path.
                        var path = this._lassoPath;
                        if(path.length >= 3){
                            var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                            path.forEach(function(p){ if(p.r<minR)minR=p.r; if(p.r>maxR)maxR=p.r; if(p.c<minC)minC=p.c; if(p.c>maxC)maxC=p.c; });
                            var fcells = [];
                            var fcols = this.state.cols, frows = this.state.rows;
                            var self = this;
                            for(var fr = minR; fr <= maxR; fr++)
                                for(var fc = minC; fc <= maxC; fc++)
                                    if(fc>=0 && fc<fcols && fr>=0 && fr<frows && self.pointInPolygon(fc, fr, path))
                                        fcells.push([fr, fc]);
                            this.setState({selection: {type:'freeform', path: path.slice(), cells: fcells}});
                        } else {
                            this.setState({selection: null});
                        }
                        this._selStart = null;
                        this._lassoPath = [];
                        this.drawBoard();
                        return;
                    }
                    // rect / ellipse: normalise bounds.
                    var sel = this.state.selection;
                    if(sel){
                        var normType = sel.type || 'rect';
                        var self = this;
                        this.setState({selection: {
                            type: normType,
                            r1: Math.min(sel.r1, sel.r2), c1: Math.min(sel.c1, sel.c2),
                            r2: Math.max(sel.r1, sel.r2), c2: Math.max(sel.c1, sel.c2)
                        }}, function(){ self.drawBoard(); });
                    }
                    this._selStart = null;
                    return;
                }
                // Apply rubber-band draw tools on mouse up.
                if(this._drawToolStart && this.state.drawMode === 'paint'){
                    var drawTool = this.state.drawTool || 'cell';
                    if(drawTool === 'line' || drawTool === 'shape-rect' || drawTool === 'shape-circle'){
                        var previewCells = this._drawPreviewCells;
                        this._drawToolStart = null;
                        this._drawPreviewCells = [];
                        this._minimapDirty = true;
                        this._hlStale = true;
                        var self2 = this;
                        var erasing = this._drawErasing;
                        this.setState(function(prevState){
                            var newLiveCells = new Map(prevState.liveCells);
                            previewCells.forEach(function(rc){
                                if(erasing){ newLiveCells.delete(rc[0]+','+rc[1]); }
                                else { newLiveCells.set(rc[0]+','+rc[1], 1); }
                            });
                            return {liveCells: newLiveCells, stable: false};
                        }, function(){ self2.drawBoard(); });
                        return;
                    }
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
                this._hlStale = true;
                var self = this;
                this.setState({liveCells: newLiveCells, stable: false}, function(){ self.drawBoard(); });
            },

            onMouseLeave : function(){
                if(this.state.hoverCell){ this.setState({hoverCell : null}); }
                this._minimapDragging = false;
                this._panDragging = false;
                this._panStart = null;
                this.cancelDrawTool();
                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    this._previewPos = null;
                    this.drawBoard();
                    return;
                }
                this.onMouseUp();
            },

            onContextMenu : function(event){
                event.preventDefault();
                if(this._drawToolStart){ this.cancelDrawTool(); return; }
                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0, drawMode : 'paint'},
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
                    : Math.max(1, cellSize - step);
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

            // ── Selection/draw helpers ────────────────────────────────────────

            // Returns [[r,c],...] for every cell in the selection (any type).
            getSelectionCells : function(sel){
                if(!sel){ return []; }
                var type = sel.type || 'rect';
                if(type === 'rect'){
                    var cells = [];
                    var r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
                    var c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
                    for(var r = r1; r <= r2; r++)
                        for(var c = c1; c <= c2; c++)
                            cells.push([r, c]);
                    return cells;
                }
                if(type === 'ellipse'){
                    var r1e = Math.min(sel.r1, sel.r2), r2e = Math.max(sel.r1, sel.r2);
                    var c1e = Math.min(sel.c1, sel.c2), c2e = Math.max(sel.c1, sel.c2);
                    var cx = (c1e + c2e) / 2, cy = (r1e + r2e) / 2;
                    var rx = (c2e - c1e) / 2, ry = (r2e - r1e) / 2;
                    var cells = [];
                    for(var re = r1e; re <= r2e; re++)
                        for(var ce = c1e; ce <= c2e; ce++){
                            var ddx = (cx > 0 || rx > 0) ? (ce - cx) / (rx + 0.5) : 0;
                            var ddy = (cy > 0 || ry > 0) ? (re - cy) / (ry + 0.5) : 0;
                            if(ddx*ddx + ddy*ddy <= 1) cells.push([re, ce]);
                        }
                    return cells;
                }
                if(type === 'freeform' || type === 'all-visible'){
                    return sel.cells || [];
                }
                return [];
            },

            // Ray-casting point-in-polygon test. polygon is array of {c,r} objects.
            pointInPolygon : function(px, py, polygon){
                var inside = false;
                var n = polygon.length;
                for(var i = 0, j = n - 1; i < n; j = i++){
                    var xi = polygon[i].c, yi = polygon[i].r;
                    var xj = polygon[j].c, yj = polygon[j].r;
                    if(((yi > py) !== (yj > py)) &&
                       (px < (xj - xi) * (py - yi) / (yj - yi) + xi)){
                        inside = !inside;
                    }
                }
                return inside;
            },

            // Bresenham line — returns [[r,c],...] cells from (r0,c0) to (r1,c1).
            bresenhamLine : function(r0, c0, r1, c1){
                var cells = [];
                var dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
                var sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
                var err = dr - dc;
                while(true){
                    cells.push([r0, c0]);
                    if(r0 === r1 && c0 === c1){ break; }
                    var e2 = 2 * err;
                    if(e2 > -dc){ err -= dc; r0 += sr; }
                    if(e2 < dr) { err += dr; c0 += sc; }
                }
                return cells;
            },

            // BFS flood fill — returns [[r,c],...] of connected cells matching startAlive.
            floodFillCells : function(startC, startR, liveCells, cols, rows, startAlive){
                var isUnbounded = this.state.boundary === 'unbounded';
                var maxFlood = 100000; // safety limit for unbounded mode
                var queue = [[startR, startC]];
                var result = [];
                var visited = new Set();
                while(queue.length){
                    if(result.length >= maxFlood){ break; }
                    var cur = queue.pop();
                    var key = cur[0] + ',' + cur[1];
                    if(visited.has(key)){ continue; }
                    visited.add(key);
                    var rr = cur[0], cc = cur[1];
                    if(!isUnbounded && (cc < 0 || cc >= cols || rr < 0 || rr >= rows)){ continue; }
                    var isAlive = liveCells.has(key);
                    if(isAlive !== startAlive){ continue; }
                    result.push([rr, cc]);
                    queue.push([rr+1, cc], [rr-1, cc], [rr, cc+1], [rr, cc-1]);
                }
                return result;
            },

            // Compute cells inside ellipse from bounding rect.
            ellipseCells : function(c1, r1, c2, r2){
                var cells = [];
                var rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
                var cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
                var cx = (cc1 + cc2) / 2, cy = (rr1 + rr2) / 2;
                var rx = (cc2 - cc1) / 2, ry = (rr2 - rr1) / 2;
                for(var r = rr1; r <= rr2; r++)
                    for(var c = cc1; c <= cc2; c++){
                        var dx = (cx > 0 || rx > 0) ? (c - cx) / (rx + 0.5) : 0;
                        var dy = (cy > 0 || ry > 0) ? (r - cy) / (ry + 0.5) : 0;
                        if(dx*dx + dy*dy <= 1) cells.push([r, c]);
                    }
                return cells;
            },

            // Select all visible live cells immediately.
            selectAllVisible : function(){
                var liveCells = this.state.liveCells;
                var viewX = this.state.viewX, viewY = this.state.viewY;
                var cs = this.getCanvasSize();
                var viewCols = Math.ceil(cs.w / this.state.cellSize);
                var viewRows = Math.ceil(cs.h / this.state.cellSize);
                var cells = [];
                var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                liveCells.forEach(function(_, key){
                    var parts = key.split(',');
                    var r = +parts[0], c = +parts[1];
                    if(c >= viewX && c < viewX + viewCols && r >= viewY && r < viewY + viewRows){
                        cells.push([r, c]);
                        if(r < minR) minR = r; if(r > maxR) maxR = r;
                        if(c < minC) minC = c; if(c > maxC) maxC = c;
                    }
                });
                if(cells.length === 0){ return; }
                var self = this;
                this.setState({
                    selection: {type:'all-visible', cells: cells,
                                c1: minC, r1: minR, c2: maxC, r2: maxR},
                    drawMode: 'select'
                }, function(){ self.drawBoard(); });
            },

            fitView : function(){
                if(!this._canvas){ return; }
                // In unbounded mode, "Fit Grid" behaves like "Fit Cells".
                if(this.state.boundary === 'unbounded'){ this.fitLiveCells(); return; }
                var cols = this.state.cols;
                var rows = this.state.rows;
                var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
                var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
                var contentPad = isMobile ? 24 : 40;
                var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;
                var isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
                var isMobileToolsOpen = typeof window !== 'undefined'
                    && window.innerWidth <= 620 && this.state.showMobileTools;
                var hFrac = isMobile ? (isMobileToolsOpen ? 0.36 : 0.82) : 0.90;
                var effW = typeof window !== 'undefined'
                    ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
                var effH = typeof window !== 'undefined'
                    ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
                // Apply the same aspect-ratio constraint as getCanvasSize.
                var fitAspect = cols / rows;
                if(effW / effH > fitAspect){
                    effW = Math.max(1, Math.round(effH * fitAspect));
                } else if(effH / effW > 1 / fitAspect){
                    effH = Math.max(1, Math.round(effW / fitAspect));
                }
                // Largest integer cellSize where every grid cell fits in the canvas.
                var newCS = Math.max(1, Math.floor(Math.min(effW / cols, effH / rows)));
                var self = this;
                this.setState({cellSize: newCS, viewX: 0, viewY: 0}, function(){ self.drawBoard(); });
            },

            fitLiveCells : function(){
                if(!this._canvas){ return; }
                var liveCells = this.state.liveCells;
                if(liveCells.size === 0){ this.fitView(); return; }
                var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                liveCells.forEach(function(_, key){
                    var parts = key.split(',');
                    var r = parseInt(parts[0], 10), c = parseInt(parts[1], 10);
                    if(r < minR){ minR = r; } if(r > maxR){ maxR = r; }
                    if(c < minC){ minC = c; } if(c > maxC){ maxC = c; }
                });
                var spanR = maxR - minR + 1, spanC = maxC - minC + 1;
                var padR = Math.max(2, Math.round(spanR * 0.1));
                var padC = Math.max(2, Math.round(spanC * 0.1));
                var totalR = spanR + padR * 2, totalC = spanC + padC * 2;
                var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
                var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
                var contentPad = isMobile ? 24 : 40;
                var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;
                var isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
                var isMobileToolsOpen = typeof window !== 'undefined'
                    && window.innerWidth <= 620 && this.state.showMobileTools;
                var hFrac = isMobile ? (isMobileToolsOpen ? 0.36 : 0.82) : 0.90;
                var effW = typeof window !== 'undefined'
                    ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
                var effH = typeof window !== 'undefined'
                    ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
                var newCS = Math.max(1, Math.floor(Math.min(effW / totalC, effH / totalR)));
                var newVX = this.state.boundary === 'unbounded' ? minC - padC : Math.max(0, minC - padC);
                var newVY = this.state.boundary === 'unbounded' ? minR - padR : Math.max(0, minR - padR);
                var self = this;
                this.setState({cellSize: newCS, viewX: newVX, viewY: newVY}, function(){ self.drawBoard(); });
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
                var selCells = this.getSelectionCells(sel);
                if(selCells.length === 0){ return; }
                var minR = Infinity, minC = Infinity;
                selCells.forEach(function(rc){ if(rc[0] < minR) minR = rc[0]; if(rc[1] < minC) minC = rc[1]; });
                var cells = [];
                selCells.forEach(function(rc){
                    if(liveCells.has(rc[0] + ',' + rc[1])){
                        cells.push([rc[0] - minR, rc[1] - minC]);
                    }
                });
                this.setState({clipboard: cells});
            },

            pasteAsPattern : function(){
                if(!this.state.clipboard || this.state.clipboard.length === 0){ return; }
                PATTERNS['Clipboard'] = this.state.clipboard;
                this._previewPos = null;
                var self = this;
                this.setState({selectedPattern: 'Clipboard', patternRotation: 0,
                               drawMode: 'preset', selection: null},
                    function(){ self.drawBoard(); self.drawRotationPreview(); });
            },

            deleteSelection : function(){
                var sel = this.state.selection;
                if(!sel){ return; }
                this.pushUndo();
                // Snapshot selection cells before setState to avoid stale closure.
                var selCells = this.getSelectionCells(sel);
                this._minimapDirty = true;
                this._hlStale = true;
                var self = this;
                this.setState(function(prevState){
                    var newLiveCells = new Map(prevState.liveCells);
                    selCells.forEach(function(rc){
                        newLiveCells.delete(rc[0] + ',' + rc[1]);
                    });
                    return {liveCells: newLiveCells, stable: false};
                }, function(){ self.drawBoard(); });
            },

            clearSelection : function(){
                var self = this;
                // Restore to preset or paint depending on whether a pattern is armed.
                var restoreMode = this.state.selectedPattern ? 'preset' : 'paint';
                this.setState({selection: null, drawMode: restoreMode},
                    function(){ self.drawBoard(); });
            },

            toggleSelectMode : function(){
                if(this.state.drawMode === 'select'){
                    this.clearSelection();
                } else {
                    var self = this;
                    // Enter select mode without clearing the armed preset.
                    this.setState({drawMode: 'select'},
                        function(){ self.drawBoard(); });
                }
            },

            toggleDrawMode : function(){
                var self = this;
                this.setState({drawMode: 'paint'}, function(){ self.drawBoard(); });
            },

            togglePresetMode : function(){
                var self = this;
                var newMode = this.state.drawMode === 'preset' ? 'paint' : 'preset';
                this.setState({drawMode: newMode}, function(){ self.drawBoard(); });
            },

            toggleMinimap : function(){
                var self = this;
                this.setState({showMinimap: !this.state.showMinimap}, function(){ self.drawBoard(); });
            },

            togglePanMode : function(){
                this.setState({panMode: !this.state.panMode});
            },

            toggleMobileTools : function(){
                var self = this;
                this.setState({showMobileTools: !this.state.showMobileTools}, function(){ self.drawBoard(); });
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
                clearTimeout(this._longPressTimer);
                if(event.touches.length === 2){
                    // Begin pinch-zoom + two-finger pan tracking.
                    var t0 = event.touches[0], t1 = event.touches[1];
                    this._pinchStart = {
                        dist:     Math.sqrt(
                                    Math.pow(t1.clientX - t0.clientX, 2) +
                                    Math.pow(t1.clientY - t0.clientY, 2)),
                        midX:     (t0.clientX + t1.clientX) / 2,
                        midY:     (t0.clientY + t1.clientY) / 2,
                        cellSize: this.state.cellSize,
                        viewX:    this.state.viewX,
                        viewY:    this.state.viewY
                    };
                    this._dragging = false;
                    return;
                }
                this._pinchStart = null;
                var t = event.touches[0];
                // Long-press: show cell coordinates in the stat bar.
                var self = this;
                var pos = this.getCellPos({clientX: t.clientX, clientY: t.clientY});
                if(pos.c >= 0 && pos.c < this.state.cols && pos.r >= 0 && pos.r < this.state.rows){
                    this._longPressTimer = setTimeout(function(){
                        self.setState({hoverCell: {c: pos.c, r: pos.r}});
                        self._longPressTimer = setTimeout(function(){
                            self.setState({hoverCell: null});
                        }, 2000);
                    }, 420);
                }
                // Pattern placement: show a preview at the initial tap position instead of
                // placing immediately. The pattern is placed on touchend at the final position.
                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    if(pos.c >= 0 && pos.c < this.state.cols && pos.r >= 0 && pos.r < this.state.rows){
                        this._previewPos = {c: pos.c, r: pos.r};
                        this.drawBoard();
                    }
                    return;
                }
                // Pan mode: single-finger pan instead of drawing
                if(this.state.panMode){
                    this._panDragging = true;
                    this._panStart = {x: t.clientX, y: t.clientY,
                                      vx: this.state.viewX, vy: this.state.viewY};
                    return;
                }
                this.onMouseDown({preventDefault: function(){}, button: 0,
                    clientX: t.clientX, clientY: t.clientY});
            },

            onTouchMove : function(event){
                event.preventDefault();
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
                if(event.touches.length === 2 && this._pinchStart){
                    var t0 = event.touches[0], t1 = event.touches[1];
                    var newDist = Math.sqrt(
                        Math.pow(t1.clientX - t0.clientX, 2) +
                        Math.pow(t1.clientY - t0.clientY, 2));
                    var newMidX = (t0.clientX + t1.clientX) / 2;
                    var newMidY = (t0.clientY + t1.clientY) / 2;
                    var scale = this._pinchStart.dist > 0 ? newDist / this._pinchStart.dist : 1;
                    var newCS = Math.max(1, Math.min(32,
                        Math.round(this._pinchStart.cellSize * scale)));
                    // Pan: shift view by finger-midpoint movement (in canvas cells).
                    var dmx  = newMidX - this._pinchStart.midX;
                    var dmy  = newMidY - this._pinchStart.midY;
                    var newVX = this._pinchStart.viewX - Math.round(dmx / newCS);
                    var newVY = this._pinchStart.viewY - Math.round(dmy / newCS);
                    var clamped = this.clampView(newVX, newVY,
                        this.state.cols, this.state.rows, newCS);
                    var self = this;
                    this.setState({cellSize: newCS, viewX: clamped.viewX, viewY: clamped.viewY},
                        function(){ self.drawBoard(); });
                    return;
                }
                if(event.touches.length !== 1){ return; }
                var t = event.touches[0];
                // Pan mode: move viewport by finger delta
                if(this.state.panMode && this._panDragging && this._panStart){
                    var dx = t.clientX - this._panStart.x;
                    var dy = t.clientY - this._panStart.y;
                    var cs2 = this.state.cellSize;
                    var newVX = this._panStart.vx - Math.round(dx / cs2);
                    var newVY = this._panStart.vy - Math.round(dy / cs2);
                    var clamped = this.clampView(newVX, newVY,
                        this.state.cols, this.state.rows, cs2);
                    var self = this;
                    this.setState({viewX: clamped.viewX, viewY: clamped.viewY},
                        function(){ self.drawBoard(); });
                    return;
                }
                this.onMouseMove({clientX: t.clientX, clientY: t.clientY});
            },

            onTouchEnd : function(event){
                event.preventDefault();
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
                if(event.touches.length < 2){ this._pinchStart = null; }
                if(event.touches.length === 0){
                    // End pan mode drag
                    if(this.state.panMode && this._panDragging){
                        this._panDragging = false;
                        this._panStart = null;
                        return;
                    }
                    // For pattern placement, place at the final preview position rather than
                    // the initial tap position (which onMouseUp would have used).
                    if(this.state.drawMode === 'preset' && this.state.selectedPattern && this._previewPos){
                        if(!this.state.livePaintMode){ this.setState({running: false}); }
                        this.placePattern(this.state.selectedPattern, this._previewPos.c, this._previewPos.r);
                        return;
                    }
                    this.onMouseUp();
                }
            },

            // ── Keyboard ──────────────────────────────────────────────────────

            handleKeyDown : function(e){
                if(e.key !== 'Escape' && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].indexOf(e.target.tagName) !== -1){ return; }
                var self = this;
                switch(e.key){
                    case ' ':
                        e.preventDefault();
                        this.toggleGame();
                        break;
                    case '.':
                        e.preventDefault();
                        if(e.shiftKey){ this.stepN(this.state.stepCount); }
                        else { this.stepGame(); }
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if(!this.state.running){ this.stepGame(); }
                        break;
                    case ',':
                        e.preventDefault();
                        this.stepBack();
                        break;
                    case 'r': case 'R':
                        this.resetGame();
                        break;
                    case 'e': case 'E':
                        this.emptyBoard();
                        break;
                    case 'z': case 'Z':
                        if(e.ctrlKey || e.metaKey){ e.preventDefault(); this.undo(); }
                        else if(this.state.layoutMode === 'observatory'){ this.toggleZenMode(); }
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
                        if(this._drawToolStart){ this.cancelDrawTool(); break; }
                        if(this.state.selection){ this.clearSelection(); break; }
                        if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                            this._previewPos = null;
                            this.setState({selectedPattern : null, patternRotation : 0, drawMode : 'paint'},
                                function(){ self.drawBoard(); });
                            break;
                        }
                        if(this.state.showPopGraph){
                            this.setState({showPopGraph: false});
                            break;
                        }
                        if(this.state.showHelp){
                            this.setState({showHelp : false});
                            break;
                        }
                        // Close layout elements
                        if(this.state.bottomSheetOpen){ this.setState({bottomSheetOpen: false}); break; }
                        if(this.state.contextTrayOpen){ this.setState({contextTrayOpen: false, contextTrayContent: null, contextTrayPinned: false}); break; }
                        if(this.state.zenMode){ this.setState({zenMode: false}); break; }
                        break;
                    case '?':
                        this.toggleHelp();
                        break;
                    case 'm': case 'M':
                        this.toggleMinimap();
                        break;
                }
            },

            // ── Keyboard shortcut registry ────────────────────────────────

            _registerCoreShortcuts : function(){
                var self = this;
                // Register all existing shortcuts centrally.
                this._registerShortcut('d', 'Switch to Draw mode', function(){ self.toggleDrawMode(); });
                this._registerShortcut('p', 'Switch to Preset mode', function(){ self.togglePresetMode(); });
                this._registerShortcut('g', 'Toggle grid lines', function(){ self.toggleGridLines(); });
                this._registerShortcut('t', 'Toggle trails', function(){ self.toggleTrails(); });
            },

            _registerShortcut : function(key, description, handler){
                this._shortcuts[key.toLowerCase()] = {key: key, description: description, handler: handler};
            },

            _unregisterShortcut : function(key){
                delete this._shortcuts[key.toLowerCase()];
            },

            // ── Layout mode management ───────────────────────────────────────

            _persistLayout : function(){
                try {
                    localStorage.setItem('life-layout-prefs', JSON.stringify({
                        _schemaVersion: 1,
                        layoutMode:    this.state.layoutMode,
                        railCollapsed: this.state.railCollapsed,
                        railTab:       this.state.railTab,
                        railSide:      this.state.railSide,
                        panelStates:   this.state.panelStates
                    }));
                } catch(e){
                    // localStorage full or unavailable — silently ignore.
                }
            },

            // ── Focus management ─────────────────────────────────────────

            _saveFocus : function(){
                this._prevFocusEl = document.activeElement;
            },

            _restoreFocus : function(){
                if(this._prevFocusEl && this._prevFocusEl.focus){
                    try { this._prevFocusEl.focus(); } catch(e){}
                }
                this._prevFocusEl = null;
            },

            _focusFirst : function(containerSelector){
                var self = this;
                setTimeout(function(){
                    var el = document.querySelector(containerSelector);
                    if(!el){ return; }
                    var focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if(focusable){ focusable.focus(); }
                }, 50);
            },

            setLayoutMode : function(mode){
                var self = this;
                this.setState({layoutMode: mode, zenMode: false}, function(){
                    self._persistLayout();
                    self.drawBoard();
                });
            },

            setRailTab : function(tab){
                var self = this;
                var updates = {railTab: tab, railCollapsed: false};
                this.setState(updates, function(){ self._persistLayout(); });
            },

            toggleRailCollapsed : function(){
                var self = this;
                this.setState({railCollapsed: !this.state.railCollapsed}, function(){
                    self._persistLayout();
                    self.drawBoard();
                });
            },

            toggleRailHidden : function(){
                var self = this;
                this.setState({railHidden: !this.state.railHidden}, function(){ self.drawBoard(); });
            },

            toggleRailSide : function(){
                var self = this;
                var newSide = this.state.railSide === 'right' ? 'left' : 'right';
                this.setState({railSide: newSide}, function(){
                    self._persistLayout();
                    self.drawBoard();
                });
            },

            openContextTray : function(content){
                var self = this;
                this.setState({contextTrayOpen: true, contextTrayContent: content}, function(){ self.drawBoard(); });
            },

            closeContextTray : function(){
                if(!this.state.contextTrayPinned){
                    var self = this;
                    this.setState({contextTrayOpen: false, contextTrayContent: null}, function(){ self.drawBoard(); });
                }
            },

            toggleContextTrayPin : function(){
                this.setState({contextTrayPinned: !this.state.contextTrayPinned});
            },

            toggleZenMode : function(){
                var self = this;
                this.setState({zenMode: !this.state.zenMode}, function(){ self.drawBoard(); });
            },

            toggleBottomSheet : function(){
                var self = this;
                if(this.state.bottomSheetOpen){
                    // Closing: animate out, then unmount.
                    this.setState({bottomSheetClosing: true}, function(){
                        setTimeout(function(){
                            self.setState({bottomSheetOpen: false, bottomSheetClosing: false}, function(){
                                self._restoreFocus();
                            });
                        }, 200);
                    });
                } else {
                    // Opening.
                    this._saveFocus();
                    this.setState({bottomSheetOpen: true, bottomSheetClosing: false}, function(){
                        self._focusFirst('.bottom-sheet');
                    });
                }
            },

            setBottomSheetTab : function(tab){
                this.setState({bottomSheetTab: tab, bottomSheetOpen: true});
            },

            // ── Bottom sheet swipe-to-dismiss ─────────────────────────────────

            _onSheetTouchStart : function(e){
                this._sheetTouchY = e.touches[0].clientY;
                this._sheetEl = e.currentTarget;
            },
            _onSheetTouchMove : function(e){
                if(this._sheetTouchY == null){ return; }
                var dy = e.touches[0].clientY - this._sheetTouchY;
                if(dy > 0){
                    e.preventDefault();
                    this._sheetEl.style.transform = 'translateY(' + dy + 'px)';
                }
            },
            _onSheetTouchEnd : function(){
                if(this._sheetTouchY == null){ return; }
                var el = this._sheetEl;
                var transform = el.style.transform;
                var dy = 0;
                if(transform){
                    var match = transform.match(/translateY\((\d+)/);
                    if(match){ dy = parseInt(match[1], 10); }
                }
                el.style.transform = '';
                if(dy > 60){
                    this.toggleBottomSheet();
                }
                this._sheetTouchY = null;
            },

            // ── Bottom sheet focus trap + keyboard ────────────────────────────

            _onSheetKeyDown : function(e){
                if(e.key === 'Escape'){
                    this.toggleBottomSheet();
                    e.preventDefault();
                    return;
                }
                if(e.key !== 'Tab'){ return; }
                var sheet = e.currentTarget.querySelector('.bottom-sheet');
                if(!sheet){ return; }
                var focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if(!focusable.length){ return; }
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if(e.shiftKey && document.activeElement === first){
                    e.preventDefault(); last.focus();
                } else if(!e.shiftKey && document.activeElement === last){
                    e.preventDefault(); first.focus();
                }
            },

            // ── Toggles ───────────────────────────────────────────────────────

            toggleTrails : function(){
                var newVal = !this.state.showTrails;
                this._trailEnabled = newVal;
                if(!newVal){ this._trailMap = new Map(); }
                var self = this;
                this.setState({showTrails: newVal}, function(){ self.drawBoard(); });
            },

            setStepCount : function(e){
                this.setState({stepCount: parseInt(e.target.value) || 1});
            },

            // Advance N generations at once (synchronous, chunked for large N).
            stepN : function(n){
                if(!n || n < 1){ n = 1; }
                this.pushUndo();
                // Snapshot for gen history before batch.
                this._pushGenHistory();
                var liveCells = this.state.liveCells;
                var cols      = this.state.cols;
                var rows      = this.state.rows;
                var birth     = this.state.birthRule;
                var survive   = this.state.surviveRule;
                var boundary  = this.state.boundary;
                var self = this;
                var gen = this.state.generations;
                var popHistory = this.state.popHistory.slice();
                var peak = this.state.sessionPeakPop || 0;
                var done = 0;
                var CHUNK = 50;
                var isToroidal = boundary === 'toroidal';
                var doChunk = function(){
                    var limit = Math.min(done + CHUNK, n);
                    for(var i = done; i < limit; i++){
                        if(isToroidal){
                            liveCells = SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
                        } else {
                            liveCells = self._hashLifeStep(liveCells, birth, survive);
                            if(boundary === 'finite'){
                                var clipped = new Map();
                                liveCells.forEach(function(age, key){
                                    var comma = key.indexOf(',');
                                    var r = parseInt(key.substring(0, comma));
                                    var c = parseInt(key.substring(comma + 1));
                                    if(r >= 0 && r < rows && c >= 0 && c < cols){
                                        clipped.set(key, age);
                                    }
                                });
                                liveCells = clipped;
                                self._hlStale = true; // tree must rebuild from clipped cells
                            }
                        }
                        gen++;
                        var pop = liveCells.size;
                        popHistory.push(pop);
                        if(popHistory.length > 10000){ popHistory = popHistory.slice(popHistory.length - 10000); }
                        if(pop > peak){ peak = pop; }
                    }
                    done = limit;
                    if(done < n){
                        setTimeout(doChunk, 0);
                    } else {
                        self._minimapDirty = true;
                        self.setState({
                            liveCells: liveCells,
                            generations: gen,
                            running: false,
                            popHistory: popHistory,
                            sessionPeakPop: peak,
                            stable: false
                        }, function(){ self.drawBoard(); });
                    }
                };
                doChunk();
            },

            // ── Generation history (step backward) ─────────────────────────────

            _pushGenHistory : function(){
                this._genHistoryCounter++;
                if(this._genHistoryCounter % this._genHistoryInterval !== 0){ return; }
                this._genHistory.push({
                    liveCells: new Map(this.state.liveCells),
                    generations: this.state.generations
                });
                if(this._genHistory.length > this._genHistoryMax){
                    this._genHistory.shift();
                }
            },

            stepBack : function(){
                if(this._genHistory.length === 0){ return; }
                var snapshot = this._genHistory.pop();
                this._minimapDirty = true;
                this._hlStale = true;
                var self = this;
                this.setState({
                    liveCells: snapshot.liveCells,
                    generations: snapshot.generations,
                    running: false,
                    stable: false
                }, function(){ self.drawBoard(); });
            },

            clearGenHistory : function(){
                this._genHistory = [];
                this._genHistoryCounter = 0;
            },

            toggleLivePaint : function(){
                this.setState({livePaintMode : !this.state.livePaintMode});
            },

            toggleGridLines : function(){
                var self = this;
                this.setState({gridLines : !this.state.gridLines}, function(){
                    self.drawBoard();
                });
            },

            toggleBoundary : function(){
                var cur = this.state.boundary;
                var next = cur === 'toroidal' ? 'finite' : cur === 'finite' ? 'unbounded' : 'toroidal';
                this._hlStale = true;
                this._minimapDirty = true;
                var self = this;
                this.setState({boundary : next}, function(){ self.drawBoard(); });
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
                this._hlStale = true;
                var self = this;
                this.setState({
                    cols :        newCols,
                    rows :        newRows,
                    pendingCols : newCols,
                    pendingRows : newRows,
                    liveCells :   newLiveCells,
                    viewX :       clamped.viewX,
                    viewY :       clamped.viewY,
                    selection :      null,
                    popHistory :     [],
                    sessionPeakPop : 0
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

            applyGridPreset : function(cols, rows){
                if(cols * rows > 500000){
                    if(!confirm('A ' + cols + '\u00d7' + rows + ' grid uses significant memory and may run slowly. Continue?')){ return; }
                }
                this.resizeBoard(cols, rows);
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
                    this._hlStale = true;
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
                    this._hlStale = true;
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
                if(text.length > 500000){
                    this.setState({rleError : 'Pattern too large (max 500 KB). Use a smaller pattern or reduce it first.'}); return;
                }
                // Strip non-printable control characters.
                text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
                try {
                    // Auto-detect format.
                    var result;
                    if(/^#Life\s+1\.06/m.test(text)){
                        result = SimEngine.parseLife106(text);
                    } else if(/^#Life\s+1\.05/m.test(text)){
                        result = SimEngine.parseLife105(text);
                    } else if(/[bo\$]/.test(text) && /!/.test(text)){
                        result = this.parseRLE(text);
                    } else {
                        result = this.parsePlaintext(text);
                    }
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
                        rleError :        result.truncated ? 'Pattern truncated to 100,000 cells.' : ''
                    }, function(){ self.drawBoard(); });
                } catch(ex){
                    this.setState({rleError : 'Could not parse pattern: ' + ex.message});
                }
            },

            parseRLE       : function(text)        { return SimEngine.parseRLE(text); },
            parsePlaintext : function(text)        { return SimEngine.parsePlaintext(text); },

            // ── Patterns ──────────────────────────────────────────────────────

            rotatePattern : function(cells, steps){ return SimEngine.rotatePattern(cells, steps); },

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
                var newMode = name ? 'preset' : 'paint';
                this.setState({selectedPattern: name, drawMode: newMode, patternRotation: 0},
                    function(){ self.drawBoard(); });
            },

            placePattern : function(name, centerC, centerR){
                if(!PATTERNS[name]){ return; }
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
                    if(this.state.boundary === 'unbounded' || (pr >= 0 && pr < rows && pc >= 0 && pc < cols)){
                        newLiveCells.set(pr + ',' + pc, 1);
                    }
                }
                this._previewPos = null;
                this._minimapDirty = true;
                this._hlStale = true;
                var self = this;
                this.setState({liveCells: newLiveCells, stable: false}, function(){ self.drawBoard(); });
            },

            // ── Board actions ─────────────────────────────────────────────────

            emptyBoard : function(){
                this.pushUndo();
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._minimapDirty = true;
                this._hlStale = true;
                this._trailMap = new Map();
                this.clearGenHistory();
                var self = this;
                this.setState({running : false, generations : 0, liveCells : new Map(),
                    popHistory : [], sessionPeakPop : 0, stable : false}, function(){ self.drawBoard(); });
            },

            resetGame : function(){
                this.pushUndo();
                var resetCols = this.state.boundary === 'unbounded' ? 100 : this.state.cols;
                var resetRows = this.state.boundary === 'unbounded' ? 100 : this.state.rows;
                var totalCells = resetCols * resetRows;
                var sparseness = this.state.sparseness;
                // Cap density for very large boards to prevent browser crash.
                if(totalCells > 1000000){
                    sparseness = Math.max(sparseness, totalCells / 500000);
                }
                var wasRunning = this.state.running;
                this._tickId++;
                this._loopRunning = false;
                this._prevBoardHash = null;
                this._stableCount = 0;
                this._minimapDirty = true;
                this._hlStale = true;
                this._trailMap = new Map();
                this.clearGenHistory();
                var self = this;
                var applyReset = function(newLiveCells){
                    self.setState({running : false, generations : 0, liveCells : newLiveCells,
                        popHistory : [], sessionPeakPop : 0, stable : false}, function(){
                        self.drawBoard();
                        if(wasRunning){
                            self.setState({running : true}, function(){ self._startLoop(); });
                        }
                    });
                };
                if(totalCells > 250000){
                    // Large board: generate cells asynchronously to avoid UI freeze.
                    this.setState({running : false});
                    SimEngine.buildLiveCellsAsync(resetCols, resetRows, sparseness, applyReset);
                } else {
                    applyReset(this.buildLiveCells(resetCols, resetRows, sparseness));
                }
            },

            // ── Render sub-methods ────────────────────────────────────────────

            renderHelpModal : function(){
                if(!this.state.showHelp){ return null; }
                return (
                    <div className="help-overlay" onClick={this.toggleHelp}
                        role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
                        <div className="help-modal" onClick={function(e){ e.stopPropagation(); }}>
                            <h3 className="help-title" id="help-dialog-title">Keyboard Shortcuts</h3>
                            <table className="help-table">
                                <tbody>
                                    <tr><td>Space</td><td>Play / Pause</td></tr>
                                    <tr><td>.</td><td>Step one generation</td></tr>
                                    <tr><td>Shift+.</td><td>Step N generations</td></tr>
                                    <tr><td>,</td><td>Step backward</td></tr>
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
                                    <tr><td colSpan="2" style={{paddingTop:'10px',opacity:0.55,fontSize:'0.85em',textTransform:'uppercase',letterSpacing:'0.05em'}}>Touch gestures</td></tr>
                                    <tr><td>Tap</td><td>Paint / place cell</td></tr>
                                    <tr><td>Pinch</td><td>Zoom in / out</td></tr>
                                    <tr><td>2-finger drag</td><td>Pan viewport</td></tr>
                                    <tr><td>Long press</td><td>Show cell coordinates</td></tr>
                                    <tr><td colSpan="2" style={{paddingTop:'10px',opacity:0.55,fontSize:'0.85em',textTransform:'uppercase',letterSpacing:'0.05em'}}>File import</td></tr>
                                    <tr><td>Drag &amp; drop</td><td>Drop .rle/.cells file on canvas</td></tr>
                                </tbody>
                            </table>
                            <button className="btn help-close" onClick={this.toggleHelp}>Close</button>
                        </div>
                    </div>
                );
            },

            togglePopGraph : function(){
                this.setState({showPopGraph: !this.state.showPopGraph});
            },

            analyzePattern : function(){
                if(this.state.analyzing){ return; }
                var liveCells = this.state.liveCells;
                if(liveCells.size === 0){
                    this.setState({analysisResult: 'No live cells to analyze.'});
                    var self0 = this;
                    setTimeout(function(){ self0.setState({analysisResult: null}); }, 3000);
                    return;
                }
                this._analysisCancelled = false;
                var pop = liveCells.size;
                // Scale generation limit based on population to keep analysis responsive.
                var maxGens = pop > 1000 ? 200 : pop > 500 ? 500 : 2000;
                this.setState({analyzing: true, analysisResult: 'Analyzing\u2026 gen 0/' + maxGens + ' (click to cancel)'});
                var self = this;
                var cols = this.state.cols;
                var rows = this.state.rows;
                var birth = this.state.birthRule;
                var survive = this.state.surviveRule;
                var boundary = this.state.boundary;
                var chunkSize = 50;

                // Order-independent O(n) hash using Szudzik pairing + XOR mixing.
                function hashBoard(lc){
                    var h1 = 0, h2 = 0, count = 0;
                    lc.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        var r = parseInt(key.substring(0, comma));
                        var c = parseInt(key.substring(comma + 1));
                        var paired = r >= c ? r * r + r + c : c * c + r;
                        h1 = (h1 + paired) | 0;
                        h2 = (h2 ^ Math.imul(paired, 2654435761)) | 0;
                        count++;
                    });
                    return count + '|' + h1 + '|' + h2;
                }

                // Get bounding box center.
                function bbox(lc){
                    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                    lc.forEach(function(age, key){
                        var comma = key.indexOf(',');
                        var r = parseInt(key.substring(0, comma));
                        var c = parseInt(key.substring(comma + 1));
                        if(r < minR) minR = r; if(r > maxR) maxR = r;
                        if(c < minC) minC = c; if(c > maxC) maxC = c;
                    });
                    return {cr: (minR + maxR) / 2, cc: (minC + maxC) / 2};
                }

                var hashes = new Map();
                var current = liveCells;
                var initBBox = bbox(current);
                hashes.set(hashBoard(current), {gen: 0, cr: initBBox.cr, cc: initBBox.cc});
                var gen = 0;
                var analysisStartTime = Date.now();

                // Build a local HashLife tree for analysis (separate from main sim state).
                var aRuleKey = birth.join(',') + '/' + survive.join(',');
                if(aRuleKey !== self._hlRuleKey){
                    HashLife.init(birth, survive);
                    self._hlRuleKey = aRuleKey;
                    self._hlStale = true;
                }
                var aCells = [];
                current.forEach(function(age, key){
                    var comma = key.indexOf(',');
                    aCells.push([parseInt(key.substring(0, comma)), parseInt(key.substring(comma + 1))]);
                });
                var aTree = HashLife.fromCellList(aCells);
                var aRoot = aTree.root, aOffR = aTree.offR, aOffC = aTree.offC;

                function finishAnalysis(msg, duration){
                    self.setState({analysisResult: msg, analyzing: false});
                    setTimeout(function(){ self.setState({analysisResult: null}); }, duration || 5000);
                }

                function analyzeStep(){
                    // Advance the local HashLife tree by 1 gen.
                    if(boundary === 'toroidal'){
                        current = SimEngine.computeNextGeneration(current, cols, rows, birth, survive, boundary);
                        return;
                    }
                    var level = aRoot.level;
                    aRoot = HashLife.expandTree(aRoot);
                    aOffR += (1 << (level - 1));
                    aOffC += (1 << (level - 1));
                    level = aRoot.level;
                    aRoot = HashLife.advance(aRoot, 1);
                    aOffR -= (1 << (level - 2));
                    aOffC -= (1 << (level - 2));
                    var pLvl = aRoot.level;
                    aRoot = HashLife.trimTree(aRoot);
                    for(var l = pLvl; l > aRoot.level; l--){
                        aOffR -= (1 << (l - 2));
                        aOffC -= (1 << (l - 2));
                    }
                    var newCells = HashLife.toCellList(aRoot, aOffR, aOffC);
                    current = overlayAges(current, newCells);
                    if(boundary === 'finite'){
                        var clipped = new Map();
                        current.forEach(function(age, key){
                            var comma = key.indexOf(',');
                            var r = parseInt(key.substring(0, comma));
                            var c = parseInt(key.substring(comma + 1));
                            if(r >= 0 && r < rows && c >= 0 && c < cols){
                                clipped.set(key, age);
                            }
                        });
                        current = clipped;
                    }
                }

                function runChunk(){
                    if(self._analysisCancelled){ return; }
                    if(Date.now() - analysisStartTime > 10000){
                        finishAnalysis('Timed out after 10s (' + gen + ' gens analyzed).');
                        return;
                    }
                    var end = Math.min(gen + chunkSize, maxGens);
                    while(gen < end){
                        analyzeStep();
                        gen++;
                        var h = hashBoard(current);
                        if(hashes.has(h)){
                            var prev = hashes.get(h);
                            var period = gen - prev.gen;
                            var bb = bbox(current);
                            var dr = Math.abs(bb.cr - prev.cr);
                            var dc = Math.abs(bb.cc - prev.cc);
                            var msg;
                            if(period === 1 && dr < 0.01 && dc < 0.01){
                                msg = 'Still life (stable)';
                            } else if(dr < 0.01 && dc < 0.01){
                                msg = 'Oscillator \u2014 period ' + period;
                            } else {
                                var speed = Math.max(dr, dc);
                                var gcd = function(a, b){ return b === 0 ? a : gcd(b, a % b); };
                                var sn = Math.round(speed);
                                var g = gcd(sn, period);
                                var num = sn / g;
                                var den = period / g;
                                var dir = (dr > dc + 0.01) ? (dc > 0.01 ? 'diagonal' : 'vertical')
                                         : (dc > dr + 0.01 ? 'horizontal' : 'diagonal');
                                msg = 'Spaceship \u2014 ' + (num === 1 ? 'c' : num + 'c') + '/' + den + ' ' + dir + ', period ' + period;
                            }
                            finishAnalysis(msg, 6000);
                            return;
                        }
                        var bb2 = bbox(current);
                        hashes.set(h, {gen: gen, cr: bb2.cr, cc: bb2.cc});
                        if(current.size === 0){
                            finishAnalysis('Pattern dies at generation ' + gen + '.');
                            return;
                        }
                    }
                    if(gen >= maxGens){
                        finishAnalysis('No periodicity detected (' + maxGens + ' gens).');
                    } else {
                        // Update progress and yield to UI.
                        self.setState({analysisResult: 'Analyzing\u2026 gen ' + gen + '/' + maxGens + ' (click to cancel)'});
                        setTimeout(runChunk, 0);
                    }
                }
                setTimeout(runChunk, 0);
            },

            cancelAnalysis : function(){
                this._analysisCancelled = true;
                this.setState({analysisResult: 'Analysis cancelled.', analyzing: false});
                var self = this;
                setTimeout(function(){ self.setState({analysisResult: null}); }, 2000);
            },

            renderPopGraph : function(){
                if(!this.state.showPopGraph){ return null; }
                var hist = this.state.popHistory;
                if(hist.length < 2){ return null; }
                var self = this;
                var maxPop = 0;
                for(var i = 0; i < hist.length; i++){ if(hist[i] > maxPop){ maxPop = hist[i]; } }
                if(maxPop === 0){ maxPop = 1; }
                var vbW = 600, vbH = 200, padT = 10, padB = 20, padL = 50, padR = 10;
                var plotW = vbW - padL - padR;
                var plotH = vbH - padT - padB;
                // Draw data points as SVG polyline.
                var points = hist.map(function(p, idx){
                    var x = padL + (idx / (hist.length - 1)) * plotW;
                    var y = padT + (1 - p / maxPop) * plotH;
                    return x.toFixed(1) + ',' + y.toFixed(1);
                }).join(' ');
                // Y-axis labels.
                var yLabels = [];
                var ySteps = 4;
                for(var yi = 0; yi <= ySteps; yi++){
                    var val = Math.round(maxPop * (1 - yi / ySteps));
                    var yy = padT + (yi / ySteps) * plotH;
                    yLabels.push({val: val, y: yy});
                }
                return (
                    <div className="help-overlay" onClick={this.togglePopGraph}
                        role="dialog" aria-modal="true" aria-labelledby="popgraph-dialog-title">
                        <div className="pop-graph-modal" onClick={function(e){ e.stopPropagation(); }}>
                            <h3 className="help-title" id="popgraph-dialog-title">Population History</h3>
                            <p style={{fontSize:'0.8em',opacity:0.7,margin:'0 0 8px'}}>{hist.length + ' generations recorded \xB7 peak ' + maxPop.toLocaleString()}</p>
                            <svg width="100%" viewBox={"0 0 " + vbW + " " + vbH} style={{background:'rgba(0,0,0,0.15)',borderRadius:'4px'}}>
                                {/* Y-axis gridlines and labels */}
                                {yLabels.map(function(yl, idx){
                                    return <g key={idx}>
                                        <line x1={padL} y1={yl.y} x2={vbW - padR} y2={yl.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                                        <text x={padL - 5} y={yl.y + 4} textAnchor="end" fill="rgba(255,255,255,0.6)" fontSize="10">{yl.val.toLocaleString()}</text>
                                    </g>;
                                })}
                                {/* X-axis label */}
                                <text x={padL + plotW / 2} y={vbH - 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">Generation</text>
                                {/* Data line */}
                                <polyline fill="none" stroke={THEMES[this.state.theme] ? 'rgb(' + THEMES[this.state.theme].aliveR + ',' + THEMES[this.state.theme].aliveG + ',' + THEMES[this.state.theme].aliveB + ')' : '#70959A'} strokeWidth="1.5" points={points}/>
                                {/* Area fill */}
                                <polygon fill={THEMES[this.state.theme] ? 'rgba(' + THEMES[this.state.theme].aliveR + ',' + THEMES[this.state.theme].aliveG + ',' + THEMES[this.state.theme].aliveB + ',0.2)' : 'rgba(112,149,154,0.2)'} points={padL + ',' + (padT + plotH) + ' ' + points + ' ' + (padL + plotW) + ',' + (padT + plotH)}/>
                            </svg>
                            <button className="btn help-close" onClick={this.togglePopGraph}>Close</button>
                        </div>
                    </div>
                );
            },

            // Returns the sparkline SVG block (or null if insufficient data).
            // Called from both renderStats (desktop) and renderMobileSparkline (mobile).
            renderSparklineSVG : function(){
                var population = this.state.liveCells.size;
                var now2 = Date.now();
                var gpsText = (this._measuredGps > 0 &&
                    (this.state.running || now2 < (this._gpsDisplayUntil || 0)))
                    ? this._measuredGps.toFixed(1) + '\u00a0gen/s' : null;
                var hist0 = this.state.popHistory;
                var trendArrow = '';
                if(hist0.length >= 5){
                    var recent = hist0.slice(-5);
                    var delta  = recent[recent.length - 1] - recent[0];
                    trendArrow = delta > 2 ? '\u2009\u25b2' : delta < -2 ? '\u2009\u25bc' : '\u2009\u223c';
                }
                var fullHist = this.state.popHistory;
                var hist   = fullHist.length > 60 ? fullHist.slice(fullHist.length - 60) : fullHist;
                var maxPop = hist.length ? Math.max.apply(null, hist) : 0;
                if(hist.length <= 1){ return null; }
                var vbW = 200, vbH = 36, padT = 2, innerH = vbH - padT * 2;
                var spMax = maxPop || 1;
                var sparkPts = hist.map(function(p, idx){
                    var x = hist.length === 1 ? vbW / 2 : (idx / (hist.length - 1)) * vbW;
                    var y = padT + (1 - p / spMax) * innerH;
                    return x.toFixed(1) + ',' + y.toFixed(1);
                }).join(' ');
                var spanLabel = hist.length >= 60 ? 'last 60 gen' : hist.length + ' gen';
                return (
                    <div className="sparkline-wrap">
                        <div className="sparkline-header">
                            <span className="sparkline-title" onClick={this.togglePopGraph} style={{cursor:'pointer'}} title="Click for full population graph">{"Pop: " + population.toLocaleString() + trendArrow}</span>
                            <span className="sparkline-peak">{"peak " + maxPop.toLocaleString() + (this.state.sessionPeakPop > maxPop ? " \xb7 all " + this.state.sessionPeakPop.toLocaleString() : "")}</span>
                        </div>
                        <svg className="sparkline" width="100%" height={vbH}
                             viewBox={"0 0 " + vbW + " " + vbH}
                             preserveAspectRatio="none">
                            <line x1="0" y1={vbH - 0.5} x2={vbW} y2={vbH - 0.5}
                                  stroke="rgba(244,233,225,0.25)" strokeWidth="1"/>
                            <line x1="0" y1={padT + innerH / 2} x2={vbW} y2={padT + innerH / 2}
                                  stroke="rgba(244,233,225,0.1)" strokeWidth="0.5"/>
                            <polyline points={sparkPts} fill="none" stroke={THEMES[this.state.theme] ? 'rgb(' + THEMES[this.state.theme].aliveR + ',' + THEMES[this.state.theme].aliveG + ',' + THEMES[this.state.theme].aliveB + ')' : '#70959A'}
                                      strokeWidth="1.5" strokeLinejoin="round"
                                      strokeLinecap="round"/>
                        </svg>
                        <div className="sparkline-footer">
                            <span className="sparkline-gps">{gpsText || ''}</span>
                            <span>{"← " + spanLabel + " →"}</span>
                        </div>
                    </div>
                );
            },

            renderMobileSparkline : function(){
                var svg = this.renderSparklineSVG();
                if(!svg){ return null; }
                return <div className="mobile-sparkline">{svg}</div>;
            },

            renderMobileMinimapArea : function(){
                if(!this.state.showMinimap){ return null; }
                var self = this;
                return (
                    <div className="mobile-minimap-area">
                        <canvas className="mobile-minimap-canvas"
                            ref={function(c){ self._mobileMinimap = c; }}
                            onMouseDown={self.onMinimapElementDown}
                            onMouseMove={self.onMinimapElementMove}
                            onTouchStart={self.onMinimapElementDown}
                            onTouchMove={self.onMinimapElementMove}
                            onMouseUp={self.onMinimapElementUp}
                            onTouchEnd={self.onMinimapElementUp} />
                    </div>
                );
            },

            onMinimapElementDown : function(e){
                e.preventDefault();
                this._mmElemDragging = true;
                this.panMinimapElement(e);
            },

            onMinimapElementMove : function(e){
                if(!this._mmElemDragging){ return; }
                e.preventDefault();
                this.panMinimapElement(e);
            },

            onMinimapElementUp : function(){
                this._mmElemDragging = false;
            },

            panMinimapElement : function(e){
                if(!this._mobileMinimap){ return; }
                var rect = this._mobileMinimap.getBoundingClientRect();
                var clientX = e.touches ? e.touches[0].clientX : e.clientX;
                var clientY = e.touches ? e.touches[0].clientY : e.clientY;
                var frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                var frac_r = Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height));
                var mmCols = this.state.cols, mmRows = this.state.rows, mmOC = 0, mmOR = 0;
                if(this.state.boundary === 'unbounded'){
                    var bb = SimEngine.getBoundingBox(this.state.liveCells);
                    if(bb){
                        var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        mmOR = bb.minR - pad; mmOC = bb.minC - pad;
                        mmRows = bb.maxR - bb.minR + 1 + pad * 2;
                        mmCols = bb.maxC - bb.minC + 1 + pad * 2;
                    }
                }
                var newVX = Math.round(frac_c * mmCols + mmOC - (this._canvas.width  / this.state.cellSize) / 2);
                var newVY = Math.round(frac_r * mmRows + mmOR - (this._canvas.height / this.state.cellSize) / 2);
                var clamped = this.clampView(newVX, newVY, this.state.cols, this.state.rows, this.state.cellSize);
                var self = this;
                this.setState({viewX: clamped.viewX, viewY: clamped.viewY}, function(){ self.drawBoard(); });
            },

            drawMinimapMobile : function(liveCells, cols, rows, viewX, viewY, cellSize, theme){
                if(!this._mobileMinimap){ return; }
                // In unbounded mode, derive cols/rows from live cell bounding box.
                var mmMobOriginR = 0, mmMobOriginC = 0;
                if(this.state.boundary === 'unbounded'){
                    var bb = SimEngine.getBoundingBox(liveCells);
                    if(bb){
                        var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
                        mmMobOriginR = bb.minR - pad;
                        mmMobOriginC = bb.minC - pad;
                        rows = bb.maxR - bb.minR + 1 + pad * 2;
                        cols = bb.maxC - bb.minC + 1 + pad * 2;
                    } else {
                        mmMobOriginR = viewY - 50; mmMobOriginC = viewX - 50;
                        rows = 100; cols = 100;
                    }
                }
                var MOBILE_MM_CSS_W = 160;
                var mmAspect = cols / Math.max(1, rows);
                var mmH_css = Math.round(MOBILE_MM_CSS_W / mmAspect);
                var mmW_css = MOBILE_MM_CSS_W;

                // Resize off-screen buffer if needed
                if(this._minimapCanvas.width !== mmW_css || this._minimapCanvas.height !== mmH_css){
                    this._minimapCanvas.width  = mmW_css;
                    this._minimapCanvas.height = mmH_css;
                }

                // Render minimap cells to off-screen canvas using actual theme colors.
                var mmCtx = this._minimapCanvas.getContext('2d');
                // Dark background for contrast (same approach as desktop drawMinimap).
                mmCtx.fillStyle = 'rgba(10,14,26,0.85)';
                mmCtx.fillRect(0, 0, mmW_css, mmH_css);

                var cellW = mmW_css / cols;
                var cellH = mmH_css / rows;
                mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';

                var _mmMOR = mmMobOriginR, _mmMOC = mmMobOriginC, _mmMCols = cols, _mmMRows = rows;
                liveCells.forEach(function(_, key){
                    var parts = key.split(',');
                    var kr = parseInt(parts[0], 10) - _mmMOR;
                    var kc = parseInt(parts[1], 10) - _mmMOC;
                    if(kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
                    var px = Math.floor(kc * cellW);
                    var py = Math.floor(kr * cellH);
                    var pw = Math.max(1, Math.ceil(cellW));
                    var ph = Math.max(1, Math.ceil(cellH));
                    mmCtx.fillRect(px, py, pw, ph);
                });

                // Border.
                mmCtx.strokeStyle = 'rgba(255,255,255,0.2)';
                mmCtx.lineWidth = 1;
                mmCtx.strokeRect(0.5, 0.5, mmW_css - 1, mmH_css - 1);

                // Viewport rectangle.
                var vpW = (this._canvas.width  / cellSize) * cellW;
                var vpH = (this._canvas.height / cellSize) * cellH;
                var vpX = (viewX - mmMobOriginC) * cellW;
                var vpY = (viewY - mmMobOriginR) * cellH;
                mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
                mmCtx.lineWidth = 1;
                mmCtx.strokeRect(vpX + 0.5, vpY + 0.5, Math.min(vpW, mmW_css - vpX), Math.min(vpH, mmH_css - vpY));

                // Resize HTML canvas if needed and blit
                if(this._mobileMinimap.width !== mmW_css || this._mobileMinimap.height !== mmH_css){
                    this._mobileMinimap.width  = mmW_css;
                    this._mobileMinimap.height = mmH_css;
                }
                var mobileCtx = this._mobileMinimap.getContext('2d');
                mobileCtx.drawImage(this._minimapCanvas, 0, 0);
            },

            renderStats : function(){
                var population = this.state.liveCells.size;
                var hc = this.state.hoverCell;
                var coordText = hc ? ('Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r) : '\u2014';
                var sparkline = this.renderSparklineSVG();

                return (
                    <div className="stats">
                        <div className="stat-row">
                            <span>{"Gen: " + this.state.generations.toLocaleString()}</span>
                            <span className="board-dims">{this.state.cols + "\u00d7" + this.state.rows}</span>
                        </div>
                        <div className="stat-row">
                            <div className="status-badges">
                                <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                    {this.state.running ? "Running" : "Paused"}
                                </span>
                                {this.state.stable &&
                                    <span className="status-indicator status-stable">Stable</span>
                                }
                            </div>
                            <div className="coord-display">{coordText}</div>
                        </div>
                        {sparkline || (
                            <div className="sparkline-placeholder">
                                {"Pop: " + population.toLocaleString()}
                            </div>
                        )}
                    </div>
                );
            },

            renderMobileContextPanel : function(){
                var self = this;
                var showRotation = this.state.drawMode === 'preset' && this.state.selectedPattern;
                var showSelection = this.state.selection !== null;
                if(!showRotation && !showSelection){ return null; }
                return (
                    <div className="mobile-context-panel">
                        {showRotation &&
                            <div className="rotation-row">
                                <canvas className="rotation-preview" width="96" height="96"
                                    ref={function(c){ self._mobilePreviewCanvas = c; }} />
                                <div className="rotation-btns">
                                    <button className="btn btn-rotate" onClick={this.rotateCCW}
                                        title="Rotate 90° counter-clockwise">&#8634;</button>
                                    <button className="btn btn-rotate" onClick={this.rotateCW}
                                        title="Rotate 90° clockwise">&#8635;</button>
                                </div>
                                <p className="placement-hint">
                                    {this.state.selectedPattern}
                                    <br/><span className="placement-hint-sub">Tap canvas to place</span>
                                </p>
                            </div>
                        }
                        {showSelection &&
                            <div className="buttons buttons-selection">
                                <button className="btn" onClick={this.copySelection}
                                    disabled={!this.state.selection}>Copy</button>
                                <button className="btn" onClick={this.pasteAsPattern}
                                    disabled={!this.state.clipboard || this.state.clipboard.length === 0}>Paste</button>
                                <button className="btn" onClick={this.deleteSelection}
                                    disabled={!this.state.selection}>Delete</button>
                            </div>
                        }
                    </div>
                );
            },

            renderMobileStatsBar : function(){
                var population = this.state.liveCells.size;
                var hist = this.state.popHistory;
                var trendArrow = '';
                if(hist.length >= 5){
                    var delta = hist[hist.length - 1] - hist[hist.length - 5];
                    trendArrow = delta > 2 ? ' \u25b2' : delta < -2 ? ' \u25bc' : ' \u223c';
                }
                var statusLabel = this.state.stable ? 'Stable' :
                                  (this.state.running ? 'Running' : 'Paused');
                var statusClass = this.state.stable ? 'status-stable' :
                                  (this.state.running ? 'status-running' : 'status-paused');
                var contextLabel = this.state.drawMode === 'preset' && this.state.selectedPattern
                    ? this.state.selectedPattern
                    : (this.state.drawMode === 'select' ? 'Select' : 'Draw');
                return (
                    <div className="mobile-stats-bar">
                        <span className="msb-left">
                            <span className="msb-title">{"Conway's Game of Life"}</span>
                            {'Gen\u00a0' + this.state.generations.toLocaleString()
                             + '\u2002Pop\u00a0' + population.toLocaleString() + trendArrow}
                        </span>
                        <span className={'status-indicator ' + statusClass}>{statusLabel}</span>
                        <span className="msb-right">{contextLabel}</span>
                    </div>
                );
            },

            // ── Horizontal toolbar (desktop/tablet only — hidden on mobile via CSS) ──
            renderToolbar : function(){
                var self = this;
                return (
                    <div className="toolbar-strip">
                        <span className="toolbar-title">{"Conway's\nGame of Life"}</span>
                        <div className="toolbar-groups">
                            <div className="toolbar-group">
                                <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame} title="Start or pause the simulation (Space)">{this.state.running ? "Pause" : "Play"}</button>
                                <button className="btn" onClick={this.stepGame} title="Advance one generation (Enter)">Step</button>
                                <button className="btn" onClick={this.stepBack} title="Step backward to a previous generation (,)" disabled={this._genHistory.length === 0}>Back</button>
                                <select className="toolbar-step-select" value={this.state.stepCount} onChange={this.setStepCount} title="Advance N generations at once (Shift+.)">
                                    <option value="1">+1</option>
                                    <option value="10">+10</option>
                                    <option value="50">+50</option>
                                    <option value="100">+100</option>
                                    <option value="500">+500</option>
                                </select>
                                <button className="btn" onClick={function(){ self.stepN(self.state.stepCount); }} title="Advance multiple generations (Shift+.)">Go</button>
                            </div>
                            <div className="toolbar-group">
                                <button className="btn" onClick={this.resetGame} title="Randomize the board (R)">Reset</button>
                                <button className="btn" onClick={this.emptyBoard} title="Clear all cells (E)">Empty</button>
                                <button className="btn" onClick={this.undo} title="Undo last edit (Ctrl+Z)">Undo</button>
                            </div>
                            <div className="toolbar-group">
                                <button className="btn" onClick={this.fitView} title="Zoom to fit entire grid">Fit Grid</button>
                                <button className="btn" onClick={this.fitLiveCells} title="Zoom to fit live cells">Fit Cells</button>
                                <button className={"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick={this.toggleGridLines} title="Toggle grid lines (G)">Grid</button>
                                <button className={"btn btn-toggle" + (this.state.showTrails ? " active" : "")} onClick={this.toggleTrails} title="Show ghost trails of recently-dead cells">Trails</button>
                                <button className={"btn btn-toggle" + (this.state.showMinimap ? " active" : "")} onClick={this.toggleMinimap} title="Show/hide minimap overview (M)">Minimap</button>
                            </div>
                            <div className="toolbar-group">
                                <button className={"btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : "")} onClick={this.toggleDrawMode} title="Freehand draw mode (D)">Draw</button>
                                <button className={"btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : "")} onClick={this.togglePresetMode} title="Place preset patterns (P)">Preset</button>
                                <button className={"btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : "")} onClick={this.toggleSelectMode} title="Select and move cells (S)">Select</button>
                                <button className={"btn btn-toggle" + (this.state.livePaintMode ? " active" : "")} onClick={this.toggleLivePaint} title="Paint cells while the simulation is running">Live Paint</button>
                                <button className={"btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : "")} onClick={this.toggleBoundary} title="Cycle boundary: Wrap → Hard → Infinite">{this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E"}</button>
                            </div>
                            <div className="toolbar-group">
                                <button className="btn" onClick={this.analyzePattern} disabled={this.state.analyzing} title="Detect oscillator period or spaceship velocity">Analyze</button>
                            </div>
                        </div>
                    </div>
                );
            },

            renderButtons : function(){
                var self = this;
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
                    <div className="buttons-container">
                        {/* Simulation buttons: shown in sidebar on mobile only.
                            On desktop/tablet these live in the toolbar. */}
                        <div className="sidebar-section sidebar-btn-groups">
                            <div className="sidebar-section-title">Simulation</div>
                            <div className="btn-section">
                                <div className="buttons">
                                    <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame} title="Start or pause the simulation (Space)">{this.state.running ? "Pause" : "Play"}</button>
                                    <button className="btn" onClick={this.stepGame} title="Advance one generation (Enter)">Step</button>
                                    <button className="btn" onClick={this.stepBack} disabled={this._genHistory.length === 0} title="Step backward to a previous generation (,)">Back</button>
                                    <button className="btn" onClick={this.resetGame} title="Randomize the board (R)">Reset</button>
                                    <button className="btn" onClick={this.emptyBoard} title="Clear all cells (E)">Empty</button>
                                    <button className="btn" onClick={this.undo} title="Undo last edit (Ctrl+Z)">Undo</button>
                                </div>
                                <div className="buttons buttons-secondary" style={{gridTemplateColumns:'1fr 1fr'}}>
                                    <select className="btn" value={this.state.stepCount} onChange={this.setStepCount} title="Advance N generations at once (Shift+.)">
                                        <option value="1">+1 gen</option>
                                        <option value="10">+10 gen</option>
                                        <option value="50">+50 gen</option>
                                        <option value="100">+100 gen</option>
                                        <option value="500">+500 gen</option>
                                    </select>
                                    <button className="btn" onClick={function(){ self.stepN(self.state.stepCount); }} title="Advance multiple generations (Shift+.)">Go</button>
                                </div>
                                <div className="buttons buttons-secondary">
                                    <button className="btn" onClick={this.fitView} title="Zoom to fit entire grid">Fit Grid</button>
                                    <button className="btn" onClick={this.fitLiveCells} title="Zoom to fit live cells">Fit Cells</button>
                                    <button className={"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick={this.toggleGridLines} title="Toggle grid lines (G)">Grid</button>
                                    <button className={"btn btn-toggle" + (this.state.showTrails ? " active" : "")} onClick={this.toggleTrails} title="Show ghost trails of recently-dead cells">Trails</button>
                                    <button className={"btn btn-toggle btn-minimap-full" + (this.state.showMinimap ? " active" : "")} onClick={this.toggleMinimap} title="Show/hide minimap overview (M)">Minimap</button>
                                </div>
                                <div className="buttons buttons-secondary">
                                    <button className={"btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : "")} onClick={this.toggleDrawMode} title="Freehand draw mode (D)">Draw</button>
                                    <button className={"btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : "")} onClick={this.togglePresetMode} title="Place preset patterns (P)">Preset</button>
                                    <button className={"btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : "")} onClick={this.toggleSelectMode} title="Select and move cells (S)">Select</button>
                                    <button className={"btn btn-toggle" + (this.state.livePaintMode ? " active" : "")} onClick={this.toggleLivePaint} title="Paint cells while the simulation is running">Live Paint</button>
                                    <button className={"btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : "")} onClick={this.toggleBoundary} title="Cycle boundary: Wrap → Hard → Infinite">{this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E"}</button>
                                    <button className="btn" onClick={this.analyzePattern} disabled={this.state.analyzing} title="Detect oscillator period or spaceship velocity">Analyze</button>
                                </div>
                            </div>
                        </div>
                        {/* Tool controls: always in sidebar on all screen sizes. */}
                        <div className="sidebar-section sidebar-tools-section">
                            <div className="sidebar-section-title">Tools</div>
                            <div className="btn-section">
                                <div className="tool-subtype-row">
                                    <label className="tool-label">Draw:</label>
                                    <select value={this.state.drawTool}
                                            onChange={function(e){ self.setState({drawTool: e.target.value, drawMode: 'paint', selection: null}); }}>
                                        <option value="cell">Cell paint</option>
                                        <option value="line">Line</option>
                                        <option value="fill">Flood fill</option>
                                        <option value="shape-rect">Rectangle</option>
                                        <option value="shape-circle">Circle</option>
                                    </select>
                                </div>
                                <div className="tool-subtype-row">
                                    <label className="tool-label">Select:</label>
                                    <select value={this.state.selectTool}
                                            onChange={function(e){ self.setState({selectTool: e.target.value, drawMode: 'select', selection: null}); }}>
                                        <option value="rect">Rectangle</option>
                                        <option value="ellipse">Ellipse</option>
                                        <option value="freeform">Freeform</option>
                                        <option value="all-visible">All visible</option>
                                    </select>
                                </div>
                                <div className="tool-subtype-row">
                                    <label className="tool-label">Preset:</label>
                                    <select className={"preset-select" + (this.state.drawMode === 'preset' && this.state.selectedPattern ? " active" : "")}
                                        value={this.state.selectedPattern || ""}
                                        onChange={this.selectPattern}>
                                        <option value="">Choose preset...</option>
                                        {patternOptions}
                                    </select>
                                </div>
                                <input className="pattern-filter-input"
                                    type="text"
                                    placeholder="Filter patterns..."
                                    value={this.state.patternFilter}
                                    onChange={function(e){ self.setState({patternFilter: e.target.value}); }} />
                                {this.state.drawMode === 'preset' && this.state.selectedPattern &&
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
                                {this.state.drawMode === 'preset' && this.state.selectedPattern &&
                                    <p className="placement-hint">
                                        {"Click canvas to place \xB7 " + this.state.selectedPattern}
                                        <br/>
                                        <span className="placement-hint-sub">Right-click or Esc to cancel</span>
                                    </p>
                                }
                                {this.state.selection &&
                                    <div className="buttons buttons-selection">
                                        <button className="btn" onClick={this.copySelection} title="Copy selected cells">Copy</button>
                                        <button className="btn" onClick={this.pasteAsPattern}
                                            disabled={!this.state.clipboard || this.state.clipboard.length === 0} title="Paste copied cells">Paste</button>
                                        <button className="btn" onClick={this.deleteSelection} title="Delete selected cells (Delete)">Delete</button>
                                    </div>
                                }
                                <div className="buttons buttons-export">
                                    <button className="btn" onClick={this.exportPNG} title="Save the current board as a PNG image">Export PNG</button>
                                    <button className="btn" onClick={this.copyRLE} title="Copy board state as RLE to clipboard">Copy RLE</button>
                                    <button className={"btn btn-toggle" + (this.state.recording ? " active btn-record" : "")} onClick={this.toggleRecording} title="Record an animated GIF of the simulation">{this.state.recording ? "Stop" : "Record"}</button>
                                    <button className="btn" onClick={this.shareURL} title="Copy a shareable URL to clipboard">{this.state.shareTooltip ? "Copied!" : "Share"}</button>
                                </div>
                                <div className="buttons buttons-help">
                                    <button className="btn" onClick={this.toggleHelp} title="Show keyboard shortcuts and help (?)">Help</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            },

            renderRulesSection : function(){
                var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
                return (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Rules &amp; Display</div>
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
                            <select className="rule-preset-select"
                                value={this.state.darkModePref}
                                onChange={this.setDarkModePref}
                                title="UI dark mode preference">
                                <option value="system">Mode: System</option>
                                <option value="light">Mode: Light</option>
                                <option value="dark">Mode: Dark</option>
                            </select>
                            <label className="slider-title rule-label">Rule (B/S notation)</label>
                            <input className={"rule-input" + (ruleValid ? "" : " rule-input-invalid")}
                                type="text"
                                value={this.state.ruleString}
                                onChange={this.setRule}
                                title="Birth/Survival rule string (e.g. B3/S23)" />
                        </div>
                    </div>
                );
            },

            renderSliders : function(){
                var delay = SPEED_DELAYS[this.state.speed - 1];
                var speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
                var isUnbounded = this.state.boundary === 'unbounded';
                return (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Board</div>
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title">{"Width: " + this.state.pendingCols}</label>
                            <div className="slider-row">
                                <input type="range" min="20" max="2000" step="10"
                                    value={this.state.pendingCols}
                                    onChange={this.setWidth}
                                    onMouseUp={this.applyWidth}
                                    onKeyDown={this.onWidthKeyDown}
                                    onTouchEnd={this.applyWidth} />
                            </div>
                        </div>}
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title">{"Height: " + this.state.pendingRows}</label>
                            <div className="slider-row">
                                <input type="range" min="20" max="2000" step="10"
                                    value={this.state.pendingRows}
                                    onChange={this.setHeight}
                                    onMouseUp={this.applyHeight}
                                    onKeyDown={this.onHeightKeyDown}
                                    onTouchEnd={this.applyHeight} />
                            </div>
                        </div>}
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title">Grid presets</label>
                            <div className="grid-presets">
                                <button className="btn btn-xs" onClick={function(){this.applyGridPreset(100,100)}.bind(this)}>100²</button>
                                <button className="btn btn-xs" onClick={function(){this.applyGridPreset(200,200)}.bind(this)}>200²</button>
                                <button className="btn btn-xs" onClick={function(){this.applyGridPreset(400,400)}.bind(this)}>400²</button>
                                <button className="btn btn-xs" onClick={function(){this.applyGridPreset(1000,1000)}.bind(this)}>1000²</button>
                                <button className="btn btn-xs" onClick={function(){this.applyGridPreset(2000,2000)}.bind(this)}>2000²</button>
                            </div>
                        </div>}
                        {isUnbounded && <div className="sliders">
                            <label className="slider-title" style={{fontStyle:'italic'}}>Infinite grid — no dimension limits</label>
                        </div>}
                        <div className="sliders">
                            <label className="slider-title">Fill Density (on Reset)</label>
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
                                <input type="range" min="1" max="32" step="1"
                                    value={this.state.cellSize}
                                    onChange={this.setZoom} />
                            </div>
                        </div>
                    </div>
                );
            },

            renderRLESection : function(){
                return (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Import / Export</div>
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
                );
            },

            // ── Shared sub-components (used by all layout modes) ───────────

            renderCanvas : function(cs){
                return (
                    <div className={"app-canvas-container" + (this.state.boundary === 'toroidal' ? " boundary-wrap" : "")}>
                        <canvas className="display"
                            width  = {cs.w}
                            height = {cs.h}
                            style  = {{width: cs.displayW + 'px', height: cs.displayH + 'px', display: 'block', margin: 'auto'}}
                            id = "life-canvas"
                            role = "img"
                            aria-label = {"Conway's Game of Life simulation canvas. Generation " + this.state.generations + ", population " + this.state.liveCells.size + ", " + (this.state.running ? "running" : "paused")}
                            draggable     = {false}
                            onMouseDown   = {this.onMouseDown}
                            onMouseMove   = {this.onMouseMove}
                            onMouseUp     = {this.onMouseUp}
                            onMouseLeave  = {this.onMouseLeave}
                            onContextMenu = {this.onContextMenu}
                            onTouchStart  = {this.onTouchStart}
                            onTouchMove   = {this.onTouchMove}
                            onTouchEnd    = {this.onTouchEnd}></canvas>
                        {this.state.analysisResult ? <div className={"analysis-result" + (this.state.analyzing ? " analysis-cancellable" : "")} onClick={this.state.analyzing ? this.cancelAnalysis : null}>{this.state.analysisResult}</div> : null}
                    </div>
                );
            },

            renderTransportControls : function(compact){
                var self = this;
                if(compact){
                    return (
                        <div className="transport-controls transport-compact">
                            <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame} title="Play/Pause (Space)">{this.state.running ? "\u23F8" : "\u25B6"}</button>
                            <button className="btn" onClick={this.stepGame} title="Step (.)">Step</button>
                            <span className="transport-speed-label">{"Gen " + this.state.generations.toLocaleString()}</span>
                        </div>
                    );
                }
                return (
                    <div className="transport-controls">
                        <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame} title="Start or pause the simulation (Space)">{this.state.running ? "Pause" : "Play"}</button>
                        <button className="btn" onClick={this.stepGame} title="Advance one generation (Enter)">Step</button>
                        <button className="btn" onClick={this.stepBack} title="Step backward (,)" disabled={this._genHistory && this._genHistory.length === 0}>Back</button>
                        <select className="toolbar-step-select" value={this.state.stepCount} onChange={this.setStepCount} title="Advance N generations">
                            <option value="1">+1</option>
                            <option value="10">+10</option>
                            <option value="50">+50</option>
                            <option value="100">+100</option>
                            <option value="500">+500</option>
                        </select>
                        <button className="btn" onClick={function(){ self.stepN(self.state.stepCount); }} title="Advance multiple generations">Go</button>
                        <button className="btn" onClick={this.resetGame} title="Randomize the board (R)">Reset</button>
                        <button className="btn" onClick={this.emptyBoard} title="Clear all cells (E)">Empty</button>
                        <button className="btn" onClick={this.undo} title="Undo last edit (Ctrl+Z)">Undo</button>
                    </div>
                );
            },

            renderViewControls : function(){
                return (
                    <div className="view-controls">
                        <button className="btn" onClick={this.fitView} title="Zoom to fit entire grid">Fit Grid</button>
                        <button className="btn" onClick={this.fitLiveCells} title="Zoom to fit live cells">Fit Cells</button>
                        <button className={"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick={this.toggleGridLines} title="Toggle grid lines (G)">Grid</button>
                        <button className={"btn btn-toggle" + (this.state.showTrails ? " active" : "")} onClick={this.toggleTrails} title="Show ghost trails">Trails</button>
                        <button className={"btn btn-toggle" + (this.state.showMinimap ? " active" : "")} onClick={this.toggleMinimap} title="Show/hide minimap (M)">Minimap</button>
                    </div>
                );
            },

            renderModeControls : function(){
                return (
                    <div className="mode-controls">
                        <button className={"btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : "")} onClick={this.toggleDrawMode} title="Freehand draw mode (D)">Draw</button>
                        <button className={"btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : "")} onClick={this.togglePresetMode} title="Place preset patterns (P)">Preset</button>
                        <button className={"btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : "")} onClick={this.toggleSelectMode} title="Select and move cells (S)">Select</button>
                        <button className={"btn btn-toggle" + (this.state.livePaintMode ? " active" : "")} onClick={this.toggleLivePaint} title="Paint while running">Live Paint</button>
                        <button className={"btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : "")} onClick={this.toggleBoundary} title="Cycle boundary">{this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E"}</button>
                        <button className="btn" onClick={this.analyzePattern} disabled={this.state.analyzing} title="Detect oscillator/spaceship">Analyze</button>
                    </div>
                );
            },

            renderToolsContent : function(){
                var self = this;
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
                        <div className="sidebar-section-title">Tools</div>
                        <div className="btn-section">
                            <div className="tool-subtype-row">
                                <label className="tool-label">Draw:</label>
                                <select value={this.state.drawTool}
                                        onChange={function(e){ self.setState({drawTool: e.target.value, drawMode: 'paint', selection: null}); }}>
                                    <option value="cell">Cell paint</option>
                                    <option value="line">Line</option>
                                    <option value="fill">Flood fill</option>
                                    <option value="shape-rect">Rectangle</option>
                                    <option value="shape-circle">Circle</option>
                                </select>
                            </div>
                            <div className="tool-subtype-row">
                                <label className="tool-label">Select:</label>
                                <select value={this.state.selectTool}
                                        onChange={function(e){ self.setState({selectTool: e.target.value, drawMode: 'select', selection: null}); }}>
                                    <option value="rect">Rectangle</option>
                                    <option value="ellipse">Ellipse</option>
                                    <option value="freeform">Freeform</option>
                                    <option value="all-visible">All visible</option>
                                </select>
                            </div>
                            <div className="tool-subtype-row">
                                <label className="tool-label">Preset:</label>
                                <select className={"preset-select" + (this.state.drawMode === 'preset' && this.state.selectedPattern ? " active" : "")}
                                    value={this.state.selectedPattern || ""}
                                    onChange={this.selectPattern}>
                                    <option value="">Choose preset...</option>
                                    {patternOptions}
                                </select>
                            </div>
                            <input className="pattern-filter-input"
                                type="text" placeholder="Filter patterns..."
                                value={this.state.patternFilter}
                                onChange={function(e){ self.setState({patternFilter: e.target.value}); }} />
                            {this.state.drawMode === 'preset' && this.state.selectedPattern &&
                                <div className="rotation-row">
                                    <canvas className="rotation-preview" width="96" height="96"
                                        ref={function(c){ self._previewCanvas = c; }} />
                                    <div className="rotation-btns">
                                        <button className="btn btn-rotate" onClick={this.rotateCCW} title="Rotate 90° CCW">&#8634;</button>
                                        <button className="btn btn-rotate" onClick={this.rotateCW} title="Rotate 90° CW">&#8635;</button>
                                    </div>
                                </div>
                            }
                            {this.state.drawMode === 'preset' && this.state.selectedPattern &&
                                <p className="placement-hint">
                                    {"Click canvas to place \xB7 " + this.state.selectedPattern}
                                    <br/><span className="placement-hint-sub">Right-click or Esc to cancel</span>
                                </p>
                            }
                            {this.state.selection &&
                                <div className="buttons buttons-selection">
                                    <button className="btn" onClick={this.copySelection}>Copy</button>
                                    <button className="btn" onClick={this.pasteAsPattern}
                                        disabled={!this.state.clipboard || this.state.clipboard.length === 0}>Paste</button>
                                    <button className="btn" onClick={this.deleteSelection}>Delete</button>
                                </div>
                            }
                        </div>
                    </div>
                );
            },

            renderExportContent : function(){
                return (
                    <div className="export-content">
                        <div className="sidebar-section-title">Export &amp; Import</div>
                        <div className="btn-section">
                            <div className="buttons buttons-export">
                                <button className="btn" onClick={this.exportPNG} title="Save as PNG">Export PNG</button>
                                <button className="btn" onClick={this.copyRLE} title="Copy board as RLE">Copy RLE</button>
                                <button className={"btn btn-toggle" + (this.state.recording ? " active btn-record" : "")} onClick={this.toggleRecording}>{this.state.recording ? "Stop" : "Record"}</button>
                                <button className="btn" onClick={this.shareURL}>{this.state.shareTooltip ? "Copied!" : "Share"}</button>
                            </div>
                            {this.renderRLESection()}
                        </div>
                    </div>
                );
            },

            renderLayoutSwitcher : function(){
                var self = this;
                var mode = this.state.layoutMode;
                return (
                    <div className="layout-switcher">
                        <button className={"btn btn-toggle" + (mode === 'cartographer' ? " active" : "")}
                            onClick={function(){ self.setLayoutMode('cartographer'); }}
                            title="Cartographer: Edge rail with tabs"
                            aria-label="Cartographer layout: edge rail with tabs">
                            <i className="fa fa-columns"></i>
                        </button>
                        <button className={"btn btn-toggle" + (mode === 'specimen' ? " active" : "")}
                            onClick={function(){ self.setLayoutMode('specimen'); }}
                            title="Specimen: Contextual toolbar"
                            aria-label="Specimen layout: contextual toolbar">
                            <i className="fa fa-window-maximize"></i>
                        </button>
                        <button className={"btn btn-toggle" + (mode === 'observatory' ? " active" : "")}
                            onClick={function(){ self.setLayoutMode('observatory'); }}
                            title="Observatory: Floating panels"
                            aria-label="Observatory layout: floating panels">
                            <i className="fa fa-th-large"></i>
                        </button>
                    </div>
                );
            },

            // ── Cartographer layout ─────────────────────────────────────────

            renderCartographer : function(cs){
                var self = this;
                var dc = this.state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

                if(isMobile){
                    return this.renderCartographerMobile(cs);
                }

                var railW = this.state.railHidden ? 0 : (this.state.railCollapsed ? 40 : (dc === 'tablet' ? 200 : 240));
                var railSide = this.state.railSide;
                var railClass = 'rail' +
                    (this.state.railCollapsed ? ' rail-collapsed' : '') +
                    (this.state.railHidden ? ' rail-hidden' : '') +
                    (' rail-' + railSide);

                var tabContent = null;
                switch(this.state.railTab){
                    case 'simulate':
                        tabContent = (
                            <div className="rail-tab-content">
                                <div className="sidebar-section-title">Simulation</div>
                                {this.renderTransportControls(false)}
                                {this.renderViewControls()}
                                {this.renderModeControls()}
                            </div>
                        );
                        break;
                    case 'tools':
                        tabContent = <div className="rail-tab-content">{this.renderToolsContent()}</div>;
                        break;
                    case 'board':
                        tabContent = <div className="rail-tab-content">{this.renderSliders()}</div>;
                        break;
                    case 'rules':
                        tabContent = (
                            <div className="rail-tab-content">
                                {this.renderRulesSection()}
                            </div>
                        );
                        break;
                    case 'export':
                        tabContent = <div className="rail-tab-content">{this.renderExportContent()}</div>;
                        break;
                }

                var tabs = [
                    {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
                    {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
                    {id: 'board',    icon: 'fa-th',       label: 'Board'},
                    {id: 'rules',    icon: 'fa-cog',      label: 'Rules'},
                    {id: 'export',   icon: 'fa-download', label: 'Export'}
                ];

                return (
                    <div className="layout-cartographer">
                        {this.renderCanvas(cs)}
                        {/* Rail */}
                        <div className={railClass} style={{width: railW + 'px'}}
                            role="complementary" aria-label="Controls panel">
                            <div className="rail-header">
                                <span className="rail-title">{"Conway's Game of Life"}</span>
                                <div className="rail-header-controls">
                                    <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                        <i className="fa fa-question-circle" aria-hidden="true"></i>
                                    </button>
                                    <button className="btn rail-collapse-btn" onClick={this.toggleRailCollapsed}
                                        aria-expanded={!this.state.railCollapsed}
                                        aria-label={this.state.railCollapsed ? "Expand controls panel" : "Collapse controls panel"}>
                                        {this.state.railCollapsed ? "\u25C0" : "\u25B6"}
                                    </button>
                                </div>
                            </div>
                            {!this.state.railCollapsed && <div className="rail-stats">{this.renderStats()}</div>}
                            <div className="rail-tabs" role="tablist" aria-label="Control categories">
                                {tabs.map(function(tab){
                                    var isActive = self.state.railTab === tab.id;
                                    return (
                                        <button key={tab.id}
                                            className={"rail-tab" + (isActive ? " active" : "")}
                                            onClick={function(){ self.setRailTab(tab.id); }}
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls={"rail-panel-" + tab.id}
                                            aria-label={tab.label}>
                                            <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                            {!self.state.railCollapsed && <span className="rail-tab-label">{tab.label}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            {!this.state.railCollapsed &&
                                <div id={"rail-panel-" + this.state.railTab} role="tabpanel"
                                    aria-label={this.state.railTab + " controls"}>
                                    {tabContent}
                                </div>
                            }
                            {!this.state.railCollapsed &&
                                <div style={{padding:'8px 12px', borderTop:'1px solid var(--panel-border)'}}>
                                    {this.renderLayoutSwitcher()}
                                </div>
                            }
                        </div>
                        {/* Floating transport strip */}
                        <div className="transport-strip" role="toolbar" aria-label="Simulation transport">
                            {this.renderTransportControls(true)}
                        </div>
                        {/* Rail show button when hidden */}
                        {this.state.railHidden &&
                            <div className={"rail-reveal rail-reveal-" + railSide}
                                onMouseEnter={this.toggleRailHidden}></div>
                        }
                    </div>
                );
            },

            renderCartographerMobile : function(cs){
                var self = this;
                var tabs = [
                    {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
                    {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
                    {id: 'board',    icon: 'fa-th',       label: 'Board'},
                    {id: 'rules',    icon: 'fa-cog',      label: 'Rules'},
                    {id: 'export',   icon: 'fa-download', label: 'Export'}
                ];

                var sheetContent = null;
                switch(this.state.bottomSheetTab){
                    case 'simulate':
                        sheetContent = (
                            <div>
                                <div className="sidebar-section-title">Simulation</div>
                                {this.renderTransportControls(false)}
                                {this.renderViewControls()}
                                {this.renderModeControls()}
                            </div>
                        );
                        break;
                    case 'tools':
                        sheetContent = this.renderToolsContent();
                        break;
                    case 'board':
                        sheetContent = this.renderSliders();
                        break;
                    case 'rules':
                        sheetContent = this.renderRulesSection();
                        break;
                    case 'export':
                        sheetContent = this.renderExportContent();
                        break;
                }

                return (
                    <div className="layout-cartographer layout-mobile">
                        {this.renderCanvas(cs)}
                        {/* Stats overlay chip */}
                        <div className="stats-chip" onClick={this.togglePopGraph}>
                            <span>{"Gen " + this.state.generations.toLocaleString()}</span>
                            <span>{"\u2002Pop " + this.state.liveCells.size.toLocaleString()}</span>
                            <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                {this.state.stable ? "Stable" : (this.state.running ? "Run" : "Pause")}
                            </span>
                        </div>
                        {/* Mobile context: rotation preview + selection when active */}
                        {this.renderMobileContextPanel()}
                        {this.renderMobileMinimapArea()}
                        {/* Bottom transport bar */}
                        <div className="mobile-transport-bar" role="toolbar" aria-label="Simulation transport">
                            <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame}
                                aria-label={this.state.running ? "Pause simulation" : "Play simulation"}>
                                {this.state.running ? "\u23F8" : "\u25B6"}
                            </button>
                            <button className="btn" onClick={this.stepGame} aria-label="Step one generation">Step</button>
                            <button className={"btn btn-toggle" + (this.state.panMode ? " active" : "")}
                                onClick={this.togglePanMode}
                                aria-label={this.state.panMode ? "Switch to draw mode" : "Switch to pan mode"}
                                aria-pressed={this.state.panMode}>
                                <i className={"fa " + (this.state.panMode ? "fa-hand-paper-o" : "fa-arrows")} aria-hidden="true"></i>
                            </button>
                            <span className="mobile-transport-mode" aria-live="polite">
                                {this.state.panMode ? 'Pan'
                                    : (this.state.drawMode === 'preset' && this.state.selectedPattern
                                    ? this.state.selectedPattern
                                    : (this.state.drawMode === 'select' ? 'Select' : 'Draw'))}
                            </span>
                            <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                <i className="fa fa-question-circle" aria-hidden="true"></i>
                            </button>
                            <button className={"btn btn-toggle btn-sheet-toggle" + (this.state.bottomSheetOpen ? " active" : "")}
                                onClick={this.toggleBottomSheet}
                                aria-expanded={this.state.bottomSheetOpen}
                                aria-label="Open controls panel">More</button>
                        </div>
                        {/* Bottom sheet */}
                        {this.state.bottomSheetOpen &&
                            <div className="bottom-sheet-container"
                                onKeyDown={function(e){ self._onSheetKeyDown(e); }}>
                                <div className="bottom-sheet-backdrop" onClick={this.toggleBottomSheet}
                                    role="presentation" aria-hidden="true"></div>
                                <div className={"bottom-sheet" + (this.state.bottomSheetClosing ? " sheet-closing" : "")} role="dialog" aria-modal="true"
                                    aria-label="Controls panel"
                                    onTouchStart={function(e){ self._onSheetTouchStart(e); }}
                                    onTouchMove={function(e){ self._onSheetTouchMove(e); }}
                                    onTouchEnd={function(e){ self._onSheetTouchEnd(e); }}>
                                    <div className="bottom-sheet-handle"></div>
                                    <div className="bottom-sheet-tabs" role="tablist" aria-label="Control categories">
                                        {tabs.map(function(tab){
                                            var isActive = self.state.bottomSheetTab === tab.id;
                                            return (
                                                <button key={tab.id}
                                                    className={"rail-tab" + (isActive ? " active" : "")}
                                                    onClick={function(){ self.setBottomSheetTab(tab.id); }}
                                                    role="tab" aria-selected={isActive} aria-label={tab.label}
                                                    aria-controls={"sheet-panel-" + tab.id}>
                                                    <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                                    <span className="rail-tab-label">{tab.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="bottom-sheet-content"
                                        id={"sheet-panel-" + this.state.bottomSheetTab}
                                        role="tabpanel"
                                        aria-label={this.state.bottomSheetTab + " controls"}>
                                        {sheetContent}
                                    </div>
                                    <div style={{padding:'8px 12px 0', borderTop:'1px solid var(--panel-border)'}}>
                                        {this.renderLayoutSwitcher()}
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                );
            },

            // ── Specimen layout ──────────────────────────────────────────────

            renderSpecimen : function(cs){
                var self = this;
                var dc = this.state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

                if(isMobile){
                    return this.renderSpecimenMobile(cs);
                }

                var trayContent = null;
                switch(this.state.contextTrayContent){
                    case 'simulate':
                        trayContent = (
                            <div>
                                {this.renderTransportControls(false)}
                                {this.renderViewControls()}
                            </div>
                        );
                        break;
                    case 'tools': trayContent = this.renderToolsContent(); break;
                    case 'board': trayContent = this.renderSliders(); break;
                    case 'rules': trayContent = this.renderRulesSection(); break;
                    case 'export': trayContent = this.renderExportContent(); break;
                }

                return (
                    <div className="layout-specimen">
                        {this.renderCanvas(cs)}
                        {/* Top bar */}
                        <div className="top-bar" role="toolbar" aria-label="Main toolbar">
                            <div className="top-bar-left">
                                <span className="top-bar-title">{"Conway's Game of Life"}</span>
                            </div>
                            <div className="top-bar-center">
                                {this.renderTransportControls(true)}
                            </div>
                            <div className="top-bar-right">
                                {this.renderModeControls()}
                                <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                    <i className="fa fa-question-circle" aria-hidden="true"></i>
                                </button>
                                <div className="top-bar-more" role="group" aria-label="Settings panels">
                                    <button className={"btn btn-toggle" + (this.state.contextTrayContent === 'simulate' && this.state.contextTrayOpen ? " active" : "")}
                                        onClick={function(){ self.state.contextTrayContent === 'simulate' && self.state.contextTrayOpen ? self.closeContextTray() : self.openContextTray('simulate'); }}
                                        aria-expanded={this.state.contextTrayContent === 'simulate' && this.state.contextTrayOpen}>Sim</button>
                                    <button className={"btn btn-toggle" + (this.state.contextTrayContent === 'tools' && this.state.contextTrayOpen ? " active" : "")}
                                        onClick={function(){ self.state.contextTrayContent === 'tools' && self.state.contextTrayOpen ? self.closeContextTray() : self.openContextTray('tools'); }}
                                        aria-expanded={this.state.contextTrayContent === 'tools' && this.state.contextTrayOpen}>Tools</button>
                                    <button className={"btn btn-toggle" + (this.state.contextTrayContent === 'board' && this.state.contextTrayOpen ? " active" : "")}
                                        onClick={function(){ self.state.contextTrayContent === 'board' && self.state.contextTrayOpen ? self.closeContextTray() : self.openContextTray('board'); }}
                                        aria-expanded={this.state.contextTrayContent === 'board' && this.state.contextTrayOpen}>Board</button>
                                    <button className={"btn btn-toggle" + (this.state.contextTrayContent === 'rules' && this.state.contextTrayOpen ? " active" : "")}
                                        onClick={function(){ self.state.contextTrayContent === 'rules' && self.state.contextTrayOpen ? self.closeContextTray() : self.openContextTray('rules'); }}
                                        aria-expanded={this.state.contextTrayContent === 'rules' && this.state.contextTrayOpen}>Rules</button>
                                    <button className={"btn btn-toggle" + (this.state.contextTrayContent === 'export' && this.state.contextTrayOpen ? " active" : "")}
                                        onClick={function(){ self.state.contextTrayContent === 'export' && self.state.contextTrayOpen ? self.closeContextTray() : self.openContextTray('export'); }}
                                        aria-expanded={this.state.contextTrayContent === 'export' && this.state.contextTrayOpen}>Export</button>
                                </div>
                                {this.renderLayoutSwitcher()}
                            </div>
                        </div>
                        {/* Context tray */}
                        {this.state.contextTrayOpen &&
                            <div className={"context-tray" + (this.state.contextTrayPinned ? " pinned" : "")}
                                role="region" aria-label={this.state.contextTrayContent + " settings"}>
                                <div className="context-tray-header">
                                    <button className={"btn btn-toggle" + (this.state.contextTrayPinned ? " active" : "")}
                                        onClick={this.toggleContextTrayPin}
                                        aria-pressed={this.state.contextTrayPinned}
                                        aria-label="Pin tray open">
                                        <i className="fa fa-thumb-tack" aria-hidden="true"></i>
                                    </button>
                                    <button className="btn" onClick={function(){ self.setState({contextTrayOpen: false, contextTrayContent: null, contextTrayPinned: false}); }}
                                        aria-label="Close settings tray">&times;</button>
                                </div>
                                <div className="context-tray-body">
                                    {trayContent}
                                </div>
                            </div>
                        }
                        {/* HUD overlay */}
                        <div className="hud-overlay" onClick={this.togglePopGraph}
                            role="status" aria-live="polite" aria-label="Simulation statistics"
                            tabIndex="0">
                            <span>{"Gen " + this.state.generations.toLocaleString()}</span>
                            <span>{"\u2002Pop " + this.state.liveCells.size.toLocaleString()}</span>
                            <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                {this.state.stable ? "Stable" : (this.state.running ? "Run" : "Pause")}
                            </span>
                            {this.state.hoverCell &&
                                <span className="coord-display">{"Col\u00a0" + this.state.hoverCell.c + "\u2002Row\u00a0" + this.state.hoverCell.r}</span>
                            }
                        </div>
                    </div>
                );
            },

            renderSpecimenMobile : function(cs){
                var self = this;
                var tabs = [
                    {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
                    {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
                    {id: 'board',    icon: 'fa-th',       label: 'Board'},
                    {id: 'rules',    icon: 'fa-cog',      label: 'Rules'},
                    {id: 'export',   icon: 'fa-download', label: 'Export'}
                ];

                var sheetContent = null;
                switch(this.state.bottomSheetTab){
                    case 'simulate':
                        sheetContent = (
                            <div>
                                <div className="sidebar-section-title">Simulation</div>
                                {this.renderTransportControls(false)}
                                {this.renderViewControls()}
                                {this.renderModeControls()}
                            </div>
                        );
                        break;
                    case 'tools': sheetContent = this.renderToolsContent(); break;
                    case 'board': sheetContent = this.renderSliders(); break;
                    case 'rules': sheetContent = this.renderRulesSection(); break;
                    case 'export': sheetContent = this.renderExportContent(); break;
                }

                return (
                    <div className="layout-specimen layout-mobile">
                        {this.renderCanvas(cs)}
                        {/* Compact top bar */}
                        <div className="top-bar top-bar-mobile" role="toolbar" aria-label="Simulation transport">
                            <span className="stats-chip-inline">
                                {"Gen " + this.state.generations.toLocaleString() + "\u2002Pop " + this.state.liveCells.size.toLocaleString()}
                            </span>
                            <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame}
                                aria-label={this.state.running ? "Pause simulation" : "Play simulation"}>
                                {this.state.running ? "\u23F8" : "\u25B6"}
                            </button>
                            <button className="btn" onClick={this.stepGame} aria-label="Step one generation">Step</button>
                            <button className={"btn btn-toggle" + (this.state.panMode ? " active" : "")}
                                onClick={this.togglePanMode}
                                aria-label={this.state.panMode ? "Switch to draw mode" : "Switch to pan mode"}
                                aria-pressed={this.state.panMode}>
                                <i className={"fa " + (this.state.panMode ? "fa-hand-paper-o" : "fa-arrows")} aria-hidden="true"></i>
                            </button>
                            <span className="mobile-transport-mode" aria-live="polite">
                                {this.state.panMode ? 'Pan'
                                    : (this.state.drawMode === 'preset' && this.state.selectedPattern
                                    ? this.state.selectedPattern
                                    : (this.state.drawMode === 'select' ? 'Select' : 'Draw'))}
                            </span>
                            <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                <i className="fa fa-question-circle" aria-hidden="true"></i>
                            </button>
                            <button className={"btn btn-toggle btn-sheet-toggle" + (this.state.bottomSheetOpen ? " active" : "")}
                                onClick={this.toggleBottomSheet}
                                aria-expanded={this.state.bottomSheetOpen}
                                aria-label="Open controls panel">More</button>
                        </div>
                        {this.renderMobileContextPanel()}
                        {this.renderMobileMinimapArea()}
                        {/* Bottom sheet with tabs */}
                        {this.state.bottomSheetOpen &&
                            <div className="bottom-sheet-container"
                                onKeyDown={function(e){ self._onSheetKeyDown(e); }}>
                                <div className="bottom-sheet-backdrop" onClick={this.toggleBottomSheet}
                                    role="presentation" aria-hidden="true"></div>
                                <div className={"bottom-sheet" + (this.state.bottomSheetClosing ? " sheet-closing" : "")} role="dialog" aria-modal="true"
                                    aria-label="Controls panel"
                                    onTouchStart={function(e){ self._onSheetTouchStart(e); }}
                                    onTouchMove={function(e){ self._onSheetTouchMove(e); }}
                                    onTouchEnd={function(e){ self._onSheetTouchEnd(e); }}>
                                    <div className="bottom-sheet-handle"></div>
                                    <div className="bottom-sheet-tabs" role="tablist" aria-label="Control categories">
                                        {tabs.map(function(tab){
                                            var isActive = self.state.bottomSheetTab === tab.id;
                                            return (
                                                <button key={tab.id}
                                                    className={"rail-tab" + (isActive ? " active" : "")}
                                                    onClick={function(){ self.setBottomSheetTab(tab.id); }}
                                                    role="tab" aria-selected={isActive} aria-label={tab.label}
                                                    aria-controls={"sheet-panel-" + tab.id}>
                                                    <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                                    <span className="rail-tab-label">{tab.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="bottom-sheet-content"
                                        id={"sheet-panel-" + this.state.bottomSheetTab}
                                        role="tabpanel"
                                        aria-label={this.state.bottomSheetTab + " controls"}>
                                        {sheetContent}
                                    </div>
                                    <div style={{padding:'8px 12px 0', borderTop:'1px solid var(--panel-border)'}}>
                                        {this.renderLayoutSwitcher()}
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                );
            },

            // ── Observatory layout ───────────────────────────────────────────

            renderObservatory : function(cs){
                var self = this;
                var dc = this.state.deviceClass;
                var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';

                if(isMobile){
                    return this.renderObservatoryMobile(cs);
                }

                var panels = this.state.panelStates;
                var zenMode = this.state.zenMode;

                return (
                    <div className={"layout-observatory" + (zenMode ? " zen-mode" : "")}>
                        {this.renderCanvas(cs)}
                        {!zenMode &&
                            <div className="panel-overlay-container" role="group" aria-label="Floating control panels">
                                {this._renderFloatPanel('transport', 'Transport', this.renderTransportControls(false))}
                                {this._renderFloatPanel('view', 'View', this.renderViewControls())}
                                {this._renderFloatPanel('mode', 'Mode', this.renderModeControls())}
                                {this._renderFloatPanel('tools', 'Tools', this.renderToolsContent())}
                                {this._renderFloatPanel('board', 'Board', this.renderSliders())}
                                {this._renderFloatPanel('rules', 'Rules', this.renderRulesSection())}
                                {this._renderFloatPanel('stats', 'Stats', this.renderStats())}
                                {this._renderFloatPanel('importExport', 'Import / Export', this.renderExportContent())}
                                {/* Panel menu */}
                                <div className="panel-menu" role="group" aria-label="Panel visibility">
                                    <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                        <i className="fa fa-question-circle" aria-hidden="true"></i>
                                    </button>
                                    <button className="btn panel-menu-toggle"
                                        onClick={function(){ self.setState({_panelMenuOpen: !self.state._panelMenuOpen}); }}
                                        aria-expanded={!!this.state._panelMenuOpen}
                                        aria-label="Toggle panel visibility menu">
                                        <i className="fa fa-th" aria-hidden="true"></i>
                                    </button>
                                    {this.state._panelMenuOpen &&
                                        <div className="panel-menu-list" role="group" aria-label="Panel toggles">
                                            {['transport','view','mode','tools','board','rules','stats','importExport'].map(function(id){
                                                var label = id === 'importExport' ? 'Import/Export' : id.charAt(0).toUpperCase() + id.slice(1);
                                                return (
                                                    <label key={id} className="panel-menu-item">
                                                        <input type="checkbox" checked={panels[id].open}
                                                            onChange={function(){ self._togglePanelOpen(id); }}
                                                            aria-label={"Show " + label + " panel"} />
                                                        <span>{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    }
                                    {this.renderLayoutSwitcher()}
                                </div>
                            </div>
                        }
                    </div>
                );
            },

            renderObservatoryMobile : function(cs){
                var self = this;
                var tabs = [
                    {id: 'simulate', icon: 'fa-play',     label: 'Simulate'},
                    {id: 'tools',    icon: 'fa-pencil',   label: 'Tools'},
                    {id: 'board',    icon: 'fa-th',       label: 'Board'},
                    {id: 'rules',    icon: 'fa-cog',      label: 'Rules'},
                    {id: 'export',   icon: 'fa-download', label: 'Export'}
                ];

                var sheetContent = null;
                switch(this.state.bottomSheetTab){
                    case 'simulate':
                        sheetContent = (
                            <div>
                                <div className="sidebar-section-title">Simulation</div>
                                {this.renderTransportControls(false)}
                                {this.renderViewControls()}
                                {this.renderModeControls()}
                            </div>
                        );
                        break;
                    case 'tools': sheetContent = this.renderToolsContent(); break;
                    case 'board': sheetContent = this.renderSliders(); break;
                    case 'rules': sheetContent = this.renderRulesSection(); break;
                    case 'export': sheetContent = this.renderExportContent(); break;
                }

                return (
                    <div className="layout-observatory layout-mobile">
                        {this.renderCanvas(cs)}
                        {/* Bottom transport bar */}
                        <div className="mobile-transport-bar" role="toolbar" aria-label="Simulation transport">
                            <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame}
                                aria-label={this.state.running ? "Pause simulation" : "Play simulation"}>
                                {this.state.running ? "\u23F8" : "\u25B6"}
                            </button>
                            <button className="btn" onClick={this.stepGame} aria-label="Step one generation">Step</button>
                            <button className="btn" onClick={this.resetGame} aria-label="Reset simulation">Reset</button>
                            <button className={"btn btn-toggle" + (this.state.panMode ? " active" : "")}
                                onClick={this.togglePanMode}
                                aria-label={this.state.panMode ? "Switch to draw mode" : "Switch to pan mode"}
                                aria-pressed={this.state.panMode}>
                                <i className={"fa " + (this.state.panMode ? "fa-hand-paper-o" : "fa-arrows")} aria-hidden="true"></i>
                            </button>
                            <span className="mobile-transport-mode" aria-live="polite">
                                {this.state.panMode ? 'Pan'
                                    : (this.state.drawMode === 'preset' && this.state.selectedPattern
                                    ? this.state.selectedPattern
                                    : (this.state.drawMode === 'select' ? 'Select' : 'Draw'))}
                            </span>
                            <button className="btn" onClick={this.toggleHelp} aria-label="Help" title="Keyboard shortcuts (?)">
                                <i className="fa fa-question-circle" aria-hidden="true"></i>
                            </button>
                            <button className={"btn btn-toggle btn-sheet-toggle" + (this.state.bottomSheetOpen ? " active" : "")}
                                onClick={this.toggleBottomSheet}
                                aria-expanded={this.state.bottomSheetOpen}
                                aria-label="Open controls panel">Controls</button>
                        </div>
                        {/* Stats chip */}
                        <div className="stats-chip" onClick={this.togglePopGraph}>
                            <span>{"Gen " + this.state.generations.toLocaleString()}</span>
                            <span>{"\u2002Pop " + this.state.liveCells.size.toLocaleString()}</span>
                            <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                {this.state.stable ? "Stable" : (this.state.running ? "Run" : "Pause")}
                            </span>
                        </div>
                        {this.renderMobileContextPanel()}
                        {this.renderMobileMinimapArea()}
                        {/* Bottom sheet with tabs */}
                        {this.state.bottomSheetOpen &&
                            <div className="bottom-sheet-container"
                                onKeyDown={function(e){ self._onSheetKeyDown(e); }}>
                                <div className="bottom-sheet-backdrop" onClick={this.toggleBottomSheet}
                                    role="presentation" aria-hidden="true"></div>
                                <div className={"bottom-sheet" + (this.state.bottomSheetClosing ? " sheet-closing" : "")} role="dialog" aria-modal="true"
                                    aria-label="Controls panel"
                                    onTouchStart={function(e){ self._onSheetTouchStart(e); }}
                                    onTouchMove={function(e){ self._onSheetTouchMove(e); }}
                                    onTouchEnd={function(e){ self._onSheetTouchEnd(e); }}>
                                    <div className="bottom-sheet-handle"></div>
                                    <div className="bottom-sheet-tabs" role="tablist" aria-label="Control categories">
                                        {tabs.map(function(tab){
                                            var isActive = self.state.bottomSheetTab === tab.id;
                                            return (
                                                <button key={tab.id}
                                                    className={"rail-tab" + (isActive ? " active" : "")}
                                                    onClick={function(){ self.setBottomSheetTab(tab.id); }}
                                                    role="tab" aria-selected={isActive} aria-label={tab.label}
                                                    aria-controls={"sheet-panel-" + tab.id}>
                                                    <i className={"fa " + tab.icon} aria-hidden="true"></i>
                                                    <span className="rail-tab-label">{tab.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="bottom-sheet-content"
                                        id={"sheet-panel-" + this.state.bottomSheetTab}
                                        role="tabpanel"
                                        aria-label={this.state.bottomSheetTab + " controls"}>
                                        {sheetContent}
                                    </div>
                                    <div style={{padding:'8px 12px 0', borderTop:'1px solid var(--panel-border)'}}>
                                        {this.renderLayoutSwitcher()}
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                );
            },

            // ── Float panel helper (Observatory) ─────────────────────────────

            _renderFloatPanel : function(panelId, label, content){
                var self = this;
                var ps = this.state.panelStates[panelId];
                if(!ps || !ps.open){ return null; }
                return (
                    <div className={"float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() + (ps.collapsed ? " float-panel-collapsed" : "")}
                        style={ps.x >= 0 ? {left: ps.x, top: ps.y, right: 'auto', bottom: 'auto', transform: 'none'} : {}}
                        role="region" aria-label={label + " panel"}>
                        <div className="float-panel-header"
                            onMouseDown={function(e){ self._startPanelDrag(panelId, e); }}
                            onTouchStart={function(e){ self._startPanelDrag(panelId, e); }}>
                            <span className="float-panel-title" id={"panel-title-" + panelId}>{label}</span>
                            <button className="btn float-panel-collapse"
                                onClick={function(){ self._togglePanelCollapse(panelId); }}
                                aria-expanded={!ps.collapsed}
                                aria-label={ps.collapsed ? "Expand " + label + " panel" : "Collapse " + label + " panel"}>
                                {ps.collapsed ? "+" : "\u2013"}
                            </button>
                            <button className="btn float-panel-close"
                                onClick={function(){ self._togglePanelOpen(panelId); }}
                                aria-label={"Close " + label + " panel"}>&times;</button>
                        </div>
                        {!ps.collapsed && <div className="float-panel-body">{content}</div>}
                        {!ps.collapsed && <div className="float-panel-resize"
                            onMouseDown={function(e){ self._startPanelResize(panelId, e); }}
                            onTouchStart={function(e){ self._startPanelResize(panelId, e); }}></div>}
                    </div>
                );
            },

            // ── Panel drag (Observatory) ─────────────────────────────────────

            _startPanelDrag : function(panelId, e){
                if(e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button'))){ return; }
                e.preventDefault();
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var clientX = e.touches ? e.touches[0].clientX : e.clientX;
                var clientY = e.touches ? e.touches[0].clientY : e.clientY;
                this._fpDragId = panelId;
                this._fpDragOffX = clientX - rect.left;
                this._fpDragOffY = clientY - rect.top;
                panel.classList.add('dragging');
                var self = this;
                this._fpDragMove = function(ev){
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
                };
                this._fpDragEnd = function(){
                    panel.classList.remove('dragging');
                    var finalRect = panel.getBoundingClientRect();
                    var panels = JSON.parse(JSON.stringify(self.state.panelStates));
                    panels[panelId].x = finalRect.left;
                    panels[panelId].y = finalRect.top;
                    self.setState({panelStates: panels}, function(){ self._persistLayout(); });
                    document.removeEventListener('mousemove', self._fpDragMove);
                    document.removeEventListener('mouseup', self._fpDragEnd);
                    document.removeEventListener('touchmove', self._fpDragMove);
                    document.removeEventListener('touchend', self._fpDragEnd);
                };
                document.addEventListener('mousemove', this._fpDragMove);
                document.addEventListener('mouseup', this._fpDragEnd);
                document.addEventListener('touchmove', this._fpDragMove, {passive: false});
                document.addEventListener('touchend', this._fpDragEnd);
            },

            // ── Panel resize (Observatory) ───────────────────────────────────

            _startPanelResize : function(panelId, e){
                e.preventDefault();
                e.stopPropagation();
                var panel = e.currentTarget.parentElement;
                var rect = panel.getBoundingClientRect();
                var startW = rect.width;
                var startH = rect.height;
                var startX = e.touches ? e.touches[0].clientX : e.clientX;
                var startY = e.touches ? e.touches[0].clientY : e.clientY;
                var move = function(ev){
                    ev.preventDefault();
                    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
                    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
                    panel.style.width = Math.max(180, startW + (cx - startX)) + 'px';
                    panel.style.maxHeight = Math.max(80, startH + (cy - startY)) + 'px';
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
            },

            // ── Panel state helpers (Observatory) ────────────────────────────

            _togglePanelOpen : function(panelId){
                var panels = JSON.parse(JSON.stringify(this.state.panelStates));
                panels[panelId].open = !panels[panelId].open;
                var self = this;
                this.setState({panelStates: panels}, function(){ self._persistLayout(); });
            },

            _togglePanelCollapse : function(panelId){
                var panels = JSON.parse(JSON.stringify(this.state.panelStates));
                panels[panelId].collapsed = !panels[panelId].collapsed;
                var self = this;
                this.setState({panelStates: panels}, function(){ self._persistLayout(); });
            },

            // ── Main render ───────────────────────────────────────────────────

            render : function(){
                var cs = this.getCanvasSize();
                var layout = this.state.layoutMode;
                var layoutContent;

                switch(layout){
                    case 'cartographer':
                        layoutContent = this.renderCartographer(cs);
                        break;
                    case 'specimen':
                        layoutContent = this.renderSpecimen(cs);
                        break;
                    case 'observatory':
                        layoutContent = this.renderObservatory(cs);
                        break;
                    default:
                        layoutContent = this.renderCartographer(cs);
                }

                return (
                    <div className={"app-root layout-" + layout} role="application"
                        aria-label="Conway's Game of Life">
                        <a className="skip-to-content" href="#life-canvas">Skip to canvas</a>
                        <div className="sr-only" aria-live="polite" aria-atomic="true">
                            {"Generation " + this.state.generations + ", Population " + this.state.liveCells.size}
                        </div>
                        {this.renderHelpModal()}
                        {this.renderPopGraph()}
                        {layoutContent}
                    </div>
                );
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});
