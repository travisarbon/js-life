/* global SimRunner, SimEngine, HashLife, parseKey, overlayAges */
/**
 * Pattern analysis, help, and GIF recording mixin for LifeBoard component.
 */
var LifeAnalysisMixin = { // eslint-disable-line no-unused-vars

    // ── Help modal ─────────────────────────────────────────────────────

    toggleHelp : function(){
        var opening = !this.state.showHelp;
        if(opening){ this._saveFocus(); }
        var self = this;
        this.setState({showHelp : opening}, function(){
            if(opening){ self._focusFirst('.help-modal'); }
            else { self._restoreFocus(); }
        });
    },

    // ── GIF recording ─────────────────────────────────────────────────

    toggleRecording : function(){
        if(this.state.recording){
            // Stop recording and render.
            if(this._gif){ this._gif.render(); }
            this.setState({recording: false});
        } else {
            // Start recording (requires gif.js loaded).
            if(typeof GIF === 'undefined'){
                this._announce('gif.js is not loaded. Add it to index.html to enable GIF export.');
                return;
            }
            var self = this;
            this._gif = new GIF({
                workers:   2,
                quality:   10,
                workerScript: 'js/gif.worker.js'
            });
            this._gif.on('finished', function(blob){
                var url  = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = 'life-gen' + self.state.generations + '.gif';
                link.click();
                setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
                self._gif = null;
            });
            this.setState({recording: true});
        }
    },

    togglePopGraph : function(){
        var opening = !this.state.showPopGraph;
        if(opening){ this._saveFocus(); }
        var self = this;
        this.setState({showPopGraph: opening}, function(){
            if(opening){ self._focusFirst('.pop-graph-modal'); }
            else { self._restoreFocus(); }
        });
    },

    analyzePattern : function(){
        if(this.state.analyzing){ return; }
        var liveCells = this.state.liveCells;
        if(liveCells.size === 0){
            this.setState({analysisResult: 'No live cells to analyze.'});
            var self0 = this;
            setTimeout(function(){ self0.setState({analysisResult: null}); }, 3000);
            return;
        }
        this._analysisCancelled = false;
        var pop = liveCells.size;
        // Scale generation limit based on population to keep analysis responsive.
        var maxGens = pop > 1000 ? 200 : pop > 500 ? 500 : 2000;
        this.setState({analyzing: true, analysisResult: 'Analyzing\u2026 gen 0/' + maxGens + ' (click to cancel)'});
        var self = this;
        var cols = this.state.cols;
        var rows = this.state.rows;
        var birth = this.state.birthRule;
        var survive = this.state.surviveRule;
        var boundary = this.state.boundary;
        var chunkSize = 50;

        // Order-independent O(n) hash using Szudzik pairing + XOR mixing.
        function hashBoard(lc){
            var h1 = 0, h2 = 0, count = 0;
            lc.forEach(function(age, key){
                var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                var paired = r >= c ? r * r + r + c : c * c + r;
                h1 = (h1 + paired) | 0;
                h2 = (h2 ^ Math.imul(paired, 2654435761)) | 0;
                count++;
            });
            return count + '|' + h1 + '|' + h2;
        }

        // Get bounding box center.
        function bbox(lc){
            var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            lc.forEach(function(age, key){
                var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                if(r < minR) minR = r; if(r > maxR) maxR = r;
                if(c < minC) minC = c; if(c > maxC) maxC = c;
            });
            return {cr: (minR + maxR) / 2, cc: (minC + maxC) / 2};
        }

        var hashes = new Map();
        var current = liveCells;
        var initBBox = bbox(current);
        hashes.set(hashBoard(current), {gen: 0, cr: initBBox.cr, cc: initBBox.cc});
        var gen = 0;
        var analysisStartTime = Date.now();

        // Build a local HashLife tree for analysis (separate from main sim state).
        var aRuleKey = birth.join(',') + '/' + survive.join(',');
        var savedHlRuleKey = SimRunner._hlRuleKey;
        if(aRuleKey !== SimRunner._hlRuleKey){
            HashLife.init(birth, survive);
            SimRunner.invalidate();
        }
        var aCells = [];
        current.forEach(function(age, key){
            aCells.push(parseKey(key));
        });
        var aTree = HashLife.fromCellList(aCells);
        var aRoot = aTree.root, aOffR = aTree.offR, aOffC = aTree.offC;

        function finishAnalysis(msg, duration){
            // Restore main simulation's rule key that may have been overwritten.
            SimRunner._hlRuleKey = savedHlRuleKey;
            self.setState({analysisResult: msg, analyzing: false});
            setTimeout(function(){ self.setState({analysisResult: null}); }, duration || 5000);
        }

        function analyzeStep(){
            // Advance the local HashLife tree by 1 gen.
            if(boundary === 'toroidal'){
                current = SimEngine.computeNextGeneration(current, cols, rows, birth, survive, boundary);
                return;
            }
            var level = aRoot.level;
            aRoot = HashLife.expandTree(aRoot);
            aOffR += (1 << (level - 1));
            aOffC += (1 << (level - 1));
            level = aRoot.level;
            aRoot = HashLife.advance(aRoot, 1);
            aOffR -= (1 << (level - 2));
            aOffC -= (1 << (level - 2));
            var pLvl = aRoot.level;
            aRoot = HashLife.trimTree(aRoot);
            for(var l = pLvl; l > aRoot.level; l--){
                aOffR -= (1 << (l - 2));
                aOffC -= (1 << (l - 2));
            }
            var newCells = HashLife.toCellList(aRoot, aOffR, aOffC);
            current = overlayAges(current, newCells);
            if(boundary === 'finite'){
                var clipped = new Map();
                current.forEach(function(age, key){
                    var _rc = parseKey(key), r = _rc[0], c = _rc[1];
                    if(r >= 0 && r < rows && c >= 0 && c < cols){
                        clipped.set(key, age);
                    }
                });
                current = clipped;
            }
        }

        function runChunk(){
            if(self._analysisCancelled){ return; }
            if(Date.now() - analysisStartTime > 10000){
                finishAnalysis('Timed out after 10s (' + gen + ' gens analyzed).');
                return;
            }
            var end = Math.min(gen + chunkSize, maxGens);
            while(gen < end){
                analyzeStep();
                gen++;
                var h = hashBoard(current);
                if(hashes.has(h)){
                    var prev = hashes.get(h);
                    var period = gen - prev.gen;
                    var bb = bbox(current);
                    var dr = Math.abs(bb.cr - prev.cr);
                    var dc = Math.abs(bb.cc - prev.cc);
                    var msg;
                    if(period === 1 && dr < 0.01 && dc < 0.01){
                        msg = 'Still life (stable)';
                    } else if(dr < 0.01 && dc < 0.01){
                        msg = 'Oscillator \u2014 period ' + period;
                    } else {
                        var speed = Math.max(dr, dc);
                        var gcd = function(a, b){ return b === 0 ? a : gcd(b, a % b); };
                        var sn = Math.round(speed);
                        var g = gcd(sn, period);
                        var num = sn / g;
                        var den = period / g;
                        var dir = (dr > dc + 0.01) ? (dc > 0.01 ? 'diagonal' : 'vertical')
                                 : (dc > dr + 0.01 ? 'horizontal' : 'diagonal');
                        msg = 'Spaceship \u2014 ' + (num === 1 ? 'c' : num + 'c') + '/' + den + ' ' + dir + ', period ' + period;
                    }
                    finishAnalysis(msg, 6000);
                    return;
                }
                var bb2 = bbox(current);
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
                self.setState({analysisResult: 'Analyzing\u2026 gen ' + gen + '/' + maxGens + ' (click to cancel)'});
                setTimeout(runChunk, 0);
            }
        }
        setTimeout(runChunk, 0);
    },

    cancelAnalysis : function(){
        this._analysisCancelled = true;
        this.setState({analysisResult: 'Analysis cancelled.', analyzing: false});
        var self = this;
        setTimeout(function(){ self.setState({analysisResult: null}); }, 2000);
    },
};
