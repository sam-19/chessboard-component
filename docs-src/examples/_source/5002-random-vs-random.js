// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

const board = document.querySelector('chess-board');
const game = new Chess();

function makeRandomMove() {
  const possibleMoves = game.moves();

  // exit if the game is over
  if (game.game_over()) {
    return;
  }

  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  game.move(possibleMoves[randomIdx]);
  board.setPosition(game.fen());

  window.setTimeout(makeRandomMove, 500);
}

window.setTimeout(makeRandomMove, 500);
