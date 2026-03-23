# Plan: Fix UI Inconsistencies Across All Modes

## Overview
The codebase has a well-designed CSS custom properties system (spacing scale, type scale, radius scale, opacity tiers, z-index scale), but it's undermined by numerous inline styles and hardcoded values in both CSS and JS components that bypass these design tokens. This plan fixes all identified inconsistencies.

---

## 1. Replace inline styles in JS components with CSS classes

**Files:** `components/help-modal.js`, `components/pop-graph.js`, `components/layout-shell.js`, `components/settings-panels.js`, `components/observatory-panels.js`, `components/rules-export.js`, `components/stats-panel.js`, `main.css`

**Issues:**
- `help-modal.js:60,65` — Duplicate inline style objects for section headings (`paddingTop:'10px', opacity:0.55, fontSize:'0.85em'...`)
- `pop-graph.js:47` — Inline `fontSize:'0.8em', opacity:0.7, margin:'0 0 8px'` (0.8em and 0.7 opacity aren't in any scale)
- `pop-graph.js:48` — Inline `background:'rgba(0,0,0,0.15)', borderRadius:'4px'` (4px not in radius scale)
- `layout-shell.js:116,231` — Inline `padding:'8px 12px'` (12px is `--space-lg` but combo is ad-hoc)
- `settings-panels.js:52` — Inline `marginTop:'var(--space-sm)'`
- `settings-panels.js:73` — Inline `fontWeight:700`
- `settings-panels.js:136` — Inline `fontStyle:'italic'`
- `observatory-panels.js:357,360` — Inline `width:'100%'` and `marginTop`
- `rules-export.js:23` — Inline `opacity:0.5, fontSize:'0.85em'`
- `stats-panel.js:38` — Inline `cursor:'pointer'`

**Changes:**
- Add new CSS utility/component classes in `main.css` (e.g., `.help-section-subheading`, `.pop-graph-subtitle`, `.pop-graph-svg`, `.sheet-footer`, `.rail-footer`, `.control-label-spaced`, `.boundary-infinity`, `.unbounded-label`, `.btn-block-spaced`, `.info-hint`, `.clickable`)
- Replace all inline `style={{...}}` with `className` references using design tokens
- Standardize values: `0.8em` → `var(--text-sm)`, `0.7` opacity → `var(--opacity-secondary)`, `4px` border-radius → `var(--radius-sm)`, `10px` padding → `var(--space-lg)`

---

## 2. Fix hardcoded border-radius values in CSS

**File:** `main.css`

**Issues:**
- Line ~1292: `border-radius: 4px` (should be `var(--radius-sm)` = 6px)
- Line ~2737: `border-radius: 4px` (tooltip, should be `var(--radius-sm)`)

**Changes:**
- Replace `border-radius: 4px` with `var(--radius-sm)` at both locations

---

## 3. Fix z-index collisions (9999 overflow)

**File:** `main.css`

**Issues:**
- Three places use `z-index: 9999` — pop-out panels (~line 1496), tooltips (~lines 2742, 2759)
- These collide with each other and massively exceed the defined scale (max `--z-modal: 300`)

**Changes:**
- Pop-out panels: `z-index: var(--z-modal)` (300) — they're modal-like overlays
- Tooltips: add `--z-tooltip: 350` to the scale, use it for tooltips (tooltips should be above modals)

---

## 4. Fix hardcoded colors in pop-graph SVG

**File:** `components/pop-graph.js`

**Issues:**
- Grid lines: `stroke="rgba(255,255,255,0.15)"` — wrong in light mode
- Y-axis labels: `fill="rgba(255,255,255,0.6)"` — wrong in light mode
- X-axis label: `fill="rgba(255,255,255,0.5)"` — wrong in light mode
- Polyline stroke: falls back to `'#70959A'` (hardcoded accent)
- Polygon fill: complex inline rgba manipulation

**Changes:**
- Add CSS custom properties for graph colors: `--graph-grid`, `--graph-label`, `--graph-fill` with light/dark variants
- Use `var(--accent)` for stroke via `currentColor` or pass theme-aware values
- Use `var(--accent-rgb)` for the polygon fill opacity

---

## 5. Standardize opacity values

**Files:** `components/pop-graph.js`, `components/rules-export.js`

**Issues:**
- `pop-graph.js:47` uses `opacity: 0.7` (between `--opacity-muted: 0.55` and `--opacity-secondary: 0.75`)
- `rules-export.js:23` uses `opacity: 0.5` (below `--opacity-muted: 0.55`)

**Changes:**
- `0.7` → `var(--opacity-secondary)` (0.75 — close enough, consistent)
- `0.5` → `var(--opacity-muted)` (0.55 — close enough, consistent)

---

## 6. Standardize font sizes to type scale

**Files:** `components/help-modal.js`, `components/pop-graph.js`, `components/rules-export.js`

**Issues:**
- `0.85em` used in help-modal section headings and rules-export info icon (not in scale)
- `0.8em` used in pop-graph subtitle (not in scale)
- Both should map to `var(--text-sm)` (0.833em)

**Changes:**
- All `0.85em` and `0.8em` instances → `var(--text-sm)` via CSS classes

---

## 7. Standardize padding in layout shell footers

**File:** `components/layout-shell.js`, `main.css`

**Issues:**
- Lines 116 and 231: `padding:'8px 12px'` — should use design tokens
- 8px = `var(--space-md)`, 12px = `var(--space-lg)` — the combination is valid but should be expressed with tokens

**Changes:**
- Create `.sheet-footer` and `.rail-footer` CSS classes with `padding: var(--space-md) var(--space-lg)`
- Replace inline styles with class names

---

## Summary of files to modify

| File | Type of change |
|------|---------------|
| `main.css` | Add ~10 new utility classes, fix 2 border-radius values, fix 3 z-index values, add z-tooltip variable, add graph color variables |
| `components/help-modal.js` | Replace 2 inline styles with className |
| `components/pop-graph.js` | Replace 2 inline styles with className, use CSS vars for SVG colors |
| `components/layout-shell.js` | Replace 2 inline styles with className |
| `components/settings-panels.js` | Replace 3 inline styles with className |
| `components/observatory-panels.js` | Replace 2 inline styles with className |
| `components/rules-export.js` | Replace 1 inline style with className |
| `components/stats-panel.js` | Replace 1 inline style with className |
