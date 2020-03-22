const board = document.querySelector('chess-board');

document.querySelector('#clearBoardBtn').addEventListener('click', () => {
  board.clear();
});

document.querySelector('#startPositionBtn').addEventListener('click', () => {
  board.start();
});

document.querySelector('#clearBoardInstantBtn').addEventListener('click', () => {
  board.clear(false);
});