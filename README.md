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

Overlays are given as `;` separated lists. Colors can be any CSS color or a preset: `@blue`, `@cyan`, `@green`, `@grey`, `@orange`, `@purple`, `@red` or `@yellow`.

| Attribute | Example |
| --- | --- |
| `straight-arrows` | `e2 e4 @green; g1 f3 @blue` |
| `angled-arrows` | `g1 f3 @blue` (knight-style arrow), or a path: `a1 a4 d4 @red` |
| `square-markers` | `e4 d5 o @green; h7 x @red` (`o` circle, `x` cross) |
| `color-squares` | `e4 d5 @green; a1` (yellow by default) |

The `straightArrows`, `angledArrows`, `squareMarkers` and `colorSquares` properties take the corresponding objects (`StraightArrow`, `AngledArrow`, `PathArrow`, `SquareMarker`) directly.

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
