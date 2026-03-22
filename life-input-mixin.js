/* global InputHandler */
/**
 * Input delegation and keyboard utility object for LifeBoard component.
 * Delegates mouse/touch/wheel events to InputHandler and handles keyboard shortcuts.
 */
var LifeInputUtils = { // eslint-disable-line no-unused-vars

    // ── Mouse / painting (delegated to InputHandler) ───────────────────

    getMousePos : function(stateRef, dispatch, refs, event){
        return InputHandler.getMousePos(event, refs.canvas);
    },

    paintCellDirect : function(stateRef, dispatch, refs, c, r){
        InputHandler.paintCellDirect(c, r, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }});
    },

    getCellPos : function(stateRef, dispatch, refs, event){
        return InputHandler.getCellPos(event, refs.canvas, stateRef.current.viewX, stateRef.current.viewY, stateRef.current.cellSize);
    },

    onMouseDown : function(stateRef, dispatch, refs, event){
        InputHandler.onMouseDown(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, getCellPos: function(ev){ return LifeInputUtils.getCellPos(stateRef, dispatch, refs, ev); }, getMousePos: function(ev){ return LifeInputUtils.getMousePos(stateRef, dispatch, refs, ev); }, paintCellDirect: function(c, r){ LifeInputUtils.paintCellDirect(stateRef, dispatch, refs, c, r); }, _startPanMomentum: function(vx, vy){ LifeInputUtils._startPanMomentum(stateRef, dispatch, refs, vx, vy); }});
    },

    onMouseMove : function(stateRef, dispatch, refs, event){
        InputHandler.onMouseMove(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, getCellPos: function(ev){ return LifeInputUtils.getCellPos(stateRef, dispatch, refs, ev); }, getMousePos: function(ev){ return LifeInputUtils.getMousePos(stateRef, dispatch, refs, ev); }, paintCellDirect: function(c, r){ LifeInputUtils.paintCellDirect(stateRef, dispatch, refs, c, r); }});
    },

    onMouseUp : function(stateRef, dispatch, refs){
        InputHandler.onMouseUp(null, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, _startPanMomentum: function(vx, vy){ LifeInputUtils._startPanMomentum(stateRef, dispatch, refs, vx, vy); }});
    },

    _startPanMomentum : function(stateRef, dispatch, refs, vx, vy){
        InputHandler._startPanMomentum(vx, vy, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, drawBoard: function(){ refs.drawPending = true; }});
    },

    onMouseLeave : function(stateRef, dispatch, refs){
        InputHandler.onMouseLeave(null, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, drawBoard: function(){ refs.drawPending = true; }});
    },

    onContextMenu : function(stateRef, dispatch, refs, event){
        InputHandler.onContextMenu(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }});
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    onWheel : function(stateRef, dispatch, refs, event){
        InputHandler.onWheel(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, drawBoard: function(){ refs.drawPending = true; }});
    },

    // ── Touch support (delegated to InputHandler) ─────────────────────

    onTouchStart : function(stateRef, dispatch, refs, event){ InputHandler.onTouchStart(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, getCellPos: function(ev){ return LifeInputUtils.getCellPos(stateRef, dispatch, refs, ev); }, getMousePos: function(ev){ return LifeInputUtils.getMousePos(stateRef, dispatch, refs, ev); }, paintCellDirect: function(c, r){ LifeInputUtils.paintCellDirect(stateRef, dispatch, refs, c, r); }}); },
    onTouchMove : function(stateRef, dispatch, refs, event){ InputHandler.onTouchMove(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, getCellPos: function(ev){ return LifeInputUtils.getCellPos(stateRef, dispatch, refs, ev); }, getMousePos: function(ev){ return LifeInputUtils.getMousePos(stateRef, dispatch, refs, ev); }, paintCellDirect: function(c, r){ LifeInputUtils.paintCellDirect(stateRef, dispatch, refs, c, r); }}); },
    onTouchEnd : function(stateRef, dispatch, refs, event){ InputHandler.onTouchEnd(event, {state: stateRef.current, setState: function(s, cb){ dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s}); if(cb) cb(); }, _canvas: refs.canvas, _ctx: refs.ctx, drawBoard: function(){ refs.drawPending = true; }, _startPanMomentum: function(vx, vy){ LifeInputUtils._startPanMomentum(stateRef, dispatch, refs, vx, vy); }}); },

    // ── Keyboard ──────────────────────────────────────────────────────

    handleKeyDown : function(stateRef, dispatch, refs, e){
        var tag = e.target.tagName;
        // Allow Escape everywhere; allow single-key shortcuts even when a
        // button is focused (buttons capture Enter/Space but not letter keys).
        var inTextInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable;
        if(e.key !== 'Escape' && inTextInput){ return; }
        var handled = true;
        switch(e.key){
            case ' ':
                e.preventDefault();
                LifeSimUtils.toggleGame(stateRef, dispatch, refs);
                break;
            case '.':
                e.preventDefault();
                if(e.shiftKey){ LifeSimUtils.stepN(stateRef, dispatch, refs, stateRef.current.stepCount); }
                else { LifeSimUtils.stepGame(stateRef, dispatch, refs); }
                break;
            case 'Enter':
                e.preventDefault();
                if(!stateRef.current.running){ LifeSimUtils.stepGame(stateRef, dispatch, refs); }
                break;
            case ',':
                e.preventDefault();
                LifeSimUtils.stepBack(stateRef, dispatch, refs);
                break;
            case 'r': case 'R':
                e.preventDefault();
                LifeBoardUtils.resetGame(stateRef, dispatch, refs);
                break;
            case 'e': case 'E':
                e.preventDefault();
                LifeBoardUtils.emptyBoard(stateRef, dispatch, refs);
                break;
            case 'z': case 'Z':
                if((e.ctrlKey || e.metaKey) && e.shiftKey){ e.preventDefault(); LifeSimUtils.redo(stateRef, dispatch, refs); }
                else if(e.ctrlKey || e.metaKey){ e.preventDefault(); LifeSimUtils.undo(stateRef, dispatch, refs); }
                else if(stateRef.current.layoutMode === 'observatory'){ LifeViewUtils.toggleZenMode(stateRef, dispatch, refs); }
                break;
            case 'c': case 'C':
                if((e.ctrlKey || e.metaKey) && stateRef.current.selection){
                    e.preventDefault(); LifeBoardUtils.copySelection(stateRef, dispatch, refs);
                }
                break;
            case 'y': case 'Y':
                if(e.ctrlKey || e.metaKey){ e.preventDefault(); LifeSimUtils.redo(stateRef, dispatch, refs); }
                break;
            case 'v': case 'V':
                if((e.ctrlKey || e.metaKey) && stateRef.current.clipboard){
                    e.preventDefault(); LifeBoardUtils.pasteAsPattern(stateRef, dispatch, refs);
                }
                break;
            case 'Delete': case 'Backspace':
                if(stateRef.current.selection){ LifeBoardUtils.deleteSelection(stateRef, dispatch, refs); }
                break;
            case 's': case 'S':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); LifeIOUtils.exportPNG(stateRef, dispatch, refs); }
                break;
            case 'x': case 'X':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); LifeIOUtils.copyRLE(stateRef, dispatch, refs); }
                break;
            case 'f': case 'F':
                e.preventDefault();
                LifeViewUtils.fitView(stateRef, dispatch, refs);
                break;
            case '[':
                if(stateRef.current.selectedPattern){ LifeBoardUtils.rotateCCW(stateRef, dispatch, refs); }
                break;
            case ']':
                if(stateRef.current.selectedPattern){ LifeBoardUtils.rotateCW(stateRef, dispatch, refs); }
                break;
            case 'ArrowLeft':
                e.preventDefault(); LifeViewUtils.pan(stateRef, dispatch, refs, -5, 0);
                break;
            case 'ArrowRight':
                e.preventDefault(); LifeViewUtils.pan(stateRef, dispatch, refs, 5, 0);
                break;
            case 'ArrowUp':
                e.preventDefault(); LifeViewUtils.pan(stateRef, dispatch, refs, 0, -5);
                break;
            case 'ArrowDown':
                e.preventDefault(); LifeViewUtils.pan(stateRef, dispatch, refs, 0, 5);
                break;
            case 'Escape':
                if(InputHandler._drawToolStart){ LifeSimUtils.cancelDrawTool(stateRef, dispatch, refs); break; }
                if(stateRef.current.selection){ LifeBoardUtils.clearSelection(stateRef, dispatch, refs); break; }
                if(stateRef.current.drawMode === 'preset' && stateRef.current.selectedPattern){
                    InputHandler._previewPos = null;
                    dispatch({type:'MERGE', payload:{selectedPattern : null, patternRotation : 0, drawMode : 'paint'}});
                    refs.drawPending = true;
                    break;
                }
                if(stateRef.current.showPopGraph){
                    dispatch({type:'MERGE', payload:{showPopGraph: false}});
                    break;
                }
                if(stateRef.current.showHelp){
                    dispatch({type:'MERGE', payload:{showHelp : false}});
                    break;
                }
                // Close layout elements
                if(stateRef.current.bottomSheetOpen){ dispatch({type:'MERGE', payload:{bottomSheetOpen: false}}); break; }
                if(stateRef.current.zenMode){ dispatch({type:'MERGE', payload:{zenMode: false}}); break; }
                break;
            case '?':
                LifeAnalysisUtils.toggleHelp(stateRef, dispatch, refs);
                break;
            case 'm': case 'M':
                LifeBoardUtils.toggleMinimap(stateRef, dispatch, refs);
                break;
            default:
                handled = false;
        }
        // Dispatch registered shortcuts (d, p, b, g, t, …).
        if(!handled && !e.ctrlKey && !e.metaKey && !e.altKey){
            var entry = refs.shortcuts[e.key.toLowerCase()];
            if(entry){
                e.preventDefault();
                entry.handler();
            }
        }
    },

    // ── Keyboard shortcut registry ────────────────────────────────

    _registerCoreShortcuts : function(stateRef, dispatch, refs){
        // Register all existing shortcuts centrally.
        LifeInputUtils._registerShortcut(stateRef, dispatch, refs, 'd', 'Switch to Draw mode', function(){ LifeBoardUtils.toggleDrawMode(stateRef, dispatch, refs); });
        LifeInputUtils._registerShortcut(stateRef, dispatch, refs, 'p', 'Switch to Preset mode', function(){ LifeBoardUtils.togglePresetMode(stateRef, dispatch, refs); });
        LifeInputUtils._registerShortcut(stateRef, dispatch, refs, 'b', 'Switch to Region mode', function(){ LifeBoardUtils.toggleRegionMode(stateRef, dispatch, refs); });
        LifeInputUtils._registerShortcut(stateRef, dispatch, refs, 'g', 'Toggle grid lines', function(){ LifeBoardUtils.toggleGridLines(stateRef, dispatch, refs); });
        LifeInputUtils._registerShortcut(stateRef, dispatch, refs, 't', 'Toggle trails', function(){ LifeViewUtils.toggleTrails(stateRef, dispatch, refs); });
    },

    _registerShortcut : function(stateRef, dispatch, refs, key, description, handler){
        refs.shortcuts[key.toLowerCase()] = {key: key, description: description, handler: handler};
    },

    _unregisterShortcut : function(stateRef, dispatch, refs, key){
        delete refs.shortcuts[key.toLowerCase()];
    },
};
