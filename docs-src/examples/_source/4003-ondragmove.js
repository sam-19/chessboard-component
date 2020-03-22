const board = document.querySelector('chess-board');

board.addEventListener('drag-move', (e) => {
  const {newLocation, oldLocation, source,
                     piece, position, orientation} = e.detail;
  console.log('New location: ' + newLocation)
  console.log('Old location: ' + oldLocation)
  console.log('Source: ' + source)
  console.log('Piece: ' + piece)
  console.log('Position: ' + chessUtils.objToFen(position))
  console.log('Orientation: ' + orientation)
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
});