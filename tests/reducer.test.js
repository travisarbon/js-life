const fs = require('fs');
const constantsSrc = fs.readFileSync(__dirname + '/../constants.js', 'utf8');
const patternsSrc = fs.readFileSync(__dirname + '/../patterns.js', 'utf8');
const regionSrc = fs.readFileSync(__dirname + '/../region.js', 'utf8');
const combined = constantsSrc + '\n' + patternsSrc + '\n' + regionSrc;
// Need to extract lifeReducer from script.js - it's a standalone function
const scriptSrc = fs.readFileSync(__dirname + '/../script.js', 'utf8');
// Extract just the lifeReducer function (lines before DOMContentLoaded)
const reducerMatch = scriptSrc.match(/function lifeReducer[\s\S]*?^}/m);
const reducerSrc = reducerMatch ? reducerMatch[0] : '';
const allSrc = combined + '\n' + reducerSrc;
const script = new Function(allSrc + '\nreturn { lifeReducer };');
const { lifeReducer } = script();

// ── MERGE action ─────────────────────────────────────────────────────────────

describe('lifeReducer — MERGE action', () => {

    test('single property update', () => {
        const state = { running: false, speed: 5 };
        const result = lifeReducer(state, { type: 'MERGE', payload: { running: true } });
        expect(result.running).toBe(true);
        expect(result.speed).toBe(5);
    });

    test('multiple properties update', () => {
        const state = { running: false, speed: 5, cols: 100 };
        const result = lifeReducer(state, { type: 'MERGE', payload: { running: true, speed: 10 } });
        expect(result.running).toBe(true);
        expect(result.speed).toBe(10);
        expect(result.cols).toBe(100);
    });

    test('does not lose existing state properties', () => {
        const state = { a: 1, b: 2, c: 3 };
        const result = lifeReducer(state, { type: 'MERGE', payload: { b: 99 } });
        expect(result.a).toBe(1);
        expect(result.b).toBe(99);
        expect(result.c).toBe(3);
    });
});

// ── Unknown action ───────────────────────────────────────────────────────────

describe('lifeReducer — unknown action', () => {

    test('returns original state unchanged', () => {
        const state = { running: true, speed: 5 };
        const result = lifeReducer(state, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(state);
    });
});

// ── State immutability ───────────────────────────────────────────────────────

describe('lifeReducer — state immutability', () => {

    test('MERGE returns a new object (not same reference)', () => {
        const state = { running: false, speed: 5 };
        const result = lifeReducer(state, { type: 'MERGE', payload: { speed: 10 } });
        expect(result).not.toBe(state);
    });
});
