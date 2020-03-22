const board = document.querySelector('chess-board');

board.addEventListener('drag-start', (e) => {
  const {piece, orientation} = e.detail;
  if ((orientation === 'white' && piece.search(/^w/) === -1) ||
      (orientation === 'black' && piece.search(/^b/) === -1)) {
    e.preventDefault();
  }
});

document.querySelector('#flipOrientationBtn').addEventListener('click', () => {
  board.flip();
});