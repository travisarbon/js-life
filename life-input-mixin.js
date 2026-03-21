/* global InputHandler */
/**
 * Input delegation and keyboard mixin for LifeBoard component.
 * Delegates mouse/touch/wheel events to InputHandler and handles keyboard shortcuts.
 */
var LifeInputMixin = { // eslint-disable-line no-unused-vars

    // ── Mouse / painting (delegated to InputHandler) ───────────────────

    getMousePos : function(event){
        return InputHandler.getMousePos(event, this._canvas);
    },

    paintCellDirect : function(c, r){
        InputHandler.paintCellDirect(c, r, this);
    },

    getCellPos : function(event){
        return InputHandler.getCellPos(event, this._canvas, this.state.viewX, this.state.viewY, this.state.cellSize);
    },

    onMouseDown : function(event){
        InputHandler.onMouseDown(event, this);
    },

    onMouseMove : function(event){
        InputHandler.onMouseMove(event, this);
    },

    onMouseUp : function(){
        InputHandler.onMouseUp(null, this);
    },

    _startPanMomentum : function(vx, vy){
        InputHandler._startPanMomentum(vx, vy, this);
    },

    onMouseLeave : function(){
        InputHandler.onMouseLeave(null, this);
    },

    onContextMenu : function(event){
        InputHandler.onContextMenu(event, this);
    },

    // ── Zoom and pan ──────────────────────────────────────────────────

    onWheel : function(event){
        InputHandler.onWheel(event, this);
    },

    // ── Touch support (delegated to InputHandler) ─────────────────────

    onTouchStart : function(event){ InputHandler.onTouchStart(event, this); },
    onTouchMove : function(event){ InputHandler.onTouchMove(event, this); },
    onTouchEnd : function(event){ InputHandler.onTouchEnd(event, this); },

    // ── Keyboard ──────────────────────────────────────────────────────

    handleKeyDown : function(e){
        var tag = e.target.tagName;
        // Allow Escape everywhere; allow single-key shortcuts even when a
        // button is focused (buttons capture Enter/Space but not letter keys).
        var inTextInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable;
        if(e.key !== 'Escape' && inTextInput){ return; }
        var self = this;
        var handled = true;
        switch(e.key){
            case ' ':
                e.preventDefault();
                this.toggleGame();
                break;
            case '.':
                e.preventDefault();
                if(e.shiftKey){ this.stepN(this.state.stepCount); }
                else { this.stepGame(); }
                break;
            case 'Enter':
                e.preventDefault();
                if(!this.state.running){ this.stepGame(); }
                break;
            case ',':
                e.preventDefault();
                this.stepBack();
                break;
            case 'r': case 'R':
                e.preventDefault();
                this.resetGame();
                break;
            case 'e': case 'E':
                e.preventDefault();
                this.emptyBoard();
                break;
            case 'z': case 'Z':
                if((e.ctrlKey || e.metaKey) && e.shiftKey){ e.preventDefault(); this.redo(); }
                else if(e.ctrlKey || e.metaKey){ e.preventDefault(); this.undo(); }
                else if(this.state.layoutMode === 'observatory'){ this.toggleZenMode(); }
                break;
            case 'c': case 'C':
                if((e.ctrlKey || e.metaKey) && this.state.selection){
                    e.preventDefault(); this.copySelection();
                }
                break;
            case 'y': case 'Y':
                if(e.ctrlKey || e.metaKey){ e.preventDefault(); this.redo(); }
                break;
            case 'v': case 'V':
                if((e.ctrlKey || e.metaKey) && this.state.clipboard){
                    e.preventDefault(); this.pasteAsPattern();
                }
                break;
            case 'Delete': case 'Backspace':
                if(this.state.selection){ this.deleteSelection(); }
                break;
            case 's': case 'S':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); this.exportPNG(); }
                break;
            case 'x': case 'X':
                if(!e.ctrlKey && !e.metaKey){ e.preventDefault(); this.copyRLE(); }
                break;
            case 'f': case 'F':
                e.preventDefault();
                this.fitView();
                break;
            case '[':
                if(this.state.selectedPattern){ this.rotateCCW(); }
                break;
            case ']':
                if(this.state.selectedPattern){ this.rotateCW(); }
                break;
            case 'ArrowLeft':
                e.preventDefault(); this.pan(-5, 0);
                break;
            case 'ArrowRight':
                e.preventDefault(); this.pan(5, 0);
                break;
            case 'ArrowUp':
                e.preventDefault(); this.pan(0, -5);
                break;
            case 'ArrowDown':
                e.preventDefault(); this.pan(0, 5);
                break;
            case 'Escape':
                if(InputHandler._drawToolStart){ this.cancelDrawTool(); break; }
                if(this.state.selection){ this.clearSelection(); break; }
                if(this.state.drawMode === 'preset' && this.state.selectedPattern){
                    InputHandler._previewPos = null;
                    this.setState({selectedPattern : null, patternRotation : 0, drawMode : 'paint'},
                        function(){ self.drawBoard(); });
                    break;
                }
                if(this.state.showPopGraph){
                    this.setState({showPopGraph: false});
                    break;
                }
                if(this.state.showHelp){
                    this.setState({showHelp : false});
                    break;
                }
                // Close layout elements
                if(this.state.bottomSheetOpen){ this.setState({bottomSheetOpen: false}); break; }
                if(this.state.zenMode){ this.setState({zenMode: false}); break; }
                break;
            case '?':
                this.toggleHelp();
                break;
            case 'm': case 'M':
                this.toggleMinimap();
                break;
            default:
                handled = false;
        }
        // Dispatch registered shortcuts (d, p, b, g, t, …).
        if(!handled && !e.ctrlKey && !e.metaKey && !e.altKey){
            var entry = this._shortcuts[e.key.toLowerCase()];
            if(entry){
                e.preventDefault();
                entry.handler();
            }
        }
    },

    // ── Keyboard shortcut registry ────────────────────────────────

    _registerCoreShortcuts : function(){
        var self = this;
        // Register all existing shortcuts centrally.
        this._registerShortcut('d', 'Switch to Draw mode', function(){ self.toggleDrawMode(); });
        this._registerShortcut('p', 'Switch to Preset mode', function(){ self.togglePresetMode(); });
        this._registerShortcut('b', 'Switch to Region mode', function(){ self.toggleRegionMode(); });
        this._registerShortcut('g', 'Toggle grid lines', function(){ self.toggleGridLines(); });
        this._registerShortcut('t', 'Toggle trails', function(){ self.toggleTrails(); });
    },

    _registerShortcut : function(key, description, handler){
        this._shortcuts[key.toLowerCase()] = {key: key, description: description, handler: handler};
    },

    _unregisterShortcut : function(key){
        delete this._shortcuts[key.toLowerCase()];
    },
};
