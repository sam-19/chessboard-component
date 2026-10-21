# chessboard-component

A `<chess-board>` web component, built with [Lit](https://lit.dev). It renders a board with draggable pieces, spare pieces, player names and clocks, square highlights, arrows and markers. It only displays positions: it does not know the rules of chess, so validate moves in your own code (for example with [typescript-chess](https://github.com/sam-19/chess.ts)).

This is a refactoring of Justin Fagnani's [chessboard-element](https://github.com/justinfagnani/chessboard-element), itself based on Chris Oakman's chessboard.js.

## Installation

`npm install @sam-19/chessboard-component`

The package is published as native ES modules with type declarations. Importing it registers the `<chess-board>` element. A type-only import is removed when compiling, so import the package itself once:
```typescript
import '@sam-19/chessboard-component'
import type { ChessBoard } from '@sam-19/chessboard-component'
```

## Usage

```html
<chess-board position="start" draggable-pieces></chess-board>
```

The board takes the width of its container. Set `adjust-by-height` to also fit it within the height of the parent element; the parent must then have its height set in its `style` attribute.

### Making moves

The board does not check moves. Listen to `drop` and decide what happens to the piece:
```typescript
board.addEventListener('drop', (e) => {
    const { source, target, setAction } = e.detail
    if (source === target || !isLegal(source, target)) {
        setAction('snapback')
    }
})
// Update the board after the piece has snapped into place, e.g. to move the rook when castling.
board.addEventListener('snap-end', () => board.setPosition(fenAfterTheMove))
```
Clicking or tapping a square fires `square-click`, which can be used for click-to-move.

### Attributes and properties

| Attribute / property | Description |
| --- | --- |
| `position` | Position as a FEN string, `start`, or (as a property) a position object such as `{ e4: 'wP' }`. |
| `orientation` | `white` (default) or `black` at the bottom. |
| `draggable-pieces` | Allow dragging pieces. |
| `drag-threshold` | Pixels the pointer has to move with a piece pressed before it is picked up; a shorter press is a click. Default 4, `0` picks it up on press. |
| `available-board-pieces` | Squares whose pieces can be dragged, e.g. `e2 d2`. Default: all. |
| `drop-off-board` | `snapback` (default) or `trash` pieces dropped off the board. |
| `spare-pieces` | Show spare pieces above and below the board (replaces player details). |
| `available-spare-pieces`, `superfluous-pieces` | Which spare pieces can be used, and whether more pieces than the rules allow can be added. |
| `hide-notation` | Hide the file and rank labels. |
| `highlights` (property) | Square highlights, e.g. `{ e2: 'previous', e4: 'previous', e8: 'check' }`. Styles: `active`, `available`, `check`, `previous`, `unavailable`. |
| `white-name`, `white-title`, `white-rating` (and `black-…`) | Player details shown above and below the board. |
| `white-seconds`, `black-seconds` | Remaining time in seconds, shown as a clock. |
| `white-time`, `black-time` | Remaining time as free text, used when the seconds are not set. |
| `turn`, `countdown` | The player in turn, and whether their clock counts down on the display. Set the seconds again after each move to keep the clocks in sync with your game clock. |
| `move-speed`, `snap-speed`, `snapback-speed`, `appear-speed`, `trash-speed` | Animation durations in ms, or `snap`, `veryfast`, `fast`, `regular`, `slow`, `veryslow`. |
| `piece-theme`, `renderPiece` (property) | An image URL template such as `/pieces/{piece}.png`, or a function that renders a piece. Default: SVG pieces from Wikimedia Commons. |

### Overlays

Overlays are given as `;` separated lists. Colors can be any CSS color or a preset: `@blue`, `@cyan`, `@green`, `@grey`, `@orange`, `@pink`, `@purple`, `@red` or `@yellow`. Presets can also be given by the single-letter codes of PGN board markup (`[%cal Gd2d4]`), with or without the `@`: `G` green, `R` red, `Y` yellow, `B` blue, `C` cyan, `O` orange, `U` purple, `P` pink and `X` grey.

| Attribute | Example |
| --- | --- |
| `straight-arrows` | `e2 e4 @green; g1 f3 @blue` |
| `angled-arrows` | `g1 f3 @blue` (knight-style arrow), or a path: `a1 a4 d4 @red` |
| `angled-knight-arrows` | Draw straight arrows of a knight's move (`straight-arrows`, PGN `%cal`) as angled arrows. |
| `square-markers` | `e4 d5 o @green; h7 x @red` (`o` circle, `x` cross). A `+` or `-` after the type draws the marker over or under the piece (`e4 o+ G`); by default circles go under and crosses over. |
| `ghost-pieces` | `e2 wP; g1 f3 wN` Half-transparent pieces on the squares, under any piece on the same square and ignoring the pointer. The `ghostPieces` property maps squares to piece codes. |
| `color-squares` | `e4 d5 @green; a1` (yellow by default) |
| `square-labels` | `e4 t R: +1; d5 mc @blue: !?` Position `t` top, `m` middle or `b` bottom, optionally followed by alignment `l` left, `c` center or `r` right (the default), then the color and, after a colon, the text. Without a color the text has the board's text color. |

The `straightArrows`, `angledArrows`, `squareMarkers`, `squareLabels` and `colorSquares` properties take the corresponding objects (`StraightArrow`, `AngledArrow`, `PathArrow`, `SquareMarker`, `SquareLabel`) directly. Labels are drawn in `--label-font-family` (monospace by default), at a quarter of the square's size (`size`), with a light outline (`--label-outline-color`) so they can be read over pieces and dark squares.

#### Markup from PGN comments

`parsePgnMarkup(comment)` reads the board markup of a PGN comment into overlays, ready to assign to the board:

```js
const markup = parsePgnMarkup('Develop [%cal Gg1f3,Gb1c3] and watch [%csl Rf7] [%ctl Ue4t+1]')
board.straightArrows = markup.straightArrows
board.colorSquares = markup.colorSquares
board.squareMarkers = markup.squareMarkers
board.squareLabels = markup.squareLabels
```

It reads `%cal` (arrows), `%csl` (colored squares), `%ccl` (circles), `%cxl` (crosses) and `%ctl` (text labels: color, square, position `t`/`m`/`b`, text, e.g. `Re4t+1`). A label after the entries (`[%cal Ge2e4 "Classical"]`) is left out.

An arrow's line is 0.2 squares wide (`arrowSize`) and its head 0.5 squares long (`headSize`), set per arrow object. Where arrows start and end is shared by all boards: `StraightArrow.START_OFFSET` (default 0.4) and `StraightArrow.TARGET_OFFSET` (default 0.5) are distances from the square centers, in squares. On a short arrow (one square) both offsets are scaled down by the same factor, moving its ends towards the square centers, so that some shaft always shows before the head.

### Methods

- `setPosition(position, useAnimation = true)` sets the position; throws on an invalid FEN or position object.
- `move('e2-e4', ...)` moves pieces; pass `false` as an argument to skip the animation.
- `start()`, `clear()`, `flip()`, `resize()`.
- `fen` returns the piece placement part of the current FEN.

### Events

| Event | When |
| --- | --- |
| `drag-start` | A piece is picked up. Cancel with `preventDefault()`. |
| `drag-move` | A dragged piece moves to another square. |
| `drop` | A dragged piece is released. `detail.setAction('snapback' \| 'trash' \| 'drop')` changes what happens. |
| `snap-end`, `snapback-end` | The dropped piece has settled on its new square, or returned to its original square. |
| `square-click` | A square is clicked or tapped. |
| `mouseover-square`, `mouseout-square` | The pointer enters or leaves a square (not while dragging). |
| `change` | The position changed. |
| `move-end` | A position change animation has finished. |

`addEventListener` is typed for these events, so `e.detail` has the right type in TypeScript.

### Styling

The board is styled with CSS custom properties (`--light-color`, `--dark-color`, `--highlight-color-*`, `--preset-color-*`, `--time-low-color`) and CSS parts (`board`, `square`, `piece`, `player-details`, `player-white`, `timer-black`, `highlight-check`, ...). See the documentation comment of `ChessBoard` in `src/chessboard.ts` for the full list.

## Development

```sh
npm install
npx playwright install chromium-headless-shell
npm run dev          # demo page
npm test             # Vitest in headless Chromium
npm run typecheck
npm run lint
npm run build        # emits ES modules and declarations to dist/
```
