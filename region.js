/**
 * Region mask module for Game of Life multi-region bounding boxes.
 * Provides helpers for region mask management, connected component detection,
 * bounds computation, and region-aware flood fill.
 *
 * A region mask is a Set<string> of "r,c" keys defining in-bounds cells.
 *
 * Global exposed: RegionUtil
 * Dependencies: none
 */

var RegionUtil = { // eslint-disable-line no-unused-vars

    /**
     * Build a rectangular region mask from origin (0,0) with given cols/rows.
     * Returns a new Set<string>.
     */
    buildRect: function(cols, rows){
        const mask = new Set();
        for(let r = 0; r < rows; r++){
            for(let c = 0; c < cols; c++){
                mask.add(r + ',' + c);
            }
        }
        return mask;
    },

    /**
     * Compute the bounding rect of a region mask.
     * Returns {minR, maxR, minC, maxC} or null if mask is empty.
     */
    getBounds: function(mask){
        if(!mask || mask.size === 0){ return null; }
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        mask.forEach(function(key){
            const i = key.indexOf(',');
            const r = parseInt(key.substring(0, i), 10) || 0;
            const c = parseInt(key.substring(i + 1), 10) || 0;
            if(r < minR) minR = r;
            if(r > maxR) maxR = r;
            if(c < minC) minC = c;
            if(c > maxC) maxC = c;
        });
        return {minR: minR, maxR: maxR, minC: minC, maxC: maxC};
    },

    /**
     * Find connected components in the region mask using BFS (4-connectivity).
     * Returns an array of {cells: Set<string>, minR, maxR, minC, maxC}.
     */
    findComponents: function(mask){
        if(!mask || mask.size === 0){ return []; }
        const visited = new Set();
        const components = [];
        mask.forEach(function(key){
            if(visited.has(key)){ return; }
            // BFS from this cell.
            const comp = new Set();
            const queue = [key];
            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            while(queue.length > 0){
                const cur = queue.pop();
                if(visited.has(cur)){ continue; }
                visited.add(cur);
                comp.add(cur);
                const idx = cur.indexOf(',');
                const cr = parseInt(cur.substring(0, idx), 10) || 0;
                const cc = parseInt(cur.substring(idx + 1), 10) || 0;
                if(cr < minR) minR = cr;
                if(cr > maxR) maxR = cr;
                if(cc < minC) minC = cc;
                if(cc > maxC) maxC = cc;
                // 4-connected neighbors.
                const n1 = (cr - 1) + ',' + cc;
                const n2 = (cr + 1) + ',' + cc;
                const n3 = cr + ',' + (cc - 1);
                const n4 = cr + ',' + (cc + 1);
                if(mask.has(n1) && !visited.has(n1)) queue.push(n1);
                if(mask.has(n2) && !visited.has(n2)) queue.push(n2);
                if(mask.has(n3) && !visited.has(n3)) queue.push(n3);
                if(mask.has(n4) && !visited.has(n4)) queue.push(n4);
            }
            components.push({cells: comp, minR: minR, maxR: maxR, minC: minC, maxC: maxC});
        });
        return components;
    },

    /**
     * Check if a region mask is a single perfect rectangle matching [0,rows) x [0,cols).
     * Used for fast-path optimisation in simulation.
     */
    isSimpleRect: function(mask, cols, rows){
        if(!mask || mask.size !== cols * rows){ return false; }
        // Spot-check corners and a few interior cells.
        if(!mask.has('0,0') || !mask.has((rows - 1) + ',' + (cols - 1))){ return false; }
        if(!mask.has('0,' + (cols - 1)) || !mask.has((rows - 1) + ',0')){ return false; }
        return true;
    },

    /**
     * Build a bitmap (Uint8Array) from a region mask for fast O(1) lookups during rendering.
     * Returns {bitmap, minR, minC, width, height} or null if mask is empty.
     * Usage: bitmap[(r - minR) * width + (c - minC)] === 1 means in-region.
     */
    toBitmap: function(mask){
        const bounds = this.getBounds(mask);
        if(!bounds){ return null; }
        const width = bounds.maxC - bounds.minC + 1;
        const height = bounds.maxR - bounds.minR + 1;
        const bitmap = new Uint8Array(width * height);
        const minR = bounds.minR, minC = bounds.minC;
        mask.forEach(function(key){
            const i = key.indexOf(',');
            const r = parseInt(key.substring(0, i), 10) || 0;
            const c = parseInt(key.substring(i + 1), 10) || 0;
            bitmap[(r - minR) * width + (c - minC)] = 1;
        });
        return {bitmap: bitmap, minR: minR, minC: minC, width: width, height: height};
    },

    /**
     * Check membership using bitmap. Returns true if (r,c) is in the region.
     */
    bitmapHas: function(bm, r, c){
        if(!bm) return false;
        const lr = r - bm.minR;
        const lc = c - bm.minC;
        if(lr < 0 || lc < 0 || lr >= bm.height || lc >= bm.width) return false;
        return bm.bitmap[lr * bm.width + lc] === 1;
    },

    /**
     * BFS flood fill on region mask. Returns array of [r,c] keys to add or remove.
     * startInRegion: whether the starting cell is in the region (determines fill vs erase).
     */
    floodFillRegion: function(startR, startC, mask, maxCells){
        const max = maxCells || 100000;
        const startKey = startR + ',' + startC;
        const startInRegion = mask.has(startKey);
        const queue = [startKey];
        const visited = new Set();
        const result = [];
        while(queue.length > 0 && result.length < max){
            const cur = queue.pop();
            if(visited.has(cur)) continue;
            visited.add(cur);
            const inRegion = mask.has(cur);
            if(inRegion !== startInRegion) continue;
            result.push(cur);
            const idx = cur.indexOf(',');
            const cr = parseInt(cur.substring(0, idx), 10) || 0;
            const cc = parseInt(cur.substring(idx + 1), 10) || 0;
            const neighbors = [
                (cr - 1) + ',' + cc,
                (cr + 1) + ',' + cc,
                cr + ',' + (cc - 1),
                cr + ',' + (cc + 1)
            ];
            for(let ni = 0; ni < 4; ni++){
                if(!visited.has(neighbors[ni])) queue.push(neighbors[ni]);
            }
        }
        return result;
    },

    /**
     * Generate cells for rectangular region from (r1,c1) to (r2,c2) inclusive.
     * Returns array of "r,c" key strings.
     */
    rectKeys: function(r1, c1, r2, c2){
        const keys = [];
        const rMin = Math.min(r1, r2), rMax = Math.max(r1, r2);
        const cMin = Math.min(c1, c2), cMax = Math.max(c1, c2);
        for(let r = rMin; r <= rMax; r++){
            for(let c = cMin; c <= cMax; c++){
                keys.push(r + ',' + c);
            }
        }
        return keys;
    },

    /**
     * Generate cells for filled ellipse within bounding rect.
     * Returns array of "r,c" key strings.
     */
    ellipseKeys: function(r1, c1, r2, c2){
        const keys = [];
        const rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
        const cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
        const cx = (cc1 + cc2) / 2, cy = (rr1 + rr2) / 2;
        const rx = (cc2 - cc1) / 2, ry = (rr2 - rr1) / 2;
        for(let r = rr1; r <= rr2; r++){
            for(let c = cc1; c <= cc2; c++){
                const dx = rx > 0.001 ? (c - cx) / (rx + 0.5) : 0;
                const dy = ry > 0.001 ? (r - cy) / (ry + 0.5) : 0;
                if(dx * dx + dy * dy <= 1) keys.push(r + ',' + c);
            }
        }
        return keys;
    },

    /**
     * Generate cells for a Bresenham line.
     * Returns array of "r,c" key strings.
     */
    lineKeys: function(r0, c0, r1, c1){
        const keys = [];
        const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
        const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
        let err = dr - dc;
        while(true){
            keys.push(r0 + ',' + c0);
            if(r0 === r1 && c0 === c1) break;
            const e2 = 2 * err;
            if(e2 > -dc){ err -= dc; r0 += sr; }
            if(e2 < dr){ err += dr; c0 += sc; }
        }
        return keys;
    }
};
