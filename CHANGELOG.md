# Changelog

## 0.2.0

### Breaking
- The UMD bundle (`umd/`) and the `custom-elements.json` manifest are no longer built. The package is native ES modules with `lit` as a regular dependency.
- Pointer Events replace mouse and touch events. Only the main mouse button starts a drag.
- The countdown only changes the displayed time; `blackSeconds` and `whiteSeconds` keep the value that was set. The `countdownTimeout` property was removed.
- `setPosition()` throws on an invalid FEN string instead of clearing the board.
- Event detail types are keyed by event name (`ChessboardEventDetail['drop']`).
- Pieces show the drag cursor only when they can be dragged.

### Fixed
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

### Added
- `highlights` property for highlighting squares, with a new `check` style.
- `square-click` event.
- Typed `addEventListener` for the board's events, and the `ChessboardEventMap` type.
- Exports for the overlay classes, `presetColors` and FEN helpers.
- Board notation scales with the board size.
- Browser tests (Vitest with Playwright).

### Changed
- Toolchain: Vite 8, Vitest, TypeScript 5.9, ESLint with `eslint-plugin-lit`. Removes all dependency vulnerabilities reported by `npm audit`.
