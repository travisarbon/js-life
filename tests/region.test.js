const { loadSource } = require('./test-helpers');
const src = loadSource('region.js');
const script = new Function(src + '\nreturn RegionUtil;');
const RegionUtil = script();

// ---------------------------------------------------------------------------
// buildRect
// ---------------------------------------------------------------------------
describe('buildRect', () => {
    test('returns a Set with correct size for a 4x3 rectangle', () => {
        const mask = RegionUtil.buildRect(4, 3); // 4 cols, 3 rows
        expect(mask).toBeInstanceOf(Set);
        expect(mask.size).toBe(12);
    });

    test('contains origin and far-corner keys', () => {
        const mask = RegionUtil.buildRect(5, 4);
        expect(mask.has('0,0')).toBe(true);
        expect(mask.has('3,4')).toBe(true); // (rows-1),(cols-1)
        expect(mask.has('0,4')).toBe(true);
        expect(mask.has('3,0')).toBe(true);
    });

    test('works for a 1x1 board', () => {
        const mask = RegionUtil.buildRect(1, 1);
        expect(mask.size).toBe(1);
        expect(mask.has('0,0')).toBe(true);
    });

    test('works for a single-row board', () => {
        const mask = RegionUtil.buildRect(5, 1);
        expect(mask.size).toBe(5);
        for (let c = 0; c < 5; c++) {
            expect(mask.has('0,' + c)).toBe(true);
        }
    });

    test('works for a single-column board', () => {
        const mask = RegionUtil.buildRect(1, 4);
        expect(mask.size).toBe(4);
        for (let r = 0; r < 4; r++) {
            expect(mask.has(r + ',0')).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// getBounds
// ---------------------------------------------------------------------------
describe('getBounds', () => {
    test('returns null for null mask', () => {
        expect(RegionUtil.getBounds(null)).toBeNull();
    });

    test('returns null for empty Set', () => {
        expect(RegionUtil.getBounds(new Set())).toBeNull();
    });

    test('returns correct bounds for known keys', () => {
        const mask = new Set(['2,3', '5,1', '3,7']);
        const b = RegionUtil.getBounds(mask);
        expect(b).toEqual({ minR: 2, maxR: 5, minC: 1, maxC: 7 });
    });

    test('single-cell mask returns same min and max', () => {
        const mask = new Set(['4,6']);
        const b = RegionUtil.getBounds(mask);
        expect(b).toEqual({ minR: 4, maxR: 4, minC: 6, maxC: 6 });
    });

    test('works with buildRect result', () => {
        const mask = RegionUtil.buildRect(3, 5);
        const b = RegionUtil.getBounds(mask);
        expect(b).toEqual({ minR: 0, maxR: 4, minC: 0, maxC: 2 });
    });
});

// ---------------------------------------------------------------------------
// findComponents
// ---------------------------------------------------------------------------
describe('findComponents', () => {
    test('empty mask returns empty array', () => {
        expect(RegionUtil.findComponents(new Set())).toEqual([]);
    });

    test('null mask returns empty array', () => {
        expect(RegionUtil.findComponents(null)).toEqual([]);
    });

    test('single rectangle is 1 component', () => {
        const mask = RegionUtil.buildRect(3, 3);
        const comps = RegionUtil.findComponents(mask);
        expect(comps.length).toBe(1);
        expect(comps[0].cells.size).toBe(9);
    });

    test('two separate rectangles yield 2 components', () => {
        // Block A: rows 0-1, cols 0-1
        // Block B: rows 5-6, cols 5-6  (no adjacency)
        const mask = new Set([
            '0,0', '0,1', '1,0', '1,1',
            '5,5', '5,6', '6,5', '6,6'
        ]);
        const comps = RegionUtil.findComponents(mask);
        expect(comps.length).toBe(2);
        const sizes = comps.map(c => c.cells.size).sort();
        expect(sizes).toEqual([4, 4]);
    });

    test('L-shaped region is 1 connected component', () => {
        // Vertical arm: (0,0)-(2,0)  Horizontal arm: (2,1),(2,2)
        const mask = new Set(['0,0', '1,0', '2,0', '2,1', '2,2']);
        const comps = RegionUtil.findComponents(mask);
        expect(comps.length).toBe(1);
        expect(comps[0].cells.size).toBe(5);
    });

    test('diagonal cells are separate (4-connectivity)', () => {
        const mask = new Set(['0,0', '1,1']);
        const comps = RegionUtil.findComponents(mask);
        expect(comps.length).toBe(2);
    });

    test('component bounds are correct', () => {
        const mask = new Set(['2,3', '3,3', '4,3']);
        const comps = RegionUtil.findComponents(mask);
        expect(comps.length).toBe(1);
        expect(comps[0].minR).toBe(2);
        expect(comps[0].maxR).toBe(4);
        expect(comps[0].minC).toBe(3);
        expect(comps[0].maxC).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// isSimpleRect
// ---------------------------------------------------------------------------
describe('isSimpleRect', () => {
    test('true for buildRect result with matching dimensions', () => {
        const mask = RegionUtil.buildRect(6, 4);
        expect(RegionUtil.isSimpleRect(mask, 6, 4)).toBe(true);
    });

    test('false for null mask', () => {
        expect(RegionUtil.isSimpleRect(null, 3, 3)).toBe(false);
    });

    test('false when size is wrong', () => {
        const mask = RegionUtil.buildRect(3, 3);
        expect(RegionUtil.isSimpleRect(mask, 4, 3)).toBe(false);
    });

    test('false for partial mask missing a corner', () => {
        const mask = RegionUtil.buildRect(3, 3);
        mask.delete('2,2'); // remove far corner
        expect(RegionUtil.isSimpleRect(mask, 3, 3)).toBe(false);
    });

    test('false when mask has right count but wrong keys', () => {
        // 4 cells but not the 2x2 rectangle
        const mask = new Set(['0,0', '0,1', '1,0', '5,5']);
        expect(RegionUtil.isSimpleRect(mask, 2, 2)).toBe(false);
    });

    test('true for 1x1 rect', () => {
        const mask = RegionUtil.buildRect(1, 1);
        expect(RegionUtil.isSimpleRect(mask, 1, 1)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// toBitmap + bitmapHas
// ---------------------------------------------------------------------------
describe('toBitmap and bitmapHas', () => {
    test('round-trips membership correctly', () => {
        const mask = new Set(['1,2', '1,3', '2,2', '2,3']);
        const bm = RegionUtil.toBitmap(mask);
        expect(bm).not.toBeNull();
        expect(RegionUtil.bitmapHas(bm, 1, 2)).toBe(true);
        expect(RegionUtil.bitmapHas(bm, 1, 3)).toBe(true);
        expect(RegionUtil.bitmapHas(bm, 2, 2)).toBe(true);
        expect(RegionUtil.bitmapHas(bm, 2, 3)).toBe(true);
    });

    test('cells outside the mask report false', () => {
        const mask = new Set(['1,2', '1,3']);
        const bm = RegionUtil.toBitmap(mask);
        expect(RegionUtil.bitmapHas(bm, 0, 0)).toBe(false);
        expect(RegionUtil.bitmapHas(bm, 1, 4)).toBe(false);
    });

    test('out-of-bounds coordinates return false', () => {
        const mask = new Set(['0,0']);
        const bm = RegionUtil.toBitmap(mask);
        expect(RegionUtil.bitmapHas(bm, -1, 0)).toBe(false);
        expect(RegionUtil.bitmapHas(bm, 0, -1)).toBe(false);
        expect(RegionUtil.bitmapHas(bm, 100, 100)).toBe(false);
    });

    test('null bitmap returns false', () => {
        expect(RegionUtil.bitmapHas(null, 0, 0)).toBe(false);
    });

    test('toBitmap returns null for empty mask', () => {
        expect(RegionUtil.toBitmap(new Set())).toBeNull();
    });

    test('bitmap dimensions are correct', () => {
        const mask = new Set(['2,3', '4,5']);
        const bm = RegionUtil.toBitmap(mask);
        expect(bm.minR).toBe(2);
        expect(bm.minC).toBe(3);
        expect(bm.width).toBe(3);  // cols 3..5
        expect(bm.height).toBe(3); // rows 2..4
    });

    test('sparse mask: gap cells are not in bitmap', () => {
        const mask = new Set(['0,0', '0,4']);
        const bm = RegionUtil.toBitmap(mask);
        expect(RegionUtil.bitmapHas(bm, 0, 0)).toBe(true);
        expect(RegionUtil.bitmapHas(bm, 0, 4)).toBe(true);
        expect(RegionUtil.bitmapHas(bm, 0, 2)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// floodFillRegion
// ---------------------------------------------------------------------------
describe('floodFillRegion', () => {
    test('fills connected region cells starting inside', () => {
        // 3x3 rect region
        const mask = RegionUtil.buildRect(3, 3);
        const result = RegionUtil.floodFillRegion(0, 0, mask, 100);
        expect(result.length).toBe(9);
        expect(result).toContain('0,0');
        expect(result).toContain('2,2');
    });

    test('respects maxCells limit', () => {
        const mask = RegionUtil.buildRect(10, 10);
        const result = RegionUtil.floodFillRegion(0, 0, mask, 5);
        expect(result.length).toBe(5);
    });

    test('starting outside region fills outside cells (not region cells)', () => {
        // Region is small; start from a cell outside
        const mask = new Set(['0,0', '0,1', '1,0', '1,1']);
        // (5,5) is outside the region
        const result = RegionUtil.floodFillRegion(5, 5, mask, 20);
        // All returned keys should NOT be in the mask
        result.forEach(key => {
            expect(mask.has(key)).toBe(false);
        });
        expect(result.length).toBe(20); // limited by maxCells
    });

    test('fill on isolated region cell returns only that cell', () => {
        // Mask with a single isolated cell surrounded by non-mask cells
        const mask = new Set(['3,3']);
        const result = RegionUtil.floodFillRegion(3, 3, mask, 100);
        expect(result).toEqual(['3,3']);
    });

    test('does not cross region boundary', () => {
        // Two separate blocks
        const mask = new Set(['0,0', '0,1', '5,5', '5,6']);
        const result = RegionUtil.floodFillRegion(0, 0, mask, 100);
        // Should only get the connected block containing (0,0)
        expect(result).toContain('0,0');
        expect(result).toContain('0,1');
        expect(result).not.toContain('5,5');
        expect(result).not.toContain('5,6');
    });
});

// ---------------------------------------------------------------------------
// rectKeys
// ---------------------------------------------------------------------------
describe('rectKeys', () => {
    test('returns correct count for a rectangle', () => {
        const keys = RegionUtil.rectKeys(0, 0, 2, 3);
        expect(keys.length).toBe(12); // 3 rows x 4 cols
    });

    test('contains corners', () => {
        const keys = RegionUtil.rectKeys(1, 2, 3, 4);
        expect(keys).toContain('1,2');
        expect(keys).toContain('1,4');
        expect(keys).toContain('3,2');
        expect(keys).toContain('3,4');
    });

    test('handles reversed coordinates', () => {
        const keys = RegionUtil.rectKeys(3, 4, 1, 2);
        expect(keys.length).toBe(9); // 3x3
        expect(keys).toContain('1,2');
        expect(keys).toContain('3,4');
    });

    test('single cell rect', () => {
        const keys = RegionUtil.rectKeys(5, 5, 5, 5);
        expect(keys).toEqual(['5,5']);
    });
});

// ---------------------------------------------------------------------------
// ellipseKeys
// ---------------------------------------------------------------------------
describe('ellipseKeys', () => {
    test('generates cells within the bounding box', () => {
        const keys = RegionUtil.ellipseKeys(0, 0, 6, 6);
        keys.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(6);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(6);
        });
    });

    test('ellipse has fewer cells than enclosing rectangle', () => {
        const ellipse = RegionUtil.ellipseKeys(0, 0, 10, 10);
        const rect = RegionUtil.rectKeys(0, 0, 10, 10);
        expect(ellipse.length).toBeLessThan(rect.length);
        expect(ellipse.length).toBeGreaterThan(0);
    });

    test('center cell is always included', () => {
        const keys = RegionUtil.ellipseKeys(2, 2, 8, 8);
        expect(keys).toContain('5,5');
    });

    test('single-cell ellipse', () => {
        const keys = RegionUtil.ellipseKeys(3, 3, 3, 3);
        expect(keys).toEqual(['3,3']);
    });

    test('handles reversed coordinates', () => {
        const a = RegionUtil.ellipseKeys(0, 0, 4, 4);
        const b = RegionUtil.ellipseKeys(4, 4, 0, 0);
        expect(new Set(a)).toEqual(new Set(b));
    });
});

// ---------------------------------------------------------------------------
// lineKeys
// ---------------------------------------------------------------------------
describe('lineKeys', () => {
    test('includes both endpoints', () => {
        const keys = RegionUtil.lineKeys(0, 0, 5, 5);
        expect(keys[0]).toBe('0,0');
        expect(keys[keys.length - 1]).toBe('5,5');
    });

    test('horizontal line has correct length', () => {
        const keys = RegionUtil.lineKeys(3, 0, 3, 7);
        expect(keys.length).toBe(8);
        keys.forEach(key => {
            expect(key.startsWith('3,')).toBe(true);
        });
    });

    test('vertical line has correct length', () => {
        const keys = RegionUtil.lineKeys(0, 4, 5, 4);
        expect(keys.length).toBe(6);
        keys.forEach(key => {
            expect(key.endsWith(',4')).toBe(true);
        });
    });

    test('single-point line', () => {
        const keys = RegionUtil.lineKeys(2, 3, 2, 3);
        expect(keys).toEqual(['2,3']);
    });

    test('diagonal line includes intermediate cells', () => {
        const keys = RegionUtil.lineKeys(0, 0, 3, 3);
        expect(keys.length).toBe(4);
        expect(keys).toContain('0,0');
        expect(keys).toContain('1,1');
        expect(keys).toContain('2,2');
        expect(keys).toContain('3,3');
    });

    test('reverse direction produces same number of cells', () => {
        const forward = RegionUtil.lineKeys(0, 0, 4, 3);
        const backward = RegionUtil.lineKeys(4, 3, 0, 0);
        expect(forward.length).toBe(backward.length);
        // Both include the endpoints
        expect(forward).toContain('0,0');
        expect(forward).toContain('4,3');
        expect(backward).toContain('0,0');
        expect(backward).toContain('4,3');
    });
});
