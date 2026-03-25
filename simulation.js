import { SimEngine, parseKey, overlayAges, MAX_HL_COORD, HL_GC_THRESHOLD } from './constants.js';
import { HashLife } from './hashlife.js';
import { RegionUtil } from './region.js';
/**
 * Simulation runner module for Game of Life (R04, R07).
 * Provides a unified interface for both SimEngine (toroidal) and HashLife
 * (finite/unbounded) backends.
 *
 * Supports multi-region bounding boxes via regionMask / regionComponents.
 *
 * Global exposed: SimRunner
 */

var SimRunner = { // eslint-disable-line no-unused-vars

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
     *
     * regionMask: Set<string> of in-bounds cells (used for finite clipping).
     * regionComponents: array of {cells, minR, maxR, minC, maxC} (used for toroidal).
     */
    step: function(liveCells, cols, rows, birth, survive, boundary, regionMask, regionComponents){
        if(boundary === 'toroidal'){
            return this._toroidalStep(liveCells, cols, rows, birth, survive, regionMask, regionComponents);
        }
        // HashLife path.
        const newLiveCells = this._hashLifeStep(liveCells, birth, survive);
        if(boundary === 'finite'){
            // Clip to region mask (or fall back to rectangular bounds).
            if(regionMask && regionMask.size > 0){
                const clipped = new Map();
                newLiveCells.forEach(function(age, key){
                    if(regionMask.has(key)){
                        clipped.set(key, age);
                    }
                });
                if(clipped.size !== newLiveCells.size){ this._hlStale = true; }
                return clipped;
            }
            const clippedRect = new Map();
            newLiveCells.forEach(function(age, key){
                const _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r >= 0 && r < rows && c >= 0 && c < cols){
                    clippedRect.set(key, age);
                }
            });
            if(clippedRect.size !== newLiveCells.size){ this._hlStale = true; }
            return clippedRect;
        }
        return newLiveCells;
    },

    /**
     * Toroidal step: run each connected component independently with its own
     * bounding rect for modulo wrapping. Cells outside the region mask within
     * each component's bounding rect are treated as dead walls.
     */
    _toroidalStep: function(liveCells, cols, rows, birth, survive, regionMask, regionComponents){
        // Fast path: single rectangular component matching cols×rows — use original SimEngine.
        if(!regionComponents || regionComponents.length <= 1){
            if(!regionMask || RegionUtil.isSimpleRect(regionMask, cols, rows)){
                return SimEngine.computeNextGeneration(liveCells, cols, rows, birth, survive, 'toroidal');
            }
        }

        // Multi-component or non-rectangular: per-component toroidal simulation.
        const result = new Map();
        const components = regionComponents || [{
            cells: regionMask,
            minR: 0, maxR: rows - 1, minC: 0, maxC: cols - 1
        }];

        for(let ci = 0; ci < components.length; ci++){
            const comp = components[ci];
            const compCols = comp.maxC - comp.minC + 1;
            const compRows = comp.maxR - comp.minR + 1;
            if(compCols <= 0 || compRows <= 0) continue;

            // Extract live cells belonging to this component.
            const compLive = new Map();
            liveCells.forEach(function(age, key){
                if(comp.cells.has(key)){
                    // Translate to local coordinates (0-based within component bounding rect).
                    const _rc = parseKey(key);
                    const localR = _rc[0] - comp.minR;
                    const localC = _rc[1] - comp.minC;
                    compLive.set(localR + ',' + localC, age);
                }
            });

            // Build a local mask for the component (translated to 0-based).
            const localMask = new Set();
            comp.cells.forEach(function(key){
                const i = key.indexOf(',');
                const r = parseInt(key.substring(0, i), 10) - comp.minR;
                const c = parseInt(key.substring(i + 1), 10) - comp.minC;
                localMask.add(r + ',' + c);
            });

            // Run toroidal simulation within component bounding rect.
            const compNext = SimEngine.computeNextGenerationMasked(
                compLive, compCols, compRows, birth, survive, localMask
            );

            // Translate results back to global coordinates and add to result.
            compNext.forEach(function(age, key){
                const _rc = parseKey(key);
                const globalR = _rc[0] + comp.minR;
                const globalC = _rc[1] + comp.minC;
                const globalKey = globalR + ',' + globalC;
                // Only keep if in the component's region mask.
                if(comp.cells.has(globalKey)){
                    result.set(globalKey, age);
                }
            });
        }

        return result;
    },

    /**
     * Advance simulation by N generations (batch).
     * For unbounded: uses HashLife batch (keeps quadtree between steps).
     * For toroidal/finite: per-step loop.
     * Returns { liveCells, pops: number[], peak: number }.
     */
    stepN: function(liveCells, cols, rows, birth, survive, boundary, n, regionMask, regionComponents){
        if(boundary === 'unbounded'){
            return this._hashLifeBatchStep(liveCells, birth, survive, n);
        }
        // Toroidal / finite: per-step loop.
        const pops = [];
        let peak = 0;
        for(let i = 0; i < n; i++){
            liveCells = this.step(liveCells, cols, rows, birth, survive, boundary, regionMask, regionComponents);
            const pop = liveCells.size;
            pops.push(pop);
            if(pop > peak){ peak = pop; }
        }
        return { liveCells: liveCells, pops: pops, peak: peak };
    },

    // ── Internal HashLife methods ────────────────────────────────────────────

    _ensureRules: function(birth, survive){
        const ruleKey = birth.join(',') + '/' + survive.join(',');
        if(ruleKey !== this._hlRuleKey){
            HashLife.init(birth, survive);
            this._hlRuleKey = ruleKey;
            this._hlStale = true;
        }
    },

    _rebuildIfStale: function(liveCells){
        if(this._hlStale || !this._hlRoot){
            const cells = [];
            liveCells.forEach(function(age, key){
                const _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r > -MAX_HL_COORD && r < MAX_HL_COORD && c > -MAX_HL_COORD && c < MAX_HL_COORD){
                    cells.push([r, c]);
                }
            });
            const tree = HashLife.fromCellList(cells);
            this._hlRoot = tree.root;
            this._hlOffR = tree.offR;
            this._hlOffC = tree.offC;
            this._hlStale = false;
        }
    },

    _advanceOne: function(){
        while(HashLife.needsExpand(this._hlRoot)){
            const lvl = this._hlRoot.level;
            this._hlRoot = HashLife.expandTree(this._hlRoot);
            this._hlOffR += (1 << (lvl - 1));
            this._hlOffC += (1 << (lvl - 1));
        }
        let level = this._hlRoot.level;
        this._hlRoot = HashLife.expandTree(this._hlRoot);
        this._hlOffR += (1 << (level - 1));
        this._hlOffC += (1 << (level - 1));

        level = this._hlRoot.level;
        this._hlRoot = HashLife.advance(this._hlRoot, 1);
        this._hlOffR -= (1 << (level - 2));
        this._hlOffC -= (1 << (level - 2));

        const prevLevel = this._hlRoot.level;
        this._hlRoot = HashLife.trimTree(this._hlRoot);
        const newLevel = this._hlRoot.level;
        for(let lv = prevLevel; lv > newLevel; lv--){
            this._hlOffR -= (1 << (lv - 2));
            this._hlOffC -= (1 << (lv - 2));
        }
    },

    _hashLifeStep: function(liveCells, birth, survive){
        this._ensureRules(birth, survive);
        this._rebuildIfStale(liveCells);
        this._advanceOne();
        const newCells = HashLife.toCellList(this._hlRoot, this._hlOffR, this._hlOffC);
        const result = overlayAges(liveCells, newCells);
        this.gcIfNeeded();
        return result;
    },

    _hashLifeBatchStep: function(liveCells, birth, survive, numGens){
        this._ensureRules(birth, survive);
        this._rebuildIfStale(liveCells);
        const pops = [];
        let peak = 0;
        for(let i = 0; i < numGens; i++){
            this._advanceOne();
            const pop = this._hlRoot.population;
            pops.push(pop);
            if(pop > peak){ peak = pop; }
        }
        const newCells = HashLife.toCellList(this._hlRoot, this._hlOffR, this._hlOffC);
        const result = overlayAges(liveCells, newCells, numGens);
        this.gcIfNeeded();
        return { liveCells: result, pops: pops, peak: peak };
    }
};

export { SimRunner };
