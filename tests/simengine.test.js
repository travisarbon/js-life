/**
 * Unit tests for SimEngine pure functions.
 * Extracted from script.js for testability.
 */

// Load pattern data + pure functions from constants.js + patterns.js.
const fs = require('fs');
const patternsSrc = fs.readFileSync(__dirname + '/../patterns.js', 'utf8');
const constantsSrc = fs.readFileSync(__dirname + '/../constants.js', 'utf8');
const pureSrc = constantsSrc + '\n' + patternsSrc;

// Execute in current scope using indirect eval to expose globals.
const script = new Function(pureSrc + '\nreturn { parseKey, SimEngine, PATTERN_GROUPS, PATTERNS, PATTERN_META, RULE_PRESETS, SPEED_DELAYS, THEMES, overlayAges };');
const exported = script();
const parseKey = exported.parseKey;
const SimEngine = exported.SimEngine;

describe('parseKey', () => {
    test('parses positive coordinates', () => {
        expect(parseKey('5,10')).toEqual([5, 10]);
    });

    test('parses negative coordinates', () => {
        expect(parseKey('-3,7')).toEqual([-3, 7]);
        expect(parseKey('-1,-2')).toEqual([-1, -2]);
    });

    test('handles zero coordinates', () => {
        expect(parseKey('0,0')).toEqual([0, 0]);
    });

    test('handles invalid input gracefully', () => {
        expect(parseKey('invalid')).toEqual([0, 0]);
    });
});

describe('SimEngine.buildLiveCells', () => {
    test('returns a Map', () => {
        const result = SimEngine.buildLiveCells(10, 10, 2);
        expect(result).toBeInstanceOf(Map);
    });

    test('produces cells within bounds', () => {
        const result = SimEngine.buildLiveCells(5, 5, 2);
        result.forEach((age, key) => {
            const [r, c] = parseKey(key);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(5);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(5);
        });
    });

    test('higher sparseness produces fewer cells', () => {
        const dense = SimEngine.buildLiveCells(50, 50, 2);
        const sparse = SimEngine.buildLiveCells(50, 50, 7);
        expect(dense.size).toBeGreaterThan(sparse.size);
    });
});

describe('SimEngine.getBoundingBox', () => {
    test('returns null for empty map', () => {
        expect(SimEngine.getBoundingBox(new Map())).toBeNull();
    });

    test('returns correct bounds', () => {
        const cells = new Map();
        cells.set('2,3', 1);
        cells.set('5,1', 1);
        cells.set('0,7', 1);
        const bb = SimEngine.getBoundingBox(cells);
        expect(bb).toEqual({ minR: 0, maxR: 5, minC: 1, maxC: 7 });
    });
});

describe('SimEngine.computeNextGeneration', () => {
    test('blinker oscillates', () => {
        const cells = new Map();
        cells.set('1,0', 1);
        cells.set('1,1', 1);
        cells.set('1,2', 1);
        const next = SimEngine.computeNextGeneration(cells, 5, 5, [3], [2, 3], 'finite');
        // Blinker should rotate to vertical
        expect(next.has('0,1')).toBe(true);
        expect(next.has('1,1')).toBe(true);
        expect(next.has('2,1')).toBe(true);
        expect(next.size).toBe(3);
    });

    test('block is stable', () => {
        const cells = new Map();
        cells.set('0,0', 1);
        cells.set('0,1', 1);
        cells.set('1,0', 1);
        cells.set('1,1', 1);
        const next = SimEngine.computeNextGeneration(cells, 5, 5, [3], [2, 3], 'finite');
        expect(next.size).toBe(4);
        expect(next.has('0,0')).toBe(true);
        expect(next.has('0,1')).toBe(true);
        expect(next.has('1,0')).toBe(true);
        expect(next.has('1,1')).toBe(true);
    });

    test('empty board stays empty', () => {
        const cells = new Map();
        const next = SimEngine.computeNextGeneration(cells, 10, 10, [3], [2, 3], 'finite');
        expect(next.size).toBe(0);
    });
});

describe('SimEngine.parseRLE', () => {
    test('parses simple glider RLE', () => {
        const rle = 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!';
        const result = SimEngine.parseRLE(rle);
        expect(result.cells.length).toBe(5);
        expect(result.truncated).toBe(false);
        expect(result.rule).toBe('B3/S23');
    });

    test('parses RLE without header', () => {
        const rle = 'bo$2bo$3o!';
        const result = SimEngine.parseRLE(rle);
        expect(result.cells.length).toBe(5);
    });

    test('handles empty pattern', () => {
        const rle = 'x = 0, y = 0\n!';
        const result = SimEngine.parseRLE(rle);
        expect(result.cells.length).toBe(0);
    });

    test('caps run counts to prevent DoS', () => {
        const rle = '999999999o!';
        const result = SimEngine.parseRLE(rle);
        expect(result.cells.length).toBeLessThanOrEqual(100000);
    });
});

describe('SimEngine.parsePlaintext', () => {
    test('parses cells format', () => {
        const text = '!Name: Blinker\n.O.\n.O.\n.O.';
        const result = SimEngine.parsePlaintext(text);
        expect(result.cells.length).toBe(3);
    });
});

describe('SimEngine.boardToRLE', () => {
    test('serializes and round-trips', () => {
        const cells = new Map();
        cells.set('0,1', 1);
        cells.set('1,2', 1);
        cells.set('2,0', 1);
        cells.set('2,1', 1);
        cells.set('2,2', 1);
        const rle = SimEngine.boardToRLE(cells, 'B3/S23');
        expect(rle).toContain('rule = B3/S23');
        expect(rle).toContain('!');
        // Round-trip: parse the RLE back
        const parsed = SimEngine.parseRLE(rle);
        expect(parsed.cells.length).toBe(5);
    });

    test('returns empty string for empty board', () => {
        const rle = SimEngine.boardToRLE(new Map(), 'B3/S23');
        expect(rle).toBe('');
    });
});

describe('SimEngine.rotatePattern', () => {
    test('rotation 0 is identity', () => {
        const cells = [[0, 0], [0, 1], [1, 0]];
        const result = SimEngine.rotatePattern(cells, 0);
        expect(result).toEqual(cells);
    });

    test('4 rotations returns to original', () => {
        const cells = [[0, 1], [1, 2], [2, 0]];
        const result = SimEngine.rotatePattern(cells, 4);
        expect(result).toEqual(cells);
    });

    test('rotation preserves cell count', () => {
        const cells = [[0, 0], [0, 1], [1, 0], [2, 2]];
        const result = SimEngine.rotatePattern(cells, 1);
        expect(result.length).toBe(cells.length);
    });
});

describe('SimEngine.parseLife106', () => {
    test('parses Life 1.06 format', () => {
        const text = '#Life 1.06\n0 0\n1 0\n2 0';
        const result = SimEngine.parseLife106(text);
        expect(result.cells.length).toBe(3);
    });
});

describe('SimEngine.parseLife105', () => {
    test('parses Life 1.05 format', () => {
        const text = '#Life 1.05\n#P 0 0\n.*.\n***';
        const result = SimEngine.parseLife105(text);
        expect(result.cells.length).toBe(4);
    });
});
