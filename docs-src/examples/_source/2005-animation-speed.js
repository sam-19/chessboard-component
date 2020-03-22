const board = document.querySelector('chess-board');

document.querySelector('#ruyLopezBtn').addEventListener('click', () => {
  board.setPosition('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R');
});

document.querySelector('#startBtn').addEventListener('click', () => {
  board.start();
});