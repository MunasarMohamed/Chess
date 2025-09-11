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


// Functions allowing drops inside the Squares.
function allowDrop(event) {
    event.preventDefault();
}

// Function for dragging the ID of the pieces.
function drag(event){
    event.dataTransfer.setData("text", event.target.id);
}

// Function for dropping the pieces into other squares and on other pieces.
function drop(event){
    
    event.preventDefault();
    var data = event.dataTransfer.getData("text");
    let draggedElement = document.getElementById(data);
    let targetSquare = event.target.closest('.square');
    let child = targetSquare.firstElementChild;
 

// If targetSquare exists, the draggedElement is droped in the square. 
    if (targetSquare) {
        targetSquare.appendChild(draggedElement); 
    }

    if (targetSquare.children == 'coordinatesLetterW' || 'cordinatesLetterB')
// If there already exists a piece in the target square, the piece is removed.
    if (targetSquare.children.length > 0) {
        targetSquare.removeChild(child);
    }

 


}  

















