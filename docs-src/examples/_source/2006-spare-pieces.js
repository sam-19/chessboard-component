const board = document.querySelector('chess-board');

document.querySelector('#startBtn').addEventListener('click', () => {
  board.start();
});
document.querySelector('#clearBtn').addEventListener('click', () => {
  board.clear();
});