# Game of Life

An interactive [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) simulator built with vanilla JavaScript and React.

## Quick Start

```bash
npm install
npm run build   # lint + test + compile JSX
npm start       # serve on localhost
```

## Features

- **Drawing tools** -- paint, line, rectangle, circle, flood fill, freeform lasso selection
- **27 preset patterns** across 5 categories (still lifes, oscillators, spaceships, methuselahs, guns)
- **3 boundary modes** -- toroidal (wrap), finite, unbounded (infinite via HashLife)
- **HashLife engine** -- memoized quadtree for fast simulation of large/sparse patterns
- **Undo/redo** (30 levels), step forward/backward, multi-step advance
- **3 color themes** (Teal, Midnight, Ember) with dark mode support
- **Population graph**, stability detection, pattern analysis
- **Import/export** -- RLE, Life 1.05/1.06, plaintext; PNG and animated GIF export; URL sharing
- **Minimap**, zoom toward cursor, trackpad pan, keyboard shortcuts
- **Responsive** -- desktop rail/panel layouts, mobile bottom sheet with touch gestures
- **Accessible** -- ARIA labels, screen reader announcements, keyboard navigation, reduced-motion support

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| `.` | Step one generation |
| `,` | Step backward |
| R | Reset (random fill) |
| E | Empty board |
| D / P / B | Draw / Preset / Region mode |
| G / T / M | Toggle grid / trails / minimap |
| F | Fit live cells in view |
| Ctrl+Wheel | Zoom in/out |
| Scroll / Trackpad | Pan viewport |
| Arrows | Pan viewport |
| `[` / `]` | Rotate pattern CCW / CW |
| ? | Show help |

## Architecture

| File | Responsibility |
|------|---------------|
| `constants.js` | Shared constants, `parseKey`, `SimEngine`, format parsers, themes |
| `hashlife.js` | HashLife quadtree algorithm |
| `patterns.js` | Pattern library data |
| `canvas-renderer.js` | Canvas drawing (cells, grid, selection, trails) |
| `simulation.js` | Simulation runner (SimEngine + HashLife dispatcher) |
| `region.js` | Region mask utilities |
| `input-handler.js` | Mouse, touch, and drawing event handling |
| `script.js` | React UI component (state, lifecycle, rendering) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Lint, test, then compile `script.js` to `script.compiled.js` |
| `npm run lint` | Run ESLint across all source files |
| `npm test` | Run Jest test suite |
| `npm start` | Serve the app locally |

## License

[MIT](LICENSE)
