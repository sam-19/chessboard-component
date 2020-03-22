const board = document.querySelector('chess-board');

document.querySelector('#setRuyLopezBtn').addEventListener('click', () => {
  const ruyLopez = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R';
  board.setPosition(ruyLopez);
});

document.querySelector('#setStartBtn').addEventListener('click', () => {
  board.start();
});

document.querySelector('#setRookCheckmateBtn').addEventListener('click', () => {
  board.position = {
    a4: 'bK',
    c4: 'wK',
    a7: 'wR'
  };
});