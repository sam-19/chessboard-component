const board = document.querySelector('chess-board');

document.querySelector('#showPositionBtn').addEventListener('click', () => {
  console.log('Current position as an Object:');
  console.log(board.position);

  console.log('Current position as a FEN string:');
  console.log(board.fen());
});