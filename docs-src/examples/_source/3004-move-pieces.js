const board = document.querySelector('chess-board');

document.querySelector('#move1Btn').addEventListener('click', () => {
  board.move('e2-e4');
});

document.querySelector('#move2Btn').addEventListener('click', () => {
  board.move('d2-d4', 'g8-f6');
});

document.querySelector('#startPositionBtn').addEventListener('click', () => {
  board.start();
});