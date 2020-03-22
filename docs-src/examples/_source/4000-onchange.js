const board = document.querySelector('chess-board');

board.addEventListener('change', (e) => {
  const {value, oldValue} = e.detail;
  console.log('Position changed:');
  console.log('Old position: ' + chessUtils.objToFen(oldValue));
  console.log('New position: ' + chessUtils.objToFen(value));
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
});

document.querySelector('#ruyLopezBtn').addEventListener('click', () => {
  const ruyLopez = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R';
  board.setPosition(ruyLopez);
});

document.querySelector('#startPositionBtn').addEventListener('click', () => {
  board.start();
});