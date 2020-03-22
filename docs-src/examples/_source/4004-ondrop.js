const board = document.querySelector('chess-board');

board.addEventListener('drop', (e) => {
  const {source, target, piece, newPosition, oldPosition, orientation} = e.detail;
  console.log('Source: ' + source)
  console.log('Target: ' + target)
  console.log('Piece: ' + piece)
  console.log('New position: ' + chessUtils.objToFen(newPosition))
  console.log('Old position: ' + chessUtils.objToFen(oldPosition))
  console.log('Orientation: ' + orientation)
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
});