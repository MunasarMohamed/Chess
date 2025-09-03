const boardSquares = document.querySelectorAll('square');
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


const a8 = document.getElementById("a8");



function allowDrop(event) {
    event.preventDefault();
}

function drag(event){
    event.dataTransfer.setData("text", event.target.id);
}

function drop(event){
    
    event.preventDefault();
    var data = event.dataTransfer.getData("text");

    let draggedElement = document.getElementById(data);
    let targetSquare = event.target;
    var existingImage = targetSquare.querySelector("img");

    if ((hasClass(targetSquare, 'square'))){
            
        targetSquare.appendChild(draggedElement); 
    }  else {
        targetSquare.removeChild(draggedElement)
    }

} 


function hasClass(element, classNameToTestFor) {
    var classNames = element.className.split(' ');
    for (var i = 0; i < classNames.length; i++) {
        if (classNames[i].toLowerCase() == classNameToTestFor.toLowerCase()) {
            return true;
        }
    }
    return false;
}















