/**
 * Unit tests for SimRunner module (simulation.js).
 * Tests step, stepN, invalidate, and boundary mode behaviour.
 */

const fs = require('fs');
const constantsSrc = fs.readFileSync(__dirname + '/../constants.js', 'utf8');
const patternsSrc = fs.readFileSync(__dirname + '/../patterns.js', 'utf8');
const hashlifeSrc = fs.readFileSync(__dirname + '/../hashlife.js', 'utf8');
const regionSrc = fs.readFileSync(__dirname + '/../region.js', 'utf8');
const simSrc = fs.readFileSync(__dirname + '/../simulation.js', 'utf8');
const combined = constantsSrc + '\n' + patternsSrc + '\n' + hashlifeSrc + '\n' + regionSrc + '\n' + simSrc;
const script = new Function(combined + '\nreturn { SimRunner, SimEngine, HashLife, RegionUtil, parseKey, overlayAges };');
const exported = script();
const { SimRunner, SimEngine, HashLife, RegionUtil, parseKey } = exported;

// Conway's Game of Life rules: B3/S23
const BIRTH = [3];
const SURVIVE = [2, 3];

/** Helper: create a Map of live cells from an array of [r, c] pairs. */
function makeCells(pairs) {
    const m = new Map();
    for (const [r, c] of pairs) {
        m.set(r + ',' + c, 1);
    }
    return m;
}

/** Helper: extract sorted [r, c] pairs from a live cell Map. */
function cellList(map) {
    const list = [];
    map.forEach((age, key) => {
        const rc = parseKey(key);
        list.push(rc);
    });
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return list;
}

beforeEach(() => {
    HashLife.init(BIRTH, SURVIVE);
    SimRunner.invalidate();
});

// ── SimRunner.step ──────────────────────────────────────────────────────────

describe('SimRunner.step', () => {

    test('blinker oscillates (toroidal)', () => {
        // Vertical blinker at column 5, rows 4-6 on a 10x10 board
        const blinkerV = makeCells([[4, 5], [5, 5], [6, 5]]);
        const gen1 = SimRunner.step(blinkerV, 10, 10, BIRTH, SURVIVE, 'toroidal', null, null);

        // Should become horizontal blinker: row 5, cols 4-6
        const expected1 = [[5, 4], [5, 5], [5, 6]];
        expect(cellList(gen1)).toEqual(expected1);

        // Step again: should return to vertical
        const gen2 = SimRunner.step(gen1, 10, 10, BIRTH, SURVIVE, 'toroidal', null, null);
        const expected2 = [[4, 5], [5, 5], [6, 5]];
        expect(cellList(gen2)).toEqual(expected2);
    });

    test('block is stable (toroidal)', () => {
        const block = makeCells([[2, 2], [2, 3], [3, 2], [3, 3]]);
        const gen1 = SimRunner.step(block, 10, 10, BIRTH, SURVIVE, 'toroidal', null, null);
        expect(cellList(gen1)).toEqual([[2, 2], [2, 3], [3, 2], [3, 3]]);
        expect(gen1.size).toBe(4);
    });

    test('empty board stays empty', () => {
        const empty = new Map();
        const gen1 = SimRunner.step(empty, 10, 10, BIRTH, SURVIVE, 'toroidal', null, null);
        expect(gen1.size).toBe(0);
    });

    test('works with finite boundary', () => {
        // Blinker near the edge: cells that would go out of bounds die
        const blinkerEdge = makeCells([[0, 0], [0, 1], [0, 2]]);
        const gen1 = SimRunner.step(blinkerEdge, 10, 10, BIRTH, SURVIVE, 'finite', null, null);

        // In finite mode, only cells within [0,rows) x [0,cols) survive.
        // The horizontal blinker at row 0 would produce cells at row -1 and row 1,
        // but row -1 is clipped. Only row 0 col 1 and row 1 col 1 survive.
        const coords = cellList(gen1);
        for (const [r, c] of coords) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(10);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(10);
        }
        // Population should be less than 3 since some neighbours are out of bounds
        expect(gen1.size).toBeLessThan(3);
    });

    test('works with unbounded boundary (uses HashLife)', () => {
        // Blinker in unbounded mode: should oscillate just like toroidal
        const blinkerV = makeCells([[4, 5], [5, 5], [6, 5]]);
        const gen1 = SimRunner.step(blinkerV, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);

        // Should become horizontal blinker at row 5
        const coords = cellList(gen1);
        expect(coords.length).toBe(3);
        // All cells should be on row 5
        for (const [r] of coords) {
            expect(r).toBe(5);
        }
        // Columns should span 4-6
        const cols = coords.map(([, c]) => c);
        expect(cols).toEqual([4, 5, 6]);
    });
});

// ── SimRunner.stepN ─────────────────────────────────────────────────────────

describe('SimRunner.stepN', () => {

    test('advances correct number of generations', () => {
        // Blinker has period 2; after 4 gens it returns to original state
        const blinkerV = makeCells([[4, 5], [5, 5], [6, 5]]);
        const result = SimRunner.stepN(blinkerV, 10, 10, BIRTH, SURVIVE, 'toroidal', 4, null, null);

        expect(result.pops.length).toBe(4);
        expect(cellList(result.liveCells)).toEqual([[4, 5], [5, 5], [6, 5]]);
    });

    test('returns correct population array', () => {
        // Blinker always has population 3
        const blinkerV = makeCells([[4, 5], [5, 5], [6, 5]]);
        const result = SimRunner.stepN(blinkerV, 10, 10, BIRTH, SURVIVE, 'toroidal', 5, null, null);

        expect(result.pops).toHaveLength(5);
        for (const pop of result.pops) {
            expect(pop).toBe(3);
        }
    });

    test('peak population tracking', () => {
        // R-pentomino generates a burst of activity with population > 5
        const rPent = makeCells([[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]]);
        const result = SimRunner.stepN(rPent, 40, 40, BIRTH, SURVIVE, 'toroidal', 20, null, null);

        expect(result.peak).toBeGreaterThanOrEqual(Math.max(...result.pops));
        // R-pentomino population grows beyond 5 in early generations
        expect(result.peak).toBeGreaterThan(5);
    });

    test('advances correct number of generations (unbounded)', () => {
        // Blinker in unbounded mode via HashLife batch path
        const blinkerV = makeCells([[4, 5], [5, 5], [6, 5]]);
        SimRunner.invalidate();
        const result = SimRunner.stepN(blinkerV, 10, 10, BIRTH, SURVIVE, 'unbounded', 4, null, null);

        expect(result.pops).toHaveLength(4);
        // After 4 gens (even period) blinker returns to original orientation
        expect(cellList(result.liveCells)).toEqual([[4, 5], [5, 5], [6, 5]]);
    });
});

// ── SimRunner.invalidate ────────────────────────────────────────────────────

describe('SimRunner.invalidate', () => {

    test('does not throw', () => {
        expect(() => SimRunner.invalidate()).not.toThrow();
    });

    test('subsequent step still works correctly after invalidate', () => {
        const block = makeCells([[2, 2], [2, 3], [3, 2], [3, 3]]);

        // Run a step to build internal state
        SimRunner.step(block, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);

        // Invalidate cache
        SimRunner.invalidate();

        // Should still produce correct results
        const gen1 = SimRunner.step(block, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);
        expect(cellList(gen1)).toEqual([[2, 2], [2, 3], [3, 2], [3, 3]]);
    });

    test('invalidate between different patterns produces correct results', () => {
        // Step with a blinker
        const blinker = makeCells([[4, 5], [5, 5], [6, 5]]);
        SimRunner.step(blinker, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);

        SimRunner.invalidate();

        // Now step with a completely different pattern (block)
        const block = makeCells([[0, 0], [0, 1], [1, 0], [1, 1]]);
        const gen1 = SimRunner.step(block, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);
        expect(gen1.size).toBe(4);
        expect(cellList(gen1)).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    });
});

// ── SimRunner boundary modes ────────────────────────────────────────────────

describe('SimRunner boundary modes', () => {

    test('toroidal: cells wrap around edges', () => {
        // Place a vertical blinker at the top edge: rows 0, 9 (wrapped), 1
        // on a 10x10 board. In toroidal mode row -1 wraps to row 9.
        const wrappingBlinker = makeCells([[9, 5], [0, 5], [1, 5]]);
        const gen1 = SimRunner.step(wrappingBlinker, 10, 10, BIRTH, SURVIVE, 'toroidal', null, null);

        // Should become horizontal at row 0 spanning cols 4-6 (wrapped toroidal)
        const coords = cellList(gen1);
        expect(coords.length).toBe(3);
        // All cells on row 0
        for (const [r] of coords) {
            expect(r).toBe(0);
        }
    });

    test('finite: cells die at boundary', () => {
        // Place a glider heading toward the top-left corner on a small board
        // After enough steps, any cells that move out of bounds are removed
        const glider = makeCells([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]);
        const gen1 = SimRunner.step(glider, 6, 6, BIRTH, SURVIVE, 'finite', null, null);

        // All cells must remain in bounds [0,6) x [0,6)
        gen1.forEach((age, key) => {
            const [r, c] = parseKey(key);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(6);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(6);
        });
    });

    test('finite: cells clipped by region mask', () => {
        // Use a custom region mask (L-shape) and verify clipping
        const mask = new Set(['0,0', '0,1', '1,0', '2,0', '2,1']);
        const cells = makeCells([[0, 0], [0, 1], [1, 0]]);
        const gen1 = SimRunner.step(cells, 10, 10, BIRTH, SURVIVE, 'finite', mask, null);

        // All resulting cells must be within the mask
        gen1.forEach((age, key) => {
            expect(mask.has(key)).toBe(true);
        });
    });

    test('unbounded: cells expand freely beyond grid', () => {
        // Place a glider and run several steps in unbounded mode
        // Cells should be allowed to go beyond the original grid bounds
        const glider = makeCells([[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]]);

        let current = glider;
        for (let i = 0; i < 20; i++) {
            SimRunner.invalidate();
            current = SimRunner.step(current, 5, 5, BIRTH, SURVIVE, 'unbounded', null, null);
        }

        // A glider moves diagonally; after 20 gens some cells should be outside [0,5) x [0,5)
        let outsideBounds = false;
        current.forEach((age, key) => {
            const [r, c] = parseKey(key);
            if (r < 0 || r >= 5 || c < 0 || c >= 5) {
                outsideBounds = true;
            }
        });
        expect(outsideBounds).toBe(true);
        // Should still have 5 cells (glider is a spaceship)
        expect(current.size).toBe(5);
    });

    test('unbounded: empty board stays empty', () => {
        const empty = new Map();
        const gen1 = SimRunner.step(empty, 10, 10, BIRTH, SURVIVE, 'unbounded', null, null);
        expect(gen1.size).toBe(0);
    });
});
