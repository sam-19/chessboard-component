// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

const board = document.querySelector('chess-board');
const highlightStyles = document.createElement('style');
document.head.append(highlightStyles);

const game = new Chess();

const styles = [];
let pendingStyle = '';

const updateHighlights = () => {
  highlightStyles.textContent = styles.join('\n');
}

const highlight = (square, color) => `
  chess-board::part(${square}) {
    box-shadow: inset 0 0 3px 3px ${color};
  }
`;

function makeRandomMove () {
  const possibleMoves = game.moves({
    verbose: true,
  });

  // exit if the game is over
  if (game.game_over()) {
    return;
  }

  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  const move = possibleMoves[randomIdx];

  if (styles.length === 4) {
    styles.shift();
    styles.shift();
  }
  if (move.color === 'w') {
    styles.push(highlight(move.from, 'yellow'));
    pendingStyle = highlight(move.to, 'yellow');
  } else {
    styles.push(highlight(move.from, 'blue'));
    pendingStyle = highlight(move.to, 'blue');
  }
  updateHighlights();
  game.move(possibleMoves[randomIdx].san);
  board.setPosition(game.fen());

  window.setTimeout(makeRandomMove, 1200);
}

board.addEventListener('move-end', (e) => {
  styles.push(pendingStyle);
  updateHighlights();
});

window.setTimeout(makeRandomMove, 500);