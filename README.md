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

The UI is a React 19 functional component (`LifeBoard`) that owns all state via `useReducer`. It delegates to 10 child components and 6 utility modules.

### Core modules

| File | Responsibility |
|------|---------------|
| `constants.js` | Shared constants, `parseKey`, `SimEngine`, format parsers, themes |
| `hashlife.js` | HashLife quadtree algorithm |
| `patterns.js` | Pattern library data |
| `canvas-renderer.js` | Canvas drawing (cells, grid, selection, trails) |
| `simulation.js` | Simulation runner (SimEngine + HashLife dispatcher) |
| `region.js` | Region mask utilities |
| `input-handler.js` | Mouse, touch, and drawing event handling |

### Utility modules

| File | Responsibility |
|------|---------------|
| `life-sim-utils.js` | Simulation loop, undo/redo, stepping |
| `life-io-utils.js` | File import/export, URL sharing, RLE |
| `life-input-utils.js` | Keyboard, mouse, and touch event delegation |
| `life-view-utils.js` | Viewport, layout, panel/group management |
| `life-board-utils.js` | Board config, drawing modes, selection, patterns |
| `life-analysis-utils.js` | Pattern analysis, recording, help modal |

### React components

| File | Components |
|------|-----------|
| `script.js` | `LifeBoard` — root component (state, effects, layout dispatch) |
| `components/canvas-area.js` | `CanvasArea`, `MobileMinimapArea` + imperative `drawBoard`/`drawMinimap` |
| `components/observatory-panels.js` | `FloatPanel`, `PanelGroup`, `CompactBody` + drag/resize handlers |
| `components/layout-shell.js` | `CartographerLayout`, `ObservatoryLayout`, `BottomSheet`, `LayoutSwitcher` |
| `components/tools-panel.js` | `ModeControls`, `ToolsContent`, `MobileContextPanel` |
| `components/settings-panels.js` | `ViewControls`, `ZoomSlider`, `DisplaySettings`, `BoardSliders`, etc. |
| `components/stats-panel.js` | `StatsPanel`, `SparklineSVG`, `StatsChip` |
| `components/transport-controls.js` | `TransportControls`, `MobileTransportBar` |
| `components/rules-export.js` | `RulesSection`, `ExportContent`, `RLESection` |
| `components/help-modal.js` | `HelpModal` |
| `components/pop-graph.js` | `PopGraphModal` |

### Build pipeline

All files are loaded as global scripts (no bundler). Babel compiles `components/*.js` and `script.js` into a single `script.compiled.js` output, which `index.html` loads.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Lint, test, then compile all JSX files to `script.compiled.js` |
| `npm run lint` | Run ESLint across all source files |
| `npm test` | Run Jest test suite |
| `npm start` | Serve the app locally |

## License

[MIT](LICENSE)
