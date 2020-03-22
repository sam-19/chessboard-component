const board = document.querySelector('chess-board');

document.querySelector('#showOrientationBtn').addEventListener('click', () => {
  console.log('Board orientation is: ' + board.orientation);
});

document.querySelector('#flipOrientationBtn').addEventListener('click', () => {
  board.flip();
});

document.querySelector('#whiteOrientationBtn').addEventListener('click', () => {
  board.orientation = 'white';
});

document.querySelector('#blackOrientationBtn').addEventListener('click', () => {
  board.orientation = 'black';
});