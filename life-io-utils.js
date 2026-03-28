import { SimEngine, detectAndParsePattern, MAX_CELL_IMPORT } from './constants.js';
import { PATTERNS } from './patterns.js';
import { SimRunner } from './simulation.js';
import { InputHandler } from './input-handler.js';
import { LifeViewUtils } from './life-view-utils.js';
import { LifeBoardUtils } from './life-board-utils.js';
/**
 * File I/O and export utilities for LifeBoard component.
 * Handles file drop, clipboard paste, PNG/RLE export, URL sharing, and RLE import.
 */
var LifeIOUtils = { // eslint-disable-line no-unused-vars

    // ── Drag-and-drop file import ──────────────────────────────────────

    _handleFileDrop : function(stateRef, refs, dispatch, e){
        e.preventDefault();
        e.stopPropagation();
        const container = refs.canvas.parentNode;
        container.classList.remove('drop-active');
        const files = e.dataTransfer && e.dataTransfer.files;
        if(!files || files.length === 0){ return; }
        const file = files[0];
        if(file.size > 500000){
            dispatch({type:'MERGE', payload:{rleError: 'File too large (max 500 KB).'}});
            return;
        }
        // Basic file type validation.
        const fileName = file.name || '';
        const ext = fileName.split('.').pop().toLowerCase();
        const allowedExts = ['rle', 'cells', 'lif', 'life', 'txt', 'mc', 'l'];
        if(file.type && file.type !== 'text/plain' && file.type !== 'application/octet-stream' && allowedExts.indexOf(ext) === -1){
            dispatch({type:'MERGE', payload:{rleError: 'Unsupported file type. Use .rle, .cells, or .lif files.'}});
            return;
        }
        const reader = new FileReader();
        reader.onerror = function(){
            dispatch({type:'MERGE', payload:{rleError: 'Unable to read file.'}});
        };
        reader.onload = function(ev){
            if(!ev.target || ev.target.result == null){
                dispatch({type:'MERGE', payload:{rleError: 'Failed to read file contents.'}});
                return;
            }
            let text = ev.target.result;
            // Strip non-printable control characters (keep tabs, newlines, CR).
            text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
            try {
                const result = detectAndParsePattern(text);
                if(result.cells.length === 0){
                    dispatch({type:'MERGE', payload:{rleError: 'No live cells found in file.'}});
                    return;
                }
                PATTERNS['Custom'] = result.cells;
                InputHandler._previewPos = null;
                dispatch({type:'MERGE', payload:{
                    selectedPattern : 'Custom',
                    patternRotation : 0,
                    drawMode :        'preset',
                    showRle :         false,
                    rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
                }});
                refs.drawPending = true;
                LifeViewUtils._announce(stateRef, refs, dispatch, 'Pattern imported. Click on the canvas to place it.');
            } catch(ex){
                dispatch({type:'MERGE', payload:{rleError: 'Could not parse file: ' + (ex.message || 'unknown error')}});
            }
        };
        reader.readAsText(file);
    },

    // ── System clipboard paste (RLE/pattern text) ──────────────────────

    _handleClipboardPaste : function(stateRef, refs, dispatch, e){
        // Skip if focus is in a text input or textarea.
        const tag = (e.target.tagName || '').toLowerCase();
        if(tag === 'input' || tag === 'textarea' || tag === 'select'){ return; }
        // Skip if internal clipboard paste already handled this.
        if(stateRef.current.clipboard && stateRef.current.clipboard.length > 0){ return; }
        const text = (e.clipboardData || window.clipboardData || {}).getData('text');
        if(!text || text.length < 2){ return; }
        // Quick check: does it look like a pattern format?
        const looksLikePattern = /^#|x\s*=/im.test(text) || (/[bo$]/.test(text) && /!/.test(text)) || /^[.*O]+$/m.test(text);
        if(!looksLikePattern){ return; }
        e.preventDefault();
        try {
            const result = detectAndParsePattern(text);
            if(result.cells.length === 0){ return; }
            PATTERNS['Custom'] = result.cells;
            InputHandler._previewPos = null;
            dispatch({type:'MERGE', payload:{
                selectedPattern : 'Custom',
                patternRotation : 0,
                drawMode :        'preset',
                rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
            }});
            refs.drawPending = true;
            LifeViewUtils._announce(stateRef, refs, dispatch, 'Pattern pasted from clipboard. Click on the canvas to place it.');
        } catch(ex){
            // Not a valid pattern — ignore silently.
        }
    },

    // ── Export ─────────────────────────────────────────────────────────

    exportPNG : function(stateRef, refs, dispatch){
        const link = document.createElement('a');
        link.download = 'game-of-life-gen-' + stateRef.current.generations + '.png';
        link.href = refs.canvas.toDataURL('image/png');
        link.click();
        LifeViewUtils._announce(stateRef, refs, dispatch, 'PNG exported');
    },

    // ── RLE export ────────────────────────────────────────────────────

    copyRLE : function(stateRef, refs, dispatch){
        const rle = SimEngine.boardToRLE(stateRef.current.liveCells, stateRef.current.ruleString);
        if(!rle){ return; }
        dispatch({type:'MERGE', payload:{showRle: true, rleInput: rle, rleError: ''}}); refs.drawPending = true;
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(rle).then(function(){
                LifeViewUtils._announce(stateRef, refs, dispatch, 'RLE copied to clipboard');
                dispatch({type:'MERGE', payload:{copyRleTooltip: true}});
                setTimeout(function(){ dispatch({type:'MERGE', payload:{copyRleTooltip: false}}); }, 2000);
            }).catch(function(){
                LifeViewUtils._announce(stateRef, refs, dispatch, 'Could not copy to clipboard. Select and copy manually.');
            });
        }
    },

    // ── URL sharing ──────────────────────────────────────────────────

    shareURL : function(stateRef, refs, dispatch){
        const rle = SimEngine.boardToRLE(stateRef.current.liveCells, stateRef.current.ruleString);
        if(!rle){ return; }
        // Build URL hash with compact parameters.
        let params = 'rle=' + encodeURIComponent(rle) +
            '&cols=' + (stateRef.current.boundary === 'unbounded' ? 200 : stateRef.current.cols) +
            '&rows=' + (stateRef.current.boundary === 'unbounded' ? 200 : stateRef.current.rows);
        if(stateRef.current.ruleString !== 'B3/S23'){
            params += '&rule=' + encodeURIComponent(stateRef.current.ruleString);
        }
        // Check total length — use compression for large patterns if available.
        if(params.length > 4000){
            // Too large for URL; fall back to copying RLE.
            LifeViewUtils._announce(stateRef, refs, dispatch, 'Pattern too large for URL sharing, copied RLE instead.');
            LifeIOUtils.copyRLE(stateRef, refs, dispatch);
            return;
        }
        const url = window.location.origin + window.location.pathname + '#' + params;
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(url).catch(function(){});
        }
        // Brief visual feedback.
        dispatch({type:'MERGE', payload:{shareTooltip: true}});
        setTimeout(function(){ dispatch({type:'MERGE', payload:{shareTooltip: false}}); }, 2000);
    },

    _loadFromURLHash : function(stateRef, refs, dispatch){
        const hash = window.location.hash;
        if(!hash || hash.length < 5){ return; }
        try {
            const params = {};
            hash.substring(1).split('&').forEach(function(pair){
                const eq = pair.indexOf('=');
                if(eq > 0){ params[decodeURIComponent(pair.substring(0, eq))] = decodeURIComponent(pair.substring(eq + 1)); }
            });
            if(!params.rle){ return; }
            const cols = Math.min(1000, Math.max(1, parseInt(params.cols, 10) || 100));
            const rows = Math.min(1000, Math.max(1, parseInt(params.rows, 10) || 100));
            const rule = params.rule || 'B3/S23';
            const parsed = LifeBoardUtils.parseRuleString(stateRef, refs, dispatch, rule);
            const result = SimEngine.parseRLE(params.rle);
            if(result.cells.length === 0){ return; }
            PATTERNS['Custom'] = result.cells;
            const updates = {
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
            dispatch({type:'MERGE', payload:updates});
            refs.drawPending = true;
            LifeViewUtils._announce(stateRef, refs, dispatch, 'Pattern loaded from URL. Click on the canvas to place it.');
            // Clear hash so reloads don't re-import.
            try { if(history.replaceState){ history.replaceState(null, '', window.location.pathname); } } catch(ex2){}
        } catch(ex){}
    },

    // ── RLE import ────────────────────────────────────────────────────

    setRleInput : function(stateRef, refs, dispatch, e){
        dispatch({type:'MERGE', payload:{rleInput : e.target.value, rleError : ''}});
    },

    toggleRle : function(stateRef, refs, dispatch){
        dispatch({type:'MERGE', payload:{showRle : !stateRef.current.showRle, rleError : ''}});
    },

    loadRle : function(stateRef, refs, dispatch){
        let text = stateRef.current.rleInput.trim();
        if(!text){ dispatch({type:'MERGE', payload:{rleError : 'Paste a pattern first.'}}); return; }
        if(text.length > 500000){
            dispatch({type:'MERGE', payload:{rleError : 'Pattern too large (max 500 KB). Use a smaller pattern or reduce it first.'}}); return;
        }
        // Strip non-printable control characters.
        text = text.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
        try {
            // Auto-detect format.
            const result = detectAndParsePattern(text);
            if(result.cells.length === 0){
                dispatch({type:'MERGE', payload:{rleError : 'No live cells found in pattern.'}}); return;
            }
            PATTERNS['Custom'] = result.cells;
            InputHandler._previewPos = null;
            dispatch({type:'MERGE', payload:{
                selectedPattern : 'Custom',
                patternRotation : 0,
                showRle :         false,
                rleError :        result.truncated ? 'Pattern truncated to ' + MAX_CELL_IMPORT.toLocaleString() + ' cells.' : ''
            }});
            refs.drawPending = true;
        } catch(ex){
            dispatch({type:'MERGE', payload:{rleError : 'Could not parse pattern: ' + ex.message}});
        }
    },
};

export { LifeIOUtils };
