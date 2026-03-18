/* HashLife — memoized quadtree algorithm for Conway's Game of Life (and variants).
   Exposes a global `HashLife` object.
   Supports arbitrary B/S rules via a precomputed level-2 lookup table.

   Coordinate convention: internal coords are unsigned [0, 2^level).
   External (row, col) coords are mapped via offsets stored alongside the root.
   x = column, y = row in internal coords.
*/
var HashLife = (function () {
    'use strict';

    var _nextId = 0;
    var _pool = new Map();
    var _poolSize = 0;
    var _emptyCache = [];
    var _level2Table = null;

    // Level-0 singletons
    var DEAD  = { nw: null, ne: null, sw: null, se: null, level: 0, population: 0, id: _nextId++, result: null, stepResult: null };
    var ALIVE = { nw: null, ne: null, sw: null, se: null, level: 0, population: 1, id: _nextId++, result: null, stepResult: null };

    // --- Canonical node constructor ---
    function getNode(nw, ne, sw, se) {
        // Use nested Maps for cache lookup to avoid string allocation.
        // Fall back to string key for simplicity in the initial pool.
        var key = nw.id + '|' + ne.id + '|' + sw.id + '|' + se.id;
        var cached = _pool.get(key);
        if (cached) return cached;
        var node = {
            nw: nw, ne: ne, sw: sw, se: se,
            level: nw.level + 1,
            population: nw.population + ne.population + sw.population + se.population,
            id: _nextId++,
            result: null,
            stepResult: null
        };
        _pool.set(key, node);
        _poolSize++;
        return node;
    }

    // --- Empty tree at given level (memoized) ---
    function emptyTree(level) {
        if (level === 0) return DEAD;
        if (_emptyCache[level]) return _emptyCache[level];
        var sub = emptyTree(level - 1);
        var node = getNode(sub, sub, sub, sub);
        _emptyCache[level] = node;
        return node;
    }

    // --- Expand: wrap root in one level of empty border ---
    // Old pattern at [0, 2^k) shifts to [2^(k-1), 2^(k-1) + 2^k) in new tree.
    function expandTree(node) {
        var empty = emptyTree(node.level - 1);
        return getNode(
            getNode(empty, empty, empty, node.nw),
            getNode(empty, empty, node.ne, empty),
            getNode(empty, node.sw, empty, empty),
            getNode(node.se, empty, empty, empty)
        );
    }

    // --- Trim: remove unnecessary empty border levels ---
    function trimTree(node) {
        while (canTrim(node)) {
            node = trimStep(node);
        }
        return node;
    }

    // Check if outermost ring is all dead (safe to trim one level)
    function canTrim(node) {
        if (node.level <= 3) return false;
        var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;
        return (nw.nw.population === 0 && nw.ne.population === 0 && nw.sw.population === 0 &&
                ne.nw.population === 0 && ne.ne.population === 0 && ne.se.population === 0 &&
                sw.nw.population === 0 && sw.sw.population === 0 && sw.se.population === 0 &&
                se.ne.population === 0 && se.sw.population === 0 && se.se.population === 0);
    }

    // Remove one level of empty border
    function trimStep(node) {
        return getNode(node.nw.se, node.ne.sw, node.sw.ne, node.se.nw);
    }

    // --- Level-2 lookup table ---
    // 4x4 grid = 16 cells, 2^16 = 65536 possible states.
    // Bit layout (row-major): row 0 = bits 0-3, row 1 = bits 4-7, etc.
    // Result: 2x2 center after 1 gen, packed as 4 bits.
    function buildLevel2Table(birth, survive) {
        var table = new Uint8Array(65536);
        var birthSet = new Uint8Array(9);
        var surviveSet = new Uint8Array(9);
        for (var i = 0; i < birth.length; i++) birthSet[birth[i]] = 1;
        for (var i = 0; i < survive.length; i++) surviveSet[survive[i]] = 1;

        for (var bits = 0; bits < 65536; bits++) {
            var res = 0;
            for (var ri = 0; ri < 2; ri++) {
                for (var ci = 0; ci < 2; ci++) {
                    var r = ri + 1, c = ci + 1;
                    var count = 0;
                    for (var dr = -1; dr <= 1; dr++) {
                        for (var dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            if ((bits >> ((r + dr) * 4 + (c + dc))) & 1) count++;
                        }
                    }
                    var isAlive = (bits >> (r * 4 + c)) & 1;
                    if (isAlive ? surviveSet[count] : birthSet[count]) {
                        res |= (1 << (ri * 2 + ci));
                    }
                }
            }
            table[bits] = res;
        }
        return table;
    }

    // Convert level-2 node (4x4) to 16-bit representation
    function level2ToBits(node) {
        var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;
        var bits = 0;
        // Row 0: nw.nw, nw.ne, ne.nw, ne.ne
        if (nw.nw.population) bits |= (1 << 0);
        if (nw.ne.population) bits |= (1 << 1);
        if (ne.nw.population) bits |= (1 << 2);
        if (ne.ne.population) bits |= (1 << 3);
        // Row 1: nw.sw, nw.se, ne.sw, ne.se
        if (nw.sw.population) bits |= (1 << 4);
        if (nw.se.population) bits |= (1 << 5);
        if (ne.sw.population) bits |= (1 << 6);
        if (ne.se.population) bits |= (1 << 7);
        // Row 2: sw.nw, sw.ne, se.nw, se.ne
        if (sw.nw.population) bits |= (1 << 8);
        if (sw.ne.population) bits |= (1 << 9);
        if (se.nw.population) bits |= (1 << 10);
        if (se.ne.population) bits |= (1 << 11);
        // Row 3: sw.sw, sw.se, se.sw, se.se
        if (sw.sw.population) bits |= (1 << 12);
        if (sw.se.population) bits |= (1 << 13);
        if (se.sw.population) bits |= (1 << 14);
        if (se.se.population) bits |= (1 << 15);
        return bits;
    }

    // Convert 4-bit result back to level-1 node
    function bitsToLevel1(bits) {
        return getNode(
            (bits & 1) ? ALIVE : DEAD,
            (bits & 2) ? ALIVE : DEAD,
            (bits & 4) ? ALIVE : DEAD,
            (bits & 8) ? ALIVE : DEAD
        );
    }

    // --- Centered sub-square helpers ---
    // These extract overlapping sub-regions from a node's 16 grandchildren.

    // centeredHorizontal: level-(k-1) overlap between horizontally adjacent level-(k-1) nodes
    function centeredHorizontal(w, e) {
        return getNode(w.ne, e.nw, w.se, e.sw);
    }

    // centeredVertical: level-(k-1) overlap between vertically adjacent level-(k-1) nodes
    function centeredVertical(n, s) {
        return getNode(n.sw, n.se, s.nw, s.ne);
    }

    // centeredSubnode: level-(k-1) center of a level-k node
    function centeredSubnode(node) {
        return getNode(node.nw.se, node.ne.sw, node.sw.ne, node.se.nw);
    }

    // --- Core: advance ---
    // For level-k node (k >= 2), returns level-(k-1) node representing the center
    // after 2^(k-2) generations (full speed) or 1 generation (step mode).
    function advance(node, stepLimit) {
        if (node.population === 0) {
            return emptyTree(node.level - 1);
        }

        // Guard: advance requires level >= 2.
        if (node.level < 2) {
            return node.level === 1 ? centeredSubnode(node) : node;
        }

        var singleStep = (stepLimit <= 1);

        // Check caches
        if (singleStep && node.stepResult !== null) return node.stepResult;
        if (!singleStep && node.result !== null) return node.result;

        // Level-2 base case: lookup table
        if (node.level === 2) {
            var bits = level2ToBits(node);
            var res = bitsToLevel1(_level2Table[bits]);
            node.stepResult = res;
            node.result = res; // at level 2, full speed = 1 gen
            return res;
        }

        var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;

        // Build 9 overlapping level-(k-1) sub-quads from the 16 grandchildren.
        var q0 = nw;
        var q1 = centeredHorizontal(nw, ne);
        var q2 = ne;
        var q3 = centeredVertical(nw, sw);
        var q4 = centeredSubnode(node);
        var q5 = centeredVertical(ne, se);
        var q6 = sw;
        var q7 = centeredHorizontal(sw, se);
        var q8 = se;

        var result;

        if (singleStep) {
            // Step=1: extract spatial centers (level k-2) from each sub-quad,
            // form 4 level-(k-1) blocks, advance each by 1 gen.
            var c0 = centeredSubnode(q0);
            var c1 = centeredSubnode(q1);
            var c2 = centeredSubnode(q2);
            var c3 = centeredSubnode(q3);
            var c4 = centeredSubnode(q4);
            var c5 = centeredSubnode(q5);
            var c6 = centeredSubnode(q6);
            var c7 = centeredSubnode(q7);
            var c8 = centeredSubnode(q8);

            result = getNode(
                advance(getNode(c0, c1, c3, c4), 1),
                advance(getNode(c1, c2, c4, c5), 1),
                advance(getNode(c3, c4, c6, c7), 1),
                advance(getNode(c4, c5, c7, c8), 1)
            );
            node.stepResult = result;
        } else {
            // Full speed: two-phase decomposition.
            // Phase 1: advance all 9 sub-quads → 9 level-(k-2) results, 2^(k-3) gens each.
            var r0 = advance(q0, stepLimit);
            var r1 = advance(q1, stepLimit);
            var r2 = advance(q2, stepLimit);
            var r3 = advance(q3, stepLimit);
            var r4 = advance(q4, stepLimit);
            var r5 = advance(q5, stepLimit);
            var r6 = advance(q6, stepLimit);
            var r7 = advance(q7, stepLimit);
            var r8 = advance(q8, stepLimit);

            // Phase 2: compose 4 groups of 4 results into level-(k-1) nodes,
            // advance each → 4 level-(k-2) results. Total: 2^(k-2) gens.
            result = getNode(
                advance(getNode(r0, r1, r3, r4), stepLimit),
                advance(getNode(r1, r2, r4, r5), stepLimit),
                advance(getNode(r3, r4, r6, r7), stepLimit),
                advance(getNode(r4, r5, r7, r8), stepLimit)
            );
            node.result = result;
        }

        return result;
    }

    // --- Set a single cell (unsigned internal coords) ---
    function setCell(node, x, y, alive) {
        if (node.level === 0) {
            return alive ? ALIVE : DEAD;
        }
        var half = 1 << (node.level - 1);
        var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;
        if (x < half) {
            if (y < half) {
                nw = setCell(nw, x, y, alive);
            } else {
                sw = setCell(sw, x, y - half, alive);
            }
        } else {
            if (y < half) {
                ne = setCell(ne, x - half, y, alive);
            } else {
                se = setCell(se, x - half, y - half, alive);
            }
        }
        return getNode(nw, ne, sw, se);
    }

    // --- Get a single cell (unsigned internal coords) ---
    function getCell(node, x, y) {
        if (node.level === 0) {
            return node.population;
        }
        var half = 1 << (node.level - 1);
        if (x < half) {
            if (y < half) return getCell(node.nw, x, y);
            return getCell(node.sw, x, y - half);
        } else {
            if (y < half) return getCell(node.ne, x - half, y);
            return getCell(node.se, x - half, y - half);
        }
    }

    // --- Build tree from cell list ---
    // cells: [[r, c], ...] with arbitrary signed coordinates.
    // Returns { root, offR, offC } where internal_y = external_r + offR,
    //                                       internal_x = external_c + offC.
    function fromCellList(cells) {
        if (cells.length === 0) {
            return { root: emptyTree(3), offR: 0, offC: 0 };
        }

        // Find bounding box
        var minR = cells[0][0], maxR = cells[0][0];
        var minC = cells[0][1], maxC = cells[0][1];
        for (var i = 1; i < cells.length; i++) {
            var r = cells[i][0], c = cells[i][1];
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
        }

        // Choose level large enough to hold all cells + border
        var rangeR = maxR - minR + 1;
        var rangeC = maxC - minC + 1;
        var range = Math.max(rangeR, rangeC);
        var level = 3;
        while ((1 << level) < range + 2) level++;

        var size = 1 << level;
        // Center the pattern: compute offsets so pattern sits in middle of tree
        var offR = Math.floor((size - rangeR) / 2) - minR;
        var offC = Math.floor((size - rangeC) / 2) - minC;

        // Convert to internal coords and build tree recursively (bulk-build).
        var internalized = new Array(cells.length);
        for (var i = 0; i < cells.length; i++) {
            internalized[i] = [cells[i][1] + offC, cells[i][0] + offR]; // [ix, iy]
        }
        var root = _buildRecursive(internalized, 0, internalized.length, level, 0, 0);
        return { root: root, offR: offR, offC: offC };
    }

    // Recursively build a quadtree from a list of cells in internal coords.
    // cells[lo..hi) are [ix, iy] pairs within the square [ox, ox+2^level) x [oy, oy+2^level).
    function _buildRecursive(cells, lo, hi, level, ox, oy) {
        if (lo >= hi) return emptyTree(level);
        if (level === 0) return ALIVE; // exactly one cell at this position
        var half = 1 << (level - 1);
        var midX = ox + half;
        var midY = oy + half;
        // Partition cells into 4 quadrants in-place using a 4-way partition.
        // NW: ix < midX && iy < midY  NE: ix >= midX && iy < midY
        // SW: ix < midX && iy >= midY SE: ix >= midX && iy >= midY
        // First split by Y (top vs bottom), then by X within each half.
        var topEnd = lo;
        for (var i = lo; i < hi; i++) {
            if (cells[i][1] < midY) {
                // Top row — swap to front
                var tmp = cells[topEnd]; cells[topEnd] = cells[i]; cells[i] = tmp;
                topEnd++;
            }
        }
        // topEnd is the boundary: [lo, topEnd) = top (NW+NE), [topEnd, hi) = bottom (SW+SE)
        var nwEnd = lo;
        for (var i = lo; i < topEnd; i++) {
            if (cells[i][0] < midX) {
                var tmp = cells[nwEnd]; cells[nwEnd] = cells[i]; cells[i] = tmp;
                nwEnd++;
            }
        }
        // [lo, nwEnd) = NW, [nwEnd, topEnd) = NE
        var swEnd = topEnd;
        for (var i = topEnd; i < hi; i++) {
            if (cells[i][0] < midX) {
                var tmp = cells[swEnd]; cells[swEnd] = cells[i]; cells[i] = tmp;
                swEnd++;
            }
        }
        // [topEnd, swEnd) = SW, [swEnd, hi) = SE
        return getNode(
            _buildRecursive(cells, lo,     nwEnd,  level - 1, ox,   oy),
            _buildRecursive(cells, nwEnd,  topEnd, level - 1, midX, oy),
            _buildRecursive(cells, topEnd, swEnd,  level - 1, ox,   midY),
            _buildRecursive(cells, swEnd,  hi,     level - 1, midX, midY)
        );
    }

    // --- Extract all alive cells ---
    // Returns [[r, c], ...] in external coordinates.
    // offR, offC: the same offsets from fromCellList (internal = external + off).
    // So external = internal - off.
    function toCellList(node, offR, offC) {
        var result = [];
        _collectCells(node, 0, 0, offR, offC, result);
        return result;
    }

    function _collectCells(node, ix, iy, offR, offC, result) {
        if (node.population === 0) return;
        if (node.level === 0) {
            result.push([iy - offR, ix - offC]);
            return;
        }
        var half = 1 << (node.level - 1);
        _collectCells(node.nw, ix,        iy,        offR, offC, result);
        _collectCells(node.ne, ix + half,  iy,        offR, offC, result);
        _collectCells(node.sw, ix,         iy + half, offR, offC, result);
        _collectCells(node.se, ix + half,  iy + half, offR, offC, result);
    }

    // --- Garbage collection ---
    function gc(currentRoot) {
        _pool = new Map();
        _poolSize = 0;
        _emptyCache = [];
        _reinterNode(currentRoot);
    }

    function _reinterNode(node) {
        // Iterative traversal to avoid stack overflow on deep trees.
        var stack = [node];
        while (stack.length > 0) {
            var n = stack.pop();
            if (n.level === 0) continue;
            var key = n.nw.id + '|' + n.ne.id + '|' + n.sw.id + '|' + n.se.id;
            if (_pool.has(key)) continue;
            n.result = null;
            n.stepResult = null;
            _pool.set(key, n);
            _poolSize++;
            stack.push(n.nw, n.ne, n.sw, n.se);
        }
    }

    // --- Init / reset ---
    function init(birth, survive) {
        _level2Table = buildLevel2Table(birth, survive);
        // Clear result caches (rules changed) but keep pool structure
        _pool.forEach(function (node) {
            node.result = null;
            node.stepResult = null;
        });
        _emptyCache = [];
    }

    function poolSize() {
        return _poolSize;
    }

    // Returns true if the tree needs expanding before advance.
    // Checks that each quadrant's population is entirely in its inner corner
    // (closest to center), ensuring cells have room to grow.
    function needsExpand(node) {
        if (node.level < 3) return true;
        var nw = node.nw, ne = node.ne, sw = node.sw, se = node.se;
        return (nw.population !== nw.se.population ||
                ne.population !== ne.sw.population ||
                sw.population !== sw.ne.population ||
                se.population !== se.nw.population);
    }

    return {
        DEAD: DEAD,
        ALIVE: ALIVE,
        init: init,
        getNode: getNode,
        emptyTree: emptyTree,
        expandTree: expandTree,
        trimTree: trimTree,
        canTrim: canTrim,
        trimStep: trimStep,
        advance: advance,
        setCell: setCell,
        getCell: getCell,
        fromCellList: fromCellList,
        toCellList: toCellList,
        gc: gc,
        poolSize: poolSize,
        needsExpand: needsExpand
    };
})();
