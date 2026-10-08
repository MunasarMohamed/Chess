// All 64 squares of the board, in the same order as in the HTML: a8, b8, ... h8, a7, ... h1.
const boardSquares = document.querySelectorAll('.square');

// The board as game state. board[row][col], where row 0 is the 8th rank and col 0 is the a-file.
// Each square is either null or a piece like { type: "rook", color: "black", id: "brook1" }.
const board = [];

// The color of the player whose turn it is. White always starts.
let currentTurn = 'white';

// The square of the piece selected by clicking or dragging, or null if no piece is selected.
let selectedSquare = null;

// The promotion move waiting for the player to choose a piece, like { from: "e7", to: "e8" }, or null.
let pendingPromotion = null;

// The square a pawn skipped with a two-square move, like "e3", where it can be captured en passant.
// It is only set for the move right after the two-square move, otherwise it is null.
let enPassantSquare = null;

// Whether each player may still castle on each side. A right is lost for good when the king moves,
// or when that side's rook moves or is captured.
let castlingRights = {
    white: { kingside: true, queenside: true },
    black: { kingside: true, queenside: true }
};

// Whether the game has ended by checkmate, stalemate or insufficient material. No moves are allowed after that.
let gameOver = false;

// The types of the pieces each player has captured, like { white: ["pawn", "knight"], black: [] }.
let capturedPieces = { white: [], black: [] };

// The value of each piece in points. The king can never be captured.
const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

// The color played on this computer in an online game, "white" or "black".
// It is null in a local game, where both players use the same computer.
let myColor = null;

// The PeerJS peer and the connection to the opponent in an online game. Both are null in a local game.
let peer = null;
let connection = null;

// All moves of the game so far, like { from: "e7", to: "e8", promotion: "queen" }.
// In an online game, White sends them to Black when Black joins or rejoins, so both boards are the same.
let moveHistory = [];

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

// A copy of the starting position from the HTML, used when the game is restarted.
const startBoard = board.map(row => row.map(piece => piece ? { type: piece.type, color: piece.color, id: piece.id } : null));

// Function for turning a square ID like "e2" into a board position [row, col].
function getPosition(squareId) {
    let col = squareId.charCodeAt(0) - 'a'.charCodeAt(0);
    let row = 8 - Number(squareId[1]);
    return [row, col];
}

// Function for turning a board position [row, col] back into a square ID like "e2".
function getSquareId(row, col) {
    return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
}

// Function for getting the piece on a square, or null if the square is empty.
function getPiece(squareId) {
    let [row, col] = getPosition(squareId);
    return board[row][col];
}

// Function for checking if all squares between two positions are empty. Used by rooks, bishops and queens.
function isPathClear(fromRow, fromCol, toRow, toCol) {
    let rowStep = Math.sign(toRow - fromRow);
    let colStep = Math.sign(toCol - fromCol);
    let row = fromRow + rowStep;
    let col = fromCol + colStep;

    while (row != toRow || col != toCol) {
        if (board[row][col]) {
            return false;
        }
        row += rowStep;
        col += colStep;
    }

    return true;
}

// Function for checking if a piece can move from one square to another by its own movement rules.
function canPieceMove(from, to) {
    let [fromRow, fromCol] = getPosition(from);
    let [toRow, toCol] = getPosition(to);
    let piece = board[fromRow][fromCol];
    let target = board[toRow][toCol];
    let rowDistance = Math.abs(toRow - fromRow);
    let colDistance = Math.abs(toCol - fromCol);

// The knight jumps in an L-shape and can jump over other pieces.
    if (piece.type == 'knight') {
        return (rowDistance == 2 && colDistance == 1) || (rowDistance == 1 && colDistance == 2);
    }

// The king moves one square in any direction.
    if (piece.type == 'king') {
        return rowDistance <= 1 && colDistance <= 1;
    }

// The rook moves in a straight line along a rank or a file.
    if (piece.type == 'rook') {
        return (rowDistance == 0 || colDistance == 0) && isPathClear(fromRow, fromCol, toRow, toCol);
    }

// The bishop moves diagonally.
    if (piece.type == 'bishop') {
        return rowDistance == colDistance && isPathClear(fromRow, fromCol, toRow, toCol);
    }

// The queen moves like both a rook and a bishop.
    if (piece.type == 'queen') {
        return (rowDistance == 0 || colDistance == 0 || rowDistance == colDistance) && isPathClear(fromRow, fromCol, toRow, toCol);
    }

    if (piece.type == 'pawn') {
// White pawns move up the board (towards row 0) and black pawns move down.
        let direction = piece.color == 'white' ? -1 : 1;
        let startRow = piece.color == 'white' ? 6 : 1;
        let rowMove = toRow - fromRow;

// One square forward, only to an empty square.
        if (colDistance == 0 && rowMove == direction && !target) {
            return true;
        }

// Two squares forward from the starting rank, only if both squares are empty.
        if (colDistance == 0 && rowMove == 2 * direction && fromRow == startRow && !target && !board[fromRow + direction][fromCol]) {
            return true;
        }

// One square diagonally forward, only when capturing.
        if (colDistance == 1 && rowMove == direction && target) {
            return true;
        }

// One square diagonally forward onto an empty square, when capturing en passant.
        if (colDistance == 1 && rowMove == direction && isEnPassant(from, to)) {
            return true;
        }

        return false;
    }

    return false;
}

// Function for checking if a square is attacked by any piece of the given color.
function isSquareAttacked(squareId, byColor) {
    let [row, col] = getPosition(squareId);

    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            let piece = board[fromRow][fromCol];

            if (!piece || piece.color != byColor) {
                continue;
            }

// Pawns only attack diagonally forward, which is different from how they move.
            if (piece.type == 'pawn') {
                let direction = piece.color == 'white' ? -1 : 1;
                if (row - fromRow == direction && Math.abs(col - fromCol) == 1) {
                    return true;
                }
            } else if (canPieceMove(getSquareId(fromRow, fromCol), squareId)) {
                return true;
            }
        }
    }

    return false;
}

// Function for checking if the king of the given color is in check.
function isInCheck(color) {
    let kingSquare = findKing(color);

    if (!kingSquare) {
        return false;
    }

    return isSquareAttacked(kingSquare, color == 'white' ? 'black' : 'white');
}

// Function for finding the square of the king of the given color, or null if there is no king.
function findKing(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let piece = board[row][col];

            if (piece && piece.type == 'king' && piece.color == color) {
                return getSquareId(row, col);
            }
        }
    }

    return null;
}

// Function for checking if a move is an en passant capture: a pawn moving diagonally onto the square
// an enemy pawn just skipped. The captured pawn is not on that square, but next to the capturing pawn.
function isEnPassant(from, to) {
    let [fromRow, fromCol] = getPosition(from);
    let toCol = getPosition(to)[1];
    let piece = board[fromRow][fromCol];
    let passedPawn = board[fromRow][toCol];

    return piece.type == 'pawn' && to == enPassantSquare && fromCol != toCol &&
        passedPawn != null && passedPawn.type == 'pawn' && passedPawn.color != piece.color;
}

// Function for checking if a move is castling: the king moving two squares sideways.
function isCastling(from, to) {
    let [fromRow, fromCol] = getPosition(from);
    let [toRow, toCol] = getPosition(to);
    let piece = board[fromRow][fromCol];

    return piece.type == 'king' && fromRow == toRow && Math.abs(toCol - fromCol) == 2;
}

// Function for checking if the king may castle from one square to another.
function canCastle(from, to) {
    let [fromRow, fromCol] = getPosition(from);
    let toCol = getPosition(to)[1];
    let king = board[fromRow][fromCol];
    let enemyColor = king.color == 'white' ? 'black' : 'white';
    let side = toCol > fromCol ? 'kingside' : 'queenside';
    let rookCol = side == 'kingside' ? 7 : 0;
    let rook = board[fromRow][rookCol];
    let homeRow = king.color == 'white' ? 7 : 0;

// The king and the rook must never have moved, so they are still on their starting squares.
    if (!castlingRights[king.color][side] || fromRow != homeRow || fromCol != 4) {
        return false;
    }
    if (!rook || rook.type != 'rook' || rook.color != king.color) {
        return false;
    }

// All squares between the king and the rook must be empty.
    if (!isPathClear(fromRow, fromCol, fromRow, rookCol)) {
        return false;
    }

// The king may not castle out of check, through an attacked square, or into check.
    let passedCol = (fromCol + toCol) / 2;
    if (isSquareAttacked(from, enemyColor) ||
        isSquareAttacked(getSquareId(fromRow, passedCol), enemyColor) ||
        isSquareAttacked(to, enemyColor)) {
        return false;
    }

    return true;
}

// Function for removing castling rights when a king or rook leaves its starting square,
// or when a rook is captured on its starting square.
function updateCastlingRights(from, to) {
    for (let square of [from, to]) {
        if (square == 'e1') {
            castlingRights.white.kingside = false;
            castlingRights.white.queenside = false;
        } else if (square == 'e8') {
            castlingRights.black.kingside = false;
            castlingRights.black.queenside = false;
        } else if (square == 'h1') {
            castlingRights.white.kingside = false;
        } else if (square == 'a1') {
            castlingRights.white.queenside = false;
        } else if (square == 'h8') {
            castlingRights.black.kingside = false;
        } else if (square == 'a8') {
            castlingRights.black.queenside = false;
        }
    }
}

// Function for checking if a move is allowed.
function isLegalMove(from, to) {
    let piece = getPiece(from);
    let target = getPiece(to);

// When the game is over, no moves are allowed.
    if (gameOver) {
        return false;
    }

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

// Castling has its own rules, because the king moves two squares and the rook moves too.
    if (isCastling(from, to)) {
        return canCastle(from, to);
    }

// The piece must follow its own movement rules.
    if (!canPieceMove(from, to)) {
        return false;
    }

// The move must not leave the player's own king in check. The move is tried on the board,
// the king is checked, and then the board is put back the way it was.
// With en passant the captured pawn is removed from the square next to the capturing pawn.
    let [fromRow, fromCol] = getPosition(from);
    let [toRow, toCol] = getPosition(to);
    let capturedRow = isEnPassant(from, to) ? fromRow : toRow;
    let captured = board[capturedRow][toCol];

    board[capturedRow][toCol] = null;
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    let leavesKingInCheck = isInCheck(piece.color);
    board[fromRow][fromCol] = piece;
    board[toRow][toCol] = target;
    board[capturedRow][toCol] = captured;

    if (leavesKingInCheck) {
        return false;
    }

    return true;
}

// Function for getting all the squares the piece on a square can legally move to.
function getLegalMoves(from) {
    let moves = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let to = getSquareId(row, col);
            if (isLegalMove(from, to)) {
                moves.push(to);
            }
        }
    }

    return moves;
}

// Function for getting the image file of a piece, like "pieces/Queen(white).png".
function getPieceImage(type, color) {
    return 'pieces/' + type[0].toUpperCase() + type.slice(1) + '(' + color + ').png';
}

// Function for moving a piece from one square to another, first in the game state and then in the DOM.
// promotion is the piece type a pawn becomes when it reaches the last rank, like "queen".
// Returns the captured piece, or null if nothing was captured.
function applyMove(from, to, promotion) {
    let [fromRow, fromCol] = getPosition(from);
    let [toRow, toCol] = getPosition(to);
    let piece = board[fromRow][fromCol];
    let castling = isCastling(from, to);

// With en passant the captured pawn is next to the capturing pawn, not on the square it moves to.
    let capturedRow = isEnPassant(from, to) ? fromRow : toRow;
    let captured = board[capturedRow][toCol];
    board[capturedRow][toCol] = null;

// After a pawn moves two squares, the square it skipped can be captured on in the next move only.
    if (piece.type == 'pawn' && Math.abs(toRow - fromRow) == 2) {
        enPassantSquare = getSquareId((fromRow + toRow) / 2, fromCol);
    } else {
        enPassantSquare = null;
    }

    updateCastlingRights(from, to);

// A promoted pawn becomes the chosen piece, but keeps its ID and image element.
    if (promotion) {
        piece = { type: promotion, color: piece.color, id: piece.id };
    }

    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

// Any selected piece and highlighted squares belong to the old position.
    clearSelection();

// The captured piece is removed by its ID, so nothing else in the square is touched.
    if (captured) {
        document.getElementById(captured.id).remove();
    }
    let img = document.getElementById(piece.id);
    document.getElementById(to).appendChild(img);

    if (promotion) {
        img.src = getPieceImage(piece.type, piece.color);
        img.alt = piece.type;
    }

// When castling, the rook moves to the square the king passed over.
    if (castling) {
        let rookFromCol = toCol > fromCol ? 7 : 0;
        let rookToCol = (fromCol + toCol) / 2;
        let rook = board[fromRow][rookFromCol];

        board[fromRow][rookToCol] = rook;
        board[fromRow][rookFromCol] = null;
        document.getElementById(getSquareId(fromRow, rookToCol)).appendChild(document.getElementById(rook.id));
    }

// After a move it is the other player's turn.
    currentTurn = currentTurn == 'white' ? 'black' : 'white';
// The captured piece is added to the pieces captured by the player who moved.
    if (captured) {
        capturedPieces[piece.color].push(captured.type);
        renderCapturedPieces();
    }

    moveHistory.push({ from: from, to: to, promotion: promotion || null });
    showLastMove(from, to);
    updateTurnIndicator();
    showCheck();
    checkGameEnd();

    return captured;
}

// Function for marking the squares the last move went from and to.
function showLastMove(from, to) {
    for (let square of boardSquares) {
        square.classList.remove('lastMove');
    }

    document.getElementById(from).classList.add('lastMove');
    document.getElementById(to).classList.add('lastMove');
}

// Function for marking the king's square when the player whose turn it is, is in check.
function showCheck() {
    for (let square of boardSquares) {
        square.classList.remove('inCheck');
    }

    if (isInCheck(currentTurn)) {
        document.getElementById(findKing(currentTurn)).classList.add('inCheck');
    }
}

// Function for getting the total points of the pieces a player has captured.
function getPoints(color) {
    let points = 0;

    for (let type of capturedPieces[color]) {
        points += pieceValues[type];
    }

    return points;
}

// Function for showing the captured pieces and points of each player next to the board.
// The pieces are sorted from lowest to highest value.
function renderCapturedPieces() {
    for (let color of ['white', 'black']) {
        let enemyColor = color == 'white' ? 'black' : 'white';
        let row = document.getElementById(color + 'Captures');
        let images = row.querySelector('.capturedImages');
        let sorted = capturedPieces[color].slice().sort((a, b) => pieceValues[a] - pieceValues[b]);

        images.innerHTML = '';
        for (let type of sorted) {
            let img = document.createElement('img');
            img.src = getPieceImage(type, enemyColor);
            img.alt = type;
            img.draggable = false;
            images.appendChild(img);
        }

        let points = getPoints(color);
        row.querySelector('.points').textContent = points + (points == 1 ? ' point' : ' points');
    }
}

// Function for showing whose turn it is above the board.
// In an online game it says "Your turn" or "Opponent's turn" instead, and the dot still shows the color.
function updateTurnIndicator() {
    let text = currentTurn == 'white' ? "White's turn" : "Black's turn";

    if (myColor) {
        text = currentTurn == myColor ? 'Your turn' : "Opponent's turn";
    }

    document.getElementById('turnText').textContent = text;
    document.getElementById('turnIndicator').classList.toggle('blackTurn', currentTurn == 'black');
}

// Function for checking if the player whose turn it is has at least one legal move.
function hasAnyLegalMove() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let piece = board[row][col];

            if (piece && piece.color == currentTurn && getLegalMoves(getSquareId(row, col)).length > 0) {
                return true;
            }
        }
    }

    return false;
}

// Function for checking if neither player has enough pieces left to ever checkmate:
// king against king, king and one bishop or knight against king,
// or kings with only bishops that all stand on squares of the same color.
function isInsufficientMaterial() {
    let minorPieces = 0;
    let bishopSquareColors = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let piece = board[row][col];

            if (!piece || piece.type == 'king') {
                continue;
            }

// With a pawn, rook or queen on the board, checkmate is still possible.
            if (piece.type == 'pawn' || piece.type == 'rook' || piece.type == 'queen') {
                return false;
            }

            minorPieces++;
            if (piece.type == 'bishop') {
                bishopSquareColors.push((row + col) % 2);
            }
        }
    }

    if (minorPieces <= 1) {
        return true;
    }

// Bishops on squares of the same color can never attack the squares of the other color, so no checkmate is possible.
    let onlyBishops = bishopSquareColors.length == minorPieces;
    let allSameColor = bishopSquareColors.every(color => color == bishopSquareColors[0]);
    return onlyBishops && allSameColor;
}

// Function for checking if the game has ended after a move, and showing the result.
function checkGameEnd() {
// The player who just moved is the winner if the player whose turn it is now is checkmated.
    let winner = currentTurn == 'white' ? 'Black' : 'White';

    if (!hasAnyLegalMove()) {
        if (isInCheck(currentTurn)) {
            endGame('Checkmate! ' + winner + ' wins');
        } else {
            endGame('Stalemate. The game is a draw');
        }
    } else if (isInsufficientMaterial()) {
        endGame('Draw by insufficient material');
    }
}

// Function for ending the game: no more moves are allowed, and the result replaces the turn indicator.
function endGame(message) {
    gameOver = true;
    clearSelection();
    document.getElementById('turnText').textContent = message;
    document.getElementById('turnIndicator').classList.remove('blackTurn');
    document.getElementById('turnIndicator').classList.add('gameOver');
    document.getElementById('newGameButton').classList.remove('hidden');
}

// Function for drawing all pieces from the game state onto the board. Each piece gets an image
// with the same attributes as the pieces written in the HTML.
function renderBoard() {
    for (let square of boardSquares) {
        for (let img of square.querySelectorAll('img')) {
            img.remove();
        }
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let piece = board[row][col];

            if (piece) {
                let img = document.createElement('img');
                img.src = getPieceImage(piece.type, piece.color);
                img.id = piece.id;
                img.draggable = true;
                img.setAttribute('ondragstart', 'drag(event)');
                img.setAttribute('ondragend', 'dragEnd(event)');
                img.alt = piece.type;
                document.getElementById(getSquareId(row, col)).appendChild(img);
            }
        }
    }
}

// Function for starting a new game: the game state is reset to the starting position and the board is drawn again.
function restartGame() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let piece = startBoard[row][col];
            board[row][col] = piece ? { type: piece.type, color: piece.color, id: piece.id } : null;
        }
    }

    currentTurn = 'white';
    enPassantSquare = null;
    castlingRights = {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true }
    };
    gameOver = false;

// A promotion that was waiting for a choice is cancelled.
    pendingPromotion = null;
    document.getElementById('promotionPicker').classList.add('hidden');

    capturedPieces = { white: [], black: [] };
    renderCapturedPieces();
    moveHistory = [];

    for (let square of boardSquares) {
        square.classList.remove('lastMove');
    }

    clearSelection();
    document.getElementById('turnIndicator').classList.remove('gameOver');
    updateTurnIndicator();
    showCheck();
    document.getElementById('newGameButton').classList.add('hidden');
    renderBoard();
}

// Function for the "New game" button that appears when a game has ended.
// In an online game the opponent's board is reset too, and both players keep their colors.
function startNewGame() {
    restartGame();
    if (connection && connection.open) {
        connection.send({ type: 'newGame' });
    }
}

// Function for checking if a move takes a pawn to the last rank, so it has to be promoted.
function isPromotion(from, to) {
    let piece = getPiece(from);
    let [toRow] = getPosition(to);
    return piece.type == 'pawn' && (toRow == 0 || toRow == 7);
}

// Function for making a legal move from the board (by dropping or clicking).
// If a pawn is promoted, the player first chooses a piece in the promotion picker.
function playMove(from, to) {
    if (isPromotion(from, to)) {
        showPromotionPicker(from, to);
    } else {
        applyMove(from, to);
        sendMove(from, to, null);
    }
}

// Function for showing the promotion picker with the pieces in the color of the promoted pawn.
function showPromotionPicker(from, to) {
    let color = getPiece(from).color;
    pendingPromotion = { from: from, to: to };
    clearSelection();

    for (let img of document.querySelectorAll('.promotionChoices img')) {
        img.src = getPieceImage(img.alt, color);
    }
    document.getElementById('promotionPicker').classList.remove('hidden');
}

// Function for promoting the pawn to the piece the player clicked in the promotion picker.
function choosePromotion(type) {
    if (!pendingPromotion) {
        return;
    }

    let move = pendingPromotion;
    pendingPromotion = null;
    document.getElementById('promotionPicker').classList.add('hidden');
    applyMove(move.from, move.to, type);
    sendMove(move.from, move.to, type);
}

// Function for cancelling a promotion by clicking next to the choices. The pawn stays where it was.
function cancelPromotion(event) {
// Clicks on the choices themselves also reach the picker, so only clicks on the dark background cancel.
    if (event.target != event.currentTarget) {
        return;
    }

    pendingPromotion = null;
    document.getElementById('promotionPicker').classList.add('hidden');
}

// Function for checking if the player at this computer may move right now. In a local game both colors
// are played here. In an online game only your own color can be moved, and only on your turn.
// While the opponent is not connected, no moves can be made, so the two boards can't get out of step.
function canPlayerMove() {
    if (myColor && !(connection && connection.open)) {
        return false;
    }

    return !gameOver && (myColor == null || myColor == currentTurn);
}

// Function for choosing the color played on this computer. The board is turned around for Black,
// so each player sees their own pieces at the bottom. null goes back to a local game.
function setMyColor(color) {
    myColor = color;
    clearSelection();
    document.body.classList.toggle('flipped', color == 'black');

    if (!gameOver) {
        updateTurnIndicator();
    }
}

// Functions allowing drops inside the Squares.
function allowDrop(event) {
    event.preventDefault();
// Show the "move" cursor instead of the "copy" cursor with a plus sign.
    event.dataTransfer.dropEffect = 'move';
}

// Function for dragging the ID of the pieces.
function drag(event){
    let piece = getPiece(event.target.closest('.square').id);

// Only the pieces of the player whose turn it is can be dragged, and nothing can be dragged after the game is over.
// In an online game you can't drag anything while it is the opponent's turn.
    if (!canPlayerMove() || !piece || piece.color != currentTurn) {
        event.preventDefault();
        return;
    }

// The dragged piece is selected, so its legal squares are highlighted while dragging.
    selectSquare(event.target.closest('.square').id);
    event.dataTransfer.setData("text", event.target.id);
    event.dataTransfer.effectAllowed = 'move';

// The piece is hidden on its square while it is dragged. This waits until the browser has taken
// the picture of the piece it shows under the mouse, otherwise that picture would be empty too.
    let img = event.target;
    setTimeout(function () {
        img.classList.add('dragging');
    }, 0);
}

// Function for showing the dragged piece again when the drag ends, whether it was dropped or not.
function dragEnd(event) {
    event.target.classList.remove('dragging');
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
    if (!canPlayerMove() || !isLegalMove(from, to)) {
        return;
    }

    playMove(from, to);
}

// Function for selecting a piece and highlighting the squares it can legally move to.
function selectSquare(squareId) {
    clearSelection();
    selectedSquare = squareId;
    document.getElementById(squareId).classList.add('selected');

    for (let to of getLegalMoves(squareId)) {
        document.getElementById(to).classList.add('legalMove');
    }
}

// Function for removing the selection and all highlighted squares.
function clearSelection() {
    selectedSquare = null;

    for (let square of boardSquares) {
        square.classList.remove('selected', 'legalMove');
    }
}

// Function for click-to-move. The first click selects a piece, the second click moves it.
function clickSquare(event) {
// After the game is over, or while it is the opponent's turn online, nothing can be selected or moved.
    if (!canPlayerMove()) {
        return;
    }

    let squareId = event.target.closest('.square').id;
    let piece = getPiece(squareId);

// Clicking one of the highlighted squares moves the selected piece there.
    if (selectedSquare && isLegalMove(selectedSquare, squareId)) {
        playMove(selectedSquare, squareId);
        return;
    }

// Clicking the selected piece again removes the selection.
    if (squareId == selectedSquare) {
        clearSelection();
        return;
    }

// Clicking one of your own pieces selects it. Clicking anywhere else removes the selection.
    if (piece && piece.color == currentTurn) {
        selectSquare(squareId);
    } else {
        clearSelection();
    }
}

// ---------------------------------------------------------------------------------------------
// Online games with PeerJS. The player who creates the game plays White and gets a link.
// The player who opens the link plays Black. Each move is sent as { type: "move", from, to, promotion }
// and is checked with the same rules on the other side before it is made there.
// ---------------------------------------------------------------------------------------------

// Function for showing a message about the online game below the board.
function setOnlineStatus(text) {
    document.getElementById('onlineStatus').textContent = text;
}

// Function for showing or hiding the link that White sends to the opponent.
function showShareLink(visible) {
    document.getElementById('shareLink').classList.toggle('hidden', !visible);
    document.getElementById('copyLinkButton').classList.toggle('hidden', !visible);
}

// Function for creating an online game. This player plays White and gets a link for the opponent.
function createOnlineGame() {
    if (typeof Peer == 'undefined') {
        setOnlineStatus('Online games are not available right now (PeerJS could not be loaded).');
        return;
    }

    document.getElementById('createGameButton').classList.add('hidden');
    setOnlineStatus('Creating the game...');
    restartGame();
    setMyColor('white');

    peer = new Peer();
    peer.on('open', function (id) {
        document.getElementById('shareLink').value = location.href.split('#')[0] + '#join=' + id;
        showShareLink(true);
        setOnlineStatus('Waiting for your opponent. Send them this link:');
    });

// The opponent connects through the link. If they connect again, for example after reloading the page,
// the new connection replaces the old one.
    peer.on('connection', function (newConnection) {
        useConnection(newConnection);
    });

    peer.on('error', showPeerError);
}

// Function for joining an online game from a link. This player plays Black.
function joinOnlineGame(hostId) {
    if (typeof Peer == 'undefined') {
        setOnlineStatus('Online games are not available right now (PeerJS could not be loaded).');
        return;
    }

    document.getElementById('createGameButton').classList.add('hidden');
    setOnlineStatus('Connecting to the game...');
    setMyColor('black');

    peer = new Peer();
    peer.on('open', function () {
        useConnection(peer.connect(hostId, { reliable: true }));
    });
    peer.on('error', showPeerError);
}

// Function for using a connection to the opponent. Messages from an old, replaced connection are ignored.
function useConnection(newConnection) {
    let oldConnection = connection;
    connection = newConnection;

    if (oldConnection) {
        oldConnection.close();
    }

    newConnection.on('open', function () {
        showShareLink(false);
        setOnlineStatus('Connected. You play ' + (myColor == 'white' ? 'White' : 'Black') + '.');

// White has the game as it is, and sends all moves so far to Black.
        if (myColor == 'white') {
            newConnection.send({ type: 'sync', moves: moveHistory });
        }
    });

    newConnection.on('data', function (data) {
        if (newConnection == connection) {
            receiveMessage(data);
        }
    });

    newConnection.on('close', function () {
        if (newConnection != connection) {
            return;
        }

        clearSelection();
        if (myColor == 'white') {
            showShareLink(true);
            setOnlineStatus('Your opponent left the game. They can join again with the same link:');
        } else {
            setOnlineStatus('The connection to your opponent was lost. Reload the page to join again.');
        }
    });
}

// Function for showing a message when PeerJS reports a problem.
function showPeerError(error) {
    if (error.type == 'peer-unavailable') {
        setOnlineStatus('This game could not be found. The link may be old, or the other player has closed the game.');
    } else if (error.type == 'network' || error.type == 'server-error' || error.type == 'socket-error' || error.type == 'socket-closed') {
        setOnlineStatus('Could not reach the online game server. Check your internet connection and reload the page.');
    } else if (error.type == 'browser-incompatible') {
        setOnlineStatus('This browser does not support online games.');
    } else {
        setOnlineStatus('Something went wrong with the online game (' + error.type + ').');
    }
}

// Function for sending a move made on this computer to the opponent. Nothing is sent in a local game.
function sendMove(from, to, promotion) {
    if (connection && connection.open) {
        connection.send({ type: 'move', from: from, to: to, promotion: promotion });
    }
}

// Function for handling a message from the opponent.
function receiveMessage(data) {
    if (!data) {
        return;
    }

// Black gets the whole game from White and plays all moves on a fresh board.
    if (data.type == 'sync' && myColor == 'black' && Array.isArray(data.moves)) {
        restartGame();
        for (let move of data.moves) {
            if (!makeReceivedMove(move)) {
                setOnlineStatus('The game from your opponent could not be loaded. Reload the page to try again.');
                return;
            }
        }
    }

// The opponent started a new game. If both players clicked "New game" at the same time, this board is
// already reset (the game is no longer over), and the message is ignored so no new moves are lost.
    if (data.type == 'newGame' && gameOver) {
        restartGame();
    }

// A move is only made if it is the opponent's turn and the move follows the rules.
    if (data.type == 'move') {
        if (currentTurn == myColor || !makeReceivedMove(data)) {
            setOnlineStatus('Your opponent sent a move that is not allowed. Reload the page to load the game again.');
        }
    }
}

// Function for checking a move from the opponent and making it if it is legal.
// Returns false if the move is not allowed.
function makeReceivedMove(move) {
    let squarePattern = /^[a-h][1-8]$/;

    if (!move || !squarePattern.test(move.from) || !squarePattern.test(move.to) || !isLegalMove(move.from, move.to)) {
        return false;
    }

// A pawn that reaches the last rank must come with one of the four pieces it can become.
    let promotion = null;
    if (isPromotion(move.from, move.to)) {
        if (!['queen', 'rook', 'bishop', 'knight'].includes(move.promotion)) {
            return false;
        }
        promotion = move.promotion;
    }

    applyMove(move.from, move.to, promotion);
    return true;
}

// Function for copying the link for the opponent.
function copyShareLink() {
    let input = document.getElementById('shareLink');
    let button = document.getElementById('copyLinkButton');

    input.select();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(input.value);
    } else {
        document.execCommand('copy');
    }

    button.textContent = 'Copied!';
    setTimeout(function () {
        button.textContent = 'Copy link';
    }, 1500);
}

// When the page is opened with a link like "index.html#join=<id>", this player joins that game as Black.
if (location.hash.startsWith('#join=')) {
    joinOnlineGame(location.hash.slice('#join='.length));
}
