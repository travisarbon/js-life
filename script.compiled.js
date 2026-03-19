"use strict";

/**
 * Conway's Game of Life
 */

// ── Constants ────────────────────────────────────────────────────────────────
var MAX_UNDO_STACK = 30;
var MAX_POP_HISTORY = 10000;
var MAX_GEN_HISTORY = 200;
var MAX_TRAIL_MAP = 50000;
var TRAIL_MAX_VALUE = 20;
var TRAIL_PRUNE_THRESHOLD = 5;
var MAX_CELL_IMPORT = 100000;
var MAX_FILE_SIZE = 500000;
var MAX_HL_COORD = 1000000;
var HL_GC_THRESHOLD = 2000000;
var STABLE_COUNT_THRESHOLD = 2;
var GPS_DISPLAY_DURATION = 3000;
var LONG_PRESS_DELAY = 420;
var MAX_STEP_COUNT = 10000;
var MAX_ZOOM_WHEEL = 32;
var MAX_ZOOM_PINCH = 128;
var COLOR_STEPS = 63;
var MAX_AGE = 65535;
var MAX_FLOOD_FILL = 100000;
var ANALYSIS_TIMEOUT = 10000;
var STATS_CHIP_REAPPEAR_DELAY = 1500;

// ── Board key utilities ──────────────────────────────────────────────────────
// Encapsulates the "r,c" string key format used by the cell Map.

// Parse a "r,c" map key into [row, col] integers.
function parseKey(key) {
  var i = key.indexOf(',');
  if (i < 0) return [0, 0];
  return [parseInt(key.substring(0, i), 10) || 0, parseInt(key.substring(i + 1), 10) || 0];
}

// ── Pattern data loaded from patterns.js ─────────────────────────────────────
// Globals: PATTERN_GROUPS, PATTERNS, PATTERN_META

// ── Rule presets ──────────────────────────────────────────────────────────────
var RULE_PRESETS = [{
  name: 'Conway (B3/S23)',
  rule: 'B3/S23'
}, {
  name: 'HighLife (B36/S23)',
  rule: 'B36/S23'
}, {
  name: 'Day & Night (B3678/S34678)',
  rule: 'B3678/S34678'
}, {
  name: 'Maze (B3/S12345)',
  rule: 'B3/S12345'
}, {
  name: 'Seeds (B2/S)',
  rule: 'B2/S'
}, {
  name: 'Replicator (B1357/S1357)',
  rule: 'B1357/S1357'
}, {
  name: 'Life w/o Death (B3/S012345678)',
  rule: 'B3/S012345678'
}, {
  name: 'Anneal (B4678/S35678)',
  rule: 'B4678/S35678'
}];

// Delay in ms per generation, indexed by speed 1-10.
var SPEED_DELAYS = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];

// ── Color themes ──────────────────────────────────────────────────────────────
// Each theme defines alive/young RGB channels for age-gradient rendering plus
// canvas background and grid/selection overlay colours.
var THEMES = {
  'Teal': {
    bg: '#FFFFFF',
    aliveR: 112,
    aliveG: 149,
    aliveB: 154,
    youngR: 200,
    youngG: 220,
    youngB: 222,
    grid: 'rgba(0,0,0,0.15)',
    sel: 'rgba(112,149,154,0.25)'
  },
  'Midnight': {
    bg: '#0A0E1A',
    aliveR: 74,
    aliveG: 158,
    aliveB: 205,
    youngR: 150,
    youngG: 190,
    youngB: 225,
    grid: 'rgba(255,255,255,0.12)',
    sel: 'rgba(74,158,205,0.25)'
  },
  'Ember': {
    bg: '#FFF8F0',
    aliveR: 196,
    aliveG: 113,
    aliveB: 58,
    youngR: 230,
    youngG: 200,
    youngB: 160,
    grid: 'rgba(0,0,0,0.15)',
    sel: 'rgba(196,113,58,0.25)'
  }
};

// ── Format detection helper (shared between file drop and manual import) ─────
// R21: Extracted to avoid duplication between _handleFileDrop and loadRle.
function detectAndParsePattern(text) {
  var result;
  if (/^#Life\s+1\.06/m.test(text)) {
    result = SimEngine.parseLife106(text);
  } else if (/^#Life\s+1\.05/m.test(text)) {
    result = SimEngine.parseLife105(text);
  } else if (/x\s*=/i.test(text) || /[bo\$]/.test(text) && /!/.test(text)) {
    result = SimEngine.parseRLE(text);
  } else {
    result = SimEngine.parsePlaintext(text);
  }
  return result;
}

// ── Age overlay for HashLife ──────────────────────────────────────────────────
// Computes cell ages by diffing old Map (key→age) against new cell list [[r,c],...].
function overlayAges(oldLiveCells, newCellList, ageIncrement) {
  var inc = ageIncrement || 1;
  var newMap = new Map();
  for (var i = 0; i < newCellList.length; i++) {
    var key = newCellList[i][0] + ',' + newCellList[i][1];
    var oldAge = oldLiveCells.get(key);
    newMap.set(key, oldAge !== undefined ? Math.min(oldAge + inc, MAX_AGE) : 1);
  }
  return newMap;
}

// ── SimEngine ─────────────────────────────────────────────────────────────────
// Pure simulation functions isolated from React state for testability and reuse.
var SimEngine = {
  // Returns a sparse Map keyed by "r,c" with value = age.
  buildLiveCells: function (cols, rows, sparseness) {
    var map = new Map();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (Math.random() < 1 / sparseness) {
          map.set(r + ',' + c, 1);
        }
      }
    }
    return map;
  },
  // Async version of buildLiveCells for large boards (> 250K cells).
  // Yields to the browser via setTimeout every ~50K cells to prevent UI freeze.
  buildLiveCellsAsync: function (cols, rows, sparseness, callback) {
    var map = new Map();
    var r = 0;
    var CHUNK = Math.max(1, Math.floor(50000 / cols));
    function doChunk() {
      var end = Math.min(r + CHUNK, rows);
      for (; r < end; r++) {
        for (var c = 0; c < cols; c++) {
          if (Math.random() < 1 / sparseness) {
            map.set(r + ',' + c, 1);
          }
        }
      }
      if (r < rows) {
        setTimeout(doChunk, 0);
      } else {
        callback(map);
      }
    }
    doChunk();
  },
  // Returns bounding box {minR, maxR, minC, maxC} of live cells, or null if empty.
  getBoundingBox: function (liveCells) {
    if (liveCells.size === 0) return null;
    var minR = Infinity,
      maxR = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    liveCells.forEach(function (age, key) {
      var rc = parseKey(key),
        r = rc[0],
        c = rc[1];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    });
    return {
      minR: minR,
      maxR: maxR,
      minC: minC,
      maxC: maxC
    };
  },
  // Returns next-generation sparse Map in O(k) where k = live cell count.
  computeNextGeneration: function (liveCells, cols, rows, birth, survive, boundary) {
    if (rows <= 0 || cols <= 0) {
      return new Map();
    }
    var toroidal = boundary === 'toroidal';
    var birthLut = new Uint8Array(9);
    var surviveLut = new Uint8Array(9);
    for (var bi = 0; bi < birth.length; bi++) {
      birthLut[birth[bi]] = 1;
    }
    for (var si = 0; si < survive.length; si++) {
      surviveLut[survive[si]] = 1;
    }
    var candidates = new Map();
    liveCells.forEach(function (age, key) {
      var _krc = parseKey(key),
        kr = _krc[0],
        kc = _krc[1];
      candidates.set(key, _krc);
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }
          var nr, nc;
          if (toroidal) {
            nr = (kr + dr + rows) % rows;
            nc = (kc + dc + cols) % cols;
          } else {
            nr = kr + dr;
            nc = kc + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
              continue;
            }
          }
          var nk = nr + ',' + nc;
          if (!candidates.has(nk)) {
            candidates.set(nk, [nr, nc]);
          }
        }
      }
    });
    var newLiveCells = new Map();
    candidates.forEach(function (pos, key) {
      var r = pos[0],
        c = pos[1];
      var count = 0;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }
          var nr, nc;
          if (toroidal) {
            nr = (r + dr + rows) % rows;
            nc = (c + dc + cols) % cols;
          } else {
            nr = r + dr;
            nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
              continue;
            }
          }
          if (liveCells.has(nr + ',' + nc)) {
            count++;
          }
        }
      }
      var wasAlive = liveCells.has(key);
      var alive = wasAlive ? surviveLut[count] : birthLut[count];
      if (alive) {
        newLiveCells.set(key, wasAlive ? Math.min((liveCells.get(key) || 0) + 1, MAX_AGE) : 1);
      }
    });
    return newLiveCells;
  },
  /**
   * Toroidal simulation with a region mask. Like computeNextGeneration but
   * uses modulo wrapping on the bounding rect and restricts candidates to
   * cells that are in the mask.  The mask uses local (0-based) coordinates.
   */
  computeNextGenerationMasked: function (liveCells, cols, rows, birth, survive, mask) {
    if (rows <= 0 || cols <= 0) {
      return new Map();
    }
    var birthLut = new Uint8Array(9);
    var surviveLut = new Uint8Array(9);
    for (var bi = 0; bi < birth.length; bi++) {
      birthLut[birth[bi]] = 1;
    }
    for (var si = 0; si < survive.length; si++) {
      surviveLut[survive[si]] = 1;
    }
    var candidates = new Map();
    liveCells.forEach(function (age, key) {
      var _krc = parseKey(key),
        kr = _krc[0],
        kc = _krc[1];
      candidates.set(key, _krc);
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }
          var nr = (kr + dr + rows) % rows;
          var nc = (kc + dc + cols) % cols;
          var nk = nr + ',' + nc;
          if (!candidates.has(nk) && mask.has(nk)) {
            candidates.set(nk, [nr, nc]);
          }
        }
      }
    });
    var newLiveCells = new Map();
    candidates.forEach(function (pos, key) {
      if (!mask.has(key)) {
        return;
      }
      var r = pos[0],
        c = pos[1];
      var count = 0;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }
          var nr = (r + dr + rows) % rows;
          var nc = (c + dc + cols) % cols;
          if (liveCells.has(nr + ',' + nc)) {
            count++;
          }
        }
      }
      var wasAlive = liveCells.has(key);
      var alive = wasAlive ? surviveLut[count] : birthLut[count];
      if (alive) {
        newLiveCells.set(key, wasAlive ? Math.min((liveCells.get(key) || 0) + 1, MAX_AGE) : 1);
      }
    });
    return newLiveCells;
  },
  // Serialises live cells to RLE string (header + wrapped body).
  boardToRLE: function (liveCells, ruleString) {
    var bb = SimEngine.getBoundingBox(liveCells);
    if (!bb || !isFinite(bb.maxR)) {
      return '';
    }
    var minR = bb.minR,
      maxR = bb.maxR,
      minC = bb.minC,
      maxC = bb.maxC;
    var W = maxC - minC + 1;
    var H = maxR - minR + 1;
    var header = 'x = ' + W + ', y = ' + H + ', rule = ' + ruleString + '\n';
    var rleData = '';
    for (var row = minR; row <= maxR; row++) {
      var runChar = null,
        runLen = 0,
        rowStr = '';
      for (var col = minC; col <= maxC; col++) {
        var ch = liveCells.has(row + ',' + col) ? 'o' : 'b';
        if (ch === runChar) {
          runLen++;
        } else {
          if (runChar !== null) {
            rowStr += (runLen > 1 ? runLen : '') + runChar;
          }
          runChar = ch;
          runLen = 1;
        }
      }
      if (runChar === 'o') {
        rowStr += (runLen > 1 ? runLen : '') + runChar;
      }
      if (row < maxR) {
        rowStr += '$';
      }
      rleData += rowStr;
    }
    rleData += '!';
    var wrapped = '';
    for (var k = 0; k < rleData.length; k += 70) {
      wrapped += rleData.slice(k, k + 70) + '\n';
    }
    return header + wrapped;
  },
  // Parses standard RLE format into [[row, col], ...].
  parseRLE: function (text) {
    var lines = text.split(/\r?\n/);
    var dataLines = lines.filter(function (l) {
      return l.charAt(0) !== '#';
    });
    var headerIdx = -1;
    for (var i = 0; i < dataLines.length; i++) {
      if (/x\s*=/i.test(dataLines[i])) {
        headerIdx = i;
        break;
      }
    }
    // Extract rule from header if present.
    var parsedRule = null;
    if (headerIdx >= 0) {
      var ruleMatch = dataLines[headerIdx].match(/rule\s*=\s*([^\s,]+)/i);
      if (ruleMatch) {
        parsedRule = ruleMatch[1];
      }
    }
    var dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
    var data = dataLines.slice(dataStart).join('').replace(/\s/g, '');
    var cells = [];
    var row = 0,
      col = 0,
      countStr = '';
    var MAX_COORD = 100000;
    for (var k = 0; k < data.length; k++) {
      var ch = data[k];
      if (ch >= '0' && ch <= '9') {
        countStr += ch;
      } else if (ch === 'b' || ch === 'o') {
        var n = countStr ? parseInt(countStr, 10) : 1;
        if (isNaN(n) || n < 1) {
          n = 1;
        }
        if (n > MAX_COORD) {
          n = MAX_COORD;
        }
        if (ch === 'o') {
          for (var j = 0; j < n && cells.length < MAX_CELL_IMPORT; j++) {
            cells.push([row, col + j]);
          }
        }
        col += n;
        countStr = '';
      } else if (ch === '$') {
        var n2 = countStr ? parseInt(countStr, 10) : 1;
        if (n2 > MAX_COORD) {
          n2 = MAX_COORD;
        }
        row += n2;
        col = 0;
        countStr = '';
      } else if (ch === '!') {
        break;
      }
      if (row > MAX_COORD || col > MAX_COORD) {
        break;
      }
    }
    var truncated = cells.length > MAX_CELL_IMPORT;
    if (truncated) {
      cells.length = MAX_CELL_IMPORT;
    }
    return {
      cells: cells,
      truncated: truncated,
      rule: parsedRule
    };
  },
  // Parses LifeWiki plaintext (.cells) format into [[row, col], ...].
  parsePlaintext: function (text) {
    var lines = text.split(/\r?\n/);
    var cells = [];
    var row = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.charAt(0) === '!' || line.charAt(0) === '#') {
        continue;
      }
      for (var col = 0; col < line.length; col++) {
        var ch = line.charAt(col);
        if (ch === 'O' || ch === 'o' || ch === '*') {
          cells.push([row, col]);
        }
      }
      row++;
    }
    var truncated = cells.length > MAX_CELL_IMPORT;
    if (truncated) {
      cells.length = MAX_CELL_IMPORT;
    }
    return {
      cells: cells,
      truncated: truncated
    };
  },
  // Parses Life 1.06 format: header "#Life 1.06", then one "x y" per live cell.
  parseLife106: function (text) {
    var lines = text.split(/\r?\n/);
    var cells = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === '' || line.charAt(0) === '#') {
        continue;
      }
      var parts = line.split(/\s+/);
      if (parts.length >= 2) {
        var x = parseInt(parts[0], 10);
        var y = parseInt(parts[1], 10);
        if (!isNaN(x) && !isNaN(y)) {
          cells.push([y, x]); // Life 1.06 uses x,y; we store row,col
        }
      }
    }
    var truncated = cells.length > MAX_CELL_IMPORT;
    if (truncated) {
      cells.length = MAX_CELL_IMPORT;
    }
    return {
      cells: cells,
      truncated: truncated
    };
  },
  // Parses Life 1.05 format: header "#Life 1.05", #D descriptions, #P x y origin blocks.
  parseLife105: function (text) {
    var lines = text.split(/\r?\n/);
    var cells = [];
    var originX = 0,
      originY = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('#P') === 0) {
        var parts = line.substring(2).trim().split(/\s+/);
        originX = parseInt(parts[0], 10) || 0;
        originY = parseInt(parts[1], 10) || 0;
        var rowOffset = 0;
        for (var j = i + 1; j < lines.length; j++) {
          var bline = lines[j];
          if (bline.charAt(0) === '#' || bline.trim() === '') {
            i = j - 1;
            break;
          }
          for (var col = 0; col < bline.length; col++) {
            if (bline.charAt(col) === '*') {
              cells.push([originY + rowOffset, originX + col]);
            }
          }
          rowOffset++;
          if (j === lines.length - 1) {
            i = j;
          }
        }
      }
    }
    // Normalize to non-negative coordinates.
    if (cells.length > 0) {
      var minR = cells[0][0],
        minC = cells[0][1];
      for (var k = 1; k < cells.length; k++) {
        if (cells[k][0] < minR) {
          minR = cells[k][0];
        }
        if (cells[k][1] < minC) {
          minC = cells[k][1];
        }
      }
      if (minR < 0 || minC < 0) {
        for (var k2 = 0; k2 < cells.length; k2++) {
          cells[k2] = [cells[k2][0] - minR, cells[k2][1] - minC];
        }
      }
    }
    var truncated = cells.length > MAX_CELL_IMPORT;
    if (truncated) {
      cells.length = MAX_CELL_IMPORT;
    }
    return {
      cells: cells,
      truncated: truncated
    };
  },
  // Rotates a [[row,col],...] pattern 90° CW, `steps` times.
  rotatePattern: function (cells, steps) {
    var result = cells.slice();
    for (var s = 0; s < steps; s++) {
      var maxR = 0;
      for (var k = 0; k < result.length; k++) {
        if (result[k][0] > maxR) {
          maxR = result[k][0];
        }
      }
      result = result.map(function (cell) {
        return [cell[1], maxR - cell[0]];
      });
    }
    return result;
  }
};
document.addEventListener('DOMContentLoaded', function () {
  var LifeBoard = React.createClass({
    displayName: "LifeBoard",
    // ── Lifecycle ─────────────────────────────────────────────────────

    getInitialState: function () {
      var cols = 100;
      var rows = 100;
      // On mobile, default to 8px/cell; on desktop, 5px/cell.
      // Center the view on the grid for all screen sizes.
      var isMobileInit = window.innerWidth <= 620 || window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 550px)').matches;
      var cellSize = isMobileInit ? 8 : 5;
      var initViewX = Math.round(cols / 2 - window.innerWidth / (2 * cellSize));
      var initViewY = Math.round(rows / 2 - window.innerHeight / (2 * cellSize));
      // Load persisted layout preferences from localStorage.
      // Schema v1: {layoutMode, railCollapsed, railTab, railSide, panelStates}
      var LAYOUT_SCHEMA_VERSION = 1;
      var savedLayout = {};
      try {
        var raw = localStorage.getItem('life-layout-prefs');
        if (raw) {
          var parsed = JSON.parse(raw);
          // Validate schema version — if missing or mismatched, discard.
          if (parsed && typeof parsed === 'object') {
            // Validate layoutMode is a known value.
            if (parsed.layoutMode && ['cartographer', 'observatory'].indexOf(parsed.layoutMode) !== -1) {
              savedLayout.layoutMode = parsed.layoutMode;
            } else if (parsed.layoutMode === 'specimen') {
              savedLayout.layoutMode = 'cartographer';
            }
            if (typeof parsed.railCollapsed === 'boolean') {
              savedLayout.railCollapsed = parsed.railCollapsed;
            }
            if (parsed.railTab && ['simulate', 'tools', 'board', 'rules', 'export'].indexOf(parsed.railTab) !== -1) {
              savedLayout.railTab = parsed.railTab;
            }
            if (parsed.railSide && ['left', 'right'].indexOf(parsed.railSide) !== -1) {
              savedLayout.railSide = parsed.railSide;
            }
            // Validate panelStates: must be an object with known panel keys.
            if (parsed.panelStates && typeof parsed.panelStates === 'object') {
              var validPanels = ['transport', 'view', 'mode', 'tools', 'board', 'rules', 'stats', 'importExport'];
              var ps = {};
              var allValid = true;
              for (var vi = 0; vi < validPanels.length; vi++) {
                var pid = validPanels[vi];
                if (parsed.panelStates[pid] && typeof parsed.panelStates[pid] === 'object') {
                  ps[pid] = {
                    open: typeof parsed.panelStates[pid].open === 'boolean' ? parsed.panelStates[pid].open : true,
                    x: typeof parsed.panelStates[pid].x === 'number' ? parsed.panelStates[pid].x : -1,
                    y: typeof parsed.panelStates[pid].y === 'number' ? parsed.panelStates[pid].y : -1,
                    collapsed: typeof parsed.panelStates[pid].collapsed === 'boolean' ? parsed.panelStates[pid].collapsed : false
                  };
                } else {
                  allValid = false;
                  break;
                }
              }
              if (allValid) {
                savedLayout.panelStates = ps;
              }
            }
          }
        }
      } catch (e) {
        // Corrupted localStorage — silently ignore, use defaults.
        try {
          localStorage.removeItem('life-layout-prefs');
        } catch (e2) {}
      }
      var initRegionMask = RegionUtil.buildRect(cols, rows);
      var initRegionComponents = [{
        cells: initRegionMask,
        minR: 0,
        maxR: rows - 1,
        minC: 0,
        maxC: cols - 1
      }];
      return {
        running: true,
        cellSize: cellSize,
        cols: cols,
        rows: rows,
        viewX: initViewX,
        viewY: initViewY,
        sparseness: 2,
        liveCells: SimEngine.buildLiveCells(cols, rows, 2),
        generations: 0,
        livePaintMode: false,
        speed: 5,
        gridLines: true,
        boundary: 'toroidal',
        regionMask: initRegionMask,
        regionComponents: initRegionComponents,
        regionBounds: {
          minR: 0,
          maxR: rows - 1,
          minC: 0,
          maxC: cols - 1
        },
        birthRule: [3],
        surviveRule: [2, 3],
        ruleString: 'B3/S23',
        rulePreset: 'B3/S23',
        selectedPattern: null,
        patternRotation: 0,
        pendingCols: cols,
        pendingRows: rows,
        popHistory: [],
        sessionPeakPop: 0,
        stable: false,
        showHelp: false,
        showRle: false,
        rleInput: '',
        rleError: '',
        patternFilter: '',
        hoverCell: null,
        theme: 'Teal',
        drawMode: 'paint',
        selectTool: 'rect',
        drawTool: 'cell',
        regionTool: 'shape-rect',
        selection: null,
        clipboard: null,
        showMinimap: !isMobileInit,
        recording: false,
        showMobileTools: false,
        showTrails: true,
        darkModePref: function () {
          try {
            return localStorage.getItem('life-dark-mode-pref') || 'system';
          } catch (e) {
            return 'system';
          }
        }(),
        stepCount: 1,
        shareTooltip: false,
        showPopGraph: false,
        analysisResult: null,
        analyzing: false,
        // ── Layout mode state ───────────────────────────
        layoutMode: savedLayout.layoutMode || 'cartographer',
        // Cartographer state
        railCollapsed: savedLayout.railCollapsed || false,
        railHidden: false,
        railTab: savedLayout.railTab || 'simulate',
        railSide: savedLayout.railSide || 'right',
        // Observatory state
        zenMode: false,
        panelMenuOpen: false,
        panelStates: savedLayout.panelStates || {
          transport: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          view: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          mode: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          tools: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          board: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          rules: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          stats: {
            open: true,
            x: -1,
            y: -1,
            collapsed: false
          },
          importExport: {
            open: false,
            x: -1,
            y: -1,
            collapsed: false
          }
        },
        // Responsive device class
        deviceClass: 'desktop',
        // Bottom sheet (phone modes)
        bottomSheetOpen: false,
        bottomSheetClosing: false,
        bottomSheetTab: 'simulate',
        panMode: false,
        srAnnouncement: '',
        autoPauseOnStable: true
      };
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      // Skip render when only canvas-only state changed during animation.
      // These keys are updated every tick but only affect the imperative
      // canvas — the React DOM tree doesn't depend on them.
      if (this.state.running && nextState.running) {
        var dominated_only = true;
        for (var k in nextState) {
          if (nextState.hasOwnProperty(k) && k !== 'popHistory' && k !== 'srAnnouncement' && k !== 'liveCells' && this.state[k] !== nextState[k]) {
            dominated_only = false;
            break;
          }
        }
        if (dominated_only) return false;
      }
      return true;
    },
    componentDidMount: function () {
      this._mounted = true;
      // Instance properties previously in componentWillMount.
      this._genHistory = [];
      this._genHistoryMax = 200;
      this._genHistoryInterval = 1;
      this._genHistoryCounter = 0;
      this._trailMap = new Map();
      this._trailEnabled = true;
      // Input state is managed by InputHandler module
      this._loopRunning = false;
      this._tickId = 0;
      this._undoStack = [];
      this._redoStack = [];
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._genTimestamps = [];
      this._measuredGps = 0;
      InputHandler.reset();
      SimRunner.invalidate();
      this._gif = null;
      this._minimapDirty = true;
      // _minimapDragging managed by InputHandler
      this._minimapCanvas = document.createElement('canvas');
      this._mobileMinimap = null;
      this._mmElemDragging = false;
      this._minimapCanvas.width = 100;
      this._minimapCanvas.height = 75;
      // _pinchStart, _wasPinching, _longPressTimer managed by InputHandler
      this._statsChipHidden = false;
      this._statsChipTimer = null;
      this._minimapHidden = false;
      this._minimapTimer = null;
      // _canvas is set via React ref callback in renderCanvas
      // Attach wheel listener as non-passive so preventDefault works.
      this._canvas.addEventListener('wheel', this.onWheel, {
        passive: false
      });
      document.addEventListener('keydown', this.handleKeyDown);
      // Drag-and-drop file import (desktop).
      var canvasContainer = this._canvas.parentNode;
      this._onDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.add('drop-active');
      };
      this._onDragLeave = function (e) {
        e.preventDefault();
        e.stopPropagation();
        canvasContainer.classList.remove('drop-active');
      };
      this._onDrop = this._handleFileDrop.bind(this);
      canvasContainer.addEventListener('dragover', this._onDragOver);
      canvasContainer.addEventListener('dragleave', this._onDragLeave);
      canvasContainer.addEventListener('drop', this._onDrop);
      // Dark mode: respect system preference.
      this._darkModeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      if (this._darkModeQuery) {
        var self2 = this;
        this._onDarkModeChange = function (e) {
          if (self2.state.darkModePref === 'system') {
            self2._applyDarkMode(e.matches);
          }
        };
        try {
          this._darkModeQuery.addEventListener('change', this._onDarkModeChange);
        } catch (ex) {
          try {
            this._darkModeQuery.addListener(this._onDarkModeChange);
          } catch (ex2) {}
        }
        // Apply initial dark mode state.
        if (this.state.darkModePref === 'system') {
          this._applyDarkMode(this._darkModeQuery.matches);
        }
      }
      // Respond to viewport resize (throttled) to update canvas dimensions.
      var self = this;
      // Cache initial dimensions to filter out browser-chrome-only height changes on mobile.
      this._lastResizeW = window.innerWidth;
      this._lastResizeH = window.innerHeight;
      this._onResize = function () {
        var newW = window.innerWidth;
        var newH = window.innerHeight;
        var widthChanged = Math.abs(newW - self._lastResizeW) > 10;
        var heightBigChange = Math.abs(newH - self._lastResizeH) > 100;
        // Ignore height-only changes < 100px (mobile browser chrome show/hide on scroll).
        if (!widthChanged && !heightBigChange) {
          return;
        }
        self._lastResizeW = newW;
        self._lastResizeH = newH;
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self.forceUpdate(function () {
            self.drawBoard();
          });
        }, 120);
      };
      window.addEventListener('resize', this._onResize);
      // orientationchange fires before dimensions settle on iOS; use a longer debounce.
      this._onOrientationChange = function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self.forceUpdate(function () {
            self.drawBoard();
          });
        }, 300);
      };
      window.addEventListener('orientationchange', this._onOrientationChange);
      // ── Device class detection via matchMedia ──────────────────
      var self3 = this;
      this._mqPhone = window.matchMedia('(max-width: 620px)');
      this._mqPhoneLandscape = window.matchMedia('(orientation: landscape) and (max-height: 550px)');
      this._mqTablet = window.matchMedia('(min-width: 621px) and (max-width: 900px)');
      this._mqLandscape = window.matchMedia('(orientation: landscape)');
      this._updateDeviceClass = function () {
        var dc;
        if (self3._mqPhone.matches) {
          dc = self3._mqLandscape.matches ? 'phone-landscape' : 'phone-portrait';
        } else if (self3._mqPhoneLandscape.matches) {
          dc = 'phone-landscape';
        } else if (self3._mqTablet.matches) {
          dc = 'tablet';
        } else {
          dc = 'desktop';
        }
        if (dc !== self3.state.deviceClass) {
          self3.setState({
            deviceClass: dc
          }, function () {
            self3.drawBoard();
          });
        }
      };
      this._updateDeviceClass();
      try {
        this._mqPhone.addEventListener('change', this._updateDeviceClass);
        this._mqPhoneLandscape.addEventListener('change', this._updateDeviceClass);
        this._mqTablet.addEventListener('change', this._updateDeviceClass);
        this._mqLandscape.addEventListener('change', this._updateDeviceClass);
      } catch (ex) {
        try {
          this._mqPhone.addListener(this._updateDeviceClass);
          this._mqPhoneLandscape.addListener(this._updateDeviceClass);
          this._mqTablet.addListener(this._updateDeviceClass);
          this._mqLandscape.addListener(this._updateDeviceClass);
        } catch (ex2) {}
      }

      // ── Keyboard shortcut registry ──────────────────────────────
      this._shortcuts = {};
      this._registerCoreShortcuts();

      // Initialize HashLife engine with current rules.
      HashLife.init(this.state.birthRule, this.state.surviveRule);
      SimRunner._hlRuleKey = this.state.birthRule.join(',') + '/' + this.state.surviveRule.join(',');
      this.drawBoard();
      this._loadFromURLHash();
      this._startLoop();
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.selectedPattern !== this.state.selectedPattern || prevState.patternRotation !== this.state.patternRotation || prevState.bottomSheetOpen !== this.state.bottomSheetOpen || prevState.bottomSheetTab !== this.state.bottomSheetTab || prevState.layoutMode !== this.state.layoutMode) {
        this.drawRotationPreview();
      }
    },
    // Compute canvas pixel dimensions that fit the device viewport.
    getCanvasSize: function () {
      var cellSize = this.state.cellSize;
      var pendingCols = this.state.pendingCols;
      var pendingRows = this.state.pendingRows;
      // Use stable viewport dimensions from resize handler to prevent
      // minor iOS address-bar fluctuations from resizing the canvas.
      var winW = this._lastResizeW || window.innerWidth;
      var winH = this._lastResizeH || window.innerHeight;
      // Memoization: return cached result if inputs haven't changed.
      var cacheKey = cellSize + ',' + pendingCols + ',' + pendingRows + ',' + this.state.deviceClass + ',' + this.state.layoutMode + ',' + this.state.boundary + ',' + this.state.bottomSheetOpen + ',' + winW + ',' + winH;
      if (this._canvasSizeCacheKey === cacheKey && this._canvasSizeCache) {
        return this._canvasSizeCache;
      }
      var dc = this.state.deviceClass;
      var layout = this.state.layoutMode;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      var maxW, maxH;

      // All layouts: canvas fills full viewport
      maxW = winW;
      maxH = winH;

      // Infinite canvas: always fill the available space regardless of boundary mode.
      var w = maxW,
        h = maxH;
      var result = {
        w: w,
        h: h,
        displayW: w,
        displayH: h
      };
      this._canvasSizeCacheKey = cacheKey;
      this._canvasSizeCache = result;
      return result;
    },
    componentWillUnmount: function () {
      if (!this._canvas) {
        return;
      }
      this._canvas.removeEventListener('wheel', this.onWheel);
      document.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onOrientationChange);
      var container = this._canvas.parentNode;
      if (container) {
        container.removeEventListener('dragover', this._onDragOver);
        container.removeEventListener('dragleave', this._onDragLeave);
        container.removeEventListener('drop', this._onDrop);
      }
      if (this._gif) {
        this._gif.abort();
        this._gif = null;
      }
      // Remove media query listeners.
      if (this._darkModeQuery && this._onDarkModeChange) {
        try {
          this._darkModeQuery.removeEventListener('change', this._onDarkModeChange);
        } catch (ex) {
          try {
            this._darkModeQuery.removeListener(this._onDarkModeChange);
          } catch (ex2) {}
        }
      }
      if (this._updateDeviceClass) {
        var mqList = [this._mqPhone, this._mqPhoneLandscape, this._mqTablet, this._mqLandscape];
        for (var mi = 0; mi < mqList.length; mi++) {
          if (mqList[mi]) {
            try {
              mqList[mi].removeEventListener('change', this._updateDeviceClass);
            } catch (ex) {
              try {
                mqList[mi].removeListener(this._updateDeviceClass);
              } catch (ex2) {}
            }
          }
        }
      }
      // Cancel pending animation frame and timeout.
      this._mounted = false;
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._loopTimeout) {
        clearTimeout(this._loopTimeout);
        this._loopTimeout = null;
      }
      InputHandler.reset();
      // Release large objects.
      this._minimapCanvas = null;
      SimRunner._hlRoot = null;
      this._genHistory = [];
      this._trailMap = null;
      InputHandler._paintedCells = {};
      this._sheetEl = null;
    },
    // ── Drag-and-drop file import ──────────────────────────────────────

    _handleFileDrop: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var container = this._canvas.parentNode;
      container.classList.remove('drop-active');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || files.length === 0) {
        return;
      }
      var file = files[0];
      if (file.size > 500000) {
        this.setState({
          rleError: 'File too large (max 500 KB).'
        });
        return;
      }
      // Basic file type validation.
      var fileName = file.name || '';
      var ext = fileName.split('.').pop().toLowerCase();
      var allowedExts = ['rle', 'cells', 'lif', 'life', 'txt', 'mc', 'l'];
      if (file.type && file.type !== 'text/plain' && file.type !== 'application/octet-stream' && allowedExts.indexOf(ext) === -1) {
        this.setState({
          rleError: 'Unsupported file type. Use .rle, .cells, or .lif files.'
        });
        return;
      }
      var self = this;
      var reader = new FileReader();
      reader.onerror = function () {
        self.setState({
          rleError: 'Unable to read file.'
        });
      };
      reader.onload = function (ev) {
        var text = ev.target.result;
        // Strip non-printable control characters (keep tabs, newlines, CR).
        text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
        try {
          var result = detectAndParsePattern(text);
          if (result.cells.length === 0) {
            self.setState({
              rleError: 'No live cells found in file.'
            });
            return;
          }
          PATTERNS['Custom'] = result.cells;
          self._previewPos = null;
          self.setState({
            selectedPattern: 'Custom',
            patternRotation: 0,
            drawMode: 'preset',
            showRle: false,
            rleError: result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
          }, function () {
            self.drawBoard();
            self._announce('Pattern imported. Click on the canvas to place it.');
          });
        } catch (ex) {
          self.setState({
            rleError: 'Could not parse file: ' + (ex.message || 'unknown error')
          });
        }
      };
      reader.readAsText(file);
    },
    // ── Dark mode ──────────────────────────────────────────────────────

    _applyDarkMode: function (dark) {
      document.documentElement.classList.toggle('dark-mode', !!dark);
    },
    setDarkModePref: function (e) {
      var pref = e.target.value;
      var dark;
      if (pref === 'dark') {
        dark = true;
      } else if (pref === 'light') {
        dark = false;
      } else {
        dark = this._darkModeQuery && this._darkModeQuery.matches;
      }
      this._applyDarkMode(dark);
      this.setState({
        darkModePref: pref
      });
      try {
        localStorage.setItem('life-dark-mode-pref', pref);
      } catch (ex) {}
    },
    // ── Board construction ─────────────────────────────────────────────

    // ── Rendering ─────────────────────────────────────────────────────

    drawBoard: function () {
      var canvas = this._canvas;
      if (!canvas) {
        return;
      }
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      var cellSize = this.state.cellSize;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var viewX = this.state.viewX;
      var viewY = this.state.viewY;
      var canvasW = canvas.width;
      var canvasH = canvas.height;
      var theme = THEMES[this.state.theme] || THEMES['Teal'];
      var liveCells = this.state.liveCells;
      var isUnbounded = this.state.boundary === 'unbounded';

      // Visible cell range.
      var startC = viewX,
        startR = viewY;
      var endC = viewX + Math.ceil(canvasW / cellSize) + 1;
      var endR = viewY + Math.ceil(canvasH / cellSize) + 1;

      // Clear canvas.
      // In bounded mode, pre-darken the entire canvas so that out-of-region
      // areas are uniformly dimmed with no edge gaps.  Region cells are then
      // restored to the clean bg before cells/trails/grid are drawn.
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvasW, canvasH);
      if (!isUnbounded && this.state.regionMask && this.state.regionMask.size > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, canvasW, canvasH);
        // Restore clean bg for in-region cells.
        CanvasRenderer.clearRegionCells(ctx, this.state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, theme.bg);
      }

      // Palette.
      var palettes = CanvasRenderer._ensurePalette(theme, this.state.theme);

      // Cells.
      CanvasRenderer.drawCells(ctx, liveCells, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.color);

      // Trails.
      if (this._trailEnabled && this._trailMap.size > 0) {
        CanvasRenderer.drawTrails(ctx, this._trailMap, startR, startC, endR, endC, viewX, viewY, cellSize, palettes.trail);
      }

      // Grid.
      if (this.state.gridLines) {
        CanvasRenderer.drawGrid(ctx, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme.grid);
      }

      // Region overlay (replaces single bounding box).
      if (!isUnbounded) {
        CanvasRenderer.drawRegionOverlay(ctx, this.state.regionMask, startR, startC, endR, endC, viewX, viewY, cellSize, canvasW, canvasH, theme, this.state.boundary);
      }

      // Selection.
      CanvasRenderer.drawSelection(ctx, this.state.selection, viewX, viewY, cellSize, theme);

      // Tool preview (paint mode).
      CanvasRenderer.drawToolPreview(ctx, InputHandler._drawPreviewCells, InputHandler._drawErasing, viewX, viewY, cellSize, theme);

      // Region tool preview.
      if (this.state.drawMode === 'region') {
        // Show rubber-band shape preview.
        if (InputHandler._regionPreviewKeys.length > 0) {
          CanvasRenderer.drawRegionPreview(ctx, InputHandler._regionPreviewKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
        }
        // Show cell-by-cell painting preview.
        if (InputHandler._regionDragging) {
          var rgPainted = InputHandler._regionPaintedKeys;
          var rgKeys = Object.keys(rgPainted);
          if (rgKeys.length > 0) {
            CanvasRenderer.drawRegionPreview(ctx, rgKeys, InputHandler._regionErasing, viewX, viewY, cellSize);
          }
        }
      }

      // Pattern preview.
      if (this.state.drawMode === 'preset') {
        CanvasRenderer.drawPatternPreview(ctx, this.state.selectedPattern, this.state.patternRotation, InputHandler._previewPos, viewX, viewY, cellSize, theme);
      }

      // Minimap overlay (bottom-right corner on large desktop; separate element elsewhere).
      var useMobileMinimap = this.state.deviceClass === 'phone-portrait' || this.state.deviceClass === 'phone-landscape' || this.state.deviceClass === 'tablet' || typeof window !== 'undefined' && window.innerWidth <= 1200;
      if (this.state.showMinimap && (isUnbounded || cols > 0 && rows > 0)) {
        if (useMobileMinimap) {
          this.drawMinimapMobile(liveCells, cols, rows, viewX, viewY, cellSize, theme);
          this._minimapRect = null;
        } else {
          // Compute scale from actual canvas element for accuracy.
          var mmDisplayScale = 1;
          if (canvas.style.width) {
            var cssW = parseFloat(canvas.style.width);
            if (cssW > 0 && canvasW > 0) {
              mmDisplayScale = cssW / canvasW;
            }
          }
          this.drawMinimap(ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, mmDisplayScale);
        }
      }

      // GIF recording: capture frame.
      if (this.state.recording && this._gif) {
        this._gif.addFrame(ctx, {
          copy: true,
          delay: SPEED_DELAYS[this.state.speed - 1] || 50
        });
      }
    },
    drawMinimap: function (ctx, canvasW, canvasH, liveCells, cols, rows, viewX, viewY, cellSize, theme, displayScale) {
      // Derive minimap world region.
      // For all modes on the infinite canvas, show the bounding box area
      // expanded to include any live cells outside and the current viewport.
      var isUnbounded = this.state.boundary === 'unbounded';
      var mmOriginR = 0,
        mmOriginC = 0;
      // regionBounds and regionComponents used instead of mmBBCols/mmBBRows
      if (isUnbounded) {
        var bb = SimEngine.getBoundingBox(liveCells);
        if (bb) {
          var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
          var newMinR = bb.minR - pad,
            newMinC = bb.minC - pad;
          var newMaxR = bb.maxR + pad,
            newMaxC = bb.maxC + pad;
          // Hysteresis: only expand, never shrink (prevents flashing).
          var prev = this._mmUnboundedRegion;
          if (prev) {
            newMinR = Math.min(prev.minR, newMinR);
            newMinC = Math.min(prev.minC, newMinC);
            newMaxR = Math.max(prev.maxR, newMaxR);
            newMaxC = Math.max(prev.maxC, newMaxC);
          }
          this._mmUnboundedRegion = {
            minR: newMinR,
            minC: newMinC,
            maxR: newMaxR,
            maxC: newMaxC
          };
          mmOriginR = newMinR;
          mmOriginC = newMinC;
          rows = newMaxR - newMinR + 1;
          cols = newMaxC - newMinC + 1;
        } else {
          mmOriginR = viewY - 50;
          mmOriginC = viewX - 50;
          rows = 100;
          cols = 100;
          this._mmUnboundedRegion = null;
        }
      } else {
        // Bounded modes: fixed world region = region bounds + live cells + static padding.
        // Does NOT expand to follow viewport — arrow indicators show off-screen viewport.
        var rb = this.state.regionBounds;
        var mmMinR = rb ? rb.minR : 0;
        var mmMinC = rb ? rb.minC : 0;
        var mmMaxR = rb ? rb.maxR + 1 : rows;
        var mmMaxC = rb ? rb.maxC + 1 : cols;
        var bbLive = SimEngine.getBoundingBox(liveCells);
        if (bbLive) {
          mmMinR = Math.min(mmMinR, bbLive.minR);
          mmMinC = Math.min(mmMinC, bbLive.minC);
          mmMaxR = Math.max(mmMaxR, bbLive.maxR + 1);
          mmMaxC = Math.max(mmMaxC, bbLive.maxC + 1);
        }
        var pad2 = Math.max(5, Math.round(Math.max(mmMaxR - mmMinR, mmMaxC - mmMinC) * 0.1));
        mmOriginR = mmMinR - pad2;
        mmOriginC = mmMinC - pad2;
        rows = mmMaxR - mmMinR + pad2 * 2;
        cols = mmMaxC - mmMinC + pad2 * 2;
      }
      // Target a fixed CSS display size of ~160px for the minimap.
      // The buffer size is inversely proportional to displayScale so the CSS display size stays constant.
      var TARGET_CSS_SIZE = 160;
      var ds = displayScale && displayScale > 0 ? displayScale : 1;
      var aspect = cols / rows;
      // Cap buffer dimensions so the minimap never exceeds 1/3 of the canvas.
      var maxMmW = Math.floor(canvasW / 3);
      var maxMmH = Math.floor(canvasH / 3);
      var mmW, mmH;
      if (aspect >= 1) {
        mmW = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmW);
        mmH = Math.min(Math.max(40, Math.round(mmW / aspect)), maxMmH);
      } else {
        mmH = Math.min(Math.max(40, Math.round(TARGET_CSS_SIZE / ds)), maxMmH);
        mmW = Math.min(Math.max(40, Math.round(mmH * aspect)), maxMmW);
      }
      // Resize the off-screen canvas if dimensions changed.
      if (this._minimapCanvas.width !== mmW || this._minimapCanvas.height !== mmH) {
        this._minimapCanvas.width = mmW;
        this._minimapCanvas.height = mmH;
        this._minimapDirty = true;
      }
      // Express the margin in CSS-space pixels by scaling by 1/ds,
      // so the visual gap from the canvas corner stays ~6px at all zoom levels.
      var marginBuf = Math.max(1, Math.round(6 / ds));
      // In Cartographer mode, offset minimap upward to clear the fixed transport strip.
      var isMobileView2 = this.state.deviceClass === 'phone-portrait' || this.state.deviceClass === 'phone-landscape';
      var transportPad = this.state.layoutMode === 'cartographer' && !isMobileView2 ? Math.round(60 / ds) : 0;
      var mmX = canvasW - mmW - marginBuf,
        mmY = canvasH - mmH - marginBuf - transportPad;

      // Redraw minimap off-screen canvas only when marked dirty.
      if (this._minimapDirty) {
        var mc = this._minimapCanvas;
        var mctx = mc.getContext('2d');
        mctx.clearRect(0, 0, mmW, mmH);
        // Background.
        mctx.fillStyle = 'rgba(10,14,26,0.85)';
        mctx.fillRect(0, 0, mmW, mmH);
        // Draw all live cells as 1-px dots.
        mctx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
        var _mmOC = mmOriginC,
          _mmOR = mmOriginR,
          _mmCols = cols,
          _mmRows = rows;
        liveCells.forEach(function (age, key) {
          var _rc = parseKey(key),
            kr = _rc[0] - _mmOR,
            kc = _rc[1] - _mmOC;
          if (kr >= 0 && kr < _mmRows && kc >= 0 && kc < _mmCols) {
            mctx.fillRect(Math.floor(kc / _mmCols * mmW), Math.floor(kr / _mmRows * mmH), 1, 1);
          }
        });
        // Region indicator on minimap (bounded modes only).
        if (!isUnbounded && this.state.regionMask) {
          var _regionMask = this.state.regionMask;
          mctx.fillStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.12)';
          _regionMask.forEach(function (key) {
            var _i = key.indexOf(',');
            var _rr = parseInt(key.substring(0, _i), 10) - _mmOR;
            var _cc = parseInt(key.substring(_i + 1), 10) - _mmOC;
            if (_rr >= 0 && _rr < _mmRows && _cc >= 0 && _cc < _mmCols) {
              mctx.fillRect(Math.floor(_cc / _mmCols * mmW), Math.floor(_rr / _mmRows * mmH), 1, 1);
            }
          });
          // Draw component bounding rects as dashed outlines.
          var _comps = this.state.regionComponents;
          if (_comps && _comps.length > 0) {
            mctx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
            mctx.lineWidth = 1;
            mctx.setLineDash([3, 2]);
            for (var _ci = 0; _ci < _comps.length; _ci++) {
              var _comp = _comps[_ci];
              var _cx = Math.round((_comp.minC - _mmOC) / _mmCols * mmW);
              var _cy = Math.round((_comp.minR - _mmOR) / _mmRows * mmH);
              var _cw = Math.round((_comp.maxC - _comp.minC + 1) / _mmCols * mmW);
              var _ch = Math.round((_comp.maxR - _comp.minR + 1) / _mmRows * mmH);
              mctx.strokeRect(_cx + 0.5, _cy + 0.5, _cw, _ch);
            }
            mctx.setLineDash([]);
          }
        }
        // Border.
        mctx.strokeStyle = 'rgba(255,255,255,0.2)';
        mctx.lineWidth = 1;
        mctx.strokeRect(0.5, 0.5, mmW - 1, mmH - 1);
        this._minimapDirty = false;
      }

      // Blit minimap to main canvas.
      ctx.drawImage(this._minimapCanvas, mmX, mmY);

      // Viewport rectangle.
      var visCols = Math.ceil(canvasW / cellSize);
      var visRows = Math.ceil(canvasH / cellSize);
      var vx1 = mmX + Math.round((viewX - mmOriginC) / cols * mmW);
      var vy1 = mmY + Math.round((viewY - mmOriginR) / rows * mmH);
      var vw = Math.max(2, Math.round(visCols / cols * mmW));
      var vh = Math.max(2, Math.round(visRows / rows * mmH));
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      var clampX = Math.max(vx1, mmX);
      var clampY = Math.max(vy1, mmY);
      var clampR = Math.min(vx1 + vw, mmX + mmW);
      var clampB = Math.min(vy1 + vh, mmY + mmH);
      if (clampR > clampX && clampB > clampY) {
        ctx.strokeRect(clampX + 0.5, clampY + 0.5, clampR - clampX, clampB - clampY);
      }

      // Off-screen viewport indicator arrow (when viewport is outside minimap world region).
      var vpCenterC = viewX + visCols / 2;
      var vpCenterR = viewY + visRows / 2;
      var vpOutside = vpCenterC < mmOriginC || vpCenterC > mmOriginC + cols || vpCenterR < mmOriginR || vpCenterR > mmOriginR + rows;
      if (vpOutside) {
        var mmCenterC = mmOriginC + cols / 2;
        var mmCenterR = mmOriginR + rows / 2;
        var arrowAngle = Math.atan2(vpCenterR - mmCenterR, vpCenterC - mmCenterC);
        // Position arrow on minimap border
        var arrowPx = mmX + mmW / 2 + Math.cos(arrowAngle) * (mmW / 2 - 8);
        var arrowPy = mmY + mmH / 2 + Math.sin(arrowAngle) * (mmH / 2 - 8);
        arrowPx = Math.max(mmX + 6, Math.min(mmX + mmW - 6, arrowPx));
        arrowPy = Math.max(mmY + 6, Math.min(mmY + mmH - 6, arrowPy));
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.translate(arrowPx, arrowPy);
        ctx.rotate(arrowAngle);
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Store minimap rect for click detection (include world origin/dims for coordinate mapping).
      this._minimapRect = {
        x: mmX,
        y: mmY,
        w: mmW,
        h: mmH,
        originC: mmOriginC,
        originR: mmOriginR,
        worldCols: cols,
        worldRows: rows
      };
    },
    drawRotationPreview: function () {
      var theme = THEMES[this.state.theme] || THEMES['Teal'];
      CanvasRenderer.drawRotationPreview(this._previewCanvas, this.state.selectedPattern, this.state.patternRotation, theme);
    },
    // ── Simulation step (delegated to SimRunner) ──────────────────────────
    // SimRunner encapsulates both HashLife and SimEngine backends (R04, R07).

    // ── Animation loop ─────────────────────────────────────────────────

    _startLoop: function () {
      if (this._loopRunning) {
        return;
      }
      this._loopRunning = true;
      var tickId = ++this._tickId;
      var self = this;
      this._rafId = requestAnimationFrame(function () {
        self.findNewStates(tickId);
      });
    },
    findNewStates: function (tickId) {
      if (!this._mounted) {
        this._loopRunning = false;
        return;
      }
      if (tickId !== this._tickId) {
        this._loopRunning = false;
        return;
      }
      if (this.state.running !== true) {
        this._loopRunning = false;
        return;
      }
      var liveCells = this.state.liveCells;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var birth = this.state.birthRule;
      var survive = this.state.surviveRule;
      var boundary = this.state.boundary;
      var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary, this.state.regionMask, this.state.regionComponents);
      this._applyNewStates(newLiveCells, tickId);
    },
    // Called by the worker response handler and the sync path.
    _applyNewStates: function (newLiveCells, tickId) {
      if (!this._mounted) {
        this._loopRunning = false;
        return;
      }
      if (tickId !== this._tickId) {
        this._loopRunning = false;
        return;
      }

      // While the user is mid-stroke in Live Paint mode, merge the
      // cells being painted so they aren't erased by the incoming
      // generation (which was computed from the pre-stroke snapshot).
      if (InputHandler._dragging && this.state.livePaintMode) {
        var painted = InputHandler._paintedCells;
        var paintKeys = Object.keys(painted);
        if (paintKeys.length > 0) {
          for (var pi = 0; pi < paintKeys.length; pi++) {
            var k = paintKeys[pi];
            if (painted[k] === 1) {
              newLiveCells.set(k, 1);
            } else {
              newLiveCells.delete(k);
            }
          }
          SimRunner.invalidate();
        }
      }

      // Cell trail tracking: record recently-dead cells.
      if (this._trailEnabled) {
        var trailMap = this._trailMap;
        var prevCells = this.state.liveCells;
        // Cells that were alive but are now dead → add to trail.
        prevCells.forEach(function (age, key) {
          if (!newLiveCells.has(key)) {
            trailMap.set(key, 20);
          }
        });
        // Single pass: decay values, collect expired/overwritten entries.
        var toDelete = [];
        trailMap.forEach(function (val, key) {
          if (newLiveCells.has(key) || val <= 1) {
            toDelete.push(key);
          } else {
            trailMap.set(key, val - 1);
          }
        });
        for (var ti = 0; ti < toDelete.length; ti++) {
          trailMap.delete(toDelete[ti]);
        }
        // Prune if over limit.
        if (trailMap.size > 50000) {
          trailMap.forEach(function (val, key) {
            if (val <= 5) {
              trailMap.delete(key);
            }
          });
          if (trailMap.size > 50000) {
            trailMap.clear();
          }
        }
      }

      // Generation history snapshot for step-backward.
      this._pushGenHistory();

      // Stability detection via O(n) order-independent hash (FNV-1a inspired).
      var _h1 = 0,
        _h2 = 0x811c9dc5,
        _h3 = 0,
        _hCount = 0;
      newLiveCells.forEach(function (age, key) {
        var _krc = parseKey(key),
          kr = _krc[0],
          kc = _krc[1];
        var paired = kr >= kc ? kr * kr + kr + kc : kc * kc + kr;
        _h1 = _h1 + paired | 0;
        _h2 = Math.imul(_h2 ^ paired, 16777619) | 0;
        _h3 = _h3 + Math.imul(paired, 2654435761) | 0;
        _hCount++;
      });
      var boardHash = _hCount + '|' + _h1 + '|' + _h2 + '|' + _h3;
      var isStable = boardHash === this._prevBoardHash;
      this._prevBoardHash = boardHash;
      this._stableCount = isStable ? this._stableCount + 1 : 0;
      var hitStable = this._stableCount >= 2 && this.state.autoPauseOnStable;
      var newPop = newLiveCells.size;
      var newHistory = this.state.popHistory;
      newHistory.push(newPop);
      if (newHistory.length > 20000) {
        newHistory = newHistory.slice(-10000);
      }
      var newSessionPeak = Math.max(this.state.sessionPeakPop || 0, newPop);
      // Store last measured GPS so it persists briefly after pausing.
      this._gpsDisplayUntil = this._gpsDisplayUntil || 0;

      // Gen/sec tracking.
      var now = Date.now();
      this._genTimestamps.push(now);
      if (this._genTimestamps.length > 20) {
        this._genTimestamps.shift();
      }
      if (this._genTimestamps.length >= 2) {
        var ts = this._genTimestamps;
        var dt = ts[ts.length - 1] - ts[0];
        if (dt > 0) {
          this._measuredGps = (ts.length - 1) / dt * 1000;
        }
      }
      // Keep GPS visible for 3 s after pausing.
      this._gpsDisplayUntil = now + 3000;
      this._minimapDirty = true;
      var self = this;
      var myTickId = tickId;
      this.setState(function (prev) {
        return {
          liveCells: newLiveCells,
          generations: prev.generations + 1,
          popHistory: newHistory,
          sessionPeakPop: newSessionPeak,
          stable: hitStable,
          running: hitStable ? false : prev.running
        };
      }, function () {
        if (!self._mounted) {
          return;
        }
        self.drawBoard();
        if (hitStable) {
          self._loopRunning = false;
          self._announce('Stable pattern detected \u2014 simulation paused');
          return;
        }
        var delay = SPEED_DELAYS[Math.max(0, Math.min(9, (self.state.speed || 1) - 1))] || 0;
        self._loopTimeout = setTimeout(function () {
          self._rafId = requestAnimationFrame(function () {
            self.findNewStates(myTickId);
          });
        }, delay);
      });
    },
    stepGame: function () {
      this.pushUndo();
      var liveCells = this.state.liveCells;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var birth = this.state.birthRule;
      var survive = this.state.surviveRule;
      var boundary = this.state.boundary;
      var newLiveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary, this.state.regionMask, this.state.regionComponents);
      var newPop = newLiveCells.size;
      var newHistory = this.state.popHistory;
      newHistory.push(newPop);
      if (newHistory.length > 20000) {
        newHistory = newHistory.slice(-10000);
      }
      var newSessionPeakStep = Math.max(this.state.sessionPeakPop || 0, newPop);
      this._minimapDirty = true;
      var self = this;
      this.setState({
        liveCells: newLiveCells,
        running: false,
        generations: this.state.generations + 1,
        popHistory: newHistory,
        sessionPeakPop: newSessionPeakStep,
        stable: false
      }, function () {
        self.drawBoard();
      });
    },
    // ── Undo ──────────────────────────────────────────────────────────

    pushUndo: function () {
      this._undoStack.push({
        liveCells: new Map(this.state.liveCells),
        generations: this.state.generations,
        regionMask: new Set(this.state.regionMask)
      });
      if (this._undoStack.length > MAX_UNDO_STACK) {
        this._undoStack.shift();
      }
      this._redoStack = [];
    },
    popUndo: function () {
      if (this._undoStack && this._undoStack.length > 0) {
        return this._undoStack.pop();
      }
      return null;
    },
    cancelDrawTool: function () {
      if (!InputHandler._drawToolStart) {
        return;
      }
      InputHandler._drawToolStart = null;
      InputHandler._drawPreviewCells = [];
      this.popUndo();
      this.drawBoard();
    },
    undo: function () {
      if (this._undoStack.length === 0) {
        this._announce('Nothing to undo');
        return;
      }
      // Save current state for redo before restoring.
      this._redoStack.push({
        liveCells: new Map(this.state.liveCells),
        generations: this.state.generations,
        regionMask: new Set(this.state.regionMask)
      });
      if (this._redoStack.length > MAX_UNDO_STACK) {
        this._redoStack.shift();
      }
      var entry = this._undoStack.pop();
      this._tickId++;
      this._loopRunning = false;
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._minimapDirty = true;
      var self = this;
      SimRunner.invalidate();
      var stateUpdate = {
        liveCells: entry.liveCells,
        generations: entry.generations,
        running: false,
        stable: false
      };
      if (entry.regionMask) {
        stateUpdate.regionMask = entry.regionMask;
      }
      this.setState(stateUpdate, function () {
        if (entry.regionMask) {
          self._recomputeRegion();
        } else {
          self.drawBoard();
        }
      });
    },
    redo: function () {
      if (this._redoStack.length === 0) {
        this._announce('Nothing to redo');
        return;
      }
      // Save current state for undo before applying redo.
      this._undoStack.push({
        liveCells: new Map(this.state.liveCells),
        generations: this.state.generations,
        regionMask: new Set(this.state.regionMask)
      });
      var entry = this._redoStack.pop();
      this._tickId++;
      this._loopRunning = false;
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._minimapDirty = true;
      var self = this;
      SimRunner.invalidate();
      var stateUpdate = {
        liveCells: entry.liveCells,
        generations: entry.generations,
        running: false,
        stable: false
      };
      if (entry.regionMask) {
        stateUpdate.regionMask = entry.regionMask;
      }
      this.setState(stateUpdate, function () {
        if (entry.regionMask) {
          self._recomputeRegion();
        } else {
          self.drawBoard();
        }
      });
    },
    // ── Export ─────────────────────────────────────────────────────────

    exportPNG: function () {
      var link = document.createElement('a');
      link.download = 'game-of-life-gen-' + this.state.generations + '.png';
      link.href = this._canvas.toDataURL('image/png');
      link.click();
    },
    // ── RLE export ────────────────────────────────────────────────────

    copyRLE: function () {
      var rle = SimEngine.boardToRLE(this.state.liveCells, this.state.ruleString);
      if (!rle) {
        return;
      }
      var self = this;
      var self2 = this;
      this.setState({
        showRle: true,
        rleInput: rle,
        rleError: ''
      }, function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(rle).then(function () {
            self2._announce('RLE copied to clipboard');
          }).catch(function () {
            self2._announce('Could not copy to clipboard. Select and copy manually.');
          });
        }
      });
    },
    // ── URL sharing ──────────────────────────────────────────────────

    shareURL: function () {
      var rle = SimEngine.boardToRLE(this.state.liveCells, this.state.ruleString);
      if (!rle) {
        return;
      }
      // Build URL hash with compact parameters.
      var params = 'rle=' + encodeURIComponent(rle) + '&cols=' + (this.state.boundary === 'unbounded' ? 200 : this.state.cols) + '&rows=' + (this.state.boundary === 'unbounded' ? 200 : this.state.rows);
      if (this.state.ruleString !== 'B3/S23') {
        params += '&rule=' + encodeURIComponent(this.state.ruleString);
      }
      // Check total length — use compression for large patterns if available.
      if (params.length > 4000) {
        // Too large for URL; fall back to copying RLE.
        this._announce('Pattern too large for URL sharing, copied RLE instead.');
        this.copyRLE();
        return;
      }
      var url = window.location.origin + window.location.pathname + '#' + params;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
      // Brief visual feedback.
      var self = this;
      this.setState({
        shareTooltip: true
      });
      setTimeout(function () {
        self.setState({
          shareTooltip: false
        });
      }, 2000);
    },
    _loadFromURLHash: function () {
      var hash = window.location.hash;
      if (!hash || hash.length < 5) {
        return;
      }
      try {
        var params = {};
        hash.substring(1).split('&').forEach(function (pair) {
          var eq = pair.indexOf('=');
          if (eq > 0) {
            params[decodeURIComponent(pair.substring(0, eq))] = decodeURIComponent(pair.substring(eq + 1));
          }
        });
        if (!params.rle) {
          return;
        }
        var cols = Math.min(10000, Math.max(1, parseInt(params.cols, 10) || 100));
        var rows = Math.min(10000, Math.max(1, parseInt(params.rows, 10) || 100));
        var rule = params.rule || 'B3/S23';
        var parsed = this.parseRuleString(rule);
        var result = SimEngine.parseRLE(params.rle);
        if (result.cells.length === 0) {
          return;
        }
        PATTERNS['Custom'] = result.cells;
        var self = this;
        var updates = {
          cols: cols,
          rows: rows,
          pendingCols: cols,
          pendingRows: rows,
          selectedPattern: 'Custom',
          patternRotation: 0,
          drawMode: 'preset',
          ruleString: rule
        };
        if (parsed) {
          updates.birthRule = parsed.birth;
          updates.surviveRule = parsed.survive;
          updates.rulePreset = rule.toUpperCase();
          SimRunner.invalidate();
        }
        this.setState(updates, function () {
          self.drawBoard();
          self._announce('Pattern loaded from URL. Click on the canvas to place it.');
        });
        // Clear hash so reloads don't re-import.
        try {
          if (history.replaceState) {
            history.replaceState(null, '', window.location.pathname);
          }
        } catch (ex2) {}
      } catch (ex) {}
    },
    // ── Help modal ─────────────────────────────────────────────────────

    toggleHelp: function () {
      var opening = !this.state.showHelp;
      if (opening) {
        this._saveFocus();
      }
      var self = this;
      this.setState({
        showHelp: opening
      }, function () {
        if (opening) {
          self._focusFirst('.help-modal');
        } else {
          self._restoreFocus();
        }
      });
    },
    // ── Mouse / painting (delegated to InputHandler) ───────────────────

    getMousePos: function (event) {
      return InputHandler.getMousePos(event, this._canvas);
    },
    paintCellDirect: function (c, r) {
      InputHandler.paintCellDirect(c, r, this);
    },
    getCellPos: function (event) {
      return InputHandler.getCellPos(event, this._canvas, this.state.viewX, this.state.viewY, this.state.cellSize);
    },
    clampView: function (viewX, viewY, cols, rows, cellSize) {
      return {
        viewX: Math.round(viewX),
        viewY: Math.round(viewY)
      };
    },
    onMouseDown: function (event) {
      InputHandler.onMouseDown(event, this);
    },
    onMouseMove: function (event) {
      InputHandler.onMouseMove(event, this);
    },
    onMouseUp: function () {
      InputHandler.onMouseUp(null, this);
    },
    _startPanMomentum: function (vx, vy) {
      InputHandler._startPanMomentum(vx, vy, this);
    },
    onMouseLeave: function () {
      InputHandler.onMouseLeave(null, this);
    },
    onContextMenu: function (event) {
      InputHandler.onContextMenu(event, this);
    },
    // ── Zoom and pan ──────────────────────────────────────────────────

    onWheel: function (event) {
      InputHandler.onWheel(event, this);
    },
    pan: function (dc, dr) {
      var clamped = this.clampView(this.state.viewX + dc, this.state.viewY + dr, this.state.cols, this.state.rows, this.state.cellSize);
      var self = this;
      this.setState({
        viewX: clamped.viewX,
        viewY: clamped.viewY
      }, function () {
        self.drawBoard();
      });
    },
    // ── Selection/draw helpers (delegated to InputHandler) ─────────────

    getSelectionCells: function (sel) {
      return InputHandler.getSelectionCells(sel);
    },
    pointInPolygon: function (px, py, polygon) {
      return InputHandler.pointInPolygon(px, py, polygon);
    },
    bresenhamLine: function (r0, c0, r1, c1) {
      return InputHandler.bresenhamLine(r0, c0, r1, c1);
    },
    floodFillCells: function (startC, startR, liveCells, cols, rows, startAlive) {
      return InputHandler.floodFillCells(startC, startR, liveCells, cols, rows, this.state.boundary, startAlive, this.state.regionMask);
    },
    ellipseCells: function (c1, r1, c2, r2) {
      return InputHandler.ellipseCells(c1, r1, c2, r2);
    },
    selectAllVisible: function () {
      var liveCells = this.state.liveCells;
      var viewX = this.state.viewX,
        viewY = this.state.viewY;
      var cs = this.getCanvasSize();
      var viewCols = Math.ceil(cs.w / this.state.cellSize);
      var viewRows = Math.ceil(cs.h / this.state.cellSize);
      var cells = [];
      var minR = Infinity,
        maxR = -Infinity,
        minC = Infinity,
        maxC = -Infinity;
      liveCells.forEach(function (_, key) {
        var rc = parseKey(key);
        var r = rc[0],
          c = rc[1];
        if (c >= viewX && c < viewX + viewCols && r >= viewY && r < viewY + viewRows) {
          cells.push([r, c]);
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      });
      if (cells.length === 0) {
        return;
      }
      var self = this;
      this.setState({
        selection: {
          type: 'all-visible',
          cells: cells,
          c1: minC,
          r1: minR,
          c2: maxC,
          r2: maxR
        },
        drawMode: 'select'
      }, function () {
        self.drawBoard();
      });
    },
    fitView: function () {
      if (!this._canvas) {
        return;
      }
      // In unbounded mode, "Fit Grid" behaves like "Fit Cells".
      if (this.state.boundary === 'unbounded') {
        this.fitLiveCells();
        return;
      }
      // Use regionBounds to determine the area to fit.
      var rb = this.state.regionBounds;
      var originC = rb ? rb.minC : 0;
      var originR = rb ? rb.minR : 0;
      var cols = rb ? rb.maxC - rb.minC + 1 : this.state.cols;
      var rows = rb ? rb.maxR - rb.minR + 1 : this.state.rows;
      if (cols <= 0 || rows <= 0) {
        return;
      }
      var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
      var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
      var contentPad = isMobile ? 24 : 40;
      var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;
      var isMobileToolsOpen = typeof window !== 'undefined' && window.innerWidth <= 620 && this.state.bottomSheetOpen;
      var hFrac = isMobile ? isMobileToolsOpen ? 0.36 : 0.82 : 0.90;
      var effW = typeof window !== 'undefined' ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
      var effH = typeof window !== 'undefined' ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
      // Apply the same aspect-ratio constraint as getCanvasSize.
      var fitAspect = cols / rows;
      if (effW / effH > fitAspect) {
        effW = Math.max(1, Math.round(effH * fitAspect));
      } else if (effH / effW > 1 / fitAspect) {
        effH = Math.max(1, Math.round(effW / fitAspect));
      }
      // Add padding around bounding box so its border is visible on the infinite canvas.
      var padCols = Math.max(2, Math.round(cols * 0.05));
      var padRows = Math.max(2, Math.round(rows * 0.05));
      var totalCols = cols + padCols * 2;
      var totalRows = rows + padRows * 2;
      // Largest integer cellSize where the padded area fits in the canvas.
      var newCS = Math.max(1, Math.floor(Math.min(effW / totalCols, effH / totalRows)));
      var self = this;
      this.setState({
        cellSize: newCS,
        viewX: originC - padCols,
        viewY: originR - padRows
      }, function () {
        self.drawBoard();
      });
    },
    fitLiveCells: function () {
      if (!this._canvas) {
        return;
      }
      var liveCells = this.state.liveCells;
      if (liveCells.size === 0) {
        this.fitView();
        return;
      }
      var minR = Infinity,
        maxR = -Infinity,
        minC = Infinity,
        maxC = -Infinity;
      liveCells.forEach(function (_, key) {
        var rc = parseKey(key);
        var r = rc[0],
          c = rc[1];
        if (r < minR) {
          minR = r;
        }
        if (r > maxR) {
          maxR = r;
        }
        if (c < minC) {
          minC = c;
        }
        if (c > maxC) {
          maxC = c;
        }
      });
      var spanR = maxR - minR + 1,
        spanC = maxC - minC + 1;
      var padR = Math.max(2, Math.round(spanR * 0.1));
      var padC = Math.max(2, Math.round(spanC * 0.1));
      var totalR = spanR + padR * 2,
        totalC = spanC + padC * 2;
      var isMobile = typeof window !== 'undefined' && window.innerWidth <= 620;
      var isTablet = typeof window !== 'undefined' && window.innerWidth > 620 && window.innerWidth <= 900;
      var contentPad = isMobile ? 24 : 40;
      var sidebarW = isMobile ? 0 : (isTablet ? 178 : 200) + 14;
      var isMobileToolsOpen = typeof window !== 'undefined' && window.innerWidth <= 620 && this.state.bottomSheetOpen;
      var hFrac = isMobile ? isMobileToolsOpen ? 0.36 : 0.82 : 0.90;
      var effW = typeof window !== 'undefined' ? Math.max(1, Math.min(window.innerWidth, 1100) - contentPad - sidebarW) : 846;
      var effH = typeof window !== 'undefined' ? Math.min(Math.round(window.innerHeight * hFrac), 1400) : 900;
      var newCS = Math.max(1, Math.floor(Math.min(effW / totalC, effH / totalR)));
      var newVX = minC - padC;
      var newVY = minR - padR;
      var self = this;
      this.setState({
        cellSize: newCS,
        viewX: newVX,
        viewY: newVY
      }, function () {
        self.drawBoard();
      });
    },
    setZoom: function (e) {
      var newCS = parseInt(e.target.value, 10);
      if (isNaN(newCS) || newCS < 1) {
        return;
      }
      newCS = Math.max(1, Math.min(128, newCS));
      var clamped = this.clampView(this.state.viewX, this.state.viewY, this.state.cols, this.state.rows, newCS);
      var self = this;
      this.setState({
        cellSize: newCS,
        viewX: clamped.viewX,
        viewY: clamped.viewY
      }, function () {
        self.drawBoard();
      });
    },
    setTheme: function (e) {
      var self = this;
      this.setState({
        theme: e.target.value
      }, function () {
        self.drawBoard();
      });
    },
    // ── Selection ─────────────────────────────────────────────────────

    copySelection: function () {
      var sel = this.state.selection;
      if (!sel) {
        return;
      }
      var liveCells = this.state.liveCells;
      var selCells = this.getSelectionCells(sel);
      if (selCells.length === 0) {
        return;
      }
      var minR = Infinity,
        minC = Infinity;
      selCells.forEach(function (rc) {
        if (rc[0] < minR) minR = rc[0];
        if (rc[1] < minC) minC = rc[1];
      });
      var cells = [];
      selCells.forEach(function (rc) {
        if (liveCells.has(rc[0] + ',' + rc[1])) {
          cells.push([rc[0] - minR, rc[1] - minC]);
        }
      });
      this.setState({
        clipboard: cells
      });
    },
    pasteAsPattern: function () {
      if (!this.state.clipboard || this.state.clipboard.length === 0) {
        return;
      }
      PATTERNS['Clipboard'] = this.state.clipboard;
      InputHandler._previewPos = null;
      var self = this;
      this.setState({
        selectedPattern: 'Clipboard',
        patternRotation: 0,
        drawMode: 'preset',
        selection: null
      }, function () {
        self.drawBoard();
        self.drawRotationPreview();
      });
    },
    deleteSelection: function () {
      var sel = this.state.selection;
      if (!sel) {
        return;
      }
      this.pushUndo();
      this._stableCount = 0;
      this._prevBoardHash = null;
      // Snapshot selection cells before setState to avoid stale closure.
      var selCells = this.getSelectionCells(sel);
      this._minimapDirty = true;
      SimRunner.invalidate();
      var self = this;
      this.setState(function (prevState) {
        var newLiveCells = new Map(prevState.liveCells);
        selCells.forEach(function (rc) {
          newLiveCells.delete(rc[0] + ',' + rc[1]);
        });
        return {
          liveCells: newLiveCells,
          stable: false
        };
      }, function () {
        self.drawBoard();
      });
    },
    clearSelection: function () {
      var self = this;
      // Restore to preset or paint depending on whether a pattern is armed.
      var restoreMode = this.state.selectedPattern ? 'preset' : 'paint';
      this.setState({
        selection: null,
        drawMode: restoreMode
      }, function () {
        self.drawBoard();
      });
    },
    toggleSelectMode: function () {
      if (this.state.drawMode === 'select') {
        this.clearSelection();
      } else {
        var self = this;
        // Enter select mode without clearing the armed preset.
        this.setState({
          drawMode: 'select'
        }, function () {
          self.drawBoard();
        });
      }
    },
    toggleDrawMode: function () {
      var self = this;
      this.setState({
        drawMode: 'paint'
      }, function () {
        self.drawBoard();
      });
    },
    togglePresetMode: function () {
      var self = this;
      var newMode = this.state.drawMode === 'preset' ? 'paint' : 'preset';
      this.setState({
        drawMode: newMode
      }, function () {
        self.drawBoard();
      });
    },
    toggleMinimap: function () {
      var self = this;
      this.setState({
        showMinimap: !this.state.showMinimap
      }, function () {
        self.drawBoard();
      });
    },
    togglePanMode: function () {
      this.setState({
        panMode: !this.state.panMode
      });
    },
    toggleMobileTools: function () {
      this.toggleBottomSheet();
    },
    // ── GIF recording ─────────────────────────────────────────────────

    toggleRecording: function () {
      if (this.state.recording) {
        // Stop recording and render.
        if (this._gif) {
          this._gif.render();
        }
        this.setState({
          recording: false
        });
      } else {
        // Start recording (requires gif.js loaded).
        if (typeof GIF === 'undefined') {
          this._announce('gif.js is not loaded. Add it to index.html to enable GIF export.');
          return;
        }
        var delay = Math.max(20, SPEED_DELAYS[this.state.speed - 1] || 50);
        var self = this;
        this._gif = new GIF({
          workers: 2,
          quality: 10,
          workerScript: 'js/gif.worker.js'
        });
        this._gif.on('finished', function (blob) {
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'life-gen' + self.state.generations + '.gif';
          link.click();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 3000);
          self._gif = null;
        });
        this.setState({
          recording: true
        });
      }
    },
    // ── Touch support (delegated to InputHandler) ─────────────────────

    onTouchStart: function (event) {
      InputHandler.onTouchStart(event, this);
    },
    onTouchMove: function (event) {
      InputHandler.onTouchMove(event, this);
    },
    onTouchEnd: function (event) {
      InputHandler.onTouchEnd(event, this);
    },
    // ── Keyboard ──────────────────────────────────────────────────────

    handleKeyDown: function (e) {
      var tag = e.target.tagName;
      if (e.key !== 'Escape' && (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.target.isContentEditable)) {
        return;
      }
      var self = this;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.toggleGame();
          break;
        case '.':
          e.preventDefault();
          if (e.shiftKey) {
            this.stepN(this.state.stepCount);
          } else {
            this.stepGame();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (!this.state.running) {
            this.stepGame();
          }
          break;
        case ',':
          e.preventDefault();
          this.stepBack();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.resetGame();
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          this.emptyBoard();
          break;
        case 'z':
        case 'Z':
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            this.redo();
          } else if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.undo();
          } else if (this.state.layoutMode === 'observatory') {
            this.toggleZenMode();
          }
          break;
        case 'c':
        case 'C':
          if ((e.ctrlKey || e.metaKey) && this.state.selection) {
            e.preventDefault();
            this.copySelection();
          }
          break;
        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.redo();
          }
          break;
        case 'v':
        case 'V':
          if ((e.ctrlKey || e.metaKey) && this.state.clipboard) {
            e.preventDefault();
            this.pasteAsPattern();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (this.state.selection) {
            this.deleteSelection();
          }
          break;
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.exportPNG();
          }
          break;
        case 'x':
        case 'X':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.copyRLE();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.fitView();
          break;
        case '[':
          if (this.state.selectedPattern) {
            this.rotateCCW();
          }
          break;
        case ']':
          if (this.state.selectedPattern) {
            this.rotateCW();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.pan(-5, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.pan(5, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.pan(0, -5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.pan(0, 5);
          break;
        case 'Escape':
          if (InputHandler._drawToolStart) {
            this.cancelDrawTool();
            break;
          }
          if (this.state.selection) {
            this.clearSelection();
            break;
          }
          if (this.state.drawMode === 'preset' && this.state.selectedPattern) {
            InputHandler._previewPos = null;
            this.setState({
              selectedPattern: null,
              patternRotation: 0,
              drawMode: 'paint'
            }, function () {
              self.drawBoard();
            });
            break;
          }
          if (this.state.showPopGraph) {
            this.setState({
              showPopGraph: false
            });
            break;
          }
          if (this.state.showHelp) {
            this.setState({
              showHelp: false
            });
            break;
          }
          // Close layout elements
          if (this.state.bottomSheetOpen) {
            this.setState({
              bottomSheetOpen: false
            });
            break;
          }
          if (this.state.zenMode) {
            this.setState({
              zenMode: false
            });
            break;
          }
          break;
        case '?':
          this.toggleHelp();
          break;
        case 'm':
        case 'M':
          this.toggleMinimap();
          break;
      }
    },
    // ── Keyboard shortcut registry ────────────────────────────────

    _registerCoreShortcuts: function () {
      var self = this;
      // Register all existing shortcuts centrally.
      this._registerShortcut('d', 'Switch to Draw mode', function () {
        self.toggleDrawMode();
      });
      this._registerShortcut('p', 'Switch to Preset mode', function () {
        self.togglePresetMode();
      });
      this._registerShortcut('b', 'Switch to Region mode', function () {
        self.toggleRegionMode();
      });
      this._registerShortcut('g', 'Toggle grid lines', function () {
        self.toggleGridLines();
      });
      this._registerShortcut('t', 'Toggle trails', function () {
        self.toggleTrails();
      });
    },
    _registerShortcut: function (key, description, handler) {
      this._shortcuts[key.toLowerCase()] = {
        key: key,
        description: description,
        handler: handler
      };
    },
    _unregisterShortcut: function (key) {
      delete this._shortcuts[key.toLowerCase()];
    },
    // ── Layout mode management ───────────────────────────────────────

    _persistLayout: function () {
      try {
        localStorage.setItem('life-layout-prefs', JSON.stringify({
          _schemaVersion: 1,
          layoutMode: this.state.layoutMode,
          railCollapsed: this.state.railCollapsed,
          railTab: this.state.railTab,
          railSide: this.state.railSide,
          panelStates: this.state.panelStates
        }));
      } catch (e) {
        // localStorage full or unavailable — silently ignore.
      }
    },
    // ── Focus management ─────────────────────────────────────────

    _saveFocus: function () {
      this._prevFocusEl = document.activeElement;
    },
    _restoreFocus: function () {
      if (this._prevFocusEl && this._prevFocusEl.focus) {
        try {
          this._prevFocusEl.focus();
        } catch (e) {}
      }
      this._prevFocusEl = null;
    },
    _announce: function (msg) {
      this.setState({
        srAnnouncement: msg
      });
      var self = this;
      setTimeout(function () {
        if (self._mounted) self.setState({
          srAnnouncement: ''
        });
      }, 3000);
    },
    _focusFirst: function (containerSelector) {
      var self = this;
      setTimeout(function () {
        var el = document.querySelector(containerSelector);
        if (!el) {
          return;
        }
        var focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) {
          focusable.focus();
        }
      }, 50);
    },
    setLayoutMode: function (mode) {
      var self = this;
      this.setState({
        layoutMode: mode,
        zenMode: false
      }, function () {
        self._persistLayout();
        self.drawBoard();
      });
    },
    setRailTab: function (tab) {
      var self = this;
      var updates = {
        railTab: tab,
        railCollapsed: false
      };
      this.setState(updates, function () {
        self._persistLayout();
      });
    },
    toggleRailCollapsed: function () {
      var self = this;
      this.setState({
        railCollapsed: !this.state.railCollapsed
      }, function () {
        self._persistLayout();
        self.drawBoard();
      });
    },
    toggleRailHidden: function () {
      var self = this;
      this.setState({
        railHidden: !this.state.railHidden
      }, function () {
        self.drawBoard();
      });
    },
    toggleRailSide: function () {
      var self = this;
      var newSide = this.state.railSide === 'right' ? 'left' : 'right';
      this.setState({
        railSide: newSide
      }, function () {
        self._persistLayout();
        self.drawBoard();
      });
    },
    toggleZenMode: function () {
      var self = this;
      this.setState({
        zenMode: !this.state.zenMode
      }, function () {
        self.drawBoard();
      });
    },
    toggleBottomSheet: function () {
      var self = this;
      if (this.state.bottomSheetOpen) {
        // Closing: animate out, then unmount.
        this._previewCanvas = null;
        this.setState({
          bottomSheetClosing: true
        }, function () {
          setTimeout(function () {
            self.setState({
              bottomSheetOpen: false,
              bottomSheetClosing: false
            }, function () {
              self._restoreFocus();
              self.drawBoard();
            });
          }, 200);
        });
      } else {
        // Opening.
        this._saveFocus();
        this.setState({
          bottomSheetOpen: true,
          bottomSheetClosing: false
        }, function () {
          self._focusFirst('.bottom-sheet');
          self.drawRotationPreview();
        });
      }
    },
    setBottomSheetTab: function (tab) {
      this.setState({
        bottomSheetTab: tab,
        bottomSheetOpen: true
      });
    },
    // ── Bottom sheet swipe-to-dismiss ─────────────────────────────────

    _onSheetTouchStart: function (e) {
      this._sheetTouchY = e.touches[0].clientY;
      this._sheetEl = e.currentTarget;
    },
    _onSheetTouchMove: function (e) {
      if (this._sheetTouchY === null || this._sheetTouchY === undefined) {
        return;
      }
      var dy = e.touches[0].clientY - this._sheetTouchY;
      if (dy > 0) {
        e.preventDefault();
        this._sheetEl.style.transform = 'translateY(' + dy + 'px)';
      }
    },
    _onSheetTouchEnd: function () {
      if (this._sheetTouchY === null || this._sheetTouchY === undefined) {
        return;
      }
      var el = this._sheetEl;
      var transform = el.style.transform;
      var dy = 0;
      if (transform) {
        var match = transform.match(/translateY\((-?\d+)/);
        if (match) {
          dy = parseInt(match[1], 10);
        }
      }
      el.style.transform = '';
      if (dy > 60) {
        this.toggleBottomSheet();
      }
      this._sheetTouchY = null;
    },
    // ── Bottom sheet focus trap + keyboard ────────────────────────────

    _onSheetKeyDown: function (e) {
      if (e.key === 'Escape') {
        this.toggleBottomSheet();
        e.preventDefault();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      var sheet = e.currentTarget.querySelector('.bottom-sheet');
      if (!sheet) {
        return;
      }
      var focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) {
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    // ── Toggles ───────────────────────────────────────────────────────

    _hideStatsChip: function () {
      this._statsChipHidden = true;
      this._minimapHidden = true;
      clearTimeout(this._statsChipTimer);
      clearTimeout(this._minimapTimer);
    },
    _showStatsChipAfterDelay: function () {
      var self = this;
      clearTimeout(this._statsChipTimer);
      clearTimeout(this._minimapTimer);
      this._statsChipTimer = setTimeout(function () {
        self._statsChipHidden = false;
        self.forceUpdate();
      }, STATS_CHIP_REAPPEAR_DELAY);
      this._minimapTimer = setTimeout(function () {
        self._minimapHidden = false;
        self.forceUpdate();
      }, STATS_CHIP_REAPPEAR_DELAY);
    },
    toggleTrails: function () {
      var newVal = !this.state.showTrails;
      this._trailEnabled = newVal;
      if (!newVal) {
        this._trailMap = new Map();
      }
      var self = this;
      this.setState({
        showTrails: newVal
      }, function () {
        self.drawBoard();
      });
    },
    setStepCount: function (e) {
      this.setState({
        stepCount: Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 1))
      });
    },
    // Advance N generations at once via SimRunner.
    stepN: function (n) {
      if (!n || n < 1) {
        n = 1;
      }
      this.pushUndo();
      this._pushGenHistory();
      var liveCells = this.state.liveCells;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var birth = this.state.birthRule;
      var survive = this.state.surviveRule;
      var boundary = this.state.boundary;
      var self = this;
      var gen = this.state.generations;
      var popHistory = this.state.popHistory;
      var peak = this.state.sessionPeakPop || 0;

      // Fast path: unbounded — SimRunner handles HashLife batch internally
      if (boundary === 'unbounded') {
        var batch = SimRunner.stepN(liveCells, cols, rows, birth, survive, boundary, n, this.state.regionMask, this.state.regionComponents);
        for (var p = 0; p < batch.pops.length; p++) {
          popHistory.push(batch.pops[p]);
          if (popHistory.length > 20000) {
            popHistory = popHistory.slice(-10000);
          }
        }
        if (batch.peak > peak) {
          peak = batch.peak;
        }
        this._minimapDirty = true;
        this.setState({
          liveCells: batch.liveCells,
          generations: gen + n,
          running: false,
          popHistory: popHistory,
          sessionPeakPop: peak,
          stable: false
        }, function () {
          self.drawBoard();
        });
        return;
      }

      // Toroidal / finite: chunked for UI responsiveness
      var done = 0;
      var CHUNK = 50;
      var doChunk = function () {
        var limit = Math.min(done + CHUNK, n);
        var _regionMask = self.state.regionMask;
        var _regionComponents = self.state.regionComponents;
        for (var i = done; i < limit; i++) {
          liveCells = SimRunner.step(liveCells, cols, rows, birth, survive, boundary, _regionMask, _regionComponents);
          gen++;
          var pop = liveCells.size;
          popHistory.push(pop);
          if (popHistory.length > 20000) {
            popHistory = popHistory.slice(-10000);
          }
          if (pop > peak) {
            peak = pop;
          }
        }
        done = limit;
        if (done < n) {
          setTimeout(doChunk, 0);
        } else {
          self._minimapDirty = true;
          self.setState({
            liveCells: liveCells,
            generations: gen,
            running: false,
            popHistory: popHistory,
            sessionPeakPop: peak,
            stable: false
          }, function () {
            self.drawBoard();
          });
        }
      };
      doChunk();
    },
    // ── Generation history (step backward) ─────────────────────────────

    _pushGenHistory: function () {
      this._genHistoryCounter++;
      var pop = this.state.liveCells.size;
      var interval = pop > 50000 ? 10 : pop > 10000 ? 5 : this._genHistoryInterval;
      if (this._genHistoryCounter % interval !== 0) {
        return;
      }
      this._genHistory.push({
        liveCells: new Map(this.state.liveCells),
        generations: this.state.generations
      });
      if (this._genHistory.length > this._genHistoryMax) {
        this._genHistory.shift();
      }
    },
    stepBack: function () {
      if (this._genHistory.length === 0) {
        return;
      }
      var snapshot = this._genHistory.pop();
      this._minimapDirty = true;
      SimRunner.invalidate();
      var self = this;
      this.setState({
        liveCells: snapshot.liveCells,
        generations: snapshot.generations,
        running: false,
        stable: false
      }, function () {
        self.drawBoard();
      });
    },
    clearGenHistory: function () {
      this._genHistory = [];
      this._genHistoryCounter = 0;
    },
    toggleLivePaint: function () {
      this.setState({
        livePaintMode: !this.state.livePaintMode
      });
    },
    toggleGridLines: function () {
      var self = this;
      this.setState({
        gridLines: !this.state.gridLines
      }, function () {
        self.drawBoard();
      });
    },
    // ── Region mask helpers ────────────────────────────────────────

    /**
     * Recompute regionComponents and regionBounds from current regionMask,
     * kill any liveCells outside the mask, and update cols/rows/pendingCols/pendingRows.
     * Optionally accepts a callback.
     */
    _recomputeRegion: function (callback) {
      var mask = this.state.regionMask;
      var components = RegionUtil.findComponents(mask);
      var bounds = RegionUtil.getBounds(mask);
      CanvasRenderer.invalidateRegionCache();
      // Derive cols/rows from bounds for backward compat.
      var newCols = bounds ? bounds.maxC - bounds.minC + 1 : this.state.cols;
      var newRows = bounds ? bounds.maxR - bounds.minR + 1 : this.state.rows;
      // Kill live cells outside the region when in bounded mode.
      var clippedLiveCells = this.state.liveCells;
      if (this.state.boundary !== 'unbounded' && mask.size > 0) {
        var dirty = false;
        clippedLiveCells = new Map();
        var liveCells = this.state.liveCells;
        liveCells.forEach(function (age, key) {
          if (mask.has(key)) {
            clippedLiveCells.set(key, age);
          } else {
            dirty = true;
          }
        });
        if (!dirty) {
          clippedLiveCells = this.state.liveCells;
        }
      }
      this._minimapDirty = true;
      SimRunner.invalidate();
      var self = this;
      this.setState({
        regionComponents: components,
        regionBounds: bounds || {
          minR: 0,
          maxR: newRows - 1,
          minC: 0,
          maxC: newCols - 1
        },
        cols: newCols,
        rows: newRows,
        pendingCols: newCols,
        pendingRows: newRows,
        liveCells: clippedLiveCells,
        stable: false
      }, function () {
        self.drawBoard();
        if (callback) callback();
      });
    },
    /**
     * Apply region mask mutations (add/remove keys), then recompute.
     * addKeys: array of "r,c" strings to add.
     * removeKeys: array of "r,c" strings to remove.
     */
    _mutateRegion: function (addKeys, removeKeys, callback) {
      var newMask = new Set(this.state.regionMask);
      if (addKeys) {
        for (var ai = 0; ai < addKeys.length; ai++) {
          newMask.add(addKeys[ai]);
        }
      }
      if (removeKeys) {
        for (var ri = 0; ri < removeKeys.length; ri++) {
          newMask.delete(removeKeys[ri]);
        }
      }
      var self = this;
      this.setState({
        regionMask: newMask
      }, function () {
        self._recomputeRegion(callback);
      });
    },
    /**
     * Switch to region draw mode.
     */
    toggleRegionMode: function () {
      var self = this;
      var newMode = this.state.drawMode === 'region' ? 'paint' : 'region';
      this.setState({
        drawMode: newMode
      }, function () {
        self.drawBoard();
      });
    },
    toggleBoundary: function () {
      var cur = this.state.boundary;
      var next = cur === 'toroidal' ? 'finite' : cur === 'finite' ? 'unbounded' : 'toroidal';
      SimRunner.invalidate();
      this._minimapDirty = true;
      this._mmUnboundedRegion = null;
      CanvasRenderer.invalidateRegionCache();
      var self = this;
      var stateUpdate = {
        boundary: next
      };
      // Exit region mode when switching to unbounded.
      if (next === 'unbounded' && this.state.drawMode === 'region') {
        stateUpdate.drawMode = 'paint';
      }
      this.setState(stateUpdate, function () {
        self.drawBoard();
      });
    },
    toggleGame: function () {
      if (this.state.running) {
        this.setState({
          running: false
        });
        this._announce('Simulation paused');
      } else {
        this._prevBoardHash = null;
        this._stableCount = 0;
        this.setState({
          running: true,
          stable: false
        });
        this._startLoop();
        this._announce('Simulation started');
      }
    },
    // ── Sliders ───────────────────────────────────────────────────────

    resizeBoard: function (newCols, newRows) {
      newCols = Math.max(1, Math.round(newCols || 1));
      newRows = Math.max(1, Math.round(newRows || 1));
      // Replace region mask with a fresh rectangle of the new dimensions.
      var newRegionMask = RegionUtil.buildRect(newCols, newRows);
      var newRegionComponents = [{
        cells: newRegionMask,
        minR: 0,
        maxR: newRows - 1,
        minC: 0,
        maxC: newCols - 1
      }];
      // Keep only cells that still fall within the new bounds.
      var oldLiveCells = this.state.liveCells;
      var newLiveCells = new Map();
      oldLiveCells.forEach(function (age, key) {
        if (newRegionMask.has(key)) {
          newLiveCells.set(key, age);
        }
      });
      var clamped = this.clampView(this.state.viewX, this.state.viewY, newCols, newRows, this.state.cellSize);
      this._minimapDirty = true;
      SimRunner.invalidate();
      CanvasRenderer.invalidateRegionCache();
      var self = this;
      this.setState({
        cols: newCols,
        rows: newRows,
        pendingCols: newCols,
        pendingRows: newRows,
        liveCells: newLiveCells,
        viewX: clamped.viewX,
        viewY: clamped.viewY,
        selection: null,
        popHistory: [],
        sessionPeakPop: 0,
        regionMask: newRegionMask,
        regionComponents: newRegionComponents,
        regionBounds: {
          minR: 0,
          maxR: newRows - 1,
          minC: 0,
          maxC: newCols - 1
        }
      }, function () {
        self.drawBoard();
      });
    },
    setWidth: function (e) {
      var v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 1) v = this.state.cols;
      v = Math.max(1, Math.min(10000, v));
      var self = this;
      this.setState({
        pendingCols: v
      }, function () {
        self.drawBoard();
      });
    },
    applyWidth: function () {
      this.resizeBoard(this.state.pendingCols, this.state.rows);
    },
    onWidthKeyDown: function (e) {
      if (e.key === 'Enter') {
        this.applyWidth();
      }
    },
    setHeight: function (e) {
      var v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 1) v = this.state.rows;
      v = Math.max(1, Math.min(10000, v));
      var self = this;
      this.setState({
        pendingRows: v
      }, function () {
        self.drawBoard();
      });
    },
    applyHeight: function () {
      this.resizeBoard(this.state.cols, this.state.pendingRows);
    },
    onHeightKeyDown: function (e) {
      if (e.key === 'Enter') {
        this.applyHeight();
      }
    },
    applyGridPreset: function (cols, rows) {
      if (cols * rows > 500000) {
        if (!confirm('A ' + cols + '\u00d7' + rows + ' grid uses significant memory and may run slowly. Continue?')) {
          return;
        }
      }
      this.resizeBoard(cols, rows);
    },
    setDensity: function (e) {
      this.setState({
        sparseness: 9 - (parseInt(e.target.value, 10) || 0)
      });
    },
    setSpeed: function (e) {
      var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
      this.setState({
        speed: v
      });
    },
    // ── Rules ─────────────────────────────────────────────────────────

    parseRuleString: function (val) {
      var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
      if (!match) {
        return null;
      }
      return {
        birth: match[1].split('').filter(function (d, i, a) {
          return a.indexOf(d) === i;
        }).map(Number),
        survive: match[2].split('').filter(function (d, i, a) {
          return a.indexOf(d) === i;
        }).map(Number)
      };
    },
    setRule: function (e) {
      var val = e.target.value;
      var parsed = this.parseRuleString(val);
      if (parsed) {
        SimRunner.invalidate();
        this.setState({
          birthRule: parsed.birth,
          surviveRule: parsed.survive,
          ruleString: val,
          rulePreset: val.toUpperCase()
        });
      } else {
        this.setState({
          ruleString: val,
          rulePreset: ''
        });
      }
    },
    setRulePreset: function (e) {
      var rule = e.target.value;
      if (!rule) {
        return;
      }
      var parsed = this.parseRuleString(rule);
      if (parsed) {
        SimRunner.invalidate();
        this.setState({
          birthRule: parsed.birth,
          surviveRule: parsed.survive,
          ruleString: rule,
          rulePreset: rule
        });
      }
    },
    // ── RLE import ────────────────────────────────────────────────────

    setRleInput: function (e) {
      this.setState({
        rleInput: e.target.value,
        rleError: ''
      });
    },
    toggleRle: function () {
      this.setState({
        showRle: !this.state.showRle,
        rleError: ''
      });
    },
    loadRle: function () {
      var text = this.state.rleInput.trim();
      if (!text) {
        this.setState({
          rleError: 'Paste a pattern first.'
        });
        return;
      }
      if (text.length > 500000) {
        this.setState({
          rleError: 'Pattern too large (max 500 KB). Use a smaller pattern or reduce it first.'
        });
        return;
      }
      // Strip non-printable control characters.
      text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
      try {
        // Auto-detect format.
        var result = detectAndParsePattern(text);
        if (result.cells.length === 0) {
          this.setState({
            rleError: 'No live cells found in pattern.'
          });
          return;
        }
        PATTERNS['Custom'] = result.cells;
        var self = this;
        InputHandler._previewPos = null;
        this.setState({
          selectedPattern: 'Custom',
          patternRotation: 0,
          showRle: false,
          rleError: result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
        }, function () {
          self.drawBoard();
        });
      } catch (ex) {
        this.setState({
          rleError: 'Could not parse pattern: ' + ex.message
        });
      }
    },
    rotateCW: function () {
      var self = this;
      this.setState({
        patternRotation: (this.state.patternRotation + 1) % 4
      }, function () {
        self.drawBoard();
      });
    },
    rotateCCW: function () {
      var self = this;
      this.setState({
        patternRotation: (this.state.patternRotation + 3) % 4
      }, function () {
        self.drawBoard();
      });
    },
    selectPattern: function (e) {
      var name = e.target.value || null;
      InputHandler._previewPos = null;
      var self = this;
      var newMode = name ? 'preset' : 'paint';
      this.setState({
        selectedPattern: name,
        drawMode: newMode,
        patternRotation: 0
      }, function () {
        self.drawBoard();
      });
    },
    placePattern: function (name, centerC, centerR) {
      if (!PATTERNS[name]) {
        return;
      }
      this.pushUndo();
      this._stableCount = 0;
      this._prevBoardHash = null;
      var pattern = SimEngine.rotatePattern(PATTERNS[name], this.state.patternRotation);
      var cols = this.state.cols;
      var rows = this.state.rows;
      var maxR = 0,
        maxC = 0;
      for (var k = 0; k < pattern.length; k++) {
        if (pattern[k][0] > maxR) {
          maxR = pattern[k][0];
        }
        if (pattern[k][1] > maxC) {
          maxC = pattern[k][1];
        }
      }
      var offsetR = centerR - Math.floor(maxR / 2);
      var offsetC = centerC - Math.floor(maxC / 2);
      var newLiveCells = new Map(this.state.liveCells);
      var regionMask = this.state.regionMask;
      var isUnbounded = this.state.boundary === 'unbounded';
      for (var i = 0; i < pattern.length; i++) {
        var pr = pattern[i][0] + offsetR;
        var pc = pattern[i][1] + offsetC;
        var pkey = pr + ',' + pc;
        if (isUnbounded || regionMask.has(pkey)) {
          newLiveCells.set(pkey, 1);
        }
      }
      InputHandler._previewPos = null;
      this._minimapDirty = true;
      SimRunner.invalidate();
      var self = this;
      this.setState({
        liveCells: newLiveCells,
        stable: false
      }, function () {
        self.drawBoard();
      });
    },
    // ── Board actions ─────────────────────────────────────────────────

    emptyBoard: function () {
      this.pushUndo();
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._minimapDirty = true;
      this._mmUnboundedRegion = null;
      SimRunner.invalidate();
      this._trailMap = new Map();
      this.clearGenHistory();
      var self = this;
      this.setState({
        running: false,
        generations: 0,
        liveCells: new Map(),
        popHistory: [],
        sessionPeakPop: 0,
        stable: false
      }, function () {
        self.drawBoard();
      });
      this._announce('Board cleared');
    },
    resetGame: function () {
      this.pushUndo();
      var mask = this.state.regionMask;
      var useMask = this.state.boundary !== 'unbounded' && mask && mask.size > 0;
      var resetCols = this.state.boundary === 'unbounded' ? 100 : this.state.cols;
      var resetRows = this.state.boundary === 'unbounded' ? 100 : this.state.rows;
      var totalCells = useMask ? mask.size : resetCols * resetRows;
      var sparseness = this.state.sparseness;
      // Cap density for very large boards to prevent browser crash.
      if (totalCells > 1000000) {
        sparseness = Math.max(sparseness, totalCells / 500000);
      }
      var wasRunning = this.state.running;
      this._tickId++;
      this._loopRunning = false;
      this._prevBoardHash = null;
      this._stableCount = 0;
      this._minimapDirty = true;
      this._mmUnboundedRegion = null;
      SimRunner.invalidate();
      this._trailMap = new Map();
      this.clearGenHistory();
      var self = this;
      var applyReset = function (newLiveCells) {
        self.setState({
          running: false,
          generations: 0,
          liveCells: newLiveCells,
          popHistory: [],
          sessionPeakPop: 0,
          stable: false
        }, function () {
          self.drawBoard();
          if (wasRunning) {
            self.setState({
              running: true
            }, function () {
              self._startLoop();
            });
          }
        });
      };
      if (useMask) {
        // Generate random cells only within the region mask.
        var newLiveCells = new Map();
        mask.forEach(function (key) {
          if (Math.random() < 1 / sparseness) {
            newLiveCells.set(key, 1);
          }
        });
        applyReset(newLiveCells);
      } else if (totalCells > 250000) {
        // Large board: generate cells asynchronously to avoid UI freeze.
        this.setState({
          running: false
        });
        SimEngine.buildLiveCellsAsync(resetCols, resetRows, sparseness, applyReset);
      } else {
        applyReset(SimEngine.buildLiveCells(resetCols, resetRows, sparseness));
      }
    },
    // ── Render sub-methods ────────────────────────────────────────────

    renderHelpModal: function () {
      if (!this.state.showHelp) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "help-overlay",
        onClick: this.toggleHelp,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "help-dialog-title",
        onKeyDown: function (e) {
          if (e.key === 'Tab') {
            var modal = e.currentTarget.querySelector('.help-modal');
            if (!modal) return;
            var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            var first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "help-modal",
        onClick: function (e) {
          e.stopPropagation();
        }
      }, /*#__PURE__*/React.createElement("h3", {
        className: "help-title",
        id: "help-dialog-title"
      }, "Keyboard Shortcuts"), /*#__PURE__*/React.createElement("table", {
        className: "help-table"
      }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Space"), /*#__PURE__*/React.createElement("td", null, "Play / Pause")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "."), /*#__PURE__*/React.createElement("td", null, "Step one generation")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Shift+."), /*#__PURE__*/React.createElement("td", null, "Step N generations")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, ","), /*#__PURE__*/React.createElement("td", null, "Step backward")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "R"), /*#__PURE__*/React.createElement("td", null, "Reset (random fill)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "E"), /*#__PURE__*/React.createElement("td", null, "Empty board")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+Z"), /*#__PURE__*/React.createElement("td", null, "Undo")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "S"), /*#__PURE__*/React.createElement("td", null, "Export PNG")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "X"), /*#__PURE__*/React.createElement("td", null, "Copy board as RLE")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "F"), /*#__PURE__*/React.createElement("td", null, "Fit live cells in view")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Wheel"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Arrows"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "["), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CCW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "]"), /*#__PURE__*/React.createElement("td", null, "Rotate pattern CW")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+C"), /*#__PURE__*/React.createElement("td", null, "Copy selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ctrl+V"), /*#__PURE__*/React.createElement("td", null, "Paste selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Del"), /*#__PURE__*/React.createElement("td", null, "Delete selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Esc"), /*#__PURE__*/React.createElement("td", null, "Cancel / close")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "M"), /*#__PURE__*/React.createElement("td", null, "Toggle minimap")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "?"), /*#__PURE__*/React.createElement("td", null, "Show / hide this help")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
        colSpan: "2",
        scope: "colgroup",
        style: {
          paddingTop: '10px',
          opacity: 0.55,
          fontSize: '0.85em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }, "Touch gestures")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tap"), /*#__PURE__*/React.createElement("td", null, "Paint / place cell")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Pinch"), /*#__PURE__*/React.createElement("td", null, "Zoom in / out")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "2-finger drag"), /*#__PURE__*/React.createElement("td", null, "Pan viewport")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Long press"), /*#__PURE__*/React.createElement("td", null, "Show cell coordinates")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
        colSpan: "2",
        scope: "colgroup",
        style: {
          paddingTop: '10px',
          opacity: 0.55,
          fontSize: '0.85em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }, "File import")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Drag & drop"), /*#__PURE__*/React.createElement("td", null, "Drop .rle/.cells file on canvas")))), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn help-close",
        onClick: this.toggleHelp,
        title: "Close",
        "aria-label": "Close help dialog"
      }, "Close")));
    },
    togglePopGraph: function () {
      var opening = !this.state.showPopGraph;
      if (opening) {
        this._saveFocus();
      }
      var self = this;
      this.setState({
        showPopGraph: opening
      }, function () {
        if (opening) {
          self._focusFirst('.pop-graph-modal');
        } else {
          self._restoreFocus();
        }
      });
    },
    analyzePattern: function () {
      if (this.state.analyzing) {
        return;
      }
      var liveCells = this.state.liveCells;
      if (liveCells.size === 0) {
        this.setState({
          analysisResult: 'No live cells to analyze.'
        });
        var self0 = this;
        setTimeout(function () {
          self0.setState({
            analysisResult: null
          });
        }, 3000);
        return;
      }
      this._analysisCancelled = false;
      var pop = liveCells.size;
      // Scale generation limit based on population to keep analysis responsive.
      var maxGens = pop > 1000 ? 200 : pop > 500 ? 500 : 2000;
      this.setState({
        analyzing: true,
        analysisResult: 'Analyzing\u2026 gen 0/' + maxGens + ' (click to cancel)'
      });
      var self = this;
      var cols = this.state.cols;
      var rows = this.state.rows;
      var birth = this.state.birthRule;
      var survive = this.state.surviveRule;
      var boundary = this.state.boundary;
      var chunkSize = 50;

      // Order-independent O(n) hash using Szudzik pairing + XOR mixing.
      function hashBoard(lc) {
        var h1 = 0,
          h2 = 0,
          count = 0;
        lc.forEach(function (age, key) {
          var _rc = parseKey(key),
            r = _rc[0],
            c = _rc[1];
          var paired = r >= c ? r * r + r + c : c * c + r;
          h1 = h1 + paired | 0;
          h2 = h2 ^ Math.imul(paired, 2654435761) | 0;
          count++;
        });
        return count + '|' + h1 + '|' + h2;
      }

      // Get bounding box center.
      function bbox(lc) {
        var minR = Infinity,
          maxR = -Infinity,
          minC = Infinity,
          maxC = -Infinity;
        lc.forEach(function (age, key) {
          var _rc = parseKey(key),
            r = _rc[0],
            c = _rc[1];
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        });
        return {
          cr: (minR + maxR) / 2,
          cc: (minC + maxC) / 2
        };
      }
      var hashes = new Map();
      var current = liveCells;
      var initBBox = bbox(current);
      hashes.set(hashBoard(current), {
        gen: 0,
        cr: initBBox.cr,
        cc: initBBox.cc
      });
      var gen = 0;
      var analysisStartTime = Date.now();

      // Build a local HashLife tree for analysis (separate from main sim state).
      var aRuleKey = birth.join(',') + '/' + survive.join(',');
      var savedHlRuleKey = SimRunner._hlRuleKey;
      if (aRuleKey !== SimRunner._hlRuleKey) {
        HashLife.init(birth, survive);
        SimRunner.invalidate();
      }
      var aCells = [];
      current.forEach(function (age, key) {
        aCells.push(parseKey(key));
      });
      var aTree = HashLife.fromCellList(aCells);
      var aRoot = aTree.root,
        aOffR = aTree.offR,
        aOffC = aTree.offC;
      function finishAnalysis(msg, duration) {
        // Restore main simulation's rule key that may have been overwritten.
        SimRunner._hlRuleKey = savedHlRuleKey;
        self.setState({
          analysisResult: msg,
          analyzing: false
        });
        setTimeout(function () {
          self.setState({
            analysisResult: null
          });
        }, duration || 5000);
      }
      function analyzeStep() {
        // Advance the local HashLife tree by 1 gen.
        if (boundary === 'toroidal') {
          current = SimEngine.computeNextGeneration(current, cols, rows, birth, survive, boundary);
          return;
        }
        var level = aRoot.level;
        aRoot = HashLife.expandTree(aRoot);
        aOffR += 1 << level - 1;
        aOffC += 1 << level - 1;
        level = aRoot.level;
        aRoot = HashLife.advance(aRoot, 1);
        aOffR -= 1 << level - 2;
        aOffC -= 1 << level - 2;
        var pLvl = aRoot.level;
        aRoot = HashLife.trimTree(aRoot);
        for (var l = pLvl; l > aRoot.level; l--) {
          aOffR -= 1 << l - 2;
          aOffC -= 1 << l - 2;
        }
        var newCells = HashLife.toCellList(aRoot, aOffR, aOffC);
        current = overlayAges(current, newCells);
        if (boundary === 'finite') {
          var clipped = new Map();
          current.forEach(function (age, key) {
            var _rc = parseKey(key),
              r = _rc[0],
              c = _rc[1];
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              clipped.set(key, age);
            }
          });
          current = clipped;
        }
      }
      function runChunk() {
        if (self._analysisCancelled) {
          return;
        }
        if (Date.now() - analysisStartTime > 10000) {
          finishAnalysis('Timed out after 10s (' + gen + ' gens analyzed).');
          return;
        }
        var end = Math.min(gen + chunkSize, maxGens);
        while (gen < end) {
          analyzeStep();
          gen++;
          var h = hashBoard(current);
          if (hashes.has(h)) {
            var prev = hashes.get(h);
            var period = gen - prev.gen;
            var bb = bbox(current);
            var dr = Math.abs(bb.cr - prev.cr);
            var dc = Math.abs(bb.cc - prev.cc);
            var msg;
            if (period === 1 && dr < 0.01 && dc < 0.01) {
              msg = 'Still life (stable)';
            } else if (dr < 0.01 && dc < 0.01) {
              msg = 'Oscillator \u2014 period ' + period;
            } else {
              var speed = Math.max(dr, dc);
              var gcd = function (a, b) {
                return b === 0 ? a : gcd(b, a % b);
              };
              var sn = Math.round(speed);
              var g = gcd(sn, period);
              var num = sn / g;
              var den = period / g;
              var dir = dr > dc + 0.01 ? dc > 0.01 ? 'diagonal' : 'vertical' : dc > dr + 0.01 ? 'horizontal' : 'diagonal';
              msg = 'Spaceship \u2014 ' + (num === 1 ? 'c' : num + 'c') + '/' + den + ' ' + dir + ', period ' + period;
            }
            finishAnalysis(msg, 6000);
            return;
          }
          var bb2 = bbox(current);
          hashes.set(h, {
            gen: gen,
            cr: bb2.cr,
            cc: bb2.cc
          });
          if (current.size === 0) {
            finishAnalysis('Pattern dies at generation ' + gen + '.');
            return;
          }
        }
        if (gen >= maxGens) {
          finishAnalysis('No periodicity detected (' + maxGens + ' gens).');
        } else {
          // Update progress and yield to UI.
          self.setState({
            analysisResult: 'Analyzing\u2026 gen ' + gen + '/' + maxGens + ' (click to cancel)'
          });
          setTimeout(runChunk, 0);
        }
      }
      setTimeout(runChunk, 0);
    },
    cancelAnalysis: function () {
      this._analysisCancelled = true;
      this.setState({
        analysisResult: 'Analysis cancelled.',
        analyzing: false
      });
      var self = this;
      setTimeout(function () {
        self.setState({
          analysisResult: null
        });
      }, 2000);
    },
    renderPopGraph: function () {
      if (!this.state.showPopGraph) {
        return null;
      }
      var hist = this.state.popHistory;
      if (hist.length < 2) {
        return null;
      }
      var self = this;
      var maxPop = 0;
      for (var i = 0; i < hist.length; i++) {
        if (hist[i] > maxPop) {
          maxPop = hist[i];
        }
      }
      if (maxPop === 0) {
        maxPop = 1;
      }
      var vbW = 600,
        vbH = 200,
        padT = 10,
        padB = 20,
        padL = 50,
        padR = 10;
      var plotW = vbW - padL - padR;
      var plotH = vbH - padT - padB;
      // Draw data points as SVG polyline.
      var points = hist.map(function (p, idx) {
        var x = padL + idx / (hist.length - 1) * plotW;
        var y = padT + (1 - p / maxPop) * plotH;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      // Y-axis labels.
      var yLabels = [];
      var ySteps = 4;
      for (var yi = 0; yi <= ySteps; yi++) {
        var val = Math.round(maxPop * (1 - yi / ySteps));
        var yy = padT + yi / ySteps * plotH;
        yLabels.push({
          val: val,
          y: yy
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "help-overlay",
        onClick: this.togglePopGraph,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "popgraph-dialog-title",
        onKeyDown: function (e) {
          if (e.key === 'Tab') {
            var modal = e.currentTarget.querySelector('.pop-graph-modal');
            if (!modal) return;
            var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            var first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "pop-graph-modal",
        onClick: function (e) {
          e.stopPropagation();
        }
      }, /*#__PURE__*/React.createElement("h3", {
        className: "help-title",
        id: "popgraph-dialog-title"
      }, "Population History"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: '0.8em',
          opacity: 0.7,
          margin: '0 0 8px'
        }
      }, hist.length + ' generations recorded \xB7 peak ' + maxPop.toLocaleString()), /*#__PURE__*/React.createElement("svg", {
        width: "100%",
        viewBox: "0 0 " + vbW + " " + vbH,
        style: {
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '4px'
        },
        role: "img",
        "aria-label": "Population history graph"
      }, yLabels.map(function (yl, idx) {
        return /*#__PURE__*/React.createElement("g", {
          key: idx
        }, /*#__PURE__*/React.createElement("line", {
          x1: padL,
          y1: yl.y,
          x2: vbW - padR,
          y2: yl.y,
          stroke: "rgba(255,255,255,0.15)",
          strokeWidth: "0.5"
        }), /*#__PURE__*/React.createElement("text", {
          x: padL - 5,
          y: yl.y + 4,
          textAnchor: "end",
          fill: "rgba(255,255,255,0.6)",
          fontSize: "10"
        }, yl.val.toLocaleString()));
      }), /*#__PURE__*/React.createElement("text", {
        x: padL + plotW / 2,
        y: vbH - 2,
        textAnchor: "middle",
        fill: "rgba(255,255,255,0.5)",
        fontSize: "9"
      }, "Generation"), /*#__PURE__*/React.createElement("polyline", {
        fill: "none",
        stroke: CanvasRenderer._aliveRGB || '#70959A',
        strokeWidth: "1.5",
        points: points
      }), /*#__PURE__*/React.createElement("polygon", {
        fill: CanvasRenderer._aliveRGB ? CanvasRenderer._aliveRGB.replace('rgb', 'rgba').replace(')', ',0.2)') : 'rgba(112,149,154,0.2)',
        points: padL + ',' + (padT + plotH) + ' ' + points + ' ' + (padL + plotW) + ',' + (padT + plotH)
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn help-close",
        onClick: this.togglePopGraph,
        title: "Close",
        "aria-label": "Close population graph"
      }, "Close")));
    },
    // Returns the sparkline SVG block (or null if insufficient data).
    // Called from both renderStats (desktop) and renderMobileSparkline (mobile).
    renderSparklineSVG: function () {
      var population = this.state.liveCells.size;
      var now2 = Date.now();
      var gpsText = this._measuredGps > 0 && (this.state.running || now2 < (this._gpsDisplayUntil || 0)) ? this._measuredGps.toFixed(1) + '\u00a0gen/s' : null;
      var fullHist = this.state.popHistory;
      var trendArrow = '';
      if (fullHist.length >= 5) {
        var delta = fullHist[fullHist.length - 1] - fullHist[fullHist.length - 5];
        trendArrow = delta > 2 ? '\u2009\u25b2' : delta < -2 ? '\u2009\u25bc' : '\u2009\u223c';
      }
      var histStart = Math.max(0, fullHist.length - 60);
      var hist = histStart > 0 ? fullHist.slice(histStart) : fullHist;
      var maxPop = 0;
      for (var hi = 0; hi < hist.length; hi++) {
        if (hist[hi] > maxPop) {
          maxPop = hist[hi];
        }
      }
      if (hist.length <= 1) {
        return null;
      }
      var vbW = 200,
        vbH = 36,
        padT = 2,
        innerH = vbH - padT * 2;
      var spMax = maxPop || 1;
      var sparkPts = hist.map(function (p, idx) {
        var x = hist.length === 1 ? vbW / 2 : idx / (hist.length - 1) * vbW;
        var y = padT + (1 - p / spMax) * innerH;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      var spanLabel = hist.length >= 60 ? 'last 60 gen' : hist.length + ' gen';
      return /*#__PURE__*/React.createElement("div", {
        className: "sparkline-wrap"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sparkline-header"
      }, /*#__PURE__*/React.createElement("span", {
        className: "sparkline-title",
        onClick: this.togglePopGraph,
        style: {
          cursor: 'pointer'
        },
        title: "Click for full population graph"
      }, "Pop: " + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
        className: "sparkline-peak"
      }, "peak " + maxPop.toLocaleString() + (this.state.sessionPeakPop > maxPop ? " \xb7 all " + this.state.sessionPeakPop.toLocaleString() : ""))), /*#__PURE__*/React.createElement("svg", {
        className: "sparkline",
        width: "100%",
        height: vbH,
        viewBox: "0 0 " + vbW + " " + vbH,
        preserveAspectRatio: "none",
        role: "img",
        "aria-label": "Population sparkline"
      }, /*#__PURE__*/React.createElement("line", {
        x1: "0",
        y1: vbH - 0.5,
        x2: vbW,
        y2: vbH - 0.5,
        stroke: "rgba(244,233,225,0.25)",
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "0",
        y1: padT + innerH / 2,
        x2: vbW,
        y2: padT + innerH / 2,
        stroke: "rgba(244,233,225,0.1)",
        strokeWidth: "0.5"
      }), /*#__PURE__*/React.createElement("polyline", {
        points: sparkPts,
        fill: "none",
        stroke: CanvasRenderer._aliveRGB || '#70959A',
        strokeWidth: "1.5",
        strokeLinejoin: "round",
        strokeLinecap: "round"
      })), /*#__PURE__*/React.createElement("div", {
        className: "sparkline-footer"
      }, /*#__PURE__*/React.createElement("span", {
        className: "sparkline-gps"
      }, gpsText || ''), /*#__PURE__*/React.createElement("span", null, "← " + spanLabel + " →")));
    },
    renderMobileSparkline: function () {
      var svg = this.renderSparklineSVG();
      if (!svg) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-sparkline"
      }, svg);
    },
    renderMobileMinimapArea: function () {
      if (!this.state.showMinimap || this._minimapHidden) {
        return null;
      }
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-minimap-area"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "mobile-minimap-canvas",
        ref: function (c) {
          self._mobileMinimap = c;
        },
        role: "img",
        "aria-label": "Minimap navigation",
        onMouseDown: self.onMinimapElementDown,
        onMouseMove: self.onMinimapElementMove,
        onTouchStart: self.onMinimapElementDown,
        onTouchMove: self.onMinimapElementMove,
        onMouseUp: self.onMinimapElementUp,
        onTouchEnd: self.onMinimapElementUp
      }));
    },
    onMinimapElementDown: function (e) {
      e.preventDefault();
      this._mmElemDragging = true;
      this.panMinimapElement(e);
    },
    onMinimapElementMove: function (e) {
      if (!this._mmElemDragging) {
        return;
      }
      e.preventDefault();
      this.panMinimapElement(e);
    },
    onMinimapElementUp: function () {
      this._mmElemDragging = false;
    },
    panMinimapElement: function (e) {
      if (!this._mobileMinimap) {
        return;
      }
      var rect = this._mobileMinimap.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var frac_c = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var frac_r = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      // Use stored world dims from last minimap render for accurate panning.
      var mmWorld = this._mmMobileWorld;
      var mmCols = mmWorld ? mmWorld.cols : this.state.cols;
      var mmRows = mmWorld ? mmWorld.rows : this.state.rows;
      var mmOC = mmWorld ? mmWorld.originC : 0;
      var mmOR = mmWorld ? mmWorld.originR : 0;
      var newVX = Math.round(frac_c * mmCols + mmOC - this._canvas.width / this.state.cellSize / 2);
      var newVY = Math.round(frac_r * mmRows + mmOR - this._canvas.height / this.state.cellSize / 2);
      var clamped = this.clampView(newVX, newVY, this.state.cols, this.state.rows, this.state.cellSize);
      var self = this;
      this.setState({
        viewX: clamped.viewX,
        viewY: clamped.viewY
      }, function () {
        self.drawBoard();
      });
    },
    drawMinimapMobile: function (liveCells, cols, rows, viewX, viewY, cellSize, theme) {
      if (!this._mobileMinimap) {
        return;
      }
      var isUnbounded = this.state.boundary === 'unbounded';
      var mmMobOriginR = 0,
        mmMobOriginC = 0;
      // regionBounds used for mobile minimap bounding indicator
      if (isUnbounded) {
        var bb = SimEngine.getBoundingBox(liveCells);
        if (bb) {
          var pad = Math.max(5, Math.round(Math.max(bb.maxR - bb.minR, bb.maxC - bb.minC) * 0.15));
          var newMinR = bb.minR - pad,
            newMinC = bb.minC - pad;
          var newMaxR = bb.maxR + pad,
            newMaxC = bb.maxC + pad;
          // Hysteresis: only expand, never shrink (prevents flashing).
          var prev = this._mmUnboundedRegion;
          if (prev) {
            newMinR = Math.min(prev.minR, newMinR);
            newMinC = Math.min(prev.minC, newMinC);
            newMaxR = Math.max(prev.maxR, newMaxR);
            newMaxC = Math.max(prev.maxC, newMaxC);
          }
          this._mmUnboundedRegion = {
            minR: newMinR,
            minC: newMinC,
            maxR: newMaxR,
            maxC: newMaxC
          };
          mmMobOriginR = newMinR;
          mmMobOriginC = newMinC;
          var mmRegionRows = newMaxR - newMinR + 1;
          var mmRegionCols = newMaxC - newMinC + 1;
        } else {
          mmMobOriginR = viewY - 50;
          mmMobOriginC = viewX - 50;
          var mmRegionRows = 100;
          var mmRegionCols = 100;
        }
      } else {
        // Bounded modes: fixed world region = region bounds + live cells + static padding.
        var rbm = this.state.regionBounds;
        var mmMR = rbm ? rbm.minR : 0;
        var mmMC = rbm ? rbm.minC : 0;
        var mmMXR = rbm ? rbm.maxR + 1 : rows;
        var mmMXC = rbm ? rbm.maxC + 1 : cols;
        var bbMob = SimEngine.getBoundingBox(liveCells);
        if (bbMob) {
          mmMR = Math.min(mmMR, bbMob.minR);
          mmMC = Math.min(mmMC, bbMob.minC);
          mmMXR = Math.max(mmMXR, bbMob.maxR + 1);
          mmMXC = Math.max(mmMXC, bbMob.maxC + 1);
        }
        var pad2m = Math.max(5, Math.round(Math.max(mmMXR - mmMR, mmMXC - mmMC) * 0.1));
        mmMobOriginR = mmMR - pad2m;
        mmMobOriginC = mmMC - pad2m;
        var mmRegionRows = mmMXR - mmMR + pad2m * 2;
        var mmRegionCols = mmMXC - mmMC + pad2m * 2;
      }
      var MOBILE_MM_CSS_W = 160;
      var mmAspect = mmRegionCols / Math.max(1, mmRegionRows);
      var mmH_css = Math.round(MOBILE_MM_CSS_W / mmAspect);
      var mmW_css = MOBILE_MM_CSS_W;

      // Resize off-screen buffer if needed
      if (this._minimapCanvas.width !== mmW_css || this._minimapCanvas.height !== mmH_css) {
        this._minimapCanvas.width = mmW_css;
        this._minimapCanvas.height = mmH_css;
      }

      // Render minimap cells to off-screen canvas using actual theme colors.
      var mmCtx = this._minimapCanvas.getContext('2d');
      // Dark background for contrast (same approach as desktop drawMinimap).
      mmCtx.fillStyle = 'rgba(10,14,26,0.85)';
      mmCtx.fillRect(0, 0, mmW_css, mmH_css);
      var cellW = mmW_css / mmRegionCols;
      var cellH = mmH_css / mmRegionRows;
      mmCtx.fillStyle = 'rgb(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ')';
      var _mmMOR = mmMobOriginR,
        _mmMOC = mmMobOriginC,
        _mmMCols = mmRegionCols,
        _mmMRows = mmRegionRows;
      liveCells.forEach(function (_, key) {
        var rc = parseKey(key);
        var kr = rc[0] - _mmMOR;
        var kc = rc[1] - _mmMOC;
        if (kr < 0 || kr >= _mmMRows || kc < 0 || kc >= _mmMCols) return;
        var px = Math.floor(kc * cellW);
        var py = Math.floor(kr * cellH);
        var pw = Math.max(1, Math.ceil(cellW));
        var ph = Math.max(1, Math.ceil(cellH));
        mmCtx.fillRect(px, py, pw, ph);
      });

      // Region indicator on mobile minimap (bounded modes only).
      if (!isUnbounded && this.state.regionComponents) {
        var _compsM = this.state.regionComponents;
        if (_compsM.length > 0) {
          mmCtx.strokeStyle = 'rgba(' + theme.aliveR + ',' + theme.aliveG + ',' + theme.aliveB + ',0.5)';
          mmCtx.lineWidth = 1;
          mmCtx.setLineDash([3, 2]);
          for (var _ciM = 0; _ciM < _compsM.length; _ciM++) {
            var _compM = _compsM[_ciM];
            var _cxM = Math.round((_compM.minC - mmMobOriginC) * cellW);
            var _cyM = Math.round((_compM.minR - mmMobOriginR) * cellH);
            var _cwM = Math.round((_compM.maxC - _compM.minC + 1) * cellW);
            var _chM = Math.round((_compM.maxR - _compM.minR + 1) * cellH);
            mmCtx.strokeRect(_cxM + 0.5, _cyM + 0.5, _cwM, _chM);
          }
          mmCtx.setLineDash([]);
        }
      }

      // Border.
      mmCtx.strokeStyle = 'rgba(255,255,255,0.2)';
      mmCtx.lineWidth = 1;
      mmCtx.strokeRect(0.5, 0.5, mmW_css - 1, mmH_css - 1);

      // Viewport rectangle.
      var vpVisColsM = this._canvas ? this._canvas.width / cellSize : 100;
      var vpVisRowsM = this._canvas ? this._canvas.height / cellSize : 100;
      var vpW = vpVisColsM * cellW;
      var vpH = vpVisRowsM * cellH;
      var vpX = (viewX - mmMobOriginC) * cellW;
      var vpY = (viewY - mmMobOriginR) * cellH;
      // Only draw viewport rect if it overlaps the minimap area.
      var vpClampX = Math.max(0, vpX),
        vpClampY = Math.max(0, vpY);
      var vpClampR = Math.min(mmW_css, vpX + vpW),
        vpClampB = Math.min(mmH_css, vpY + vpH);
      if (vpClampR > vpClampX && vpClampB > vpClampY) {
        mmCtx.strokeStyle = 'rgba(255,255,255,0.75)';
        mmCtx.lineWidth = 1;
        mmCtx.strokeRect(vpClampX + 0.5, vpClampY + 0.5, vpClampR - vpClampX, vpClampB - vpClampY);
      }

      // Off-screen viewport indicator arrow.
      var vpCenterCm = viewX + vpVisColsM / 2;
      var vpCenterRm = viewY + vpVisRowsM / 2;
      var vpOutsideM = vpCenterCm < mmMobOriginC || vpCenterCm > mmMobOriginC + mmRegionCols || vpCenterRm < mmMobOriginR || vpCenterRm > mmMobOriginR + mmRegionRows;
      if (vpOutsideM) {
        var mmCCm = mmMobOriginC + mmRegionCols / 2,
          mmCRm = mmMobOriginR + mmRegionRows / 2;
        var aaM = Math.atan2(vpCenterRm - mmCRm, vpCenterCm - mmCCm);
        var apxM = mmW_css / 2 + Math.cos(aaM) * (mmW_css / 2 - 8);
        var apyM = mmH_css / 2 + Math.sin(aaM) * (mmH_css / 2 - 8);
        apxM = Math.max(6, Math.min(mmW_css - 6, apxM));
        apyM = Math.max(6, Math.min(mmH_css - 6, apyM));
        mmCtx.save();
        mmCtx.fillStyle = 'rgba(255,255,255,0.85)';
        mmCtx.translate(apxM, apyM);
        mmCtx.rotate(aaM);
        mmCtx.beginPath();
        mmCtx.moveTo(6, 0);
        mmCtx.lineTo(-3, -4);
        mmCtx.lineTo(-3, 4);
        mmCtx.closePath();
        mmCtx.fill();
        mmCtx.restore();
      }

      // Resize HTML canvas if needed and blit
      if (this._mobileMinimap.width !== mmW_css || this._mobileMinimap.height !== mmH_css) {
        this._mobileMinimap.width = mmW_css;
        this._mobileMinimap.height = mmH_css;
      }
      var mobileCtx = this._mobileMinimap.getContext('2d');
      mobileCtx.drawImage(this._minimapCanvas, 0, 0);
      // Store world dims for mobile minimap panning.
      this._mmMobileWorld = {
        originC: mmMobOriginC,
        originR: mmMobOriginR,
        cols: mmRegionCols,
        rows: mmRegionRows
      };
    },
    renderStats: function () {
      var population = this.state.liveCells.size;
      var hc = this.state.hoverCell;
      var coordText = hc ? 'Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r : '\u2014';
      var sparkline = this.renderSparklineSVG();
      return /*#__PURE__*/React.createElement("div", {
        className: "stats"
      }, /*#__PURE__*/React.createElement("div", {
        className: "stat-row"
      }, /*#__PURE__*/React.createElement("span", null, "Gen: " + this.state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", {
        className: "board-dims"
      }, this.state.cols + "\u00d7" + this.state.rows)), /*#__PURE__*/React.createElement("div", {
        className: "stat-row"
      }, /*#__PURE__*/React.createElement("div", {
        className: "status-badges"
      }, /*#__PURE__*/React.createElement("span", {
        className: "status-indicator " + (this.state.running ? "status-running" : "status-paused")
      }, this.state.running ? "Running" : "Paused"), this.state.stable && /*#__PURE__*/React.createElement("span", {
        className: "status-indicator status-stable"
      }, "Stable")), /*#__PURE__*/React.createElement("div", {
        className: "coord-display"
      }, coordText)), sparkline || /*#__PURE__*/React.createElement("div", {
        className: "sparkline-placeholder"
      }, "Pop: " + population.toLocaleString()));
    },
    // ── Shared mobile sub-components (R10) ─────────────────────────────
    // Extracted from 3 duplicated mobile render methods.

    _MOBILE_TABS: [{
      id: 'simulate',
      icon: 'fa-play',
      label: 'Simulate'
    }, {
      id: 'tools',
      icon: 'fa-pencil',
      label: 'Tools'
    }, {
      id: 'board',
      icon: 'fa-th',
      label: 'Board'
    }, {
      id: 'rules',
      icon: 'fa-cog',
      label: 'Rules'
    }, {
      id: 'export',
      icon: 'fa-download',
      label: 'Export'
    }],
    _buildSheetContent: function () {
      if (!this.state.bottomSheetOpen) {
        return null;
      }
      return this._buildTabContent(this.state.bottomSheetTab, {
        sectionTitle: true,
        sparkline: true
      });
    },
    // Shared tab content builder used by mobile sheet, desktop rail, and context tray.
    _buildTabContent: function (tabId, options) {
      options = options || {};
      switch (tabId) {
        case 'simulate':
          return /*#__PURE__*/React.createElement("div", null, options.sectionTitle && /*#__PURE__*/React.createElement("div", {
            className: "sidebar-section-title"
          }, "Simulation"), /*#__PURE__*/React.createElement("label", {
            className: "control-group-label"
          }, "Transport"), this.renderTransportControls(false), /*#__PURE__*/React.createElement("label", {
            className: "control-group-label"
          }, "View"), this.renderViewControls(), options.showMode !== false && /*#__PURE__*/React.createElement("label", {
            className: "control-group-label"
          }, "Mode"), options.showMode !== false && this.renderModeControls(), options.sparkline && this.renderMobileSparkline());
        case 'tools':
          return this.renderToolsContent();
        case 'board':
          return this.renderSliders();
        case 'rules':
          return this.renderRulesSection();
        case 'export':
          return this.renderExportContent();
        default:
          return null;
      }
    },
    _renderStatsChip: function () {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "stats-chip",
        onClick: this.togglePopGraph,
        role: "button",
        tabIndex: "0",
        "aria-atomic": "true",
        "aria-live": "off",
        onKeyDown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            self.togglePopGraph();
          }
        }
      }, /*#__PURE__*/React.createElement("span", null, "Gen " + this.state.generations.toLocaleString()), /*#__PURE__*/React.createElement("span", null, "\u2002Pop " + this.state.liveCells.size.toLocaleString()), /*#__PURE__*/React.createElement("span", {
        className: "status-indicator status-icon " + (this.state.running ? "status-running" : "status-paused")
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.stable ? "fa-check-circle" : this.state.running ? "fa-play" : "fa-pause")
      }), " ", this.state.stable ? "Stable" : this.state.running ? "Run" : "Pause"));
    },
    _renderMobileTransportBar: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-transport-bar",
        role: "toolbar",
        "aria-label": "Simulation transport"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        "aria-label": this.state.running ? "Pause simulation" : "Play simulation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        "aria-label": "Step one generation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        "aria-label": "Reset simulation"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.panMode ? " active" : ""),
        onClick: this.togglePanMode,
        "aria-label": this.state.panMode ? "Switch to " + (this.state.drawMode === 'select' ? "select" : this.state.drawMode === 'preset' ? "preset" : this.state.drawMode === 'region' ? "region" : "draw") + " mode" : "Switch to pan mode",
        "aria-pressed": this.state.panMode
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.panMode ? this.state.drawMode === 'select' ? "fa-crosshairs" : this.state.drawMode === 'preset' ? "fa-puzzle-piece" : this.state.drawMode === 'region' ? "fa-th" : "fa-pencil" : "fa-hand-paper-o"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("span", {
        className: "mobile-transport-mode",
        "aria-live": "polite"
      }, this.state.panMode ? 'Pan' : this.state.drawMode === 'preset' && this.state.selectedPattern ? this.state.selectedPattern : this.state.drawMode === 'select' ? 'Select' : this.state.drawMode === 'region' ? 'Region' : 'Draw'), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle btn-sheet-toggle" + (this.state.bottomSheetOpen ? " active" : ""),
        onClick: this.toggleBottomSheet,
        "aria-expanded": this.state.bottomSheetOpen,
        "aria-label": "Open controls panel"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-ellipsis-h",
        "aria-hidden": "true"
      })));
    },
    _renderBottomSheet: function (sheetContent) {
      var self = this;
      var tabs = this._MOBILE_TABS;
      var layoutSwitcher = this.renderLayoutSwitcher();
      return /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-container",
        onKeyDown: function (e) {
          self._onSheetKeyDown(e);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-backdrop",
        onClick: this.toggleBottomSheet,
        role: "presentation",
        "aria-hidden": "true"
      }), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet" + (this.state.bottomSheetClosing ? " sheet-closing" : ""),
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Controls panel",
        onTouchStart: function (e) {
          self._onSheetTouchStart(e);
        },
        onTouchMove: function (e) {
          self._onSheetTouchMove(e);
        },
        onTouchEnd: function (e) {
          self._onSheetTouchEnd(e);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-handle"
      }), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-tabs",
        role: "tablist",
        "aria-label": "Control categories"
      }, tabs.map(function (tab) {
        var isActive = self.state.bottomSheetTab === tab.id;
        return /*#__PURE__*/React.createElement("button", {
          key: tab.id,
          className: "rail-tab" + (isActive ? " active" : ""),
          onClick: function () {
            self.setBottomSheetTab(tab.id);
          },
          role: "tab",
          "aria-selected": isActive,
          "aria-label": tab.label,
          "aria-controls": "sheet-panel-" + tab.id
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + tab.icon,
          "aria-hidden": "true"
        }), /*#__PURE__*/React.createElement("span", {
          className: "rail-tab-label"
        }, tab.label));
      })), /*#__PURE__*/React.createElement("div", {
        className: "bottom-sheet-content",
        id: "sheet-panel-" + this.state.bottomSheetTab,
        role: "tabpanel",
        "aria-label": this.state.bottomSheetTab + " controls"
      }, sheetContent, layoutSwitcher && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 12px 0',
          borderTop: '1px solid var(--panel-border)'
        }
      }, layoutSwitcher))));
    },
    renderMobileContextPanel: function () {
      var self = this;
      var showRotation = this.state.drawMode === 'preset' && this.state.selectedPattern;
      var showSelection = this.state.selection !== null;
      if (!showRotation && !showSelection) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-context-panel"
      }, showRotation && /*#__PURE__*/React.createElement("div", {
        className: "rotation-btns"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCCW,
        title: "Rotate 90\xB0 counter-clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCW,
        title: "Rotate 90\xB0 clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          InputHandler._previewPos = null;
          self.setState({
            selectedPattern: null,
            patternRotation: 0,
            drawMode: 'paint'
          }, function () {
            self.drawBoard();
          });
        },
        "aria-label": "Cancel pattern placement",
        title: "Cancel placement"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      }))), showSelection && /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-selection"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copySelection,
        disabled: !this.state.selection,
        title: "Copy selected cells",
        "aria-label": "Copy selected cells"
      }, "Copy"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.pasteAsPattern,
        disabled: !this.state.clipboard || this.state.clipboard.length === 0,
        title: "Paste copied cells",
        "aria-label": "Paste copied cells"
      }, "Paste"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.deleteSelection,
        disabled: !this.state.selection,
        title: "Delete selected cells",
        "aria-label": "Delete selected cells"
      }, "Delete"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.setState({
            selection: null
          }, function () {
            self.drawBoard();
          });
        },
        title: "Clear selection",
        "aria-label": "Clear selection"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      }))));
    },
    renderMobileStatsBar: function () {
      var population = this.state.liveCells.size;
      var hist = this.state.popHistory;
      var trendArrow = '';
      if (hist.length >= 5) {
        var delta = hist[hist.length - 1] - hist[hist.length - 5];
        trendArrow = delta > 2 ? ' \u25b2' : delta < -2 ? ' \u25bc' : ' \u223c';
      }
      var statusLabel = this.state.stable ? 'Stable' : this.state.running ? 'Running' : 'Paused';
      var statusClass = this.state.stable ? 'status-stable' : this.state.running ? 'status-running' : 'status-paused';
      var contextLabel = this.state.drawMode === 'preset' && this.state.selectedPattern ? this.state.selectedPattern : this.state.drawMode === 'select' ? 'Select' : 'Draw';
      return /*#__PURE__*/React.createElement("div", {
        className: "mobile-stats-bar"
      }, /*#__PURE__*/React.createElement("span", {
        className: "msb-left"
      }, /*#__PURE__*/React.createElement("span", {
        className: "msb-title"
      }, "Conway's Game of Life"), 'Gen\u00a0' + this.state.generations.toLocaleString() + '\u2002Pop\u00a0' + population.toLocaleString() + trendArrow), /*#__PURE__*/React.createElement("span", {
        className: 'status-indicator ' + statusClass
      }, statusLabel), /*#__PURE__*/React.createElement("span", {
        className: "msb-right"
      }, contextLabel));
    },
    // ── Horizontal toolbar (desktop/tablet only — hidden on mobile via CSS) ──
    renderToolbar: function () {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "toolbar-strip"
      }, /*#__PURE__*/React.createElement("span", {
        className: "toolbar-title"
      }, "Conway's\nGame of Life"), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-groups"
      }, /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        title: "Start or pause the simulation (Space)"
      }, this.state.running ? "Pause" : "Play"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        title: "Advance one generation (Enter)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      }), " Step"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepBack,
        title: "Step backward to a previous generation (,)",
        disabled: this._genHistory.length === 0
      }, "Back"), /*#__PURE__*/React.createElement("select", {
        className: "toolbar-step-select",
        value: this.state.stepCount,
        onChange: this.setStepCount,
        title: "Advance N generations at once (Shift+.)"
      }, /*#__PURE__*/React.createElement("option", {
        value: "1"
      }, "+1"), /*#__PURE__*/React.createElement("option", {
        value: "10"
      }, "+10"), /*#__PURE__*/React.createElement("option", {
        value: "50"
      }, "+50"), /*#__PURE__*/React.createElement("option", {
        value: "100"
      }, "+100"), /*#__PURE__*/React.createElement("option", {
        value: "500"
      }, "+500")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.stepN(self.state.stepCount);
        },
        title: "Advance multiple generations (Shift+.)"
      }, "Go")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        title: "Randomize the board (R)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      }), " Reset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.emptyBoard,
        title: "Clear all cells (E)"
      }, "Empty"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.undo,
        title: "Undo last edit (Ctrl+Z)"
      }, "Undo")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitView,
        title: "Zoom to fit entire grid"
      }, "Fit Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitLiveCells,
        title: "Zoom to fit live cells"
      }, "Fit Cells"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.gridLines ? " active" : ""),
        onClick: this.toggleGridLines,
        title: "Toggle grid lines (G)"
      }, "Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showTrails ? " active" : ""),
        onClick: this.toggleTrails,
        title: "Show ghost trails of recently-dead cells"
      }, "Trails"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showMinimap ? " active" : ""),
        onClick: this.toggleMinimap,
        title: "Show/hide minimap overview (M)"
      }, "Minimap")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : ""),
        onClick: this.toggleDrawMode,
        title: "Freehand draw mode (D)"
      }, "Draw"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : ""),
        onClick: this.togglePresetMode,
        title: "Place preset patterns (P)"
      }, "Preset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : ""),
        onClick: this.toggleSelectMode,
        title: "Select and move cells (S)"
      }, "Select"), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'region' ? " active" : ""),
        onClick: this.toggleRegionMode,
        title: "Draw/erase region bounds (B)"
      }, "Region"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.livePaintMode ? " active" : ""),
        onClick: this.toggleLivePaint,
        title: "Paint cells while the simulation is running"
      }, "Live Paint"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : ""),
        onClick: this.toggleBoundary,
        title: "Cycle boundary: Wrap \u2192 Hard \u2192 Infinite"
      }, this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E")), /*#__PURE__*/React.createElement("div", {
        className: "toolbar-group"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.analyzePattern,
        disabled: this.state.analyzing,
        title: "Detect oscillator period or spaceship velocity"
      }, "Analyze"))));
    },
    renderRulesSection: function () {
      var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Rules & Display"), /*#__PURE__*/React.createElement("div", {
        className: "presets-col"
      }, /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Rule preset",
        value: this.state.rulePreset,
        onChange: this.setRulePreset
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "Rule preset..."), RULE_PRESETS.map(function (p) {
        return /*#__PURE__*/React.createElement("option", {
          key: p.rule,
          value: p.rule
        }, p.name);
      })), /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Color theme",
        value: this.state.theme,
        onChange: this.setTheme
      }, Object.keys(THEMES).map(function (t) {
        return /*#__PURE__*/React.createElement("option", {
          key: t,
          value: t
        }, t);
      })), /*#__PURE__*/React.createElement("select", {
        className: "rule-preset-select",
        "aria-label": "Dark mode preference",
        value: this.state.darkModePref,
        onChange: this.setDarkModePref,
        title: "UI dark mode preference"
      }, /*#__PURE__*/React.createElement("option", {
        value: "system"
      }, "Mode: System"), /*#__PURE__*/React.createElement("option", {
        value: "light"
      }, "Mode: Light"), /*#__PURE__*/React.createElement("option", {
        value: "dark"
      }, "Mode: Dark")), /*#__PURE__*/React.createElement("label", {
        className: "slider-title rule-label"
      }, "Rule (B/S notation)"), /*#__PURE__*/React.createElement("input", {
        className: "rule-input" + (ruleValid ? "" : " rule-input-invalid"),
        type: "text",
        value: this.state.ruleString,
        onChange: this.setRule,
        title: "Birth/Survival rule string (e.g. B3/S23)"
      })));
    },
    renderSliders: function () {
      var delay = SPEED_DELAYS[this.state.speed - 1];
      var speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
      var isUnbounded = this.state.boundary === 'unbounded';
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Board"), !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Width: " + this.state.pendingCols), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "20",
        max: "2000",
        step: "10",
        "aria-label": "Grid width",
        value: this.state.pendingCols,
        onChange: this.setWidth,
        onMouseUp: this.applyWidth,
        onKeyDown: this.onWidthKeyDown,
        onTouchEnd: this.applyWidth
      }))), !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Height: " + this.state.pendingRows), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "20",
        max: "2000",
        step: "10",
        "aria-label": "Grid height",
        value: this.state.pendingRows,
        onChange: this.setHeight,
        onMouseUp: this.applyHeight,
        onKeyDown: this.onHeightKeyDown,
        onTouchEnd: this.applyHeight
      }))), !isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Grid presets"), /*#__PURE__*/React.createElement("div", {
        className: "grid-presets"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(100, 100);
        }.bind(this),
        title: "Set grid to 100\xD7100"
      }, "100\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(200, 200);
        }.bind(this),
        title: "Set grid to 200\xD7200"
      }, "200\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(400, 400);
        }.bind(this),
        title: "Set grid to 400\xD7400"
      }, "400\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(1000, 1000);
        }.bind(this),
        title: "Set grid to 1000\xD71000"
      }, "1000\xB2"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-xs",
        onClick: function () {
          this.applyGridPreset(2000, 2000);
        }.bind(this),
        title: "Set grid to 2000\xD72000"
      }, "2000\xB2"))), isUnbounded && /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title",
        style: {
          fontStyle: 'italic'
        }
      }, "No bounding box \u2014 infinite canvas")), /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Fill Density (on Reset)"), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "2",
        max: "7",
        "aria-label": "Fill density",
        value: 9 - this.state.sparseness,
        onChange: this.setDensity
      }))), /*#__PURE__*/React.createElement("label", {
        className: "control-group-label"
      }, "Playback & Display"), /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Speed: " + speedLabel), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "1",
        max: "10",
        "aria-label": "Simulation speed",
        value: this.state.speed,
        onChange: this.setSpeed
      }))), /*#__PURE__*/React.createElement("div", {
        className: "sliders"
      }, /*#__PURE__*/React.createElement("label", {
        className: "slider-title"
      }, "Zoom: " + this.state.cellSize + "\u00a0px/cell"), /*#__PURE__*/React.createElement("div", {
        className: "slider-row"
      }, /*#__PURE__*/React.createElement("input", {
        type: "range",
        min: "1",
        max: "32",
        step: "1",
        "aria-label": "Zoom level",
        value: this.state.cellSize,
        onChange: this.setZoom
      }))));
    },
    renderRLESection: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Import / Export"), /*#__PURE__*/React.createElement("div", {
        className: "rle-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "buttons rle-toggle-row"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rle-toggle btn-block" + (this.state.showRle ? " active" : ""),
        onClick: this.toggleRle
      }, "Import RLE / Plaintext")), this.state.showRle && /*#__PURE__*/React.createElement("div", {
        className: "rle-body"
      }, /*#__PURE__*/React.createElement("textarea", {
        className: "rle-input",
        rows: "5",
        placeholder: "Paste RLE or plaintext pattern\n(from LifeWiki or Golly)",
        value: this.state.rleInput,
        onChange: this.setRleInput
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-block",
        onClick: this.loadRle,
        title: "Load the RLE or plaintext pattern"
      }, "Load pattern"), this.state.rleError && /*#__PURE__*/React.createElement("p", {
        className: "rle-error"
      }, this.state.rleError))));
    },
    // ── Shared sub-components (used by all layout modes) ───────────

    renderCanvas: function (cs) {
      var self = this;
      return /*#__PURE__*/React.createElement("div", {
        className: "app-canvas-container"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "display",
        ref: function (c) {
          self._canvas = c;
        },
        width: cs.w,
        height: cs.h,
        style: {
          width: cs.displayW + 'px',
          height: cs.displayH + 'px',
          display: 'block',
          margin: '0 auto'
        },
        id: "life-canvas",
        role: "application",
        "aria-roledescription": "Game of Life grid",
        "aria-label": "Conway's Game of Life simulation canvas",
        draggable: false,
        onMouseDown: this.onMouseDown,
        onMouseMove: this.onMouseMove,
        onMouseUp: this.onMouseUp,
        onMouseLeave: this.onMouseLeave,
        onContextMenu: this.onContextMenu,
        onTouchStart: this.onTouchStart,
        onTouchMove: this.onTouchMove,
        onTouchEnd: this.onTouchEnd
      }), this.state.analysisResult ? /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "analysis-result" + (this.state.analyzing ? " analysis-cancellable" : ""),
        onClick: this.state.analyzing ? this.cancelAnalysis : null,
        "aria-live": "assertive"
      }, this.state.analysisResult) : null);
    },
    renderTransportControls: function (compact) {
      var self = this;
      if (compact) {
        return /*#__PURE__*/React.createElement("div", {
          className: "transport-controls transport-compact"
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn btn-toggle" + (this.state.running ? " active" : ""),
          onClick: this.toggleGame,
          title: "Play/Pause (Space)"
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
          "aria-hidden": "true"
        })), /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "btn",
          onClick: this.stepGame,
          title: "Step (.)"
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa fa-step-forward",
          "aria-hidden": "true"
        }), " Step"), /*#__PURE__*/React.createElement("span", {
          className: "transport-speed-label"
        }, "Gen " + this.state.generations.toLocaleString()));
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "transport-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.running ? " active" : ""),
        onClick: this.toggleGame,
        title: "Start or pause the simulation (Space)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.running ? "fa-pause" : "fa-play"),
        "aria-hidden": "true"
      }), " ", this.state.running ? "Pause" : "Play"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepGame,
        title: "Advance one generation (Enter)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-forward",
        "aria-hidden": "true"
      }), " Step"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.stepBack,
        title: "Step backward (,)",
        disabled: this._genHistory && this._genHistory.length === 0
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-step-backward",
        "aria-hidden": "true"
      }), " Back"), /*#__PURE__*/React.createElement("select", {
        className: "toolbar-step-select",
        value: this.state.stepCount,
        onChange: this.setStepCount,
        title: "Advance N generations"
      }, /*#__PURE__*/React.createElement("option", {
        value: "1"
      }, "+1"), /*#__PURE__*/React.createElement("option", {
        value: "10"
      }, "+10"), /*#__PURE__*/React.createElement("option", {
        value: "50"
      }, "+50"), /*#__PURE__*/React.createElement("option", {
        value: "100"
      }, "+100"), /*#__PURE__*/React.createElement("option", {
        value: "500"
      }, "+500")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self.stepN(self.state.stepCount);
        },
        title: "Advance multiple generations"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-fast-forward",
        "aria-hidden": "true"
      }), " Go"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.resetGame,
        title: "Randomize the board (R)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-refresh",
        "aria-hidden": "true"
      }), " Reset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.emptyBoard,
        title: "Clear all cells (E)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-eraser",
        "aria-hidden": "true"
      }), " Empty"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.undo,
        title: "Undo last edit (Ctrl+Z)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      }), " Undo"));
    },
    renderViewControls: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "view-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitView,
        title: "Zoom to fit entire grid"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-arrows-alt",
        "aria-hidden": "true"
      }), " Fit Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.fitLiveCells,
        title: "Zoom to fit live cells"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-compress",
        "aria-hidden": "true"
      }), " Fit Cells"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.gridLines ? " active" : ""),
        onClick: this.toggleGridLines,
        title: "Toggle grid lines (G)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      }), " Grid"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showTrails ? " active" : ""),
        onClick: this.toggleTrails,
        title: "Show ghost trails"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-eye",
        "aria-hidden": "true"
      }), " Trails"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.showMinimap ? " active" : ""),
        onClick: this.toggleMinimap,
        title: "Show/hide minimap (M)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-map-o",
        "aria-hidden": "true"
      }), " Minimap"));
    },
    renderModeControls: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "mode-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'paint' ? " active" : ""),
        onClick: this.toggleDrawMode,
        title: "Freehand draw mode (D)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-pencil",
        "aria-hidden": "true"
      }), " Draw"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'preset' ? " active" : ""),
        onClick: this.togglePresetMode,
        title: "Place preset patterns (P)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-puzzle-piece",
        "aria-hidden": "true"
      }), " Preset"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'select' ? " active" : ""),
        onClick: this.toggleSelectMode,
        title: "Select and move cells (S)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-mouse-pointer",
        "aria-hidden": "true"
      }), " Select"), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.drawMode === 'region' ? " active" : ""),
        onClick: this.toggleRegionMode,
        title: "Draw/erase region bounds (B)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      }), " Region"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.livePaintMode ? " active" : ""),
        onClick: this.toggleLivePaint,
        title: "Paint while running"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-paint-brush",
        "aria-hidden": "true"
      }), " Live Paint"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.boundary !== 'toroidal' ? " active" : ""),
        onClick: this.toggleBoundary,
        title: "Cycle boundary"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      }), " ", this.state.boundary === 'toroidal' ? "Wrap" : this.state.boundary === 'finite' ? "Hard" : "\u221E"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.analyzePattern,
        disabled: this.state.analyzing,
        title: "Detect oscillator/spaceship"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-crosshairs",
        "aria-hidden": "true"
      }), " Analyze"));
    },
    renderToolsContent: function () {
      var self = this;
      var filterLc = this.state.patternFilter.toLowerCase();
      var patternOptions = Object.keys(PATTERN_GROUPS).map(function (group) {
        var names = Object.keys(PATTERN_GROUPS[group]).filter(function (name) {
          return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
        });
        if (names.length === 0) {
          return null;
        }
        var opts = names.map(function (name) {
          var meta = PATTERN_META[name];
          var title = '';
          if (meta) {
            if (meta.type === 'Still life') title = 'Still life \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Oscillator') title = 'Oscillator \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Spaceship') title = 'Spaceship \xB7 Period\u00a0' + meta.period + (meta.note ? ' \xB7 ' + meta.note : '');else if (meta.type === 'Methuselah') title = 'Methuselah \xB7 ' + meta.lifespan + '\u00a0gen lifespan \xB7 ' + meta.cells + ' cells';else if (meta.type === 'Gun') title = 'Gun \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
          }
          return /*#__PURE__*/React.createElement("option", {
            key: name,
            value: name,
            title: title
          }, name);
        });
        return /*#__PURE__*/React.createElement("optgroup", {
          key: group,
          label: group
        }, opts);
      }).filter(function (x) {
        return x !== null;
      });
      if (PATTERNS['Custom']) {
        patternOptions = patternOptions.concat(/*#__PURE__*/React.createElement("optgroup", {
          key: "custom",
          label: "Custom"
        }, /*#__PURE__*/React.createElement("option", {
          value: "Custom"
        }, "Custom")));
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "tools-content"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Tools"), /*#__PURE__*/React.createElement("div", {
        className: "btn-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Draw:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.drawTool,
        onChange: function (e) {
          self.setState({
            drawTool: e.target.value,
            drawMode: 'paint',
            selection: null
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "cell"
      }, "Cell paint"), /*#__PURE__*/React.createElement("option", {
        value: "line"
      }, "Line"), /*#__PURE__*/React.createElement("option", {
        value: "fill"
      }, "Flood fill"), /*#__PURE__*/React.createElement("option", {
        value: "shape-rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "shape-circle"
      }, "Circle"))), /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Select:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.selectTool,
        onChange: function (e) {
          self.setState({
            selectTool: e.target.value,
            drawMode: 'select',
            selection: null
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "ellipse"
      }, "Ellipse"), /*#__PURE__*/React.createElement("option", {
        value: "freeform"
      }, "Freeform"), /*#__PURE__*/React.createElement("option", {
        value: "all-visible"
      }, "All visible"))), this.state.boundary !== 'unbounded' && /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Region:"), /*#__PURE__*/React.createElement("select", {
        value: this.state.regionTool,
        onChange: function (e) {
          self.setState({
            regionTool: e.target.value,
            drawMode: 'region'
          });
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "cell"
      }, "Cell paint"), /*#__PURE__*/React.createElement("option", {
        value: "line"
      }, "Line"), /*#__PURE__*/React.createElement("option", {
        value: "fill"
      }, "Flood fill"), /*#__PURE__*/React.createElement("option", {
        value: "shape-rect"
      }, "Rectangle"), /*#__PURE__*/React.createElement("option", {
        value: "shape-circle"
      }, "Circle"))), /*#__PURE__*/React.createElement("div", {
        className: "tool-subtype-row"
      }, /*#__PURE__*/React.createElement("label", {
        className: "tool-label"
      }, "Preset:"), /*#__PURE__*/React.createElement("select", {
        className: "preset-select" + (this.state.drawMode === 'preset' && this.state.selectedPattern ? " active" : ""),
        value: this.state.selectedPattern || "",
        onChange: this.selectPattern
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "Choose preset..."), patternOptions)), /*#__PURE__*/React.createElement("input", {
        className: "pattern-filter-input",
        type: "search",
        placeholder: "Filter patterns...",
        "aria-label": "Filter patterns",
        value: this.state.patternFilter,
        onChange: function (e) {
          self.setState({
            patternFilter: e.target.value
          });
        }
      }), this.state.drawMode === 'preset' && this.state.selectedPattern && /*#__PURE__*/React.createElement("div", {
        className: "rotation-row"
      }, /*#__PURE__*/React.createElement("canvas", {
        className: "rotation-preview",
        width: "96",
        height: "96",
        role: "img",
        "aria-label": "Pattern rotation preview",
        ref: function (c) {
          self._previewCanvas = c;
          if (c) requestAnimationFrame(function () {
            self.drawRotationPreview();
          });
        }
      }), /*#__PURE__*/React.createElement("div", {
        className: "rotation-btns"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCCW,
        title: "Rotate 90\xB0 counter-clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-undo",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-rotate",
        onClick: this.rotateCW,
        title: "Rotate 90\xB0 clockwise"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-repeat",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          self._previewPos = null;
          self.setState({
            selectedPattern: null,
            patternRotation: 0,
            drawMode: 'paint'
          }, function () {
            self.drawBoard();
          });
        },
        "aria-label": "Cancel pattern placement",
        title: "Cancel placement"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-times",
        "aria-hidden": "true"
      })))), this.state.selection && /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-selection"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copySelection,
        title: "Copy selected cells",
        "aria-label": "Copy selected cells"
      }, "Copy"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.pasteAsPattern,
        disabled: !this.state.clipboard || this.state.clipboard.length === 0,
        title: "Paste copied cells",
        "aria-label": "Paste copied cells"
      }, "Paste"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.deleteSelection,
        title: "Delete selected cells",
        "aria-label": "Delete selected cells"
      }, "Delete"))));
    },
    renderExportContent: function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "export-content"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-section-title"
      }, "Import / Export"), /*#__PURE__*/React.createElement("div", {
        className: "btn-section"
      }, /*#__PURE__*/React.createElement("div", {
        className: "buttons buttons-export"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.exportPNG,
        title: "Save as PNG"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-camera",
        "aria-hidden": "true"
      }), " Export PNG"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.copyRLE,
        title: "Copy board as RLE"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-clipboard",
        "aria-hidden": "true"
      }), " Copy RLE"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (this.state.recording ? " active btn-record" : ""),
        onClick: this.toggleRecording,
        title: "Record an animated GIF",
        "aria-label": this.state.recording ? "Stop recording" : "Record GIF"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.recording ? "fa-stop" : "fa-circle"),
        "aria-hidden": "true"
      }), " ", this.state.recording ? "Stop" : "Record"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.shareURL,
        title: "Copy shareable URL to clipboard",
        "aria-label": "Share simulation URL"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-share-alt",
        "aria-hidden": "true"
      }), " ", this.state.shareTooltip ? "Copied!" : "Share")), this.renderRLESection()));
    },
    renderLayoutSwitcher: function () {
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return null;
      }
      var self = this;
      var mode = this.state.layoutMode;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-switcher"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (mode === 'cartographer' ? " active" : ""),
        onClick: function () {
          self.setLayoutMode('cartographer');
        },
        title: "Cartographer: Edge rail with tabs",
        "aria-label": "Cartographer layout: edge rail with tabs"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-columns"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn btn-toggle" + (mode === 'observatory' ? " active" : ""),
        onClick: function () {
          self.setLayoutMode('observatory');
        },
        title: "Observatory: Floating panels",
        "aria-label": "Observatory layout: floating panels"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th-large"
      })));
    },
    // ── Cartographer layout ─────────────────────────────────────────

    renderCartographer: function (cs) {
      var self = this;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return this.renderCartographerMobile(cs);
      }
      var railW = this.state.railHidden ? 0 : this.state.railCollapsed ? 40 : dc === 'tablet' ? 200 : 240;
      var railSide = this.state.railSide;
      var railClass = 'rail' + (this.state.railCollapsed ? ' rail-collapsed' : '') + (this.state.railHidden ? ' rail-hidden' : '') + (' rail-' + railSide);
      var tabContent = /*#__PURE__*/React.createElement("div", {
        className: "rail-tab-content"
      }, this._buildTabContent(this.state.railTab, {
        sectionTitle: true
      }));
      var tabs = this._MOBILE_TABS;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-cartographer"
      }, this.renderCanvas(cs), /*#__PURE__*/React.createElement("div", {
        className: railClass,
        style: {
          width: railW + 'px'
        },
        role: "complementary",
        "aria-label": "Controls panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "rail-header"
      }, /*#__PURE__*/React.createElement("span", {
        className: "rail-title"
      }, "Conway's Game of Life"), /*#__PURE__*/React.createElement("div", {
        className: "rail-header-controls"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleRailSide,
        "aria-label": this.state.railSide === 'right' ? "Move panel to left" : "Move panel to right",
        title: this.state.railSide === 'right' ? "Move panel to left" : "Move panel to right"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa " + (this.state.railSide === 'right' ? "fa-indent" : "fa-dedent"),
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn rail-collapse-btn",
        onClick: this.toggleRailCollapsed,
        "aria-expanded": !this.state.railCollapsed,
        "aria-label": this.state.railCollapsed ? "Expand controls panel" : "Collapse controls panel"
      }, this.state.railCollapsed ? /*#__PURE__*/React.createElement("i", {
        className: "fa fa-chevron-left",
        "aria-hidden": "true"
      }) : /*#__PURE__*/React.createElement("i", {
        className: "fa fa-chevron-right",
        "aria-hidden": "true"
      })))), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        className: "rail-stats"
      }, this.renderStats()), /*#__PURE__*/React.createElement("div", {
        className: "rail-tabs",
        role: "tablist",
        "aria-label": "Control categories"
      }, tabs.map(function (tab) {
        var isActive = self.state.railTab === tab.id;
        return /*#__PURE__*/React.createElement("button", {
          key: tab.id,
          className: "rail-tab" + (isActive ? " active" : ""),
          onClick: function () {
            self.setRailTab(tab.id);
          },
          role: "tab",
          "aria-selected": isActive,
          "aria-controls": "rail-panel-" + tab.id,
          "aria-label": tab.label
        }, /*#__PURE__*/React.createElement("i", {
          className: "fa " + tab.icon,
          "aria-hidden": "true"
        }), !self.state.railCollapsed && /*#__PURE__*/React.createElement("span", {
          className: "rail-tab-label"
        }, tab.label));
      })), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        id: "rail-panel-" + this.state.railTab,
        role: "tabpanel",
        "aria-label": this.state.railTab + " controls"
      }, tabContent), !this.state.railCollapsed && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 12px',
          borderTop: '1px solid var(--panel-border)'
        }
      }, this.renderLayoutSwitcher())), /*#__PURE__*/React.createElement("div", {
        className: "transport-strip",
        role: "toolbar",
        "aria-label": "Simulation transport"
      }, this.renderTransportControls(true)), this.state.railHidden && /*#__PURE__*/React.createElement("div", {
        className: "rail-reveal rail-reveal-" + railSide,
        onMouseEnter: this.toggleRailHidden
      }), this.renderMobileMinimapArea());
    },
    renderCartographerMobile: function (cs) {
      var sheetContent = this._buildSheetContent();
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-cartographer layout-mobile"
      }, this.renderCanvas(cs), !this.state.bottomSheetOpen && !this._statsChipHidden && this._renderStatsChip(), !this.state.bottomSheetOpen && this.renderMobileContextPanel(), !this.state.bottomSheetOpen && this.renderMobileMinimapArea(), this._renderMobileTransportBar(), this.state.bottomSheetOpen && this._renderBottomSheet(sheetContent));
    },
    // ── Observatory layout ───────────────────────────────────────────

    renderObservatory: function (cs) {
      var self = this;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        return this.renderObservatoryMobile(cs);
      }
      var panels = this.state.panelStates;
      var zenMode = this.state.zenMode;
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-observatory" + (zenMode ? " zen-mode" : "")
      }, this.renderCanvas(cs), !zenMode && /*#__PURE__*/React.createElement("div", {
        className: "panel-overlay-container",
        role: "group",
        "aria-label": "Floating control panels"
      }, this._renderFloatPanel('transport', 'Transport', this.renderTransportControls(false)), this._renderFloatPanel('view', 'View', this.renderViewControls()), this._renderFloatPanel('mode', 'Mode', this.renderModeControls()), this._renderFloatPanel('tools', 'Tools', this.renderToolsContent()), this._renderFloatPanel('board', 'Board', this.renderSliders()), this._renderFloatPanel('rules', 'Rules', this.renderRulesSection()), this._renderFloatPanel('stats', 'Stats', this.renderStats()), this._renderFloatPanel('importExport', 'Import / Export', this.renderExportContent()), /*#__PURE__*/React.createElement("div", {
        className: "panel-menu",
        role: "group",
        "aria-label": "Panel visibility"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: this.toggleHelp,
        "aria-label": "Help",
        title: "Keyboard shortcuts (?)"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-question-circle",
        "aria-hidden": "true"
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn panel-menu-toggle",
        onClick: function () {
          self.setState({
            panelMenuOpen: !self.state.panelMenuOpen
          });
        },
        "aria-expanded": !!this.state.panelMenuOpen,
        "aria-label": "Toggle panel visibility menu"
      }, /*#__PURE__*/React.createElement("i", {
        className: "fa fa-th",
        "aria-hidden": "true"
      })), this.state.panelMenuOpen && /*#__PURE__*/React.createElement("div", {
        className: "panel-menu-list",
        role: "group",
        "aria-label": "Panel toggles"
      }, ['transport', 'view', 'mode', 'tools', 'board', 'rules', 'stats', 'importExport'].map(function (id) {
        var label = id === 'importExport' ? 'Import / Export' : id.charAt(0).toUpperCase() + id.slice(1);
        return /*#__PURE__*/React.createElement("label", {
          key: id,
          className: "panel-menu-item"
        }, /*#__PURE__*/React.createElement("input", {
          type: "checkbox",
          checked: panels[id].open,
          onChange: function () {
            self._togglePanelOpen(id);
          },
          "aria-label": "Show " + label + " panel"
        }), /*#__PURE__*/React.createElement("span", null, label));
      })), this.renderLayoutSwitcher())), this.renderMobileMinimapArea());
    },
    renderObservatoryMobile: function (cs) {
      var sheetContent = this._buildSheetContent();
      return /*#__PURE__*/React.createElement("div", {
        className: "layout-observatory layout-mobile"
      }, this.renderCanvas(cs), this._renderMobileTransportBar(), !this.state.bottomSheetOpen && !this._statsChipHidden && this._renderStatsChip(), !this.state.bottomSheetOpen && this.renderMobileContextPanel(), !this.state.bottomSheetOpen && this.renderMobileMinimapArea(), this.state.bottomSheetOpen && this._renderBottomSheet(sheetContent));
    },
    // ── Float panel helper (Observatory) ─────────────────────────────

    _renderFloatPanel: function (panelId, label, content) {
      var self = this;
      var ps = this.state.panelStates[panelId];
      if (!ps || !ps.open) {
        return null;
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "float-panel float-panel-" + panelId.replace(/([A-Z])/g, '-$1').toLowerCase() + (ps.collapsed ? " float-panel-collapsed" : ""),
        style: ps.x >= 0 ? {
          left: ps.x,
          top: ps.y,
          right: 'auto',
          bottom: 'auto',
          transform: 'none'
        } : {},
        role: "region",
        "aria-label": label + " panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "float-panel-header",
        onMouseDown: function (e) {
          self._startPanelDrag(panelId, e);
        },
        onTouchStart: function (e) {
          self._startPanelDrag(panelId, e);
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "float-panel-title",
        id: "panel-title-" + panelId
      }, label), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-collapse",
        onClick: function () {
          self._togglePanelCollapse(panelId);
        },
        "aria-expanded": !ps.collapsed,
        "aria-label": ps.collapsed ? "Expand " + label + " panel" : "Collapse " + label + " panel"
      }, ps.collapsed ? "+" : "\u2013"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn float-panel-close",
        onClick: function () {
          self._togglePanelOpen(panelId);
        },
        "aria-label": "Close " + label + " panel"
      }, "\xD7")), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
        className: "float-panel-body"
      }, content), !ps.collapsed && /*#__PURE__*/React.createElement("div", {
        className: "float-panel-resize",
        onMouseDown: function (e) {
          self._startPanelResize(panelId, e);
        },
        onTouchStart: function (e) {
          self._startPanelResize(panelId, e);
        }
      }));
    },
    // ── Panel drag (Observatory) ─────────────────────────────────────

    _startPanelDrag: function (panelId, e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest && e.target.closest('button')) {
        return;
      }
      e.preventDefault();
      var panel = e.currentTarget.parentElement;
      var rect = panel.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      this._fpDragId = panelId;
      this._fpDragOffX = clientX - rect.left;
      this._fpDragOffY = clientY - rect.top;
      panel.classList.add('dragging');
      var self = this;
      this._fpDragMove = function (ev) {
        ev.preventDefault();
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        var newX = Math.max(0, Math.min(window.innerWidth - 60, cx - self._fpDragOffX));
        var newY = Math.max(0, Math.min(window.innerHeight - 40, cy - self._fpDragOffY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
      };
      this._fpDragEnd = function () {
        panel.classList.remove('dragging');
        var finalRect = panel.getBoundingClientRect();
        var panels = JSON.parse(JSON.stringify(self.state.panelStates));
        panels[panelId].x = finalRect.left;
        panels[panelId].y = finalRect.top;
        self.setState({
          panelStates: panels
        }, function () {
          self._persistLayout();
        });
        document.removeEventListener('mousemove', self._fpDragMove);
        document.removeEventListener('mouseup', self._fpDragEnd);
        document.removeEventListener('touchmove', self._fpDragMove);
        document.removeEventListener('touchend', self._fpDragEnd);
      };
      document.addEventListener('mousemove', this._fpDragMove);
      document.addEventListener('mouseup', this._fpDragEnd);
      document.addEventListener('touchmove', this._fpDragMove, {
        passive: false
      });
      document.addEventListener('touchend', this._fpDragEnd);
    },
    // ── Panel resize (Observatory) ───────────────────────────────────

    _startPanelResize: function (panelId, e) {
      e.preventDefault();
      e.stopPropagation();
      var panel = e.currentTarget.parentElement;
      var rect = panel.getBoundingClientRect();
      var startW = rect.width;
      var startH = rect.height;
      var startX = e.touches ? e.touches[0].clientX : e.clientX;
      var startY = e.touches ? e.touches[0].clientY : e.clientY;
      var move = function (ev) {
        ev.preventDefault();
        var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        panel.style.width = Math.max(180, startW + (cx - startX)) + 'px';
        panel.style.maxHeight = Math.max(80, startH + (cy - startY)) + 'px';
      };
      var end = function () {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', end);
      document.addEventListener('touchmove', move, {
        passive: false
      });
      document.addEventListener('touchend', end);
    },
    // ── Panel state helpers (Observatory) ────────────────────────────

    _togglePanelOpen: function (panelId) {
      var panels = JSON.parse(JSON.stringify(this.state.panelStates));
      panels[panelId].open = !panels[panelId].open;
      var self = this;
      this.setState({
        panelStates: panels
      }, function () {
        self._persistLayout();
      });
    },
    _togglePanelCollapse: function (panelId) {
      var panels = JSON.parse(JSON.stringify(this.state.panelStates));
      panels[panelId].collapsed = !panels[panelId].collapsed;
      var self = this;
      this.setState({
        panelStates: panels
      }, function () {
        self._persistLayout();
      });
    },
    // ── Main render ───────────────────────────────────────────────────

    render: function () {
      var cs = this.getCanvasSize();
      var layout = this.state.layoutMode;
      var dc = this.state.deviceClass;
      var isMobile = dc === 'phone-portrait' || dc === 'phone-landscape';
      if (isMobile) {
        layout = 'observatory';
      }
      var layoutContent;
      switch (layout) {
        case 'observatory':
          layoutContent = this.renderObservatory(cs);
          break;
        default:
          layoutContent = this.renderCartographer(cs);
      }
      return /*#__PURE__*/React.createElement("div", {
        className: "app-root layout-" + layout,
        role: "application",
        "aria-label": "Conway's Game of Life"
      }, /*#__PURE__*/React.createElement("a", {
        className: "skip-to-content",
        href: "#life-canvas"
      }, "Skip to simulation"), /*#__PURE__*/React.createElement("div", {
        className: "sr-only",
        "aria-live": "polite",
        "aria-atomic": "true"
      }, this.state.srAnnouncement), this.renderHelpModal(), this.renderPopGraph(), layoutContent);
    }
  });
  ReactDOM.render(/*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LifeBoard, null)), document.getElementById("content"));
});

//# sourceMappingURL=script.compiled.js.map