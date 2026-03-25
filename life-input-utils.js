/* global InputHandler, LifeSimUtils, LifeViewUtils, LifeBoardUtils, LifeIOUtils, LifeAnalysisUtils, toggleTrails */
/**
 * Input delegation and keyboard utility object for LifeBoard component.
 * Delegates mouse/touch/wheel events to InputHandler and handles keyboard shortcuts.
 */
const LifeInputUtils = { // eslint-disable-line no-unused-vars

    /**
     * Build a thin shim that looks like `this` to InputHandler,
     * bridging stateRef / dispatch / refs into the old interface.
     */
    _shim : function(stateRef, refs, dispatch){
        return {
            get state(){ return stateRef.current; },
            setState : function(s, cb){
                dispatch({type:'MERGE', payload: typeof s === 'function' ? s(stateRef.current) : s});
                if(cb) cb();
            },
            _canvas      : refs.canvas,
            _ctx          : refs.ctx,
            get _minimapRect(){ return refs.minimapRect; },
            get _minimapDirty(){ return refs.minimapDirty; },
            set _minimapDirty(v){ refs.minimapDirty = v; },
            get _previewCanvas(){ return refs.previewCanvas; },
            drawBoard     : function(){ refs.drawPending = true; },
            getCellPos    : function(ev){ return LifeInputUtils.getCellPos(stateRef, refs, dispatch, ev); },
            getMousePos   : function(ev){ return LifeInputUtils.getMousePos(stateRef, refs, dispatch, ev); },
            paintCellDirect : function(c, r){ LifeInputUtils.paintCellDirect(stateRef, refs, dispatch, c, r); },
            _startPanMomentum : function(vx, vy){ LifeInputUtils._startPanMomentum(stateRef, refs, dispatch, vx, vy); },
            clampView     : function(vx, vy){ return LifeViewUtils.clampView(stateRef, refs, dispatch, vx, vy); },
            pan           : function(dc, dr){ LifeViewUtils.pan(stateRef, refs, dispatch, dc, dr); },
            selectAllVisible : function(){ LifeViewUtils.selectAllVisible(stateRef, refs, dispatch); },
            _hideStatsChip : function(){ LifeViewUtils._hideStatsChip(stateRef, refs, dispatch); },
            _showStatsChipAfterDelay : function(){ LifeViewUtils._showStatsChipAfterDelay(stateRef, refs, dispatch); },
            placePattern  : function(name, c, r){ LifeBoardUtils.placePattern(stateRef, refs, dispatch, name, c, r); },
            _mutateRegion : function(add, rm, cb){ LifeBoardUtils._mutateRegion(stateRef, refs, dispatch, add, rm, cb); },
            pushUndo      : function(){ LifeSimUtils.pushUndo(stateRef, refs, dispatch); },
            popUndo       : function(){ return LifeSimUtils.popUndo(stateRef, refs, dispatch); },
            cancelDrawTool : function(){ LifeSimUtils.cancelDrawTool(stateRef, refs, dispatch); },
            _startLoop     : function(){ LifeSimUtils._startLoop(stateRef, refs, dispatch); }
        };
    },

    // ── Mouse / painting (delegated to InputHandler) ───────────────────

    getMousePos : function(stateRef, refs, dispatch, event){
        return InputHandler.getMousePos(event, refs.canvas);
    },

    paintCellDirect : function(stateRef, refs, dispatch, c, r){
        InputHandler.paintCellDirect(c, r, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    getCellPos : function(stateRef, refs, dispatch, event){
        return InputHandler.getCellPos(event, refs.canvas, stateRef.current.viewX, stateRef.current.viewY, stateRef.current.cellSize);
    },

    onMouseDown : function(stateRef, refs, dispatch, event){
        InputHandler.onMouseDown(event, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    onMouseMove : function(stateRef, refs, dispatch, event){
        InputHandler.onMouseMove(event, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    onMouseUp : function(stateRef, refs, dispatch){
        InputHandler.onMouseUp(null, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    _startPanMomentum : function(stateRef, refs, dispatch, vx, vy){
        InputHandler._startPanMomentum(vx, vy, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    onMouseLeave : function(stateRef, refs, dispatch){
        InputHandler.onMouseLeave(null, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    onContextMenu : function(stateRef, refs, dispatch, event){
        InputHandler.onContextMenu(event, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    onWheel : function(stateRef, refs, dispatch, event){
        InputHandler.onWheel(event, LifeInputUtils._shim(stateRef, refs, dispatch));
    },

    // ── Touch support (delegated to InputHandler) ─────────────────────

    onTouchStart : function(stateRef, refs, dispatch, event){ InputHandler.onTouchStart(event, LifeInputUtils._shim(stateRef, refs, dispatch)); },
    onTouchMove  : function(stateRef, refs, dispatch, event){ InputHandler.onTouchMove(event, LifeInputUtils._shim(stateRef, refs, dispatch)); },
    onTouchEnd   : function(stateRef, refs, dispatch, event){ InputHandler.onTouchEnd(event, LifeInputUtils._shim(stateRef, refs, dispatch)); },

    // ── Keyboard ──────────────────────────────────────────────────────

    handleKeyDown : function(stateRef, refs, dispatch, e){
        const tag = e.target.tagName;
        // Allow Escape everywhere; allow single-key shortcuts even when a
        // button is focused (buttons capture Enter/Space but not letter keys).
        const inTextInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable;
        if(e.key !== 'Escape' && inTextInput){ return; }
        let handled = true;
        switch(e.key){
            case ' ':
                e.preventDefault();
                LifeSimUtils.toggleGame(stateRef, refs, dispatch);
                break;
            case '.':
                e.preventDefault();
                if(e.shiftKey){ LifeSimUtils.stepN(stateRef, refs, dispatch, stateRef.current.stepCount); }
                else { LifeSimUtils.stepGame(stateRef, refs, dispatch); }
                break;
            case 'Enter':
                e.preventDefault();
                if(!stateRef.current.running){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }
                break;
            case ',':
                e.preventDefault();
                LifeSimUtils.stepBack(stateRef, refs, dispatch);
                break;
            case 'r': case 'R':
                e.preventDefault();
                LifeBoardUtils.resetGame(stateRef, refs, dispatch);
                break;
            case 'e': case 'E':
                e.preventDefault();
                LifeBoardUtils.emptyBoard(stateRef, refs, dispatch);
                break;
            case 'z': case 'Z':
                if((e.ctrlKey || e.metaKey) && e.shiftKey){ e.preventDefault(); LifeSimUtils.redo(stateRef, refs, dispatch); }
                else if(e.ctrlKey || e.metaKey){ e.preventDefault(); LifeSimUtils.undo(stateRef, refs, dispatch); }
                else if(stateRef.current.layoutMode === 'observatory'){ LifeViewUtils.toggleZenMode(stateRef, refs, dispatch); }
                break;
            case 'c': case 'C':
                if((e.ctrlKey || e.metaKey) && stateRef.current.selection){
                    e.preventDefault(); LifeBoardUtils.copySelection(stateRef, refs, dispatch);
                }
                break;
            case 'y': case 'Y':
                if(e.ctrlKey || e.metaKey){ e.preventDefault(); LifeSimUtils.redo(stateRef, refs, dispatch); }
                break;
            case 'v': case 'V':
                if((e.ctrlKey || e.metaKey) && stateRef.current.clipboard){
                    e.preventDefault(); LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch);
                }
                break;
            case 'Delete': case 'Backspace':
                if(stateRef.current.selection){ LifeBoardUtils.deleteSelection(stateRef, refs, dispatch); }
                break;
            case 's': case 'S':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); LifeIOUtils.exportPNG(stateRef, refs, dispatch); }
                break;
            case 'x': case 'X':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); LifeIOUtils.copyRLE(stateRef, refs, dispatch); }
                break;
            case 'f': case 'F':
                e.preventDefault();
                LifeViewUtils.fitView(stateRef, refs, dispatch);
                break;
            case '[':
                if(stateRef.current.selectedPattern){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }
                break;
            case ']':
                if(stateRef.current.selectedPattern){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }
                break;
            case 'ArrowLeft':
                e.preventDefault(); LifeViewUtils.pan(stateRef, refs, dispatch, -5, 0);
                break;
            case 'ArrowRight':
                e.preventDefault(); LifeViewUtils.pan(stateRef, refs, dispatch, 5, 0);
                break;
            case 'ArrowUp':
                e.preventDefault(); LifeViewUtils.pan(stateRef, refs, dispatch, 0, -5);
                break;
            case 'ArrowDown':
                e.preventDefault(); LifeViewUtils.pan(stateRef, refs, dispatch, 0, 5);
                break;
            case 'Escape':
                if(InputHandler._drawToolStart){ LifeSimUtils.cancelDrawTool(stateRef, refs, dispatch); break; }
                if(stateRef.current.selection){ LifeBoardUtils.clearSelection(stateRef, refs, dispatch); break; }
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
                LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch);
                break;
            case 'm': case 'M':
                LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch);
                break;
            default:
                handled = false;
        }
        // Dispatch registered shortcuts (d, p, b, g, t, …).
        if(!handled && !e.ctrlKey && !e.metaKey && !e.altKey){
            const entry = refs.shortcuts[e.key.toLowerCase()];
            if(entry){
                e.preventDefault();
                entry.handler();
            }
        }
    },

    // ── Keyboard shortcut registry ────────────────────────────────

    _registerCoreShortcuts : function(stateRef, refs, dispatch){
        // Register all existing shortcuts centrally.
        LifeInputUtils._registerShortcut(stateRef, refs, dispatch, 'd', 'Switch to Draw mode', function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); });
        LifeInputUtils._registerShortcut(stateRef, refs, dispatch, 'p', 'Switch to Preset mode', function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); });
        LifeInputUtils._registerShortcut(stateRef, refs, dispatch, 'b', 'Switch to Region mode', function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); });
        LifeInputUtils._registerShortcut(stateRef, refs, dispatch, 'g', 'Toggle grid lines', function(){ LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch); });
        LifeInputUtils._registerShortcut(stateRef, refs, dispatch, 't', 'Toggle trails', function(){ toggleTrails(stateRef, refs, dispatch); });
    },

    _registerShortcut : function(stateRef, refs, dispatch, key, description, handler){
        refs.shortcuts[key.toLowerCase()] = {key: key, description: description, handler: handler};
    },

    _unregisterShortcut : function(stateRef, refs, dispatch, key){
        delete refs.shortcuts[key.toLowerCase()];
    },
};
