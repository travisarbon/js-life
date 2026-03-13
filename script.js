/**
 * Created by Travis on 8/6/2016.
 */
$(document).ready(function(){
    (function(){

        var LifeBoard = React.createClass({

            getInitialState : function(){
                var initialSize = this.buildBoard(500, 2);
                return {
                    running : true,
                    boardSize : initialSize[0],
                    sparseness : 2,
                    board: initialSize[1],
                    generations : 1,
                    liveClickMode : false,
                    speed : 5
                }
            },

            componentDidMount : function(){
                this.drawBoard(this.state.boardSize);
                requestAnimationFrame(this.findNewStates);
            },

            buildBoard : function(boardSize, sparseness){
                var x = 0;
                var y = 0;
                var arr = [];
                for(var i = 0; i < boardSize * boardSize; i++){
                    var status = Math.floor(Math.random() * (sparseness));
                    if(x < boardSize && y !== boardSize){
                        arr.push({"x" : x, "y" : y, "status" : status});
                        x = x + boardSize/100;
                    } else if(x == boardSize && y !== boardSize){
                        if(y < (boardSize - boardSize/100)){
                            x = 0;
                            y = y + boardSize/100;
                            arr.push({"x" : x, "y" : y, "status" : status});
                            x = boardSize/100;
                        }
                    } else if(y == boardSize){
                        i = boardSize * boardSize;
                    }
                }
                return [boardSize, arr];
            },

            drawBoard : function(boardSize){
                    var canvas = document.getElementById("life-canvas");
                    var ctx = canvas.getContext("2d");
                    for(var i = 0; i < this.state.board.length; i++){
                        if(this.state.board[i].status === 1){
                            ctx.fillStyle = "#70959A";
                            ctx.fillRect(this.state.board[i].x,this.state.board[i].y, boardSize/100, boardSize/100);
                        } else {
                            ctx.fillStyle = "#FFFFFF";
                            ctx.fillRect(this.state.board[i].x,this.state.board[i].y, boardSize/100, boardSize/100);
                        }
                    }
            },

            // Returns the number of live neighbours for cell index i.
            // Accepts an explicit board snapshot so that a setState from a
            // concurrent click cannot change the data mid-tick.
            countLiveNeighbours : function(i, board){
                var col = i % 100;
                var row = Math.floor(i / 100);
                var count = 0;
                for(var dc = -1; dc <= 1; dc++){
                    for(var dr = -1; dr <= 1; dr++){
                        if(dc === 0 && dr === 0){ continue; }
                        var nc = (col + dc + 100) % 100;
                        var nr = (row + dr + 100) % 100;
                        if(board[nr * 100 + nc].status === 1){ count++; }
                    }
                }
                return count;
            },

            findNewStates : function(){
                if(this.state.running == true){
                    // Snapshot the board once per tick so that a click arriving
                    // mid-loop (in live-click mode) does not affect this tick's
                    // neighbour reads.
                    var boardSnapshot = this.state.board.slice();
                    var newStates = [];
                    for(var i = 0; i < boardSnapshot.length; i++){
                        var statusCounter = this.countLiveNeighbours(i, boardSnapshot);
                        if(statusCounter === 3){
                            newStates.push(1);
                        } else if(boardSnapshot[i].status === 1 && statusCounter === 2) {
                            newStates.push(1);
                        } else {newStates.push(0)}
                    }
                    var copyOfBoard = boardSnapshot.map(function(cell){
                        return {x: cell.x, y: cell.y, status: cell.status};
                    });
                    var self = this;
                    this.setState({
                        board: this.changeCopiedBoard(copyOfBoard, newStates),
                        generations: this.state.generations + 1
                    }, function(){
                        self.drawBoard(self.state.boardSize);
                        var delays = [1000, 500, 250, 150, 100, 60, 30, 15, 5, 0];
                        var delay = delays[self.state.speed - 1];
                        setTimeout(function(){ requestAnimationFrame(self.findNewStates); }, delay);
                    });
                }
            },

            copyTheBoard : function(){
                // Bug 8 fix: deep-copy each cell object so that changeCopiedBoard
                // does not mutate the objects still referenced by this.state.board.
                return this.state.board.map(function(cell){
                    return {x: cell.x, y: cell.y, status: cell.status};
                });
            },

            changeCopiedBoard : function(copyOfBoard, newStates){
                for(var i = 0; i < copyOfBoard.length; i++){
                    copyOfBoard[i].status = newStates[i];
                }
                return copyOfBoard;
            },

            toggleClickMode : function(){
                this.setState({liveClickMode : !this.state.liveClickMode});
            },

            mouseClick : function(event){
                if(!this.state.liveClickMode){
                    this.setState({running : false});
                }
                var canvasEl = document.getElementById("life-canvas");
                var rect = canvasEl.getBoundingClientRect();
                var scaleX = canvasEl.width / rect.width;
                var scaleY = canvasEl.height / rect.height;
                var mouse = {
                    x: (event.clientX - rect.left) * scaleX,
                    y: (event.clientY - rect.top) * scaleY
                };
                this.findMouseSquare(mouse);
            },

            findMouseSquare : function(mouse){
                var arr = this.state.board.map(function(cell){
                    return {x: cell.x, y: cell.y, status: cell.status};
                });
                for(var i = 0; i < arr.length; i++){
                    if((mouse.x < arr[i].x + this.state.boardSize/100) && (mouse.y < arr[i].y + this.state.boardSize/100) && (mouse.x >= arr[i].x) && (mouse.y >= arr[i].y)){
                        if(arr[i].status !== 1){
                            arr[i].status = 1;
                        } else {arr[i].status = 0}
                    }
                }
                var self = this;
                this.setState({board : arr}, function(){
                    self.drawBoard(self.state.boardSize);
                });
            },

            setDensity : function(e){
                var self = this;
                // Slider value runs low=sparse to high=dense; invert to get sparseness.
                var sparseness = 9 - parseInt(e.target.value);
                this.setState({sparseness : sparseness}, function(){
                    self.resetGame();
                });
            },

            setSpeed : function(e){
                this.setState({speed : parseInt(e.target.value)});
            },

            emptyBoard : function(){
                var self = this;
                this.setState({sparseness : 1}, function(){
                    self.resetGame();
                });
            },

            toggleGame : function(){
                if(this.state.running === true){
                    this.setState({running : false});
                } else if(this.state.running === false){
                    this.setState({running : true});
                    requestAnimationFrame(this.findNewStates);
                }
            },

            resetGame : function(){
                var newBoard = this.buildBoard(this.state.boardSize, this.state.sparseness);
                var self = this;
                this.setState({running : false, generations : 0, board : newBoard[1]}, function(){
                    self.drawBoard(self.state.boardSize);
                });
            },

            render : function(){
                return(
                    <div>
                        <h2 className = "top">Conway's Game of Life</h2>
                        <canvas className = "display" width = "500" height = "500" id = "life-canvas" onClick = {this.mouseClick}></canvas>
                        <h3 className = "generations">{"Generations: " + this.state.generations}</h3>
                        <div className = "buttons">
                            <button className = "btn" onClick = {this.toggleGame}>Start/Pause</button>
                            <button className = "btn" onClick = {this.resetGame}>Reset</button>
                            <button className = "btn" onClick = {this.emptyBoard}>Empty</button>
                            <button className = {"btn btn-click-mode" + (this.state.liveClickMode ? " active" : "")} onClick = {this.toggleClickMode}>{"Click: " + (this.state.liveClickMode ? "Live" : "Pause")}</button>
                        </div>
                        <div className = "sliders">
                            <label className = "slider-title">Density</label>
                            <div className = "slider-row">
                                <span className = "slider-label">Sparse</span>
                                <input type = "range" min = "2" max = "7"
                                    value = {9 - this.state.sparseness}
                                    onChange = {this.setDensity} />
                                <span className = "slider-label">Dense</span>
                            </div>
                        </div>
                        <div className = "sliders">
                            <label className = "slider-title">Speed</label>
                            <div className = "slider-row">
                                <span className = "slider-label">Slow</span>
                                <input type = "range" min = "1" max = "10"
                                    value = {this.state.speed}
                                    onChange = {this.setSpeed} />
                                <span className = "slider-label">Fast</span>
                            </div>
                        </div>
                    </div>
                )
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});