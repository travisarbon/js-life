/**
 * Simulation runner module for Game of Life (R04, R07).
 * Provides a unified interface for both SimEngine (toroidal) and HashLife
 * (finite/unbounded) backends.
 *
 * Global exposed: SimRunner
 * Dependencies: HashLife, SimEngine, parseKey, overlayAges, MAX_HL_COORD, HL_GC_THRESHOLD
 */

var SimRunner = {

    // ── Internal HashLife state ──────────────────────────────────────────────
    _hlRoot: null,
    _hlOffR: 0,
    _hlOffC: 0,
    _hlStale: true,
    _hlRuleKey: null,

    // ── Public API ───────────────────────────────────────────────────────────

    /** Mark the HashLife tree as needing rebuild (call on boundary/rule change). */
    invalidate: function(){
        this._hlStale = true;
    },

    /** Run GC on the HashLife node pool if it exceeds the threshold. */
    gcIfNeeded: function(){
        if(HashLife.poolSize() > HL_GC_THRESHOLD){
            HashLife.gc(this._hlRoot);
        }
    },

    /**
     * Advance simulation by 1 generation.
     * Returns a new Map<"r,c", age> representing the next board state.
     * Dispatches to SimEngine (toroidal) or HashLife (finite/unbounded).
     */
    step: function(liveCells, cols, rows, birth, survive, boundary){
        if(boundary === 'toroidal'){
            return SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
        }
        // HashLife path.
        var newLiveCells = this._hashLifeStep(liveCells, birth, survive);
        if(boundary === 'finite'){
            var clipped = new Map();
            newLiveCells.forEach(function(age, key){
                var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r >= 0 && r < rows && c >= 0 && c < cols){
                    clipped.set(key, age);
                }
            });
            this._hlStale = true;
            return clipped;
        }
        return newLiveCells;
    },

    /**
     * Advance simulation by N generations (batch).
     * For unbounded: uses HashLife batch (keeps quadtree between steps).
     * For toroidal/finite: per-step loop.
     * Returns { liveCells, pops: number[], peak: number }.
     */
    stepN: function(liveCells, cols, rows, birth, survive, boundary, n){
        if(boundary === 'unbounded'){
            return this._hashLifeBatchStep(liveCells, birth, survive, n);
        }
        // Toroidal / finite: per-step loop.
        var gen = 0;
        var pops = [];
        var peak = 0;
        var isToroidal = boundary === 'toroidal';
        for(var i = 0; i < n; i++){
            if(isToroidal){
                liveCells = SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, boundary);
            } else {
                liveCells = this._hashLifeStep(liveCells, birth, survive);
                var clipped = new Map();
                liveCells.forEach(function(age, key){
                    var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                    if(r >= 0 && r < rows && c >= 0 && c < cols){
                        clipped.set(key, age);
                    }
                });
                liveCells = clipped;
                this._hlStale = true;
            }
            var pop = liveCells.size;
            pops.push(pop);
            if(pop > peak){ peak = pop; }
        }
        return { liveCells: liveCells, pops: pops, peak: peak };
    },

    // ── Internal HashLife methods ────────────────────────────────────────────

    _ensureRules: function(birth, survive){
        var ruleKey = birth.join(',') + '/' + survive.join(',');
        if(ruleKey !== this._hlRuleKey){
            HashLife.init(birth, survive);
            this._hlRuleKey = ruleKey;
            this._hlStale = true;
        }
    },

    _rebuildIfStale: function(liveCells){
        if(this._hlStale || !this._hlRoot){
            var cells = [];
            liveCells.forEach(function(age, key){
                var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r > -MAX_HL_COORD && r < MAX_HL_COORD && c > -MAX_HL_COORD && c < MAX_HL_COORD){
                    cells.push([r, c]);
                }
            });
            var tree = HashLife.fromCellList(cells);
            this._hlRoot = tree.root;
            this._hlOffR = tree.offR;
            this._hlOffC = tree.offC;
            this._hlStale = false;
        }
    },

    _advanceOne: function(){
        while(HashLife.needsExpand(this._hlRoot)){
            var lvl = this._hlRoot.level;
            this._hlRoot = HashLife.expandTree(this._hlRoot);
            this._hlOffR += (1 << (lvl - 1));
            this._hlOffC += (1 << (lvl - 1));
        }
        var level = this._hlRoot.level;
        this._hlRoot = HashLife.expandTree(this._hlRoot);
        this._hlOffR += (1 << (level - 1));
        this._hlOffC += (1 << (level - 1));

        level = this._hlRoot.level;
        this._hlRoot = HashLife.advance(this._hlRoot, 1);
        this._hlOffR -= (1 << (level - 2));
        this._hlOffC -= (1 << (level - 2));

        var prevLevel = this._hlRoot.level;
        this._hlRoot = HashLife.trimTree(this._hlRoot);
        var newLevel = this._hlRoot.level;
        for(var lv = prevLevel; lv > newLevel; lv--){
            this._hlOffR -= (1 << (lv - 2));
            this._hlOffC -= (1 << (lv - 2));
        }
    },

    _hashLifeStep: function(liveCells, birth, survive){
        this._ensureRules(birth, survive);
        this._rebuildIfStale(liveCells);
        this._advanceOne();
        var newCells = HashLife.toCellList(this._hlRoot, this._hlOffR, this._hlOffC);
        var result = overlayAges(liveCells, newCells);
        this.gcIfNeeded();
        return result;
    },

    _hashLifeBatchStep: function(liveCells, birth, survive, numGens){
        this._ensureRules(birth, survive);
        this._rebuildIfStale(liveCells);
        var pops = [];
        var peak = 0;
        for(var i = 0; i < numGens; i++){
            this._advanceOne();
            var pop = this._hlRoot.population;
            pops.push(pop);
            if(pop > peak){ peak = pop; }
        }
        var newCells = HashLife.toCellList(this._hlRoot, this._hlOffR, this._hlOffC);
        var result = overlayAges(liveCells, newCells, numGens);
        this.gcIfNeeded();
        return { liveCells: result, pops: pops, peak: peak };
    }
};
