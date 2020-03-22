const board = document.querySelector('chess-board');

board.addEventListener('snapback-end', (e) => {
  const {piece, square, position, orientation} = e.detail;

  console.log('Piece: ' + piece)
  console.log('Square: ' + square)
  console.log('Position: ' + chessUtils.objToFen(position))
  console.log('Orientation: ' + orientation)
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
});