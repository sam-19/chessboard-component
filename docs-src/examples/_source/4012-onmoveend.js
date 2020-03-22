const board = document.querySelector('chess-board');

board.addEventListener('move-end', (e) => {
  const {oldPosition, newPosition} = e.detail;

  console.log('Move animation complete:');
  console.log('Old position: ' + chessUtils.objToFen(oldPosition));
  console.log('New position: ' + chessUtils.objToFen(newPosition));
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
});

document.querySelector('#ruyLopezBtn').addEventListener('click', () => {
  board.setPosition('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R');
});
document.querySelector('#moveBtn').addEventListener('click', () => {
  board.move('a2-a4', 'h7-h5');
});
document.querySelector('#startBtn').addEventListener('click', () => {
  board.start();
});
document.querySelector('#clearBtn').addEventListener('click', () => {
  board.clear();
});