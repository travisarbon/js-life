/* Web Worker — sparse Game of Life next-generation computation.
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

    // Reconstruct sparse Map from [[r, c, age], ...] payload.
    var liveCells = new Map();
    for (var i = 0; i < d.liveCells.length; i++) {
        var cell = d.liveCells[i];
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
};
