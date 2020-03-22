// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

const board = document.querySelector('chess-board');
const highlightStyles = document.createElement('style');
document.head.append(highlightStyles);

const game = new Chess();

const styles = [];
let pendingStyle = undefined;

const updateHighlights = () => {
  highlightStyles.textContent = styles.join('\n');
}

const highlight = (square, color) => `
  chess-board::part(${square}) {
    box-shadow: inset 0 0 3px 3px ${color};
  }
`;

function removeHighlights (color) {
  highlightStyles.textContent = '';
}

board.addEventListener('drag-start', (e) => {
  const {source, piece, position, orientation} = e.detail;

  // do not pick up pieces if the game is over
  if (game.game_over()) {
    return false;
  }

  // only pick up pieces for White
  if (piece.search(/^b/) !== -1) {
    return false;
  }
});

function makeRandomMove () {
  const possibleMoves = game.moves({
    verbose: true,
  });

  // game over
  if (possibleMoves.length === 0) {
    return;
  }

  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  const move = possibleMoves[randomIdx];
  game.move(move.san);


  // highlight black's move
  if (styles.length === 4) {
    styles.shift();
    styles.shift();
  }
  styles.push(highlight(move.from, 'blue'));
  pendingStyle = highlight(move.to, 'blue');
  updateHighlights();

  // update the board to the new position
  board.setPosition(game.fen())
}

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
    return;
  }

  // highlight white's move
  if (styles.length === 4) {
    styles.shift();
    styles.shift();
  }
  styles.push(highlight(move.from, 'yellow'));
  styles.push(highlight(move.to, 'yellow'));
  pendingStyle = undefined;
  updateHighlights();

  // make random move for black
  window.setTimeout(makeRandomMove, 250)
});

board.addEventListener('move-end', (e) => {
  if (pendingStyle !== undefined) {
    styles.push(pendingStyle);
    pendingStyle = undefined;
  }
  updateHighlights();
});

// update the board position after the piece snap
// for castling, en passant, pawn promotion
board.addEventListener('snap-end', (e) => {
  board.setPosition(game.fen())
});