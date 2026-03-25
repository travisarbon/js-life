/**
 * Pattern data for Conway's Game of Life.
 * Separated from main script for maintainability (R14).
 * All cells are [row, col] offsets (0-indexed from top-left of bounding box).
 *
 * Globals exposed: PATTERN_GROUPS, PATTERNS, PATTERN_META
 */

var PATTERN_GROUPS = { // eslint-disable-line no-unused-vars
    'Still lifes': {
        'Block':     [[0,0],[0,1],[1,0],[1,1]],
        'Beehive':   [[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],
        'Loaf':      [[0,1],[0,2],[1,0],[1,3],[2,1],[2,3],[3,2]],
        'Boat':      [[0,0],[0,1],[1,0],[1,2],[2,1]],
        'Tub':       [[0,1],[1,0],[1,2],[2,1]],
        'Ship':      [[0,0],[0,1],[1,0],[1,2],[2,1],[2,2]],
        'Barge':     [[0,1],[1,0],[1,2],[2,1],[2,3],[3,2]],
        'Long boat': [[0,0],[0,1],[1,0],[1,2],[2,1],[2,3],[3,2]],
        'Pond':      [[0,1],[0,2],[1,0],[1,3],[2,0],[2,3],[3,1],[3,2]]
    },
    'Oscillators': {
        'Blinker':        [[0,0],[0,1],[0,2]],
        'Toad':           [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],
        'Beacon':         [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
        'Pulsar':         [
                            [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
                            [2,0],[2,5],[2,7],[2,12],
                            [3,0],[3,5],[3,7],[3,12],
                            [4,0],[4,5],[4,7],[4,12],
                            [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
                            [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
                            [8,0],[8,5],[8,7],[8,12],
                            [9,0],[9,5],[9,7],[9,12],
                            [10,0],[10,5],[10,7],[10,12],
                            [12,2],[12,3],[12,4],[12,8],[12,9],[12,10]
                          ],
        // Period-15 oscillator.
        'Pentadecathlon': [[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],
        // Period-4 oscillator.
        'Mold':           [[0,1],[0,2],[0,3],[1,1],[1,3],[2,0],[2,2],[3,0],[3,1],[3,2]],
        // Period-14 oscillator.
        'Tumbler':        [[0,1],[0,2],[0,4],[0,5],
                           [1,1],[1,3],[1,5],
                           [2,0],[2,2],[2,4],[2,6],
                           [3,0],[3,1],[3,5],[3,6]],
        // Period-8 oscillator — two interacting traffic lights.
        'Figure eight':   [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],
                           [3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5]],
        // Period-30 oscillator — two queen bees shuttling.
        'Queen Bee Shuttle':[[0,9],[1,7],[1,9],[2,6],[2,8],[3,0],[3,1],[3,5],[3,10],[3,20],[3,21],[4,0],[4,1],[4,6],[4,10],[4,20],[4,21],[5,7],[5,9],[6,9]]
    },
    'Spaceships': {
        'Glider': [[0,1],[1,2],[2,0],[2,1],[2,2]],
        // Lightweight spaceship — moves horizontally.
        'LWSS':   [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
        // Middleweight spaceship.
        'MWSS':   [[0,3],[1,1],[1,5],[2,0],[3,0],[3,5],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // Heavyweight spaceship.
        'HWSS':   [[0,3],[0,4],[1,1],[1,6],[2,0],[3,0],[3,6],[4,0],[4,1],[4,2],[4,3],[4,4],[4,5]],
        // Loafer: c/7 orthogonal spaceship, discovered 2013.
        'Loafer': [[0,1],[0,2],[0,5],[0,7],[0,8],[1,0],[1,3],[1,6],[1,7],[2,1],[2,3],[3,2],[4,8],[5,6],[5,7],[5,8],[6,5],[7,6],[8,7],[8,8]],
        // Copperhead: c/10 orthogonal spaceship, discovered 2016.
        'Copperhead': [[0,1],[0,2],[0,5],[0,6],[1,3],[1,4],[2,3],[2,4],[3,0],[3,2],[3,5],[3,7],[4,0],[4,7],[6,0],[6,7],[7,1],[7,2],[7,5],[7,6],[8,2],[8,3],[8,4],[8,5],[10,3],[10,4],[11,3],[11,4]]
    },
    'Methuselahs': {
        'R-pentomino':  [[0,1],[0,2],[1,0],[1,1],[2,1]],
        'Acorn':        [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]],
        // Diehard: vanishes completely after 130 generations.
        'Diehard':      [[0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]],
        // Pi heptomino: stabilises after 173 generations.
        'Pi heptomino': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2]],
        // Thunderbird: lives 243 generations.
        'Thunderbird':  [[0,0],[0,1],[0,2],[1,1],[2,1],[3,1]],
        // Herschel: 7-cell signal used in conduit chains.
        'Herschel':     [[0,0],[1,0],[1,1],[1,2],[2,0],[2,2],[3,2]],
        // Rabbits: stabilises after 17,331 generations with 1,744 cells.
        'Rabbits':      [[0,0],[0,4],[0,5],[0,6],[1,0],[1,1],[1,2],[1,5],[2,1]]
    },
    'Guns': {
        'Gosper Glider Gun': [
                            [0,24],
                            [1,22],[1,24],
                            [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
                            [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
                            [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
                            [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
                            [6,10],[6,16],[6,24],
                            [7,11],[7,15],
                            [8,12],[8,13]
                          ],
        // Simkin glider gun: period 120, more compact than Gosper.
        'Simkin Glider Gun': [
                            [0,0],[0,1],[0,7],[0,8],
                            [1,0],[1,1],[1,7],[1,8],
                            [4,4],[4,5],
                            [5,4],[5,5],
                            [10,2],[10,3],[11,2],[11,3],
                            [15,25],[15,26],
                            [16,24],[16,28],
                            [17,24],[17,28],
                            [18,25],[18,27],
                            [19,26],
                            [20,24],[20,25],[20,26],
                            [23,22],[23,23],
                            [24,22],[24,23]
                          ]
    }
};

// Flat lookup keyed by pattern name for O(1) access.
var PATTERNS = {}; // eslint-disable-line no-unused-vars
Object.keys(PATTERN_GROUPS).forEach(function(group){
    Object.keys(PATTERN_GROUPS[group]).forEach(function(name){
        PATTERNS[name] = PATTERN_GROUPS[group][name];
    });
});

// Metadata for pattern tooltips (period, type, cell count, notes).
var PATTERN_META = { // eslint-disable-line no-unused-vars
    'Block':               { type: 'Still life',  cells: 4 },
    'Beehive':             { type: 'Still life',  cells: 6 },
    'Loaf':                { type: 'Still life',  cells: 7 },
    'Boat':                { type: 'Still life',  cells: 5 },
    'Tub':                 { type: 'Still life',  cells: 4 },
    'Ship':                { type: 'Still life',  cells: 6 },
    'Barge':               { type: 'Still life',  cells: 6 },
    'Long boat':           { type: 'Still life',  cells: 7 },
    'Pond':                { type: 'Still life',  cells: 8 },
    'Blinker':             { type: 'Oscillator',  period: 2,  cells: 3 },
    'Toad':                { type: 'Oscillator',  period: 2,  cells: 6 },
    'Beacon':              { type: 'Oscillator',  period: 2,  cells: 6 },
    'Pulsar':              { type: 'Oscillator',  period: 3,  cells: 48 },
    'Pentadecathlon':      { type: 'Oscillator',  period: 15, cells: 12 },
    'Mold':                { type: 'Oscillator',  period: 4,  cells: 10 },
    'Tumbler':             { type: 'Oscillator',  period: 14, cells: 15 },
    'Figure eight':        { type: 'Oscillator',  period: 8,  cells: 18 },
    'Queen Bee Shuttle':   { type: 'Oscillator',  period: 30, cells: 20 },
    'Glider':              { type: 'Spaceship',   period: 4,  cells: 5,  note: 'c/4 diagonal' },
    'LWSS':                { type: 'Spaceship',   period: 4,  cells: 9,  note: 'c/2 orthogonal' },
    'MWSS':                { type: 'Spaceship',   period: 4,  cells: 11, note: 'c/2 orthogonal' },
    'HWSS':                { type: 'Spaceship',   period: 4,  cells: 13, note: 'c/2 orthogonal' },
    'Loafer':              { type: 'Spaceship',   period: 7,  cells: 20, note: 'c/7 orthogonal' },
    'Copperhead':          { type: 'Spaceship',   period: 10, cells: 28, note: 'c/10 orthogonal' },
    'R-pentomino':         { type: 'Methuselah',  lifespan: 1103, cells: 5 },
    'Acorn':               { type: 'Methuselah',  lifespan: 5206, cells: 7 },
    'Diehard':             { type: 'Methuselah',  lifespan: 130,  cells: 7 },
    'Pi heptomino':        { type: 'Methuselah',  lifespan: 173,  cells: 7 },
    'Thunderbird':         { type: 'Methuselah',  lifespan: 243,  cells: 6 },
    'Herschel':            { type: 'Methuselah',  lifespan: 128,  cells: 7 },
    'Rabbits':             { type: 'Methuselah',  lifespan: 17331, cells: 9 },
    'Gosper Glider Gun':   { type: 'Gun',         period: 30, cells: 36 },
    'Simkin Glider Gun':   { type: 'Gun',         period: 120, cells: 32 }
};

export { PATTERN_GROUPS, PATTERNS, PATTERN_META };
