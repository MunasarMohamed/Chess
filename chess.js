const boardSquares = document.querySelectorAll('.square');
const pieces = document.getElementsByClassName('piece');
const pieceImg = document.getElementsByTagName('img');
const div = document.querySelector('div')

// black pieces
const brook1 = document.getElementById("brook1");
const bknight1 = document.getElementById("bknight1");
const bbishop1 = document.getElementById("bbishop1");
const bqueen = document.getElementById("bqueen");
const bking = document.getElementById("bking");
const bbishop2 = document.getElementById("bbishop2");
const bknight2 = document.getElementById("bknight2");
const brook2 = document.getElementById("brook2");


// white pieces
const wknight1 = document.getElementById("wknight1");
const wbishop1 = document.getElementById("wbishop1");
const wqueen = document.getElementById("wqueen");
const wking = document.getElementById("wking");
const wbishop2 = document.getElementById("wbishop2");
const wknight2 = document.getElementById("wknight2");
const wrook2 = document.getElementById("wrook2");


// The board as game state. board[row][col], where row 0 is the 8th rank and col 0 is the a-file.
// Each square is either null or a piece like { type: "rook", color: "black", id: "brook1" }.
const board = [];

// The color of the player whose turn it is. White always starts.
let currentTurn = 'white';

// Function for reading the starting position from the pieces in the HTML.
function readBoardFromDom() {
    for (let i = 0; i < boardSquares.length; i++) {
        let row = Math.floor(i / 8);
        let col = i % 8;
        let img = boardSquares[i].querySelector('img');

        if (col == 0) {
            board.push([]);
        }

        if (img) {
            let color = img.id[0] == 'w' ? 'white' : 'black';
            board[row].push({ type: img.alt, color: color, id: img.id });
        } else {
            board[row].push(null);
        }
    }
}

readBoardFromDom();

// Function for turning a square ID like "e2" into a board position [row, col].
function getPosition(squareId) {
    let col = squareId.charCodeAt(0) - 'a'.charCodeAt(0);
    let row = 8 - Number(squareId[1]);
    return [row, col];
}

// Function for getting the piece on a square, or null if the square is empty.
function getPiece(squareId) {
    let [row, col] = getPosition(squareId);
    return board[row][col];
}

// Function for checking if a move is allowed. The movement rules for each piece are added later.
function isLegalMove(from, to) {
    let piece = getPiece(from);
    let target = getPiece(to);

// There must be a piece on the square, and it must be that player's turn.
    if (!piece || piece.color != currentTurn) {
        return false;
    }

// A piece can't stay on the square it came from.
    if (from == to) {
        return false;
    }

// A piece can't capture a piece of its own color.
    if (target && target.color == piece.color) {
        return false;
    }

    return true;
}

// Function for moving a piece from one square to another, first in the game state and then in the DOM.
// Returns the captured piece, or null if nothing was captured.
function applyMove(from, to) {
    let [fromRow, fromCol] = getPosition(from);
    let [toRow, toCol] = getPosition(to);
    let piece = board[fromRow][fromCol];
    let captured = board[toRow][toCol];

    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

// The captured piece is removed by its ID, so nothing else in the square is touched.
    if (captured) {
        document.getElementById(captured.id).remove();
    }
    document.getElementById(to).appendChild(document.getElementById(piece.id));

// After a move it is the other player's turn.
    currentTurn = currentTurn == 'white' ? 'black' : 'white';

    return captured;
}

// Functions allowing drops inside the Squares.
function allowDrop(event) {
    event.preventDefault();
}

// Function for dragging the ID of the pieces.
function drag(event){
    let piece = getPiece(event.target.closest('.square').id);

// Only the pieces of the player whose turn it is can be dragged.
    if (!piece || piece.color != currentTurn) {
        event.preventDefault();
        return;
    }

    event.dataTransfer.setData("text", event.target.id);
}

// Function for dropping the pieces into other squares and on other pieces.
function drop(event){
    
    event.preventDefault();
    var data = event.dataTransfer.getData("text");
    let draggedElement = document.getElementById(data);

// Only pieces from the board can be dropped (not text or images dragged in from outside).
    if (!draggedElement || draggedElement.tagName != 'IMG') {
        return;
    }

    let from = draggedElement.closest('.square').id;
    let to = event.target.closest('.square').id;

// If the move is not allowed, nothing happens and the piece stays where it was.
    if (!isLegalMove(from, to)) {
        return;
    }

    applyMove(from, to);
}
