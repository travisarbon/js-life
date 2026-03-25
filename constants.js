/**
 * Shared constants, pure helpers, and SimEngine for Conway's Game of Life.
 *
 * Globals exposed: MAX_UNDO_STACK, MAX_POP_HISTORY, MAX_TRAIL_MAP,
 *   TRAIL_MAX_VALUE, TRAIL_PRUNE_THRESHOLD, MAX_CELL_IMPORT, MAX_FILE_SIZE,
 *   MAX_HL_COORD, HL_GC_THRESHOLD, STABLE_COUNT_THRESHOLD, GPS_DISPLAY_DURATION,
 *   LONG_PRESS_DELAY, MAX_STEP_COUNT, COLOR_STEPS, MAX_AGE, MAX_FLOOD_FILL,
 *   ANALYSIS_TIMEOUT, STATS_CHIP_REAPPEAR_DELAY, parseKey, RULE_PRESETS,
 *   SPEED_DELAYS, THEMES, detectAndParsePattern, overlayAges, SimEngine
 */

// ── Constants ────────────────────────────────────────────────────────────────
/* eslint-disable no-unused-vars */
const MAX_UNDO_STACK = 30;
const MAX_POP_HISTORY = 10000;
const MAX_TRAIL_MAP = 50000;
const TRAIL_MAX_VALUE = 20;
const TRAIL_PRUNE_THRESHOLD = 5;
const MAX_CELL_IMPORT = 100000;
const MAX_FILE_SIZE = 500000;
const MAX_HL_COORD = 1000000;
const HL_GC_THRESHOLD = 2000000;
const STABLE_COUNT_THRESHOLD = 2;
const GPS_DISPLAY_DURATION = 3000;
const LONG_PRESS_DELAY = 420;
const MAX_STEP_COUNT = 10000;
const COLOR_STEPS = 63;
const MAX_AGE = 65535;
const MAX_FLOOD_FILL = 100000;
const ANALYSIS_TIMEOUT = 10000;
const STATS_CHIP_REAPPEAR_DELAY = 1500;

// ── Board key utilities ──────────────────────────────────────────────────────
// Encapsulates the "r,c" string key format used by the cell Map.

// Parse a "r,c" map key into [row, col] integers.
function parseKey(key) {
    const i = key.indexOf(',');
    if(i < 0){
        console.warn('parseKey: malformed key "' + key + '"');
        return [0, 0];
    }
    return [parseInt(key.substring(0, i), 10) || 0, parseInt(key.substring(i + 1), 10) || 0];
}

// ── Rule presets ──────────────────────────────────────────────────────────────
const RULE_PRESETS = [
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
const SPEED_DELAYS = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];

// ── Color themes ──────────────────────────────────────────────────────────────
// Each theme defines alive/young RGB channels for age-gradient rendering plus
// canvas background and grid/selection overlay colours.
const THEMES = {
    'Teal': {
        bg: '#FFFFFF',
        bgDark: '#1a2424',
        aliveR: 112,  aliveG: 149,  aliveB: 154,
        youngR: 200,  youngG: 220,  youngB: 222,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(112,149,154,0.25)'
    },
    'Midnight': {
        bg: '#0A0E1A',
        bgDark: '#0A0E1A',
        aliveR: 74,   aliveG: 158,  aliveB: 205,
        youngR: 150,  youngG: 190,  youngB: 225,
        grid:   'rgba(255,255,255,0.12)',
        sel:    'rgba(74,158,205,0.25)'
    },
    'Ember': {
        bg: '#FFF8F0',
        bgDark: '#241c1a',
        aliveR: 196,  aliveG: 113,  aliveB: 58,
        youngR: 230,  youngG: 200,  youngB: 160,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(196,113,58,0.25)'
    },
    'Violet': {
        bg: '#F8F5FF',
        bgDark: '#1c1a26',
        aliveR: 138,  aliveG: 92,   aliveB: 196,
        youngR: 200,  youngG: 180,  youngB: 230,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(138,92,196,0.25)'
    },
    'Forest': {
        bg: '#F5F8F2',
        bgDark: '#1a221a',
        aliveR: 76,   aliveG: 140,  aliveB: 80,
        youngR: 170,  youngG: 210,  youngB: 165,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(76,140,80,0.25)'
    },
    'Rose': {
        bg: '#FFF5F7',
        bgDark: '#261a1e',
        aliveR: 190,  aliveG: 82,   aliveB: 110,
        youngR: 235,  youngG: 185,  youngB: 195,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(190,82,110,0.25)'
    },
    'Sepia': {
        bg: '#FAF6EE',
        bgDark: '#22201a',
        aliveR: 143,  aliveG: 110,  aliveB: 70,
        youngR: 210,  youngG: 190,  youngB: 160,
        grid:   'rgba(0,0,0,0.15)',
        sel:    'rgba(143,110,70,0.25)'
    }
};

// ── Format detection helper (shared between file drop and manual import) ─────
function detectAndParsePattern(text) {
    let result;
    if(/^#Life\s+1\.06/m.test(text)){
        result = SimEngine.parseLife106(text);
    } else if(/^#Life\s+1\.05/m.test(text)){
        result = SimEngine.parseLife105(text);
    } else if(/x\s*=/i.test(text) || (/[bo\$]/.test(text) && /!/.test(text))){
        result = SimEngine.parseRLE(text);
    } else {
        result = SimEngine.parsePlaintext(text);
    }
    return result;
}

// ── Age overlay for HashLife ──────────────────────────────────────────────────
// Computes cell ages by diffing old Map (key→age) against new cell list [[r,c],...].
function overlayAges(oldLiveCells, newCellList, ageIncrement) {
    const inc = ageIncrement || 1;
    const newMap = new Map();
    for (let i = 0; i < newCellList.length; i++) {
        const key = newCellList[i][0] + ',' + newCellList[i][1];
        const oldAge = oldLiveCells.get(key);
        newMap.set(key, oldAge !== undefined ? Math.min(oldAge + inc, MAX_AGE) : 1);
    }
    return newMap;
}

// ── SimEngine ─────────────────────────────────────────────────────────────────
// Pure simulation functions isolated from React state for testability and reuse.
const SimEngine = {

    // Returns a sparse Map keyed by "r,c" with value = age.
    buildLiveCells : function(cols, rows, sparseness){
        const map = new Map();
        for(let r = 0; r < rows; r++){
            for(let c = 0; c < cols; c++){
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
        const map = new Map();
        let r = 0;
        const CHUNK = Math.max(1, Math.floor(50000 / cols));
        function doChunk(){
            const end = Math.min(r + CHUNK, rows);
            for(; r < end; r++){
                for(let c = 0; c < cols; c++){
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
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        liveCells.forEach(function(age, key){
            const rc = parseKey(key), r = rc[0], c = rc[1];
            if(r < minR) minR = r; if(r > maxR) maxR = r;
            if(c < minC) minC = c; if(c > maxC) maxC = c;
        });
        return {minR: minR, maxR: maxR, minC: minC, maxC: maxC};
    },

    // Shared next-generation core. toroidal controls wrapping; mask (optional)
    // restricts candidates and results to region membership.
    _computeNext : function(liveCells, cols, rows, birth, survive, toroidal, mask){
        if(rows <= 0 || cols <= 0){ return new Map(); }
        const birthLut = new Uint8Array(9);
        const surviveLut = new Uint8Array(9);
        for(let bi = 0; bi < birth.length; bi++){ birthLut[birth[bi]] = 1; }
        for(let si = 0; si < survive.length; si++){ surviveLut[survive[si]] = 1; }
        const candidates = new Map();
        liveCells.forEach(function(age, key){
            const _krc = parseKey(key), kr = _krc[0], kc = _krc[1];
            candidates.set(key, _krc);
            for(let dr = -1; dr <= 1; dr++){
                for(let dc = -1; dc <= 1; dc++){
                    if(dr === 0 && dc === 0){ continue; }
                    let nr, nc;
                    if(toroidal){
                        nr = (kr + dr + rows) % rows;
                        nc = (kc + dc + cols) % cols;
                    } else {
                        nr = kr + dr; nc = kc + dc;
                        if(nr < 0 || nr >= rows || nc < 0 || nc >= cols){ continue; }
                    }
                    const nk = nr + ',' + nc;
                    if(!candidates.has(nk) && (!mask || mask.has(nk))){
                        candidates.set(nk, [nr, nc]);
                    }
                }
            }
        });
        const newLiveCells = new Map();
        candidates.forEach(function(pos, key){
            if(mask && !mask.has(key)){ return; }
            const r = pos[0], c = pos[1];
            let count = 0;
            for(let dr = -1; dr <= 1; dr++){
                for(let dc = -1; dc <= 1; dc++){
                    if(dr === 0 && dc === 0){ continue; }
                    let nr, nc;
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
            const wasAlive = liveCells.has(key);
            const alive = wasAlive ? surviveLut[count] : birthLut[count];
            if(alive){
                newLiveCells.set(key, wasAlive ? Math.min((liveCells.get(key) || 0) + 1, MAX_AGE) : 1);
            }
        });
        return newLiveCells;
    },

    // Returns next-generation sparse Map in O(k) where k = live cell count.
    computeNextGeneration : function(liveCells, cols, rows, birth, survive, boundary){
        return this._computeNext(liveCells, cols, rows, birth, survive, boundary === 'toroidal', null);
    },

    /**
     * Toroidal simulation with a region mask. Like computeNextGeneration but
     * uses modulo wrapping on the bounding rect and restricts candidates to
     * cells that are in the mask.  The mask uses local (0-based) coordinates.
     */
    computeNextGenerationMasked : function(liveCells, cols, rows, birth, survive, mask){
        return this._computeNext(liveCells, cols, rows, birth, survive, true, mask);
    },

    // Serialises live cells to RLE string (header + wrapped body).
    boardToRLE : function(liveCells, ruleString){
        const bb = SimEngine.getBoundingBox(liveCells);
        if(!bb || !isFinite(bb.maxR)){ return ''; }
        const minR = bb.minR, maxR = bb.maxR, minC = bb.minC, maxC = bb.maxC;
        const W = maxC - minC + 1;
        const H = maxR - minR + 1;
        const header = 'x = ' + W + ', y = ' + H + ', rule = ' + ruleString + '\n';
        let rleData = '';
        for(let row = minR; row <= maxR; row++){
            let runChar = null, runLen = 0, rowStr = '';
            for(let col = minC; col <= maxC; col++){
                const ch = liveCells.has(row + ',' + col) ? 'o' : 'b';
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
        // Wrap lines at ~70 chars, breaking only after a complete token
        // (after 'o', 'b', '$', or '!') to avoid splitting run-length numbers.
        let wrapped = '';
        let line = '';
        for(let k = 0; k < rleData.length; k++){
            line += rleData[k];
            if(line.length >= 70 && /[ob$!]/.test(rleData[k])){
                wrapped += line + '\n';
                line = '';
            }
        }
        if(line){ wrapped += line + '\n'; }
        return header + wrapped;
    },

    // Parses standard RLE format into [[row, col], ...].
    parseRLE : function(text){
        const lines = text.split(/\r?\n/);
        const dataLines = lines.filter(function(l){ return l.charAt(0) !== '#'; });
        let headerIdx = -1;
        for(let i = 0; i < dataLines.length; i++){
            if(/x\s*=/i.test(dataLines[i])){ headerIdx = i; break; }
        }
        // Extract rule from header if present.
        let parsedRule = null;
        if(headerIdx >= 0){
            const ruleMatch = dataLines[headerIdx].match(/rule\s*=\s*([^\s,]+)/i);
            if(ruleMatch){ parsedRule = ruleMatch[1]; }
        }
        const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
        const data = dataLines.slice(dataStart).join('').replace(/\s/g, '');
        const cells = [];
        let row = 0, col = 0, countStr = '';
        const MAX_COORD = 100000;
        for(let k = 0; k < data.length; k++){
            const ch = data[k];
            if(ch >= '0' && ch <= '9'){
                countStr += ch;
            } else if(ch === 'b' || ch === 'o'){
                let n = countStr ? parseInt(countStr, 10) : 1;
                if(isNaN(n) || n < 1){ n = 1; }
                if(n > MAX_COORD){ n = MAX_COORD; }
                if(ch === 'o'){
                    for(let j = 0; j < n && cells.length < MAX_CELL_IMPORT; j++){ cells.push([row, col + j]); }
                }
                col += n;
                countStr = '';
            } else if(ch === '$'){
                let n2 = countStr ? parseInt(countStr, 10) : 1;
                if(n2 > MAX_COORD){ n2 = MAX_COORD; }
                row += n2;
                col = 0;
                countStr = '';
            } else if(ch === '!'){ break; }
            if(row > MAX_COORD || col > MAX_COORD){ break; }
        }
        const truncated = cells.length > MAX_CELL_IMPORT;
        if(truncated){ cells.length = MAX_CELL_IMPORT; }
        return {cells : cells, truncated: truncated, rule: parsedRule};
    },

    // Parses LifeWiki plaintext (.cells) format into [[row, col], ...].
    parsePlaintext : function(text){
        const lines = text.split(/\r?\n/);
        const cells = [];
        let row = 0;
        for(let i = 0; i < lines.length; i++){
            const line = lines[i];
            if(line.charAt(0) === '!' || line.charAt(0) === '#'){ continue; }
            for(let col = 0; col < line.length; col++){
                const ch = line.charAt(col);
                if(ch === 'O' || ch === 'o' || ch === '*'){
                    cells.push([row, col]);
                }
            }
            row++;
        }
        const truncated = cells.length > MAX_CELL_IMPORT;
        if(truncated){ cells.length = MAX_CELL_IMPORT; }
        return {cells : cells, truncated: truncated};
    },

    // Parses Life 1.06 format: header "#Life 1.06", then one "x y" per live cell.
    parseLife106 : function(text){
        const lines = text.split(/\r?\n/);
        const cells = [];
        for(let i = 0; i < lines.length; i++){
            const line = lines[i].trim();
            if(line === '' || line.charAt(0) === '#'){ continue; }
            const parts = line.split(/\s+/);
            if(parts.length >= 2){
                const x = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
                if(!isNaN(x) && !isNaN(y)){
                    cells.push([y, x]); // Life 1.06 uses x,y; we store row,col
                }
            }
        }
        const truncated = cells.length > MAX_CELL_IMPORT;
        if(truncated){ cells.length = MAX_CELL_IMPORT; }
        return {cells : cells, truncated: truncated};
    },

    // Parses Life 1.05 format: header "#Life 1.05", #D descriptions, #P x y origin blocks.
    parseLife105 : function(text){
        const lines = text.split(/\r?\n/);
        const cells = [];
        let originX = 0, originY = 0;
        for(let i = 0; i < lines.length; i++){
            const line = lines[i];
            if(line.indexOf('#P') === 0){
                const parts = line.substring(2).trim().split(/\s+/);
                originX = parseInt(parts[0], 10) || 0;
                originY = parseInt(parts[1], 10) || 0;
                let rowOffset = 0;
                for(let j = i + 1; j < lines.length; j++){
                    const bline = lines[j];
                    if(bline.charAt(0) === '#' || bline.trim() === ''){ i = j - 1; break; }
                    for(let col = 0; col < bline.length; col++){
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
            let minR = cells[0][0], minC = cells[0][1];
            for(let k = 1; k < cells.length; k++){
                if(cells[k][0] < minR){ minR = cells[k][0]; }
                if(cells[k][1] < minC){ minC = cells[k][1]; }
            }
            if(minR < 0 || minC < 0){
                for(let k2 = 0; k2 < cells.length; k2++){
                    cells[k2] = [cells[k2][0] - minR, cells[k2][1] - minC];
                }
            }
        }
        const truncated = cells.length > MAX_CELL_IMPORT;
        if(truncated){ cells.length = MAX_CELL_IMPORT; }
        return {cells : cells, truncated: truncated};
    },

    // Rotates a [[row,col],...] pattern 90° CW, `steps` times.
    rotatePattern : function(cells, steps){
        let result = cells.slice();
        for(let s = 0; s < steps; s++){
            let maxR = 0;
            for(let k = 0; k < result.length; k++){
                if(result[k][0] > maxR){ maxR = result[k][0]; }
            }
            result = result.map(function(cell){
                return [cell[1], maxR - cell[0]];
            });
        }
        return result;
    }
};
/* eslint-enable no-unused-vars */
