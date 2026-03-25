/**
 * Unit tests for CanvasRenderer module.
 */

const { loadSources } = require('./test-helpers');
const combined = loadSources(['constants.js', 'patterns.js', 'region.js', 'canvas-renderer.js']);
const script = new Function(combined + '\nreturn { CanvasRenderer, THEMES, COLOR_STEPS };');
const exported = script();
const CanvasRenderer = exported.CanvasRenderer;
const THEMES = exported.THEMES;

// Helper: create a fresh CanvasRenderer instance to avoid shared cache state between tests.
function freshRenderer() {
    return Object.create(CanvasRenderer, {
        _colorPalette: { value: null, writable: true },
        _trailPalette: { value: null, writable: true },
        _paletteTheme: { value: null, writable: true },
        _aliveRGB: { value: null, writable: true },
    });
}

const CSS_RGB_RE = /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/;
const CSS_RGBA_RE = /^rgba\(\d{1,3},\d{1,3},\d{1,3},\d+(\.\d+)?\)$/;

// ── _ensurePalette ──────────────────────────────────────────────────────────

describe('_ensurePalette', () => {
    test('returns object with color and trail arrays', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result).toHaveProperty('color');
        expect(result).toHaveProperty('trail');
        expect(Array.isArray(result.color)).toBe(true);
        expect(Array.isArray(result.trail)).toBe(true);
    });

    test('color palette has 64 entries (indices 0..63)', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.color).toHaveLength(64);
    });

    test('trail palette has 21 entries (indices 0..20)', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.trail).toHaveLength(21);
    });

    test('caches results - same theme name returns same palette object', () => {
        const renderer = freshRenderer();
        const first = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        const second = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(second.color).toBe(first.color);
        expect(second.trail).toBe(first.trail);
    });

    test('different theme name causes palette rebuild', () => {
        const renderer = freshRenderer();
        const tealResult = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        const tealColor = tealResult.color;
        const midnightResult = renderer._ensurePalette(THEMES['Midnight'], 'Midnight');
        expect(midnightResult.color).not.toBe(tealColor);
    });

    test('each color palette entry is a valid CSS rgb() string', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        for (let i = 0; i < result.color.length; i++) {
            expect(result.color[i]).toMatch(CSS_RGB_RE);
        }
    });

    test('each trail palette entry is a valid CSS rgba() string', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        for (let i = 0; i < result.trail.length; i++) {
            expect(result.trail[i]).toMatch(CSS_RGBA_RE);
        }
    });
});

// ── buildPalettes (via _ensurePalette) ──────────────────────────────────────

describe('buildPalettes via _ensurePalette', () => {
    test('Teal theme produces expected palette structure', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.color).toHaveLength(64);
        expect(result.trail).toHaveLength(21);
    });

    test('Midnight theme produces expected palette structure', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Midnight'], 'Midnight');
        expect(result.color).toHaveLength(64);
        expect(result.trail).toHaveLength(21);
    });

    test('first color entry differs from last (age gradient)', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.color[0]).not.toBe(result.color[63]);
    });

    test('Midnight first color entry differs from last', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Midnight'], 'Midnight');
        expect(result.color[0]).not.toBe(result.color[63]);
    });

    test('Teal first entry uses young RGB values', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        const theme = THEMES['Teal'];
        expect(result.color[0]).toBe('rgb(' + theme.youngR + ',' + theme.youngG + ',' + theme.youngB + ')');
    });

    test('Teal last entry uses alive RGB values', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        const theme = THEMES['Teal'];
        expect(result.color[63]).toBe('rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')');
    });

    test('trail palette first entry has zero alpha', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.trail[0]).toMatch(/,0\.00\)$/);
    });

    test('trail palette last entry has non-zero alpha', () => {
        const renderer = freshRenderer();
        const result = renderer._ensurePalette(THEMES['Teal'], 'Teal');
        expect(result.trail[20]).not.toMatch(/,0\.00\)$/);
    });
});

// ── drawRotationPreview ─────────────────────────────────────────────────────

describe('drawRotationPreview', () => {
    test('handles null pattern name gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview({}, null, 0, THEMES['Teal']);
        }).not.toThrow();
    });

    test('handles undefined pattern name gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview({}, undefined, 0, THEMES['Teal']);
        }).not.toThrow();
    });

    test('handles null canvas gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview(null, 'Glider', 0, THEMES['Teal']);
        }).not.toThrow();
    });

    test('handles undefined canvas gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview(undefined, 'Glider', 0, THEMES['Teal']);
        }).not.toThrow();
    });

    test('handles non-existent pattern name gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview({ isConnected: true }, 'NonExistentPattern99', 0, THEMES['Teal']);
        }).not.toThrow();
    });

    test('handles disconnected canvas gracefully', () => {
        const renderer = freshRenderer();
        expect(() => {
            renderer.drawRotationPreview({ isConnected: false }, 'Glider', 0, THEMES['Teal']);
        }).not.toThrow();
    });
});
