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
                    generations : 1
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

            // Returns the number of live neighbours for cell index i on a
            // toroidal (wrap-around) 100×100 grid (bugs 1-6 fix).
            countLiveNeighbours : function(i){
                var board = this.state.board;
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
                    var newStates = [];
                    for(var i = 0; i < this.state.board.length; i++){
                        var statusCounter = this.countLiveNeighbours(i);
                        if(statusCounter === 3){
                            newStates.push(1);
                        } else if(this.state.board[i].status === 1 && statusCounter === 2) {
                            newStates.push(1);
                        } else {newStates.push(0)}
                    }
                    var copyOfBoard = this.copyTheBoard();
                    this.setState({board : this.changeCopiedBoard(copyOfBoard, newStates)});
                    this.setState({generations : this.state.generations + 1});
                    this.drawBoard(this.state.boardSize);
                    requestAnimationFrame(this.findNewStates);
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

            mouseClick : function(event){
                this.setState({running : false});
                var canvas = $('#life-canvas');
                var canvasPosition = {
                    x: canvas.offset().left,
                    y: canvas.offset().top
                };
                var mouse  = {
                        x: event.pageX - canvasPosition.x,
                        y: event.pageY - canvasPosition.y
                    };
                this.findMouseSquare(mouse);
                this.drawBoard(this.state.boardSize);
            },

            findMouseSquare : function(mouse){
                var arr = [];
                arr = arr.concat(this.state.board);
                for(var i = 0; i < arr.length; i++){
                    if((mouse.x < arr[i].x + this.state.boardSize/100) && (mouse.y < arr[i].y + this.state.boardSize/100) && (mouse.x >= arr[i].x) && (mouse.y >= arr[i].y)){
                        if(arr[i].status !== 1){
                            arr[i].status = 1;
                        } else {arr[i].status = 0}
                    }
                }
                this.setState({board : arr});
            },

            moreSparse : function(){
                var arr = [];
                arr = arr.concat(this.state.sparseness);
                this.setState({sparseness : arr[0] + 1});
                this.resetGame();
            },

            lessSparse : function(){
                var arr = [];
                arr = arr.concat(this.state.sparseness);
                // Bug 7 fix: only decrease sparseness (= more live cells); never
                // increase it. The old else-if branch incorrectly raised sparseness
                // when it was already at or below the minimum, making "More" sparser.
                if(this.state.sparseness >= 3){
                    this.setState({sparseness : arr[0] - 1});
                }
                this.resetGame();
            },

            emptyBoard : function(){
                this.setState({sparseness : 1});
                this.resetGame();
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
                this.setState({running : false});
                this.setState({generations : 0});
                var newBoard = this.buildBoard(this.state.boardSize, this.state.sparseness);
                this.setState({board : newBoard[1]});
                this.drawBoard(this.state.boardSize);
            },

            render : function(){
                return(
                    <div>
                        <h2 className = "top">Conway's Game of Life</h2>
                        <canvas className = "display" width = "500" height = "500" id = "life-canvas" onClick = {this.mouseClick}></canvas>
                        <h3 className = "generations">{"Generations: " + this.state.generations}</h3>
                        <div className = "buttons row">
                            <button className = "btn col-xs-2" onClick = {this.toggleGame}>Start/Pause</button>
                            <button className = "btn col-xs-2" onClick = {this.resetGame}>Reset</button>
                            <button className = "btn col-xs-2" onClick = {this.moreSparse}>Fewer</button>
                            <button className = "btn col-xs-2" onClick = {this.lessSparse}>More</button>
                            <button className = "btn col-xs-2" onClick = {this.emptyBoard}>Empty</button>
                        </div>
                        <p className = "end">Coded by Travis Arbon</p>
                    </div>
                )
            }
        });

        ReactDOM.render(<div><LifeBoard/></div>, document.getElementById("content"));
    })();
});