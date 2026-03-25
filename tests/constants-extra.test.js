const fs = require('fs');
const constantsSrc = fs.readFileSync(__dirname + '/../constants.js', 'utf8');
const patternsSrc = fs.readFileSync(__dirname + '/../patterns.js', 'utf8');
const combined = constantsSrc + '\n' + patternsSrc;
const script = new Function(combined + '\nreturn { detectAndParsePattern, overlayAges, SimEngine, MAX_AGE, THEMES, RULE_PRESETS, SPEED_DELAYS };');
const exported = script();
const { detectAndParsePattern, overlayAges, SimEngine, MAX_AGE, THEMES, RULE_PRESETS, SPEED_DELAYS } = exported;

// ── detectAndParsePattern ────────────────────────────────────────────────────

describe('detectAndParsePattern', () => {

    test('detects and parses RLE input (contains "x =" and "!")', () => {
        const rle = 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!';
        const result = detectAndParsePattern(rle);
        expect(result).toHaveProperty('cells');
        expect(Array.isArray(result.cells)).toBe(true);
        // Glider: 5 live cells
        expect(result.cells.length).toBe(5);
    });

    test('detects and parses plaintext input (dots and Os)', () => {
        const plain = '.O\n..O\nOOO';
        const result = detectAndParsePattern(plain);
        expect(result).toHaveProperty('cells');
        expect(Array.isArray(result.cells)).toBe(true);
        // Same glider shape: 5 cells
        expect(result.cells.length).toBe(5);
    });

    test('detects Life 1.06 format (starts with "#Life 1.06")', () => {
        const life106 = '#Life 1.06\n0 0\n1 0\n2 0';
        const result = detectAndParsePattern(life106);
        expect(result).toHaveProperty('cells');
        expect(Array.isArray(result.cells)).toBe(true);
        expect(result.cells.length).toBe(3);
    });

    test('detects Life 1.05 format', () => {
        const life105 = '#Life 1.05\n#D A test pattern\n#P 0 0\n.*\n**';
        const result = detectAndParsePattern(life105);
        expect(result).toHaveProperty('cells');
        expect(Array.isArray(result.cells)).toBe(true);
        expect(result.cells.length).toBeGreaterThan(0);
    });

    test('returns object with .cells array for every format', () => {
        const inputs = [
            'x = 1, y = 1, rule = B3/S23\no!',
            '.O\nOO',
            '#Life 1.06\n0 0',
            '#Life 1.05\n#P 0 0\n*'
        ];
        inputs.forEach(input => {
            const result = detectAndParsePattern(input);
            expect(result).toBeDefined();
            expect(result).toHaveProperty('cells');
            expect(Array.isArray(result.cells)).toBe(true);
        });
    });
});

// ── overlayAges ──────────────────────────────────────────────────────────────

describe('overlayAges', () => {

    test('new cells get age 1', () => {
        const oldMap = new Map();
        const newCells = [[0, 0], [1, 1]];
        const result = overlayAges(oldMap, newCells);
        expect(result.get('0,0')).toBe(1);
        expect(result.get('1,1')).toBe(1);
    });

    test('existing cells increment age', () => {
        const oldMap = new Map();
        oldMap.set('0,0', 5);
        oldMap.set('1,1', 10);
        const newCells = [[0, 0], [1, 1]];
        const result = overlayAges(oldMap, newCells);
        expect(result.get('0,0')).toBe(6);
        expect(result.get('1,1')).toBe(11);
    });

    test('age is capped at MAX_AGE', () => {
        const oldMap = new Map();
        oldMap.set('0,0', MAX_AGE);
        const newCells = [[0, 0]];
        const result = overlayAges(oldMap, newCells);
        expect(result.get('0,0')).toBe(MAX_AGE);
    });

    test('handles empty old map', () => {
        const oldMap = new Map();
        const newCells = [[3, 4], [5, 6]];
        const result = overlayAges(oldMap, newCells);
        expect(result.size).toBe(2);
        expect(result.get('3,4')).toBe(1);
        expect(result.get('5,6')).toBe(1);
    });
});

// ── THEMES ───────────────────────────────────────────────────────────────────

describe('THEMES', () => {
    const expectedKeys = ['Teal', 'Midnight', 'Ember', 'Violet', 'Forest', 'Rose', 'Sepia'];

    test('has all expected theme keys', () => {
        expectedKeys.forEach(key => {
            expect(THEMES).toHaveProperty(key);
        });
    });

    test.each(expectedKeys)('theme "%s" has required color properties', (themeName) => {
        const theme = THEMES[themeName];
        expect(typeof theme.aliveR).toBe('number');
        expect(typeof theme.aliveG).toBe('number');
        expect(typeof theme.aliveB).toBe('number');
        expect(typeof theme.youngR).toBe('number');
        expect(typeof theme.youngG).toBe('number');
        expect(typeof theme.youngB).toBe('number');
        expect(typeof theme.bg).toBe('string');
    });
});

// ── RULE_PRESETS ─────────────────────────────────────────────────────────────

describe('RULE_PRESETS', () => {

    test('has B3/S23 (Conway\'s Life)', () => {
        const conway = RULE_PRESETS.find(p => p.rule === 'B3/S23');
        expect(conway).toBeDefined();
        expect(conway.name).toMatch(/Conway/i);
    });
});

// ── SPEED_DELAYS ─────────────────────────────────────────────────────────────

describe('SPEED_DELAYS', () => {

    test('is an array of 10 numbers', () => {
        expect(Array.isArray(SPEED_DELAYS)).toBe(true);
        expect(SPEED_DELAYS.length).toBe(10);
        SPEED_DELAYS.forEach(val => {
            expect(typeof val).toBe('number');
        });
    });
});
