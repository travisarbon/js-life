/* Web Worker — Game of Life next-generation computation.
   Receives: { board, cols, rows, birth, survive, boundary, tickId }
   Posts:    { newStates, newPop, tickId }
*/
function countLiveNeighbours(idx, board, cols, rows, boundary) {
    var r = Math.floor(idx / cols);
    var c = idx % cols;
    var count = 0;
    for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr;
            var nc = c + dc;
            if (boundary === 'toroidal') {
                nr = (nr + rows) % rows;
                nc = (nc + cols) % cols;
            } else {
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            }
            if (board[nr * cols + nc].status === 1) count++;
        }
    }
    return count;
}

self.onmessage = function (e) {
    var d = e.data;
    var board   = d.board;
    var cols    = d.cols;
    var rows    = d.rows;
    var birth   = d.birth;
    var survive = d.survive;
    var boundary = d.boundary;
    var tickId  = d.tickId;

    var newStates = new Array(board.length);
    var newPop = 0;

    for (var i = 0; i < board.length; i++) {
        var n = countLiveNeighbours(i, board, cols, rows, boundary);
        var wasAlive = board[i].status === 1;
        var alive = wasAlive
            ? (survive.indexOf(n) !== -1)
            : (birth.indexOf(n) !== -1);
        newStates[i] = {
            status: alive ? 1 : 0,
            age:    alive ? (board[i].age || 0) + 1 : 0
        };
        if (alive) newPop++;
    }

    self.postMessage({ newStates: newStates, newPop: newPop, tickId: tickId });
};
