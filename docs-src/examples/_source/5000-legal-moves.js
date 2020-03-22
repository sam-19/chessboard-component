// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

const board = document.querySelector('chess-board');
const game = new Chess();
const statusElement = document.querySelector('#status');
const fenElement = document.querySelector('#fen');
const pgnElement = document.querySelector('#pgn');

board.addEventListener('drag-start', (e) => {
  const {source, piece, position, orientation} = e.detail;

  // do not pick up pieces if the game is over
  if (game.game_over()) {
    e.preventDefault();
    return;
  }

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    e.preventDefault();
    return;
  }
});

board.addEventListener('drop', (e) => {
  const {source, target, setAction} = e.detail;

  // see if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  });

  // illegal move
  if (move === null) {
    setAction('snapback');
  }

  updateStatus();
});

// update the board position after the piece snap
// for castling, en passant, pawn promotion
board.addEventListener('snap-end', (e) => {
  board.setPosition(game.fen());
});

function updateStatus () {
  let status = '';

  let moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  if (game.in_checkmate()) {
    // checkmate?
    status = `Game over, ${moveColor} is in checkmate.`;
  } else if (game.in_draw()) {
    // draw?
    status = 'Game over, drawn position';
  } else {
    // game still on
    status = `${moveColor} to move`;

    // check?
    if (game.in_check()) {
      status += `, ${moveColor} is in check`;
    }
  }

  statusElement.innerHTML = status;
  fenElement.innerHTML = game.fen();
  pgnElement.innerHTML = game.pgn();
}

updateStatus();