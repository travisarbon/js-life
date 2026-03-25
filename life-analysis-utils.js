/* global SimRunner, SimEngine, HashLife, parseKey, overlayAges, LifeViewUtils, GIF */
/**
 * Pattern analysis, help, and GIF recording utils for LifeBoard component.
 */
var _gcd = function(a, b){ return b === 0 ? a : _gcd(b, a % b); };

var LifeAnalysisUtils = { // eslint-disable-line no-unused-vars

    // ── Help modal ─────────────────────────────────────────────────────

    toggleHelp : function(stateRef, refs, dispatch){
        const opening = !stateRef.current.showHelp;
        if(opening){ LifeViewUtils._saveFocus(stateRef, refs, dispatch); }
        dispatch({type:'MERGE', payload:{showHelp : opening}});
        if(opening){ LifeViewUtils._focusFirst(stateRef, refs, dispatch, '.help-modal'); }
        else { LifeViewUtils._restoreFocus(stateRef, refs, dispatch); }
    },

    // ── GIF recording ─────────────────────────────────────────────────

    toggleRecording : function(stateRef, refs, dispatch){
        if(stateRef.current.recording){
            // Stop recording and render.
            if(refs.gif){ refs.gif.render(); }
            dispatch({type:'MERGE', payload:{recording: false}});
        } else {
            // Start recording (requires gif.js loaded).
            if(typeof GIF === 'undefined'){
                LifeViewUtils._announce(stateRef, refs, dispatch, 'gif.js is not loaded. Add it to index.html to enable GIF export.');
                return;
            }
            refs.gif = new GIF({
                workers:   2,
                quality:   10,
                workerScript: 'js/gif.worker.js'
            });
            refs.gif.on('finished', function(blob){
                const url  = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'life-gen' + stateRef.current.generations + '.gif';
                link.click();
                setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
                refs.gif = null;
            });
            dispatch({type:'MERGE', payload:{recording: true}});
        }
    },

    togglePopGraph : function(stateRef, refs, dispatch){
        const opening = !stateRef.current.showPopGraph;
        if(opening){ LifeViewUtils._saveFocus(stateRef, refs, dispatch); }
        dispatch({type:'MERGE', payload:{showPopGraph: opening}});
        if(opening){ LifeViewUtils._focusFirst(stateRef, refs, dispatch, '.pop-graph-modal'); }
        else { LifeViewUtils._restoreFocus(stateRef, refs, dispatch); }
    },

    analyzePattern : function(stateRef, refs, dispatch){
        if(stateRef.current.analyzing){ return; }
        const liveCells = stateRef.current.liveCells;
        if(liveCells.size === 0){
            dispatch({type:'MERGE', payload:{analysisResult: 'No live cells to analyze.'}});
            setTimeout(function(){ dispatch({type:'MERGE', payload:{analysisResult: null}}); }, 3000);
            return;
        }
        refs.analysisCancelled = false;
        const pop = liveCells.size;
        // Scale generation limit based on population to keep analysis responsive.
        const maxGens = pop > 1000 ? 200 : pop > 500 ? 500 : 2000;
        dispatch({type:'MERGE', payload:{analyzing: true, analysisResult: 'Analyzing\u2026 gen 0/' + maxGens + ' (click to cancel)'}});
        const cols = stateRef.current.cols;
        const rows = stateRef.current.rows;
        const birth = stateRef.current.birthRule;
        const survive = stateRef.current.surviveRule;
        const boundary = stateRef.current.boundary;
        const chunkSize = 50;

        // Order-independent O(n) hash using Szudzik pairing + XOR mixing.
        function hashBoard(lc){
            let h1 = 0, h2 = 0, count = 0;
            lc.forEach(function(age, key){
                const _rc = parseKey(key), r = _rc[0], c = _rc[1];
                const paired = r >= c ? r * r + r + c : c * c + r;
                h1 = (h1 + paired) | 0;
                h2 = (h2 ^ Math.imul(paired, 2654435761)) | 0;
                count++;
            });
            return count + '|' + h1 + '|' + h2;
        }

        // Get bounding box center.
        function bbox(lc){
            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            lc.forEach(function(age, key){
                const _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r < minR) minR = r; if(r > maxR) maxR = r;
                if(c < minC) minC = c; if(c > maxC) maxC = c;
            });
            return {cr: (minR + maxR) / 2, cc: (minC + maxC) / 2};
        }

        const hashes = new Map();
        let current = liveCells;
        const initBBox = bbox(current);
        hashes.set(hashBoard(current), {gen: 0, cr: initBBox.cr, cc: initBBox.cc});
        let gen = 0;
        const analysisStartTime = Date.now();

        // Build a local HashLife tree for analysis (separate from main sim state).
        const aRuleKey = birth.join(',') + '/' + survive.join(',');
        const savedHlRuleKey = SimRunner._hlRuleKey;
        if(aRuleKey !== SimRunner._hlRuleKey){
            HashLife.init(birth, survive);
            SimRunner.invalidate();
        }
        const aCells = [];
        current.forEach(function(age, key){
            aCells.push(parseKey(key));
        });
        const aTree = HashLife.fromCellList(aCells);
        let aRoot = aTree.root, aOffR = aTree.offR, aOffC = aTree.offC;

        function finishAnalysis(msg, duration){
            // Restore main simulation's rule key that may have been overwritten.
            SimRunner._hlRuleKey = savedHlRuleKey;
            dispatch({type:'MERGE', payload:{analysisResult: msg, analyzing: false}});
            setTimeout(function(){ dispatch({type:'MERGE', payload:{analysisResult: null}}); }, duration || 5000);
        }

        function analyzeStep(){
            // Advance the local HashLife tree by 1 gen.
            if(boundary === 'toroidal'){
                current = SimEngine.computeNextGeneration(current, cols, rows, birth, survive, boundary);
                return;
            }
            let level = aRoot.level;
            aRoot = HashLife.expandTree(aRoot);
            aOffR += (1 << (level - 1));
            aOffC += (1 << (level - 1));
            level = aRoot.level;
            aRoot = HashLife.advance(aRoot, 1);
            aOffR -= (1 << (level - 2));
            aOffC -= (1 << (level - 2));
            const pLvl = aRoot.level;
            aRoot = HashLife.trimTree(aRoot);
            for(let l = pLvl; l > aRoot.level; l--){
                aOffR -= (1 << (l - 2));
                aOffC -= (1 << (l - 2));
            }
            const newCells = HashLife.toCellList(aRoot, aOffR, aOffC);
            current = overlayAges(current, newCells);
            if(boundary === 'finite'){
                const clipped = new Map();
                current.forEach(function(age, key){
                    const _rc = parseKey(key), r = _rc[0], c = _rc[1];
                    if(r >= 0 && r < rows && c >= 0 && c < cols){
                        clipped.set(key, age);
                    }
                });
                current = clipped;
            }
        }

        function runChunk(){
            if(refs.analysisCancelled){ return; }
            if(Date.now() - analysisStartTime > 10000){
                finishAnalysis('Timed out after 10s (' + gen + ' gens analyzed).');
                return;
            }
            const end = Math.min(gen + chunkSize, maxGens);
            while(gen < end){
                analyzeStep();
                gen++;
                const h = hashBoard(current);
                if(hashes.has(h)){
                    const prev = hashes.get(h);
                    const period = gen - prev.gen;
                    const bb = bbox(current);
                    const dr = Math.abs(bb.cr - prev.cr);
                    const dc = Math.abs(bb.cc - prev.cc);
                    let msg;
                    if(period === 1 && dr < 0.01 && dc < 0.01){
                        msg = 'Still life (stable)';
                    } else if(dr < 0.01 && dc < 0.01){
                        msg = 'Oscillator \u2014 period ' + period;
                    } else {
                        const speed = Math.max(dr, dc);
                        const sn = Math.round(speed);
                        const g = _gcd(sn, period);
                        const num = sn / g;
                        const den = period / g;
                        const dir = (dr > dc + 0.01) ? (dc > 0.01 ? 'diagonal' : 'vertical')
                                 : (dc > dr + 0.01 ? 'horizontal' : 'diagonal');
                        msg = 'Spaceship \u2014 ' + (num === 1 ? 'c' : num + 'c') + '/' + den + ' ' + dir + ', period ' + period;
                    }
                    finishAnalysis(msg, 6000);
                    return;
                }
                const bb2 = bbox(current);
                hashes.set(h, {gen: gen, cr: bb2.cr, cc: bb2.cc});
                if(current.size === 0){
                    finishAnalysis('Pattern dies at generation ' + gen + '.');
                    return;
                }
            }
            if(gen >= maxGens){
                finishAnalysis('No periodicity detected (' + maxGens + ' gens).');
            } else {
                // Update progress and yield to UI.
                dispatch({type:'MERGE', payload:{analysisResult: 'Analyzing\u2026 gen ' + gen + '/' + maxGens + ' (click to cancel)'}});
                setTimeout(runChunk, 0);
            }
        }
        setTimeout(runChunk, 0);
    },

    cancelAnalysis : function(stateRef, refs, dispatch){
        refs.analysisCancelled = true;
        dispatch({type:'MERGE', payload:{analysisResult: 'Analysis cancelled.', analyzing: false}});
        setTimeout(function(){ dispatch({type:'MERGE', payload:{analysisResult: null}}); }, 2000);
    },
};
