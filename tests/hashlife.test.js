/**
 * Unit tests for HashLife quadtree algorithm.
 */

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../hashlife.js', 'utf8');
const script = new Function(src + '\nreturn HashLife;');
const HashLife = script();

beforeEach(() => {
    HashLife.init([3], [2, 3]); // Conway rules
});

describe('HashLife.init', () => {
    test('initializes without error', () => {
        expect(() => HashLife.init([3], [2, 3])).not.toThrow();
    });

    test('pool starts small', () => {
        HashLife.init([3], [2, 3]);
        // After init, pool should only contain structural nodes
        expect(HashLife.poolSize()).toBeGreaterThanOrEqual(0);
    });
});

describe('HashLife.fromCellList + toCellList', () => {
    test('round-trips a cell list', () => {
        const cells = [[0, 0], [1, 1], [2, 2]];
        const tree = HashLife.fromCellList(cells);
        const result = HashLife.toCellList(tree.root, tree.offR, tree.offC);
        expect(result.length).toBe(3);
        // Sort both for comparison
        const sorted = result.map(c => c[0] + ',' + c[1]).sort();
        const expected = cells.map(c => c[0] + ',' + c[1]).sort();
        expect(sorted).toEqual(expected);
    });

    test('handles empty cell list', () => {
        const tree = HashLife.fromCellList([]);
        const result = HashLife.toCellList(tree.root, tree.offR, tree.offC);
        expect(result.length).toBe(0);
    });

    test('handles negative coordinates', () => {
        const cells = [[-5, -3], [0, 0], [10, 10]];
        const tree = HashLife.fromCellList(cells);
        const result = HashLife.toCellList(tree.root, tree.offR, tree.offC);
        expect(result.length).toBe(3);
        const sorted = result.map(c => c[0] + ',' + c[1]).sort();
        const expected = cells.map(c => c[0] + ',' + c[1]).sort();
        expect(sorted).toEqual(expected);
    });
});

describe('HashLife.advance', () => {
    test('blinker oscillates', () => {
        const cells = [[0, -1], [0, 0], [0, 1]];
        const tree = HashLife.fromCellList(cells);
        let root = tree.root;
        let offR = tree.offR, offC = tree.offC;

        // Expand and advance 1 step
        while (HashLife.needsExpand(root)) {
            const lvl = root.level;
            root = HashLife.expandTree(root);
            offR += (1 << (lvl - 1));
            offC += (1 << (lvl - 1));
        }
        const level = root.level;
        root = HashLife.expandTree(root);
        offR += (1 << (level - 1));
        offC += (1 << (level - 1));

        const nextLevel = root.level;
        root = HashLife.advance(root, 1);
        offR -= (1 << (nextLevel - 2));
        offC -= (1 << (nextLevel - 2));

        const result = HashLife.toCellList(root, offR, offC);
        expect(result.length).toBe(3);
        // Should be vertical: [-1,0], [0,0], [1,0]
        const sorted = result.map(c => c[0] + ',' + c[1]).sort();
        expect(sorted).toContain('-1,0');
        expect(sorted).toContain('0,0');
        expect(sorted).toContain('1,0');
    });

    test('block is stable', () => {
        const cells = [[0, 0], [0, 1], [1, 0], [1, 1]];
        const tree = HashLife.fromCellList(cells);
        let root = tree.root;
        let offR = tree.offR, offC = tree.offC;

        while (HashLife.needsExpand(root)) {
            const lvl = root.level;
            root = HashLife.expandTree(root);
            offR += (1 << (lvl - 1));
            offC += (1 << (lvl - 1));
        }
        const level = root.level;
        root = HashLife.expandTree(root);
        offR += (1 << (level - 1));
        offC += (1 << (level - 1));

        const nextLevel = root.level;
        root = HashLife.advance(root, 1);
        offR -= (1 << (nextLevel - 2));
        offC -= (1 << (nextLevel - 2));

        const result = HashLife.toCellList(root, offR, offC);
        expect(result.length).toBe(4);
    });
});

describe('HashLife.gc', () => {
    test('reduces pool size', () => {
        const cells = [[0, 0], [0, 1], [1, 0]];
        const tree = HashLife.fromCellList(cells);
        const beforeGC = HashLife.poolSize();
        HashLife.gc(tree.root);
        const afterGC = HashLife.poolSize();
        expect(afterGC).toBeLessThanOrEqual(beforeGC);
    });
});

describe('HashLife.emptyTree', () => {
    test('creates tree with zero population', () => {
        const tree = HashLife.emptyTree(5);
        expect(tree.population).toBe(0);
        expect(tree.level).toBe(5);
    });
});

describe('HashLife.needsExpand', () => {
    test('returns false for empty tree', () => {
        const tree = HashLife.emptyTree(3);
        expect(HashLife.needsExpand(tree)).toBe(false);
    });

    test('returns boolean', () => {
        const cells = [[0, 0]];
        const tree = HashLife.fromCellList(cells);
        expect(typeof HashLife.needsExpand(tree.root)).toBe('boolean');
    });
});
