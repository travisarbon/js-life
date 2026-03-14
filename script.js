/**
 * Created by Travis on 8/6/2016.
 */

// Classic patterns as [row, col] offset arrays (0-indexed from top-left of bounding box).
var PATTERNS = {
    'Glider':             [[0,1],[1,2],[2,0],[2,1],[2,2]],
    'Blinker':            [[0,0],[0,1],[0,2]],
    'Toad':               [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],
    'Beacon':             [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
    'Pulsar':             [
                            [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
                            [2,0],[2,5],[2,7],[2,12],
                            [3,0],[3,5],[3,7],[3,12],
                            [4,0],[4,5],[4,7],[4,12],
                            [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
                            [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
                            [8,0],[8,5],[8,7],[8,12],
                            [9,0],[9,5],[9,7],[9,12],
                            [10,0],[10,5],[10,7],[10,12],
                            [12,2],[12,3],[12,4],[12,8],[12,9],[12,10]
                          ],
    'R-pentomino':        [[0,1],[0,2],[1,0],[1,1],[2,1]],
    'Acorn':              [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]],
    'Gosper Glider Gun':  [
                            [0,24],
                            [1,22],[1,24],
                            [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
                            [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
                            [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
                            [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
                            [6,10],[6,16],[6,24],
                            [7,11],[7,15],
                            [8,12],[8,13]
                          ]
};

$(document).ready(function(){
    (function(){

        var LifeBoard = React.createClass({

            getInitialState : function(){
                var cellSize = 5;
                var cols = 100;
                var rows = 100;
                return {
                    running :      true,
                    cellSize :     cellSize,
                    cols :         cols,
                    rows :         rows,
                    sparseness :   2,
                    board :        this.buildBoard(cols, rows, 2, cellSize),
                    generations :  0,
                    liveClickMode: false,
                    speed :        5,
                    gridLines :    false,
                    boundary :       'toroidal',
                    birthRule :      [3],
                    surviveRule :    [2, 3],
                    ruleString :     'B3/S23',
                    selectedPattern: null,
                    patternRotation: 0,
                    pendingCols :    cols,
                    pendingRows :    rows
                };
            },

            componentDidMount : function(){
                this._dragging = false;
                this._dragStatus = null;
                this._paintedCells = {};
                this._previewPos = null;
                this._loopRunning = false;
                this._tickId = 0;
                this._canvas = document.getElementById("life-canvas");
                document.addEventListener('keydown', this.handleKeyDown);
                this.drawBoard();
                this._startLoop();
            },

            componentDidUpdate : function(prevProps, prevState){
                if(prevState.selectedPattern !== this.state.selectedPattern ||
                   prevState.patternRotation !== this.state.patternRotation){
                    this.drawRotationPreview();
                }
            },

            componentWillUnmount : function(){
                document.removeEventListener('keydown', this.handleKeyDown);
            },

            buildBoard : function(cols, rows, sparseness, cellSize){
                var arr = [];
                for(var r = 0; r < rows; r++){
                    for(var c = 0; c < cols; c++){
                        arr.push({
                            x :      c * cellSize,
                            y :      r * cellSize,
                            status : Math.random() < (1 / sparseness) ? 1 : 0
                        });
                    }
                }
                return arr;
            },

            drawBoard : function(){
                var canvas = this._canvas;
                var ctx = canvas.getContext("2d");
                var cellSize = this.state.cellSize;
                var cols = this.state.cols;
                var rows = this.state.rows;
                for(var i = 0; i < this.state.board.length; i++){
                    ctx.fillStyle = this.state.board[i].status === 1 ? "#70959A" : "#FFFFFF";
                    ctx.fillRect(this.state.board[i].x, this.state.board[i].y, cellSize, cellSize);
                }
                if(this.state.gridLines){
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    for(var c = 0; c <= cols; c++){
                        ctx.moveTo(c * cellSize, 0);
                        ctx.lineTo(c * cellSize, rows * cellSize);
                    }
                    for(var r = 0; r <= rows; r++){
                        ctx.moveTo(0, r * cellSize);
                        ctx.lineTo(cols * cellSize, r * cellSize);
                    }
                    ctx.stroke();
                }
                // Pattern placement preview — draw the selected pattern semi-transparently
                // under the cursor so the user can see where it will land before clicking.
                if(this.state.selectedPattern && this._previewPos){
                    var pattern = this.rotatePattern(PATTERNS[this.state.selectedPattern], this.state.patternRotation);
                    var maxPR = 0, maxPC = 0;
                    for(var pi = 0; pi < pattern.length; pi++){
                        if(pattern[pi][0] > maxPR){ maxPR = pattern[pi][0]; }
                        if(pattern[pi][1] > maxPC){ maxPC = pattern[pi][1]; }
                    }
                    var offsetPR = this._previewPos.r - Math.floor(maxPR / 2);
                    var offsetPC = this._previewPos.c - Math.floor(maxPC / 2);
                    ctx.fillStyle = 'rgba(112, 149, 154, 0.55)';
                    for(var pj = 0; pj < pattern.length; pj++){
                        var pvR = pattern[pj][0] + offsetPR;
                        var pvC = pattern[pj][1] + offsetPC;
                        if(pvR >= 0 && pvR < rows && pvC >= 0 && pvC < cols){
                            ctx.fillRect(pvC * cellSize, pvR * cellSize, cellSize, cellSize);
                        }
                    }
                }
            },

            drawRotationPreview : function(){
                var canvas = this._previewCanvas;
                if(!canvas || !this.state.selectedPattern){ return; }
                var pattern = this.rotatePattern(
                    PATTERNS[this.state.selectedPattern], this.state.patternRotation);
                var maxR = 0, maxC = 0;
                for(var i = 0; i < pattern.length; i++){
                    if(pattern[i][0] > maxR){ maxR = pattern[i][0]; }
                    if(pattern[i][1] > maxC){ maxC = pattern[i][1]; }
                }
                var patRows = maxR + 1, patCols = maxC + 1;
                var size   = canvas.width;
                var pad    = 4;
                var cellPx = Math.max(1, Math.floor((size - pad * 2) / Math.max(patRows, patCols)));
                var offX   = Math.floor((size - patCols * cellPx) / 2);
                var offY   = Math.floor((size - patRows * cellPx) / 2);
                var ctx    = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#70959A';
                for(var j = 0; j < pattern.length; j++){
                    ctx.fillRect(offX + pattern[j][1] * cellPx,
                                 offY + pattern[j][0] * cellPx, cellPx, cellPx);
                }
            },

            // Returns the number of live neighbours for cell at index i.
            // Accepts an explicit board snapshot so that a setState from a
            // concurrent click cannot change the data mid-tick.
            countLiveNeighbours : function(i, board, cols, rows, boundary){
                var col = i % cols;
                var row = Math.floor(i / cols);
                var count = 0;
                var toroidal = boundary === 'toroidal';
                for(var dc = -1; dc <= 1; dc++){
                    for(var dr = -1; dr <= 1; dr++){
                        if(dc === 0 && dr === 0){ continue; }
                        var nc, nr;
                        if(toroidal){
                            nc = (col + dc + cols) % cols;
                            nr = (row + dr + rows) % rows;
                        } else {
                            nc = col + dc;
                            nr = row + dr;
                            if(nc < 0 || nc >= cols || nr < 0 || nr >= rows){ continue; }
                        }
                        if(board[nr * cols + nc].status === 1){ count++; }
                    }
                }
                return count;
            },

            // Shared next-generation computation used by both findNewStates and stepGame.
            computeNextGeneration : function(boardSnapshot, cols, rows, birth, survive, boundary){
                var newStates = [];
                for(var i = 0; i < boardSnapshot.length; i++){
                    var n = this.countLiveNeighbours(i, boardSnapshot, cols, rows, boundary);
                    if(birth.indexOf(n) !== -1){
                        newStates.push(1);
                    } else if(boardSnapshot[i].status === 1 && survive.indexOf(n) !== -1){
                        newStates.push(1);
                    } else { newStates.push(0); }
                }
                return newStates;
            },

            _startLoop : function(){
                if(this._loopRunning){ return; }
                this._loopRunning = true;
                var tickId = ++this._tickId;
                var self = this;
                requestAnimationFrame(function(){ self.findNewStates(tickId); });
            },

            findNewStates : function(tickId){
                // Discard stale ticks that were queued before a reset or restart.
                if(tickId !== this._tickId){
                    this._loopRunning = false;
                    return;
                }
                if(this.state.running === true){
                    var boardSnapshot = this.state.board.slice();
                    var cols = this.state.cols;
                    var rows = this.state.rows;
                    var birth = this.state.birthRule;
                    var survive = this.state.surviveRule;
                    var boundary = this.state.boundary;
                    var newStates = this.computeNextGeneration(boardSnapshot, cols, rows, birth, survive, boundary);
                    var copyOfBoard = boardSnapshot.map(function(cell){
                        return {x: cell.x, y: cell.y, status: cell.status};
                    });
                    var self = this;
                    var myTickId = tickId;
                    this.setState({
                        board :       this.changeCopiedBoard(copyOfBoard, newStates),
                        generations : this.state.generations + 1
                    }, function(){
                        self.drawBoard();
                        var delays = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];
                        var delay = delays[self.state.speed - 1];
                        setTimeout(function(){
                            requestAnimationFrame(function(){ self.findNewStates(myTickId); });
                        }, delay);
                    });
                } else {
                    this._loopRunning = false;
                }
            },

            // Advance exactly one generation (pauses the game).
            stepGame : function(){
                var boardSnapshot = this.state.board.slice();
                var cols = this.state.cols;
                var rows = this.state.rows;
                var birth = this.state.birthRule;
                var survive = this.state.surviveRule;
                var boundary = this.state.boundary;
                var newStates = this.computeNextGeneration(boardSnapshot, cols, rows, birth, survive, boundary);
                var copyOfBoard = boardSnapshot.map(function(cell){
                    return {x: cell.x, y: cell.y, status: cell.status};
                });
                var self = this;
                this.setState({
                    board :       this.changeCopiedBoard(copyOfBoard, newStates),
                    running :     false,
                    generations : this.state.generations + 1
                }, function(){ self.drawBoard(); });
            },

            changeCopiedBoard : function(copyOfBoard, newStates){
                for(var i = 0; i < copyOfBoard.length; i++){
                    copyOfBoard[i].status = newStates[i];
                }
                return copyOfBoard;
            },

            // ── Mouse / painting ────────────────────────────────────────────

            getMousePos : function(event){
                var canvasEl = this._canvas;
                var rect = canvasEl.getBoundingClientRect();
                var scaleX = canvasEl.width / rect.width;
                var scaleY = canvasEl.height / rect.height;
                return {
                    x : (event.clientX - rect.left) * scaleX,
                    y : (event.clientY - rect.top)  * scaleY
                };
            },

            // Paint a single cell directly to the canvas (used during drag for
            // immediate visual feedback without waiting for a setState round-trip).
            paintCellDirect : function(c, r){
                var canvas = this._canvas;
                var ctx = canvas.getContext("2d");
                var cellSize = this.state.cellSize;
                ctx.fillStyle = this._dragStatus === 1 ? "#70959A" : "#FFFFFF";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                if(this.state.gridLines){
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }
            },

            onMouseDown : function(event){
                event.preventDefault();
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                var c = Math.floor(mouse.x / cellSize);
                var r = Math.floor(mouse.y / cellSize);
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }
                // Pattern placement mode: stamp and return; do not start a drag.
                if(this.state.selectedPattern){
                    if(!this.state.liveClickMode){
                        this.setState({running : false});
                    }
                    this.placePattern(this.state.selectedPattern, c, r);
                    return;
                }
                // Normal draw mode: begin drag-paint.
                if(!this.state.liveClickMode){
                    this.setState({running : false});
                }
                var idx = r * this.state.cols + c;
                this._dragging = true;
                this._dragStatus = this.state.board[idx].status === 0 ? 1 : 0;
                this._paintedCells = {};
                this._paintedCells[idx] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseMove : function(event){
                // Skip all work if there is nothing to do.
                if(!this.state.selectedPattern && !this._dragging){ return; }
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                var c = Math.floor(mouse.x / cellSize);
                var r = Math.floor(mouse.y / cellSize);
                // Pattern placement mode: update hover preview.
                if(this.state.selectedPattern){
                    var inBounds = c >= 0 && c < this.state.cols && r >= 0 && r < this.state.rows;
                    var newPos = inBounds ? {c : c, r : r} : null;
                    var prev = this._previewPos;
                    // Only redraw if the hovered cell actually changed.
                    if(prev === newPos){ return; }
                    if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
                    this._previewPos = newPos;
                    this.drawBoard();
                    return;
                }
                // Normal draw mode: continue drag-paint.
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }
                var idx = r * this.state.cols + c;
                if(this._paintedCells[idx] !== undefined){ return; }
                this._paintedCells[idx] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            // Sync painted cells into React state when the drag ends.
            onMouseUp : function(){
                if(!this._dragging){ return; }
                this._dragging = false;
                var paintedCells = this._paintedCells;
                var newBoard = this.state.board.map(function(cell, i){
                    return {
                        x :      cell.x,
                        y :      cell.y,
                        status : paintedCells[i] !== undefined ? paintedCells[i] : cell.status
                    };
                });
                this._paintedCells = {};
                var self = this;
                this.setState({board : newBoard}, function(){ self.drawBoard(); });
            },

            handleKeyDown : function(e){
                // Don't intercept when the user is typing in a form control.
                if(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].indexOf(e.target.tagName) !== -1){ return; }
                switch(e.key){
                    case ' ':
                        e.preventDefault();
                        this.toggleGame();
                        break;
                    case '.':
                        e.preventDefault();
                        this.stepGame();
                        break;
                    case 'r': case 'R':
                        this.resetGame();
                        break;
                    case 'e': case 'E':
                        this.emptyBoard();
                        break;
                    case '[':
                        if(this.state.selectedPattern){ this.rotateCCW(); }
                        break;
                    case ']':
                        if(this.state.selectedPattern){ this.rotateCW(); }
                        break;
                }
            },

            // Clear the hover preview when the cursor leaves the canvas.
            onMouseLeave : function(){
                if(this.state.selectedPattern){
                    this._previewPos = null;
                    this.drawBoard();
                    return;
                }
                this.onMouseUp();
            },

            // ── Toggles ──────────────────────────────────────────────────────

            toggleClickMode : function(){
                this.setState({liveClickMode : !this.state.liveClickMode});
            },

            toggleGridLines : function(){
                var self = this;
                this.setState({gridLines : !this.state.gridLines}, function(){
                    self.drawBoard();
                });
            },

            toggleBoundary : function(){
                this.setState({boundary : this.state.boundary === 'toroidal' ? 'finite' : 'toroidal'});
            },

            toggleGame : function(){
                if(this.state.running === true){
                    this.setState({running : false});
                } else {
                    this.setState({running : true});
                    this._startLoop();
                }
            },

            // ── Sliders ───────────────────────────────────────────────────────

            resizeBoard : function(newCols, newRows){
                var cellSize = this.state.cellSize;
                var oldCols = this.state.cols;
                var oldRows = this.state.rows;
                var oldBoard = this.state.board;
                var newBoard = [];
                for(var r = 0; r < newRows; r++){
                    for(var c = 0; c < newCols; c++){
                        var status = (r < oldRows && c < oldCols)
                            ? oldBoard[r * oldCols + c].status
                            : 0;
                        newBoard.push({x : c * cellSize, y : r * cellSize, status : status});
                    }
                }
                var self = this;
                this.setState({
                    cols :        newCols,
                    rows :        newRows,
                    pendingCols : newCols,
                    pendingRows : newRows,
                    board :       newBoard
                }, function(){
                    self.drawBoard();
                });
            },

            // onChange: update the pending display value and preview the canvas size.
            setWidth : function(e){
                var self = this;
                this.setState({pendingCols : parseInt(e.target.value)}, function(){
                    self.drawBoard();
                });
            },

            // onMouseUp/onTouchEnd: commit the pending value and actually resize.
            applyWidth : function(){
                this.resizeBoard(this.state.pendingCols, this.state.rows);
            },

            setHeight : function(e){
                var self = this;
                this.setState({pendingRows : parseInt(e.target.value)}, function(){
                    self.drawBoard();
                });
            },

            applyHeight : function(){
                this.resizeBoard(this.state.cols, this.state.pendingRows);
            },

            // Updating the density slider only changes the value used on the next
            // Reset — it does not immediately randomise the board.
            setDensity : function(e){
                this.setState({sparseness : 9 - parseInt(e.target.value)});
            },

            setSpeed : function(e){
                this.setState({speed : parseInt(e.target.value)});
            },

            // ── Rules ─────────────────────────────────────────────────────────

            setRule : function(e){
                var val = e.target.value;
                var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
                if(match){
                    var birth   = match[1].split('').filter(Boolean).map(Number);
                    var survive = match[2].split('').filter(Boolean).map(Number);
                    this.setState({birthRule : birth, surviveRule : survive, ruleString : val});
                } else {
                    this.setState({ruleString : val});
                }
            },

            // ── Patterns ──────────────────────────────────────────────────────

            // Returns a copy of `cells` rotated 90° clockwise `steps` times.
            // Each cell is [row, col] relative to the top-left of the bounding box.
            rotatePattern : function(cells, steps){
                var result = cells.slice();
                for(var s = 0; s < steps; s++){
                    var maxR = 0;
                    for(var k = 0; k < result.length; k++){
                        if(result[k][0] > maxR){ maxR = result[k][0]; }
                    }
                    result = result.map(function(cell){
                        return [cell[1], maxR - cell[0]];
                    });
                }
                return result;
            },

            rotateCW : function(){
                var self = this;
                this.setState({patternRotation : (this.state.patternRotation + 1) % 4}, function(){
                    self.drawBoard();
                });
            },

            rotateCCW : function(){
                var self = this;
                this.setState({patternRotation : (this.state.patternRotation + 3) % 4}, function(){
                    self.drawBoard();
                });
            },

            // Enter/exit pattern placement mode.  Selecting a pattern arms the
            // cursor so the next click on the canvas places it; selecting the
            // blank "Draw mode" option returns to normal paint behaviour.
            selectPattern : function(e){
                var name = e.target.value || null;
                this._previewPos = null;
                var self = this;
                this.setState({selectedPattern : name, patternRotation : 0}, function(){ self.drawBoard(); });
            },

            // Stamp pattern `name` centred on cell (centerC, centerR), merging
            // with existing live cells (does not clear the board first).
            placePattern : function(name, centerC, centerR){
                var pattern = this.rotatePattern(PATTERNS[name], this.state.patternRotation);
                var cols = this.state.cols;
                var rows = this.state.rows;
                var maxR = 0, maxC = 0;
                for(var k = 0; k < pattern.length; k++){
                    if(pattern[k][0] > maxR){ maxR = pattern[k][0]; }
                    if(pattern[k][1] > maxC){ maxC = pattern[k][1]; }
                }
                var offsetR = centerR - Math.floor(maxR / 2);
                var offsetC = centerC - Math.floor(maxC / 2);
                var newBoard = this.state.board.map(function(cell){
                    return {x : cell.x, y : cell.y, status : cell.status};
                });
                for(var i = 0; i < pattern.length; i++){
                    var pr = pattern[i][0] + offsetR;
                    var pc = pattern[i][1] + offsetC;
                    if(pr >= 0 && pr < rows && pc >= 0 && pc < cols){
                        newBoard[pr * cols + pc].status = 1;
                    }
                }
                this._previewPos = null;
                var self = this;
                this.setState({board : newBoard}, function(){ self.drawBoard(); });
            },

            // ── Board actions ─────────────────────────────────────────────────

            emptyBoard : function(){
                var newBoard = this.state.board.map(function(cell){
                    return {x : cell.x, y : cell.y, status : 0};
                });
                var self = this;
                this.setState({running : false, generations : 0, board : newBoard}, function(){
                    self.drawBoard();
                });
            },

            resetGame : function(){
                var newBoard = this.buildBoard(
                    this.state.cols, this.state.rows,
                    this.state.sparseness, this.state.cellSize
                );
                var wasRunning = this.state.running;
                var self = this;
                // Invalidate any in-flight tick before swapping the board.
                this._tickId++;
                this._loopRunning = false;
                this.setState({running : false, generations : 0, board : newBoard}, function(){
                    self.drawBoard();
                    if(wasRunning){
                        self.setState({running : true}, function(){
                            self._startLoop();
                        });
                    }
                });
            },

            render : function(){
                var population = 0;
                for(var i = 0; i < this.state.board.length; i++){
                    if(this.state.board[i].status === 1){ population++; }
                }
                var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
                return(
                    <div>
                        <h2 className = "top">Conway's Game of Life</h2>
                        <div className = "content-body">
                            <div className = "canvas-container">
                                <canvas className = "display"
                                    width = {this.state.pendingCols * this.state.cellSize}
                                    height = {this.state.pendingRows * this.state.cellSize}
                                    id = "life-canvas"
                                    draggable = {false}
                                    onMouseDown =  {this.onMouseDown}
                                    onMouseMove =  {this.onMouseMove}
                                    onMouseUp =    {this.onMouseUp}
                                    onMouseLeave = {this.onMouseLeave}></canvas>
                            </div>
                            <div className = "sidebar">
                                <div className = "stats">
                                    <div>{"Generation: " + this.state.generations}</div>
                                    <div>{"Population: " + population}</div>
                                    <div className = {"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                        {this.state.running ? "Running" : "Paused"}
                                    </div>
                                </div>
                                <div className = "buttons">
                                    <button className = {"btn btn-toggle" + (this.state.running ? " active" : "")} onClick = {this.toggleGame}>{this.state.running ? "Pause" : "Play"}</button>
                                    <button className = "btn" onClick = {this.stepGame}>Step</button>
                                    <button className = "btn" onClick = {this.resetGame}>Reset</button>
                                    <button className = "btn" onClick = {this.emptyBoard}>Empty</button>
                                    <button className = {"btn btn-toggle" + (this.state.liveClickMode ? " active" : "")} onClick = {this.toggleClickMode}>{this.state.liveClickMode ? "Draw: Live" : "Draw: Pause"}</button>
                                    <button className = {"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick = {this.toggleGridLines}>Grid</button>
                                    <button className = {"btn btn-toggle" + (this.state.boundary === 'finite' ? " active" : "")} onClick = {this.toggleBoundary}>{"Edges: " + (this.state.boundary === 'toroidal' ? "Wrap" : "Dead")}</button>
                                </div>
                                <div className = "presets-col">
                                    <select className = {"preset-select" + (this.state.selectedPattern ? " active" : "")}
                                        value = {this.state.selectedPattern || ""}
                                        onChange = {this.selectPattern}>
                                        <option value = "">Draw mode</option>
                                        <option value = "Glider">Glider</option>
                                        <option value = "Blinker">Blinker</option>
                                        <option value = "Toad">Toad</option>
                                        <option value = "Beacon">Beacon</option>
                                        <option value = "Pulsar">Pulsar</option>
                                        <option value = "R-pentomino">R-pentomino</option>
                                        <option value = "Acorn">Acorn</option>
                                        <option value = "Gosper Glider Gun">Gosper Glider Gun</option>
                                    </select>
                                    <input className = {"rule-input" + (ruleValid ? "" : " rule-input-invalid")}
                                        type = "text"
                                        value = {this.state.ruleString}
                                        onChange = {this.setRule}
                                        title = "Birth/Survival rule string (e.g. B3/S23)" />
                                </div>
                                {this.state.selectedPattern &&
                                    <div className = "rotation-row">
                                        <canvas className = "rotation-preview"
                                            width = "96" height = "96"
                                            ref = {function(c){ self._previewCanvas = c; }} />
                                        <div className = "rotation-btns">
                                            <button className = "btn btn-rotate" onClick = {this.rotateCCW} title = "Rotate 90° counter-clockwise">&#8634;</button>
                                            <button className = "btn btn-rotate" onClick = {this.rotateCW} title = "Rotate 90° clockwise">&#8635;</button>
                                        </div>
                                    </div>
                                }
                                {this.state.selectedPattern &&
                                    <p className = "placement-hint">
                                        {"Click canvas to place · " + this.state.selectedPattern}
                                    </p>
                                }
                                <div className = "sliders">
                                    <label className = "slider-title">{"Width: " + this.state.pendingCols}</label>
                                    <div className = "slider-row">
                                        <input type = "range" min = "20" max = "200" step = "10"
                                            value = {this.state.pendingCols}
                                            onChange = {this.setWidth}
                                            onMouseUp = {this.applyWidth}
                                            onTouchEnd = {this.applyWidth} />
                                    </div>
                                </div>
                                <div className = "sliders">
                                    <label className = "slider-title">{"Height: " + this.state.pendingRows}</label>
                                    <div className = "slider-row">
                                        <input type = "range" min = "20" max = "200" step = "10"
                                            value = {this.state.pendingRows}
                                            onChange = {this.setHeight}
                                            onMouseUp = {this.applyHeight}
                                            onTouchEnd = {this.applyHeight} />
                                    </div>
                                </div>
                                <div className = "sliders">
                                    <label className = "slider-title">Density (on Reset)</label>
                                    <div className = "slider-row">
                                        <input type = "range" min = "2" max = "7"
                                            value = {9 - this.state.sparseness}
                                            onChange = {this.setDensity} />
                                    </div>
                                </div>
                                <div className = "sliders">
                                    <label className = "slider-title">Speed</label>
                                    <div className = "slider-row">
                                        <input type = "range" min = "1" max = "10"
                                            value = {this.state.speed}
                                            onChange = {this.setSpeed} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});
