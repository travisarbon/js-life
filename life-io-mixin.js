/* global SimEngine, SimRunner, InputHandler, detectAndParsePattern,
          PATTERNS, MAX_CELL_IMPORT */
/**
 * File I/O and export mixin for LifeBoard component.
 * Handles file drop, clipboard paste, PNG/RLE export, URL sharing, and RLE import.
 */
var LifeIOMixin = { // eslint-disable-line no-unused-vars

    // ── Drag-and-drop file import ──────────────────────────────────────

    _handleFileDrop : function(e){
        e.preventDefault();
        e.stopPropagation();
        var container = this._canvas.parentNode;
        container.classList.remove('drop-active');
        var files = e.dataTransfer && e.dataTransfer.files;
        if(!files || files.length === 0){ return; }
        var file = files[0];
        if(file.size > 500000){
            this.setState({rleError: 'File too large (max 500 KB).'});
            return;
        }
        // Basic file type validation.
        var fileName = file.name || '';
        var ext = fileName.split('.').pop().toLowerCase();
        var allowedExts = ['rle', 'cells', 'lif', 'life', 'txt', 'mc', 'l'];
        if(file.type && file.type !== 'text/plain' && file.type !== 'application/octet-stream' && allowedExts.indexOf(ext) === -1){
            this.setState({rleError: 'Unsupported file type. Use .rle, .cells, or .lif files.'});
            return;
        }
        var self = this;
        var reader = new FileReader();
        reader.onerror = function(){
            self.setState({rleError: 'Unable to read file.'});
        };
        reader.onload = function(ev){
            var text = ev.target.result;
            // Strip non-printable control characters (keep tabs, newlines, CR).
            text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
            try {
                var result = detectAndParsePattern(text);
                if(result.cells.length === 0){
                    self.setState({rleError: 'No live cells found in file.'});
                    return;
                }
                PATTERNS['Custom'] = result.cells;
                self._previewPos = null;
                self.setState({
                    selectedPattern : 'Custom',
                    patternRotation : 0,
                    drawMode :        'preset',
                    showRle :         false,
                    rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
                }, function(){
                    self.drawBoard();
                    self._announce('Pattern imported. Click on the canvas to place it.');
                });
            } catch(ex){
                self.setState({rleError: 'Could not parse file: ' + (ex.message || 'unknown error')});
            }
        };
        reader.readAsText(file);
    },

    // ── System clipboard paste (RLE/pattern text) ──────────────────────

    _handleClipboardPaste : function(e){
        // Skip if focus is in a text input or textarea.
        var tag = (e.target.tagName || '').toLowerCase();
        if(tag === 'input' || tag === 'textarea' || tag === 'select'){ return; }
        // Skip if internal clipboard paste already handled this.
        if(this.state.clipboard && this.state.clipboard.length > 0){ return; }
        var text = (e.clipboardData || window.clipboardData || {}).getData('text');
        if(!text || text.length < 2){ return; }
        // Quick check: does it look like a pattern format?
        var looksLikePattern = /^#|x\s*=/im.test(text) || (/[bo$]/.test(text) && /!/.test(text)) || /^[.*O]+$/m.test(text);
        if(!looksLikePattern){ return; }
        e.preventDefault();
        try {
            var result = detectAndParsePattern(text);
            if(result.cells.length === 0){ return; }
            PATTERNS['Custom'] = result.cells;
            var self = this;
            InputHandler._previewPos = null;
            this.setState({
                selectedPattern : 'Custom',
                patternRotation : 0,
                drawMode :        'preset',
                rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
            }, function(){
                self.drawBoard();
                self._announce('Pattern pasted from clipboard. Click on the canvas to place it.');
            });
        } catch(ex){
            // Not a valid pattern — ignore silently.
        }
    },

    // ── Export ─────────────────────────────────────────────────────────

    exportPNG : function(){
        var link = document.createElement('a');
        link.download = 'game-of-life-gen-' + this.state.generations + '.png';
        link.href = this._canvas.toDataURL('image/png');
        link.click();
    },

    // ── RLE export ────────────────────────────────────────────────────

    copyRLE : function(){
        var rle = SimEngine.boardToRLE(this.state.liveCells, this.state.ruleString);
        if(!rle){ return; }
        var self = this;
        this.setState({showRle: true, rleInput: rle, rleError: ''}, function(){
            if(navigator.clipboard && navigator.clipboard.writeText){
                navigator.clipboard.writeText(rle).then(function(){
                    self._announce('RLE copied to clipboard');
                }).catch(function(){
                    self._announce('Could not copy to clipboard. Select and copy manually.');
                });
            }
        });
    },

    // ── URL sharing ──────────────────────────────────────────────────

    shareURL : function(){
        var rle = SimEngine.boardToRLE(this.state.liveCells, this.state.ruleString);
        if(!rle){ return; }
        // Build URL hash with compact parameters.
        var params = 'rle=' + encodeURIComponent(rle) +
            '&cols=' + (this.state.boundary === 'unbounded' ? 200 : this.state.cols) +
            '&rows=' + (this.state.boundary === 'unbounded' ? 200 : this.state.rows);
        if(this.state.ruleString !== 'B3/S23'){
            params += '&rule=' + encodeURIComponent(this.state.ruleString);
        }
        // Check total length — use compression for large patterns if available.
        if(params.length > 4000){
            // Too large for URL; fall back to copying RLE.
            this._announce('Pattern too large for URL sharing, copied RLE instead.');
            this.copyRLE();
            return;
        }
        var url = window.location.origin + window.location.pathname + '#' + params;
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(url).catch(function(){});
        }
        // Brief visual feedback.
        var self = this;
        this.setState({shareTooltip: true});
        setTimeout(function(){ self.setState({shareTooltip: false}); }, 2000);
    },

    _loadFromURLHash : function(){
        var hash = window.location.hash;
        if(!hash || hash.length < 5){ return; }
        try {
            var params = {};
            hash.substring(1).split('&').forEach(function(pair){
                var eq = pair.indexOf('=');
                if(eq > 0){ params[decodeURIComponent(pair.substring(0, eq))] = decodeURIComponent(pair.substring(eq + 1)); }
            });
            if(!params.rle){ return; }
            var cols = Math.min(10000, Math.max(1, parseInt(params.cols, 10) || 100));
            var rows = Math.min(10000, Math.max(1, parseInt(params.rows, 10) || 100));
            var rule = params.rule || 'B3/S23';
            var parsed = this.parseRuleString(rule);
            var result = SimEngine.parseRLE(params.rle);
            if(result.cells.length === 0){ return; }
            PATTERNS['Custom'] = result.cells;
            var self = this;
            var updates = {
                cols: cols, rows: rows, pendingCols: cols, pendingRows: rows,
                selectedPattern: 'Custom', patternRotation: 0, drawMode: 'preset',
                ruleString: rule
            };
            if(parsed){
                updates.birthRule = parsed.birth;
                updates.surviveRule = parsed.survive;
                updates.rulePreset = rule.toUpperCase();
                SimRunner.invalidate();
            }
            this.setState(updates, function(){
                self.drawBoard();
                self._announce('Pattern loaded from URL. Click on the canvas to place it.');
            });
            // Clear hash so reloads don't re-import.
            try { if(history.replaceState){ history.replaceState(null, '', window.location.pathname); } } catch(ex2){}
        } catch(ex){}
    },

    // ── RLE import ────────────────────────────────────────────────────

    setRleInput : function(e){
        this.setState({rleInput : e.target.value, rleError : ''});
    },

    toggleRle : function(){
        this.setState({showRle : !this.state.showRle, rleError : ''});
    },

    loadRle : function(){
        var text = this.state.rleInput.trim();
        if(!text){ this.setState({rleError : 'Paste a pattern first.'}); return; }
        if(text.length > 500000){
            this.setState({rleError : 'Pattern too large (max 500 KB). Use a smaller pattern or reduce it first.'}); return;
        }
        // Strip non-printable control characters.
        text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
        try {
            // Auto-detect format.
            var result = detectAndParsePattern(text);
            if(result.cells.length === 0){
                this.setState({rleError : 'No live cells found in pattern.'}); return;
            }
            PATTERNS['Custom'] = result.cells;
            var self = this;
            InputHandler._previewPos = null;
            this.setState({
                selectedPattern : 'Custom',
                patternRotation : 0,
                showRle :         false,
                rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
            }, function(){ self.drawBoard(); });
        } catch(ex){
            this.setState({rleError : 'Could not parse pattern: ' + ex.message});
        }
    },
};
