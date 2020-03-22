const board = document.querySelector('chess-board');

board.addEventListener('drag-start', (e) => {
  const {source, piece, position, orientation} = e.detail;
  console.log('Drag started:')
  console.log('Source: ' + source)
  console.log('Piece: ' + piece)
  console.log('Position: ' + chessUtils.objToFen(position))
  console.log('Orientation: ' + orientation)
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
});