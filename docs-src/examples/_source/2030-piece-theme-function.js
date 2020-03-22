const board = document.querySelector('chess-board');
board.pieceTheme = (piece) => {
  // wikipedia theme for white pieces
  if (piece.search(/w/) !== -1) {
    return `../../img/chesspieces/wikipedia/${piece}.png`;
  }

  // alpha theme for black pieces
  return `../../img/chesspieces/alpha/${piece}.png`;
};
