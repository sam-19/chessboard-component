# Changelog

## 1.0.0

### Breaking
- The UMD bundle (`umd/`) and the `custom-elements.json` manifest are no longer built. The package is native ES modules with `lit` as a regular dependency.
- Pointer Events replace mouse and touch events. Only the main mouse button starts a drag.
- The countdown only changes the displayed time; `blackSeconds` and `whiteSeconds` keep the value that was set. The `countdownTimeout` property was removed.
- `setPosition()` throws on an invalid FEN string instead of clearing the board.
- Event detail types are keyed by event name (`ChessboardEventDetail['drop']`).
- Pieces show the drag cursor only when they can be dragged.
- A piece is picked up only after the pointer has moved a few pixels with the piece pressed (`drag-threshold`, 4 by default). A click no longer starts a drag, so the piece no longer jumps under the pointer and snaps back; `drag-start` fires when the piece is picked up. `drag-threshold="0"` picks it up on press, as before.

### Changed
- Arrows are a notch smaller: the head is 0.5 squares long and wide (was 0.75, three line widths) and the line 0.2 squares wide (was 0.25). The head is sized in squares (`headSize`), independently of the line width (`arrowSize`).
- Toolchain: Vite 8, Vitest, TypeScript 5.9, ESLint with `eslint-plugin-lit`. Removes all dependency vulnerabilities reported by `npm audit`.

### Added
- Ghost pieces: the `ghost-pieces` attribute (`e2 wP; g1 f3 wN`) and `ghostPieces` property (squares mapped to piece codes) draw half-transparent pieces on squares, under any piece on the same square and ignoring the pointer, e.g. to show where a piece came from.
- `angled-knight-arrows` (`angledKnightArrows`): straight arrows of a knight's move are drawn along the knight's L, whatever set them (the attribute, the property or `parsePgnMarkup`).
- Read-only `color` and `opacity` on overlays, and `isKnightMove` on arrows.
- Text labels on squares: the `square-labels` attribute (`e4 t R: +1`) and `squareLabels` property, with `SquareLabel` objects. A label sits at the top, middle or bottom of its square, aligned left, center or right, over the pieces.
- Square markers can be drawn over or under the piece: `+` or `-` after the marker type (`e4 o+ G`), or the `layer` property. By default circles go under the piece and crosses over it, as before.
- `parsePgnMarkup(comment)` reads PGN board markup (`%cal`, `%csl`, `%ccl`, `%cxl`, `%ctl`) into overlays.
- Read-only `origin` and `target` on arrows, `square` and `type` on square markers.
- Preset colors can be given by single-letter codes, as in PGN board markup (`[%cal Gd2d4]`): `G`, `R`, `Y`, `B`, `C`, `O`, `U` (purple), `P` (pink) and `X` (grey), with or without `@`. They work for arrows, square markers and colored squares. The codes are exported as `presetColorCodes`.
- A pink preset, `@pink`.
- `highlights` property for highlighting squares, with a new `check` style.
- `square-click` event.
- Typed `addEventListener` for the board's events, and the `ChessboardEventMap` type.
- Exports for the overlay classes, `presetColors` and FEN helpers.
- Board notation scales with the board size.
- Browser tests (Vitest with Playwright).

### Fixed
- Arrows over a single square (a pawn's single step, a king's step, the second leg of an angled knight-move arrow) had no shaft: the head took up the whole distance and sat on the origin or the turning point instead of pointing into the target square. On a short leg the start and tip offsets are now scaled down by the same factor, moving both ends towards the square centers and leaving some shaft; longer arrows are unchanged.
- The `@purple` preset was a magenta (`rgb(200, 0, 100)`), hard to tell from `@red`; it is now a purple (`rgb(140, 60, 220)`).
- Window event listeners were never removed, so every board that had been on the page kept handling pointer events, and boards added again handled them several times.
- A drop, snapback or position animation never finished if its transition did not run (zero speed, no distance to move, element hidden), leaving the board unable to start a new drag or fire `move-end`.
- An animation interrupted by another position change ended the new one early or fired `move-end` twice.
- The countdown always counted down black's time, kept running after the turn changed or the board was removed, and was started from `render()`.
- Arrows and square markers were drawn for white's orientation on a flipped board.
- The `player-white`/`player-black` and `timer-white`/`timer-black` CSS parts were not applied.
- The displayed tenths of a second could disagree with the seconds (9.96 was shown as 0:09.0).
- `white-time` and `black-time` were never displayed.
- `color-squares` without a color left out the last square.
- Lists of available spare pieces could match piece codes spanning two items (`wBbK` made `bB` available).
- `move()` with moves to and from the same square moved the wrong piece.
- Animating a piece that appears on the board (e.g. a promoted queen) broke rendering when pieces were draggable but spare pieces were not shown.
- Setting a position without animation did not stop a running animation, leaving pieces of the previous position on the board and firing a stale `move-end`.
- Overlay colors containing commas or dashes (`rgb(255, 0, 0)`, `var(--color)`) were split apart.
- Dragged pieces and animations were misplaced on a board scaled with CSS transforms.
- The `BoardSquare` type was missing `f6`.
- The board did not resize with `adjust-by-height` when only the parent's size changed, and could become wider than its element.
