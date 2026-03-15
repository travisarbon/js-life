/**
 * Conway's Game of Life
 */

// ── Preset patterns ───────────────────────────────────────────────────────────
// All cells are [row, col] offsets (0-indexed from top-left of bounding box).
var PATTERN_GROUPS = {
    'Still lifes': {
        'Block':   [[0,0],[0,1],[1,0],[1,1]],
        'Beehive': [[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],
        'Loaf':    [[0,1],[0,2],[1,0],[1,3],[2,1],[2,3],[3,2]],
        'Boat':    [[0,0],[0,1],[1,0],[1,2],[2,1]]
    },
    'Oscillators': {
        'Blinker':        [[0,0],[0,1],[0,2]],
        'Toad':           [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],
        'Beacon':         [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
        'Pulsar':         [
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
        // Period-15 oscillator: row of 10 with specific corners modified.
        'Pentadecathlon': [[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]]
    },
    'Spaceships': {
        'Glider': [[0,1],[1,2],[2,0],[2,1],[2,2]],
        // Lightweight spaceship — moves horizontally.
        'LWSS':   [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
        // Middleweight spaceship.
        'MWSS':   [[0,3],[1,1],[1,5],[2,0],[3,0],[3,5],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // Heavyweight spaceship.
        'HWSS':   [[0,3],[0,4],[1,1],[1,6],[2,0],[3,0],[3,6],[4,0],[4,1],[4,2],[4,3],[4,4],[4,5]]
    },
    'Methuselahs': {
        'R-pentomino': [[0,1],[0,2],[1,0],[1,1],[2,1]],
        'Acorn':       [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]],
        // Diehard: vanishes completely after 130 generations.
        'Diehard':     [[0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]]
    },
    'Guns': {
        'Gosper Glider Gun': [
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
    }
};

// Flat lookup keyed by pattern name for O(1) access.
var PATTERNS = {};
Object.keys(PATTERN_GROUPS).forEach(function(group){
    Object.keys(PATTERN_GROUPS[group]).forEach(function(name){
        PATTERNS[name] = PATTERN_GROUPS[group][name];
    });
});

// ── Rule presets ──────────────────────────────────────────────────────────────
var RULE_PRESETS = [
    { name: 'Conway (B3/S23)',                rule: 'B3/S23' },
    { name: 'HighLife (B36/S23)',             rule: 'B36/S23' },
    { name: 'Day & Night (B3678/S34678)',     rule: 'B3678/S34678' },
    { name: 'Maze (B3/S12345)',               rule: 'B3/S12345' },
    { name: 'Seeds (B2/S)',                   rule: 'B2/S' },
    { name: 'Replicator (B1357/S1357)',       rule: 'B1357/S1357' },
    { name: 'Life w/o Death (B3/S012345678)', rule: 'B3/S012345678' },
    { name: 'Anneal (B4678/S35678)',          rule: 'B4678/S35678' }
];

// Delay in ms per generation, indexed by speed 1-10.
var SPEED_DELAYS = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];

$(document).ready(function(){
    (function(){

        var LifeBoard = React.createClass({

            // ── Lifecycle ─────────────────────────────────────────────────────

            getInitialState : function(){
                var cellSize = 5;
                var cols = 100;
                var rows = 100;
                return {
                    running :        true,
                    cellSize :       cellSize,
                    cols :           cols,
                    rows :           rows,
                    sparseness :     2,
                    board :          this.buildBoard(cols, rows, 2, cellSize),
                    generations :    0,
                    liveClickMode :  false,
                    speed :          5,
                    gridLines :      false,
                    boundary :       'toroidal',
                    birthRule :      [3],
                    surviveRule :    [2, 3],
                    ruleString :     'B3/S23',
                    rulePreset :     'B3/S23',
                    selectedPattern: null,
                    patternRotation: 0,
                    pendingCols :    cols,
                    pendingRows :    rows,
                    popHistory :     [],
                    stable :         false,
                    showHelp :       false,
                    showRle :        false,
                    rleInput :       '',
                    rleError :       ''
                };
            },

            componentDidMount : function(){
                this._dragging = false;
                this._dragStatus = null;
                this._paintedCells = {};
                this._previewPos = null;
                this._loopRunning = false;
                this._tickId = 0;
                this._undoStack = [];
                this._prevBoardHash = null;
                this._stableCount = 0;
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

            // ── Board construction ─────────────────────────────────────────────

            buildBoard : function(cols, rows, sparseness, cellSize){
                var arr = [];
                for(var r = 0; r < rows; r++){
                    for(var c = 0; c < cols; c++){
                        arr.push({
                            x :      c * cellSize,
                            y :      r * cellSize,
                            status : Math.random() < (1 / sparseness) ? 1 : 0,
                            age :    0
                        });
                    }
                }
                return arr;
            },

            // ── Rendering ─────────────────────────────────────────────────────

            drawBoard : function(){
                var canvas = this._canvas;
                var ctx = canvas.getContext("2d");
                var cellSize = this.state.cellSize;
                var cols = this.state.cols;
                var rows = this.state.rows;
                var pendingCols = this.state.pendingCols;
                var pendingRows = this.state.pendingRows;

                // Draw cells with age-based coloring.
                // Young cells (age 1) render as a light tint that deepens toward
                // the full teal #70959A as cells age past 10 generations.
                for(var i = 0; i < this.state.board.length; i++){
                    var cell = this.state.board[i];
                    if(cell.status === 1){
                        var t = Math.min((cell.age || 1) / 10, 1);
                        var cr = Math.round(200 - 88 * t);
                        var cg = Math.round(220 - 71 * t);
                        var cb = Math.round(222 - 68 * t);
                        ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
                    } else {
                        ctx.fillStyle = '#FFFFFF';
                    }
                    ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
                }

                if(this.state.gridLines){
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    for(var c = 0; c <= pendingCols; c++){
                        ctx.moveTo(c * cellSize, 0);
                        ctx.lineTo(c * cellSize, pendingRows * cellSize);
                    }
                    for(var r = 0; r <= pendingRows; r++){
                        ctx.moveTo(0, r * cellSize);
                        ctx.lineTo(pendingCols * cellSize, r * cellSize);
                    }
                    ctx.stroke();
                }

                // Pattern placement preview — semi-transparent overlay under cursor.
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

            // ── Neighbour counting & generation logic ─────────────────────────

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

            // Returns an array of {status, age} objects for the next generation.
            computeNextGeneration : function(boardSnapshot, cols, rows, birth, survive, boundary){
                var newStates = [];
                for(var i = 0; i < boardSnapshot.length; i++){
                    var n = this.countLiveNeighbours(i, boardSnapshot, cols, rows, boundary);
                    var wasAlive = boardSnapshot[i].status === 1;
                    var alive = (wasAlive  && survive.indexOf(n) !== -1) ||
                                (!wasAlive && birth.indexOf(n)   !== -1);
                    newStates.push({
                        status : alive ? 1 : 0,
                        age :    alive ? (boardSnapshot[i].age || 0) + 1 : 0
                    });
                }
                return newStates;
            },

            // ── Animation loop ─────────────────────────────────────────────────

            _startLoop : function(){
                if(this._loopRunning){ return; }
                this._loopRunning = true;
                var tickId = ++this._tickId;
                var self = this;
                requestAnimationFrame(function(){ self.findNewStates(tickId); });
            },

            findNewStates : function(tickId){
                if(tickId !== this._tickId){
                    this._loopRunning = false;
                    return;
                }
                if(this.state.running === true){
                    var boardSnapshot = this.state.board.slice();
                    var cols     = this.state.cols;
                    var rows     = this.state.rows;
                    var birth    = this.state.birthRule;
                    var survive  = this.state.surviveRule;
                    var boundary = this.state.boundary;
                    var newStates = this.computeNextGeneration(boardSnapshot, cols, rows, birth, survive, boundary);

                    // Stability detection: auto-pause when the board stops changing.
                    var boardHash = newStates.map(function(s){ return s.status; }).join('');
                    var isStable  = (boardHash === this._prevBoardHash);
                    this._prevBoardHash = boardHash;
                    this._stableCount = isStable ? this._stableCount + 1 : 0;
                    var hitStable = this._stableCount >= 2;

                    // Maintain population history (last 60 data points for sparkline).
                    var newPop = 0;
                    for(var k = 0; k < newStates.length; k++){
                        if(newStates[k].status === 1){ newPop++; }
                    }
                    var newHistory = this.state.popHistory.concat([newPop]);
                    if(newHistory.length > 60){ newHistory = newHistory.slice(newHistory.length - 60); }

                    var copyOfBoard = boardSnapshot.map(function(cell){
                        return {x: cell.x, y: cell.y, status: cell.status, age: cell.age || 0};
                    });
                    var self = this;
                    var myTickId = tickId;
                    this.setState({
                        board :       this.changeCopiedBoard(copyOfBoard, newStates),
                        generations : this.state.generations + 1,
                        popHistory :  newHistory,
                        stable :      hitStable,
                        running :     hitStable ? false : this.state.running
                    }, function(){
                        self.drawBoard();
                        if(hitStable){ self._loopRunning = false; return; }
                        var delay = SPEED_DELAYS[self.state.speed - 1];
                        setTimeout(function(){
                            requestAnimationFrame(function(){ self.findNewStates(myTickId); });
                        }, delay);
                    });
                } else {
                    this._loopRunning = false;
                }
            },

            stepGame : function(){
                this.pushUndo();
                var boardSnapshot = this.state.board.slice();
                var cols     = this.state.cols;
                var rows     = this.state.rows;
                var birth    = this.state.birthRule;
                var survive  = this.state.surviveRule;
                var boundary = this.state.boundary;
                var newStates = this.computeNextGeneration(boardSnapshot, cols, rows, birth, survive, boundary);
                var newPop = 0;
                for(var k = 0; k < newStates.length; k++){
                    if(newStates[k].status === 1){ newPop++; }
                }
                var newHistory = this.state.popHistory.concat([newPop]);
                if(newHistory.length > 60){ newHistory = newHistory.slice(newHistory.length - 60); }
                var copyOfBoard = boardSnapshot.map(function(cell){
                    return {x: cell.x, y: cell.y, status: cell.status, age: cell.age || 0};
                });
                var self = this;
                this.setState({
                    board :       this.changeCopiedBoard(copyOfBoard, newStates),
                    running :     false,
                    generations : this.state.generations + 1,
                    popHistory :  newHistory,
                    stable :      false
                }, function(){ self.drawBoard(); });
            },

            changeCopiedBoard : function(copyOfBoard, newStates){
                for(var i = 0; i < copyOfBoard.length; i++){
                    copyOfBoard[i].status = newStates[i].status;
                    copyOfBoard[i].age    = newStates[i].age;
                }
                return copyOfBoard;
            },

            // ── Undo ──────────────────────────────────────────────────────────

            pushUndo : function(){
                var snapshot = this.state.board.map(function(cell){
                    return {x: cell.x, y: cell.y, status: cell.status, age: cell.age || 0};
                });
                this._undoStack.push({board: snapshot, generations: this.state.generations});
                if(this._undoStack.length > 30){ this._undoStack.shift(); }
            },

            undo : function(){
                if(this._undoStack.length === 0){ return; }
                var entry = this._undoStack.pop();
                this._tickId++;
                this._loopRunning = false;
                this._prevBoardHash = null;
                this._stableCount = 0;
                var self = this;
                this.setState({
                    board :       entry.board,
                    generations : entry.generations,
                    running :     false,
                    stable :      false
                }, function(){ self.drawBoard(); });
            },

            // ── Export ─────────────────────────────────────────────────────────

            exportPNG : function(){
                var link = document.createElement('a');
                link.download = 'game-of-life-gen-' + this.state.generations + '.png';
                link.href = this._canvas.toDataURL('image/png');
                link.click();
            },

            // ── Help modal ─────────────────────────────────────────────────────

            toggleHelp : function(){
                this.setState({showHelp : !this.state.showHelp});
            },

            // ── Mouse / painting ───────────────────────────────────────────────

            getMousePos : function(event){
                var canvasEl = this._canvas;
                var rect = canvasEl.getBoundingClientRect();
                var scaleX = canvasEl.width  / rect.width;
                var scaleY = canvasEl.height / rect.height;
                return {
                    x : (event.clientX - rect.left) * scaleX,
                    y : (event.clientY - rect.top)  * scaleY
                };
            },

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
                // Right-click exits pattern placement mode.
                if(event.button === 2 && this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0},
                        function(){ self.drawBoard(); });
                    return;
                }
                if(event.button !== 0){ return; }
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                var c = Math.floor(mouse.x / cellSize);
                var r = Math.floor(mouse.y / cellSize);
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }
                if(this.state.selectedPattern){
                    if(!this.state.liveClickMode){ this.setState({running : false}); }
                    this.placePattern(this.state.selectedPattern, c, r);
                    return;
                }
                if(!this.state.liveClickMode){ this.setState({running : false}); }
                var idx = r * this.state.cols + c;
                this.pushUndo();
                this._dragging = true;
                this._dragStatus = this.state.board[idx].status === 0 ? 1 : 0;
                this._paintedCells = {};
                this._paintedCells[idx] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseMove : function(event){
                if(!this.state.selectedPattern && !this._dragging){ return; }
                var mouse = this.getMousePos(event);
                var cellSize = this.state.cellSize;
                var c = Math.floor(mouse.x / cellSize);
                var r = Math.floor(mouse.y / cellSize);
                if(this.state.selectedPattern){
                    var inBounds = c >= 0 && c < this.state.cols && r >= 0 && r < this.state.rows;
                    var newPos = inBounds ? {c : c, r : r} : null;
                    var prev = this._previewPos;
                    if(prev === newPos){ return; }
                    if(prev && newPos && prev.c === newPos.c && prev.r === newPos.r){ return; }
                    this._previewPos = newPos;
                    this.drawBoard();
                    return;
                }
                if(c < 0 || c >= this.state.cols || r < 0 || r >= this.state.rows){ return; }
                var idx = r * this.state.cols + c;
                if(this._paintedCells[idx] !== undefined){ return; }
                this._paintedCells[idx] = this._dragStatus;
                this.paintCellDirect(c, r);
            },

            onMouseUp : function(){
                if(!this._dragging){ return; }
                this._dragging = false;
                var paintedCells = this._paintedCells;
                var newBoard = this.state.board.map(function(cell, i){
                    return {
                        x :      cell.x,
                        y :      cell.y,
                        status : paintedCells[i] !== undefined ? paintedCells[i] : cell.status,
                        age :    paintedCells[i] !== undefined ? 0 : (cell.age || 0)
                    };
                });
                this._paintedCells = {};
                var self = this;
                this.setState({board : newBoard, stable : false}, function(){ self.drawBoard(); });
            },

            onMouseLeave : function(){
                if(this.state.selectedPattern){
                    this._previewPos = null;
                    this.drawBoard();
                    return;
                }
                this.onMouseUp();
            },

            onContextMenu : function(event){
                event.preventDefault();
                if(this.state.selectedPattern){
                    this._previewPos = null;
                    var self = this;
                    this.setState({selectedPattern : null, patternRotation : 0},
                        function(){ self.drawBoard(); });
                }
            },

            // ── Touch support ─────────────────────────────────────────────────

            onTouchStart : function(event){
                event.preventDefault();
                var t = event.touches[0];
                this.onMouseDown({preventDefault: function(){}, button: 0,
                    clientX: t.clientX, clientY: t.clientY});
            },

            onTouchMove : function(event){
                event.preventDefault();
                var t = event.touches[0];
                this.onMouseMove({clientX: t.clientX, clientY: t.clientY});
            },

            onTouchEnd : function(event){
                event.preventDefault();
                this.onMouseUp();
            },

            // ── Keyboard ──────────────────────────────────────────────────────

            handleKeyDown : function(e){
                if(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].indexOf(e.target.tagName) !== -1){ return; }
                var self = this;
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
                    case 'z': case 'Z':
                        if(e.ctrlKey || e.metaKey){ e.preventDefault(); this.undo(); }
                        break;
                    case 's': case 'S':
                        if(!e.ctrlKey && !e.metaKey){ this.exportPNG(); }
                        break;
                    case '[':
                        if(this.state.selectedPattern){ this.rotateCCW(); }
                        break;
                    case ']':
                        if(this.state.selectedPattern){ this.rotateCW(); }
                        break;
                    case 'Escape':
                        if(this.state.selectedPattern){
                            this._previewPos = null;
                            this.setState({selectedPattern : null, patternRotation : 0},
                                function(){ self.drawBoard(); });
                        }
                        if(this.state.showHelp){
                            this.setState({showHelp : false});
                        }
                        break;
                    case '?':
                        this.toggleHelp();
                        break;
                }
            },

            // ── Toggles ───────────────────────────────────────────────────────

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
                if(this.state.running){
                    this.setState({running : false});
                } else {
                    this._prevBoardHash = null;
                    this._stableCount = 0;
                    this.setState({running : true, stable : false});
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
                        var inOld = r < oldRows && c < oldCols;
                        newBoard.push({
                            x :      c * cellSize,
                            y :      r * cellSize,
                            status : inOld ? oldBoard[r * oldCols + c].status : 0,
                            age :    inOld ? (oldBoard[r * oldCols + c].age || 0) : 0
                        });
                    }
                }
                var self = this;
                this.setState({
                    cols :        newCols,
                    rows :        newRows,
                    pendingCols : newCols,
                    pendingRows : newRows,
                    board :       newBoard
                }, function(){ self.drawBoard(); });
            },

            setWidth : function(e){
                var self = this;
                this.setState({pendingCols : parseInt(e.target.value)}, function(){
                    self.drawBoard();
                });
            },

            applyWidth : function(){
                this.resizeBoard(this.state.pendingCols, this.state.rows);
            },

            onWidthKeyDown : function(e){
                if(e.key === 'Enter'){ this.applyWidth(); }
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

            onHeightKeyDown : function(e){
                if(e.key === 'Enter'){ this.applyHeight(); }
            },

            setDensity : function(e){
                this.setState({sparseness : 9 - parseInt(e.target.value)});
            },

            setSpeed : function(e){
                this.setState({speed : parseInt(e.target.value)});
            },

            // ── Rules ─────────────────────────────────────────────────────────

            parseRuleString : function(val){
                var match = val.trim().toUpperCase().match(/^B([0-8]*)\/?S([0-8]*)$/);
                if(!match){ return null; }
                return {
                    birth :   match[1].split('').filter(Boolean).map(Number),
                    survive : match[2].split('').filter(Boolean).map(Number)
                };
            },

            setRule : function(e){
                var val = e.target.value;
                var parsed = this.parseRuleString(val);
                if(parsed){
                    this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                        ruleString : val, rulePreset : val.toUpperCase()});
                } else {
                    this.setState({ruleString : val, rulePreset : ''});
                }
            },

            setRulePreset : function(e){
                var rule = e.target.value;
                if(!rule){ return; }
                var parsed = this.parseRuleString(rule);
                if(parsed){
                    this.setState({birthRule : parsed.birth, surviveRule : parsed.survive,
                        ruleString : rule, rulePreset : rule});
                }
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
                if(!text){ this.setState({rleError : 'Paste an RLE pattern first.'}); return; }
                try {
                    var result = this.parseRLE(text);
                    if(result.cells.length === 0){
                        this.setState({rleError : 'No live cells found in pattern.'}); return;
                    }
                    PATTERNS['Custom (RLE)'] = result.cells;
                    var self = this;
                    this._previewPos = null;
                    this.setState({
                        selectedPattern : 'Custom (RLE)',
                        patternRotation : 0,
                        showRle :         false,
                        rleError :        ''
                    }, function(){ self.drawBoard(); });
                } catch(ex){
                    this.setState({rleError : 'Could not parse RLE: ' + ex.message});
                }
            },

            // Parses standard RLE format into an array of [row, col] cell coordinates.
            parseRLE : function(text){
                var lines = text.split(/\r?\n/);
                var dataLines = lines.filter(function(l){ return l.charAt(0) !== '#'; });
                var headerIdx = -1;
                for(var i = 0; i < dataLines.length; i++){
                    if(/x\s*=/i.test(dataLines[i])){ headerIdx = i; break; }
                }
                var dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
                var data = dataLines.slice(dataStart).join('').replace(/\s/g, '');
                var cells = [];
                var row = 0, col = 0, countStr = '';
                for(var k = 0; k < data.length; k++){
                    var ch = data[k];
                    if(ch >= '0' && ch <= '9'){
                        countStr += ch;
                    } else if(ch === 'b' || ch === 'o'){
                        var n = countStr ? parseInt(countStr, 10) : 1;
                        if(ch === 'o'){
                            for(var j = 0; j < n; j++){ cells.push([row, col + j]); }
                        }
                        col += n;
                        countStr = '';
                    } else if(ch === '$'){
                        var n2 = countStr ? parseInt(countStr, 10) : 1;
                        row += n2;
                        col = 0;
                        countStr = '';
                    } else if(ch === '!'){
                        break;
                    }
                }
                return {cells : cells};
            },

            // ── Patterns ──────────────────────────────────────────────────────

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
                this.setState({patternRotation : (this.state.patternRotation + 1) % 4},
                    function(){ self.drawBoard(); });
            },

            rotateCCW : function(){
                var self = this;
                this.setState({patternRotation : (this.state.patternRotation + 3) % 4},
                    function(){ self.drawBoard(); });
            },

            selectPattern : function(e){
                var name = e.target.value || null;
                this._previewPos = null;
                var self = this;
                this.setState({selectedPattern : name, patternRotation : 0},
                    function(){ self.drawBoard(); });
            },

            placePattern : function(name, centerC, centerR){
                this.pushUndo();
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
                    return {x : cell.x, y : cell.y, status : cell.status, age : cell.age || 0};
                });
                for(var i = 0; i < pattern.length; i++){
                    var pr = pattern[i][0] + offsetR;
                    var pc = pattern[i][1] + offsetC;
                    if(pr >= 0 && pr < rows && pc >= 0 && pc < cols){
                        newBoard[pr * cols + pc].status = 1;
                        newBoard[pr * cols + pc].age    = 0;
                    }
                }
                this._previewPos = null;
                var self = this;
                this.setState({board : newBoard, stable : false}, function(){ self.drawBoard(); });
            },

            // ── Board actions ─────────────────────────────────────────────────

            emptyBoard : function(){
                this.pushUndo();
                var newBoard = this.state.board.map(function(cell){
                    return {x : cell.x, y : cell.y, status : 0, age : 0};
                });
                this._prevBoardHash = null;
                this._stableCount = 0;
                var self = this;
                this.setState({running : false, generations : 0, board : newBoard,
                    popHistory : [], stable : false}, function(){ self.drawBoard(); });
            },

            resetGame : function(){
                this.pushUndo();
                var newBoard = this.buildBoard(
                    this.state.cols, this.state.rows,
                    this.state.sparseness, this.state.cellSize
                );
                var wasRunning = this.state.running;
                this._tickId++;
                this._loopRunning = false;
                this._prevBoardHash = null;
                this._stableCount = 0;
                var self = this;
                this.setState({running : false, generations : 0, board : newBoard,
                    popHistory : [], stable : false}, function(){
                    self.drawBoard();
                    if(wasRunning){
                        self.setState({running : true}, function(){ self._startLoop(); });
                    }
                });
            },

            // ── Render ────────────────────────────────────────────────────────

            render : function(){
                var self = this;
                var population = 0;
                for(var i = 0; i < this.state.board.length; i++){
                    if(this.state.board[i].status === 1){ population++; }
                }

                var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(this.state.ruleString);
                var delay = SPEED_DELAYS[this.state.speed - 1];
                var speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';

                // Build sparkline from population history.
                // The SVG uses a fixed viewBox (200×36) and width="100%" so it
                // scales to fill the sidebar without distorting the line height.
                // y maps population linearly into [2, 34] leaving 2px top padding.
                var sparkline = null;
                if(this.state.popHistory.length > 1){
                    var hist    = this.state.popHistory;
                    var maxPop  = Math.max.apply(null, hist);
                    if(maxPop === 0){ maxPop = 1; }
                    var vbW = 200, vbH = 36, padT = 2, innerH = vbH - padT * 2;
                    var sparkPts = hist.map(function(p, idx){
                        var x = hist.length === 1 ? vbW / 2 : (idx / (hist.length - 1)) * vbW;
                        var y = padT + (1 - p / maxPop) * innerH;
                        return x.toFixed(1) + ',' + y.toFixed(1);
                    }).join(' ');
                    sparkline = (
                        <div className="sparkline-wrap">
                            <div className="sparkline-header">
                                <span className="sparkline-title">Population</span>
                                <span className="sparkline-peak">{maxPop}</span>
                            </div>
                            <svg className="sparkline" width="100%" height={vbH}
                                 viewBox={"0 0 " + vbW + " " + vbH}
                                 preserveAspectRatio="none">
                                <line x1="0" y1={vbH - 0.5} x2={vbW} y2={vbH - 0.5}
                                      stroke="rgba(244,233,225,0.25)" strokeWidth="1"/>
                                <line x1="0" y1={padT + innerH / 2} x2={vbW} y2={padT + innerH / 2}
                                      stroke="rgba(244,233,225,0.1)" strokeWidth="0.5"/>
                                <polyline points={sparkPts} fill="none" stroke="#70959A"
                                          strokeWidth="1.5" strokeLinejoin="round"
                                          strokeLinecap="round"/>
                            </svg>
                            <div className="sparkline-footer">
                                <span>0</span>
                                <span>{hist.length + " gen"}</span>
                            </div>
                        </div>
                    );
                }

                // Build categorised pattern dropdown using <optgroup>.
                var patternOptions = Object.keys(PATTERN_GROUPS).map(function(group){
                    var opts = Object.keys(PATTERN_GROUPS[group]).map(function(name){
                        return <option key={name} value={name}>{name}</option>;
                    });
                    return <optgroup key={group} label={group}>{opts}</optgroup>;
                });
                if(PATTERNS['Custom (RLE)']){
                    patternOptions = patternOptions.concat(
                        <optgroup key="custom" label="Custom">
                            <option value="Custom (RLE)">Custom (RLE)</option>
                        </optgroup>
                    );
                }

                return (
                    <div>
                        {this.state.showHelp &&
                            <div className="help-overlay" onClick={this.toggleHelp}>
                                <div className="help-modal" onClick={function(e){ e.stopPropagation(); }}>
                                    <h3 className="help-title">Keyboard Shortcuts</h3>
                                    <table className="help-table">
                                        <tbody>
                                            <tr><td>Space</td><td>Play / Pause</td></tr>
                                            <tr><td>.</td><td>Step one generation</td></tr>
                                            <tr><td>R</td><td>Reset (random fill)</td></tr>
                                            <tr><td>E</td><td>Empty board</td></tr>
                                            <tr><td>Ctrl+Z</td><td>Undo</td></tr>
                                            <tr><td>S</td><td>Export PNG</td></tr>
                                            <tr><td>[</td><td>Rotate pattern CCW</td></tr>
                                            <tr><td>]</td><td>Rotate pattern CW</td></tr>
                                            <tr><td>Esc</td><td>Cancel placement / close help</td></tr>
                                            <tr><td>?</td><td>Show / hide this help</td></tr>
                                        </tbody>
                                    </table>
                                    <button className="btn help-close" onClick={this.toggleHelp}>Close</button>
                                </div>
                            </div>
                        }
                        <h2 className="top">Conway's Game of Life</h2>
                        <div className="content-body">
                            <div className={"canvas-container" + (this.state.boundary === 'toroidal' ? " boundary-wrap" : "")}>
                                <canvas className="display"
                                    width  = {this.state.pendingCols * this.state.cellSize}
                                    height = {this.state.pendingRows * this.state.cellSize}
                                    id = "life-canvas"
                                    draggable     = {false}
                                    onMouseDown   = {this.onMouseDown}
                                    onMouseMove   = {this.onMouseMove}
                                    onMouseUp     = {this.onMouseUp}
                                    onMouseLeave  = {this.onMouseLeave}
                                    onContextMenu = {this.onContextMenu}
                                    onTouchStart  = {this.onTouchStart}
                                    onTouchMove   = {this.onTouchMove}
                                    onTouchEnd    = {this.onTouchEnd}></canvas>
                            </div>
                            <div className="sidebar">
                                <div className="stats">
                                    <div className="stat-row">
                                        <span>{"Gen: " + this.state.generations}</span>
                                        <span className="board-dims">{this.state.cols + " \xD7 " + this.state.rows}</span>
                                    </div>
                                    <div>{"Pop: " + population}</div>
                                    <div className="status-badges">
                                        <span className={"status-indicator " + (this.state.running ? "status-running" : "status-paused")}>
                                            {this.state.running ? "Running" : "Paused"}
                                        </span>
                                        {this.state.stable &&
                                            <span className="status-indicator status-stable">Stable</span>
                                        }
                                    </div>
                                    {sparkline}
                                </div>

                                <div className="btn-section">
                                    <div className="buttons">
                                        <button className={"btn btn-toggle" + (this.state.running ? " active" : "")} onClick={this.toggleGame}>{this.state.running ? "Pause" : "Play"}</button>
                                        <button className="btn" onClick={this.stepGame}>Step</button>
                                        <button className="btn" onClick={this.resetGame}>Reset</button>
                                        <button className="btn" onClick={this.emptyBoard}>Empty</button>
                                        <button className="btn" onClick={this.undo}>Undo</button>
                                        <button className="btn" onClick={this.exportPNG}>Export PNG</button>
                                    </div>
                                    <div className="buttons buttons-secondary">
                                        <button className={"btn btn-toggle" + (this.state.liveClickMode ? " active" : "")} onClick={this.toggleClickMode}>{this.state.liveClickMode ? "Draw: On" : "Draw: Off"}</button>
                                        <button className={"btn btn-toggle" + (this.state.gridLines ? " active" : "")} onClick={this.toggleGridLines}>Grid</button>
                                        <button className={"btn btn-toggle" + (this.state.boundary === 'finite' ? " active" : "")} onClick={this.toggleBoundary}>{this.state.boundary === 'toroidal' ? "Wrap" : "Dead"}</button>
                                        <button className="btn" onClick={this.toggleHelp}>Help</button>
                                    </div>
                                </div>

                                <div className="presets-col">
                                    <select className="rule-preset-select"
                                        value={this.state.rulePreset}
                                        onChange={this.setRulePreset}>
                                        <option value="">Rule preset...</option>
                                        {RULE_PRESETS.map(function(p){
                                            return <option key={p.rule} value={p.rule}>{p.name}</option>;
                                        })}
                                    </select>
                                    <label className="slider-title rule-label">Rule (B/S notation)</label>
                                    <input className={"rule-input" + (ruleValid ? "" : " rule-input-invalid")}
                                        type="text"
                                        value={this.state.ruleString}
                                        onChange={this.setRule}
                                        title="Birth/Survival rule string (e.g. B3/S23)" />
                                    <select className={"preset-select" + (this.state.selectedPattern ? " active" : "")}
                                        value={this.state.selectedPattern || ""}
                                        onChange={this.selectPattern}>
                                        <option value="">Draw mode</option>
                                        {patternOptions}
                                    </select>
                                </div>

                                {this.state.selectedPattern &&
                                    <div className="rotation-row">
                                        <canvas className="rotation-preview"
                                            width="96" height="96"
                                            ref={function(c){ self._previewCanvas = c; }} />
                                        <div className="rotation-btns">
                                            <button className="btn btn-rotate" onClick={this.rotateCCW} title="Rotate 90° counter-clockwise">&#8634;</button>
                                            <button className="btn btn-rotate" onClick={this.rotateCW}  title="Rotate 90° clockwise">&#8635;</button>
                                        </div>
                                    </div>
                                }
                                {this.state.selectedPattern &&
                                    <p className="placement-hint">
                                        {"Click canvas to place \xB7 " + this.state.selectedPattern}
                                        <br/>
                                        <span className="placement-hint-sub">Right-click or Esc to cancel</span>
                                    </p>
                                }

                                <div className="sliders">
                                    <label className="slider-title">{"Width: " + this.state.pendingCols}</label>
                                    <div className="slider-row">
                                        <input type="range" min="20" max="200" step="10"
                                            value={this.state.pendingCols}
                                            onChange={this.setWidth}
                                            onMouseUp={this.applyWidth}
                                            onKeyDown={this.onWidthKeyDown}
                                            onTouchEnd={this.applyWidth} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">{"Height: " + this.state.pendingRows}</label>
                                    <div className="slider-row">
                                        <input type="range" min="20" max="200" step="10"
                                            value={this.state.pendingRows}
                                            onChange={this.setHeight}
                                            onMouseUp={this.applyHeight}
                                            onKeyDown={this.onHeightKeyDown}
                                            onTouchEnd={this.applyHeight} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">Density (on Reset)</label>
                                    <div className="slider-row">
                                        <input type="range" min="2" max="7"
                                            value={9 - this.state.sparseness}
                                            onChange={this.setDensity} />
                                    </div>
                                </div>
                                <div className="sliders">
                                    <label className="slider-title">{"Speed: " + speedLabel}</label>
                                    <div className="slider-row">
                                        <input type="range" min="1" max="10"
                                            value={this.state.speed}
                                            onChange={this.setSpeed} />
                                    </div>
                                </div>

                                <div className="rle-section">
                                    <button className={"btn btn-block btn-rle-toggle" + (this.state.showRle ? " active" : "")}
                                        onClick={this.toggleRle}>Import RLE</button>
                                    {this.state.showRle &&
                                        <div className="rle-body">
                                            <textarea className="rle-input"
                                                rows="5"
                                                placeholder={"Paste RLE pattern here\n(from LifeWiki or Golly)"}
                                                value={this.state.rleInput}
                                                onChange={this.setRleInput} />
                                            <button className="btn btn-block" onClick={this.loadRle}>Load pattern</button>
                                            {this.state.rleError &&
                                                <p className="rle-error">{this.state.rleError}</p>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});
