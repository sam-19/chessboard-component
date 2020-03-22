const board = document.querySelector('chess-board');

// snapback black pieces when they are dropped
board.addEventListener('drop', (e) => {
  const {piece, setAction} = e.detail;
  if (piece.search(/b/) !== -1) {
    setAction('snapback');
  }
});