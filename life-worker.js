/* Web Worker — Game of Life next-generation computation.
   Uses a flat Uint16Array grid for fast neighbor counting on boards ≤ 160,000 cells,
   falls back to sparse Map for larger boards.
   Receives: { liveCells: [[r, c, age], ...], cols, rows, birth, survive, boundary, tickId }
   Posts:    { liveCells: [[r, c, age], ...], newPop, tickId }
*/
self.onmessage = function (e) {
    var d = e.data;
    var cols     = d.cols;
    var rows     = d.rows;
    var birth    = d.birth;
    var survive  = d.survive;
    var boundary = d.boundary;
    var tickId   = d.tickId;
    var toroidal = boundary === 'toroidal';
    var totalCells = rows * cols;

    // Use typed array for boards up to 1,000,000 cells (1000×1000); sparse Map otherwise.
    if (totalCells <= 1000000) {
        computeTypedArray(d.liveCells, cols, rows, birth, survive, toroidal, tickId);
    } else {
        computeSparse(d.liveCells, cols, rows, birth, survive, toroidal, tickId);
    }
};

function computeTypedArray(inputCells, cols, rows, birth, survive, toroidal, tickId) {
    var totalCells = rows * cols;
    // Grid stores cell age: 0 = dead, 1+ = alive.
    var grid = new Uint16Array(totalCells);
    for (var i = 0; i < inputCells.length; i++) {
        var cell = inputCells[i];
        grid[cell[0] * cols + cell[1]] = cell[2];
    }

    // Build birth/survive lookup tables for O(1) rule checking.
    var birthLut = new Uint8Array(9);
    var surviveLut = new Uint8Array(9);
    for (var bi = 0; bi < birth.length; bi++) { birthLut[birth[bi]] = 1; }
    for (var si = 0; si < survive.length; si++) { surviveLut[survive[si]] = 1; }

    // Collect candidates: every live cell + its 8 neighbors.
    // Use a Uint8Array as a visited flag to avoid duplicates.
    var visited = new Uint8Array(totalCells);
    var candidates = [];
    for (var ci = 0; ci < inputCells.length; ci++) {
        var cr = inputCells[ci][0];
        var cc = inputCells[ci][1];
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                var nr, nc;
                if (toroidal) {
                    nr = (cr + dr + rows) % rows;
                    nc = (cc + dc + cols) % cols;
                } else {
                    nr = cr + dr;
                    nc = cc + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) { continue; }
                }
                var idx = nr * cols + nc;
                if (!visited[idx]) {
                    visited[idx] = 1;
                    candidates.push(idx);
                }
            }
        }
    }

    // Apply rules using direct array indexing for neighbor counting.
    var result = [];
    var newPop = 0;
    for (var ci2 = 0; ci2 < candidates.length; ci2++) {
        var cellIdx = candidates[ci2];
        var r = (cellIdx / cols) | 0;
        var c = cellIdx % cols;
        var count = 0;

        // Count 8 neighbors via direct array access.
        for (var dr2 = -1; dr2 <= 1; dr2++) {
            for (var dc2 = -1; dc2 <= 1; dc2++) {
                if (dr2 === 0 && dc2 === 0) { continue; }
                var nr2, nc2;
                if (toroidal) {
                    nr2 = (r + dr2 + rows) % rows;
                    nc2 = (c + dc2 + cols) % cols;
                } else {
                    nr2 = r + dr2;
                    nc2 = c + dc2;
                    if (nr2 < 0 || nr2 >= rows || nc2 < 0 || nc2 >= cols) { continue; }
                }
                if (grid[nr2 * cols + nc2] > 0) { count++; }
            }
        }

        var wasAlive = grid[cellIdx] > 0;
        var alive = wasAlive ? surviveLut[count] : birthLut[count];
        if (alive) {
            var age = wasAlive ? Math.min(grid[cellIdx] + 1, 65535) : 1;
            result.push([r, c, age]);
            newPop++;
        }
    }

    self.postMessage({ liveCells: result, newPop: newPop, tickId: tickId });
}

function computeSparse(inputCells, cols, rows, birth, survive, toroidal, tickId) {
    // Reconstruct sparse Map from [[r, c, age], ...] payload.
    var liveCells = new Map();
    for (var i = 0; i < inputCells.length; i++) {
        var cell = inputCells[i];
        liveCells.set(cell[0] + ',' + cell[1], cell[2]);
    }

    // Build candidate set: every live cell plus all 8 neighbours.
    var candidates = new Map();
    liveCells.forEach(function (age, key) {
        var comma = key.indexOf(',');
        var kr = parseInt(key.substring(0, comma));
        var kc = parseInt(key.substring(comma + 1));
        candidates.set(key, [kr, kc]);
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) { continue; }
                var nr, nc;
                if (toroidal) {
                    nr = (kr + dr + rows) % rows;
                    nc = (kc + dc + cols) % cols;
                } else {
                    nr = kr + dr; nc = kc + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) { continue; }
                }
                var nk = nr + ',' + nc;
                if (!candidates.has(nk)) { candidates.set(nk, [nr, nc]); }
            }
        }
    });

    // Apply rules to each candidate cell.
    var result = [];
    var newPop = 0;
    candidates.forEach(function (pos, key) {
        var r = pos[0], c = pos[1];
        var count = 0;
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) { continue; }
                var nr, nc;
                if (toroidal) {
                    nr = (r + dr + rows) % rows;
                    nc = (c + dc + cols) % cols;
                } else {
                    nr = r + dr; nc = c + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) { continue; }
                }
                if (liveCells.has(nr + ',' + nc)) { count++; }
            }
        }
        var wasAlive = liveCells.has(key);
        var alive = wasAlive
            ? (survive.indexOf(count) !== -1)
            : (birth.indexOf(count) !== -1);
        if (alive) {
            var age = wasAlive ? (liveCells.get(key) || 0) + 1 : 1;
            result.push([r, c, age]);
            newPop++;
        }
    });

    self.postMessage({ liveCells: result, newPop: newPop, tickId: tickId });
}
