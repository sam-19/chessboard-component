/**
 * Board markup in PGN comments, as board overlays.
 * @license MIT
 */

import type { BoardSquare } from '../types.js'
import { colorSquareValue } from './chessboard-styles.js'
import { SquareLabel, SquareMarker, StraightArrow, type LabelPosition } from './overlays.js'

/**
 * Overlays read from PGN markup, ready to be assigned to the board's properties of the same names.
 */
export interface PgnMarkup {
    colorSquares: { color: string, square: BoardSquare }[]
    squareLabels: SquareLabel[]
    squareMarkers: SquareMarker[]
    straightArrows: StraightArrow[]
}

const COMMAND = /\[%(cal|csl|ccl|cxl|ctl)\s+([^\]]*)\]/g
const POSITIONS: Record<string, LabelPosition> = { t: 'top', m: 'middle', b: 'bottom' }

/**
 * Read the board markup of a PGN comment. Colors are given by their letter codes (`G`, `R`, `Y`, `B`, ...):
 * - `[%cal Gd2d4,Re2e4]` arrows,
 * - `[%csl Ye4,Rd5]` colored squares,
 * - `[%ccl Ge4]` circles and `[%cxl Rf7]` crosses,
 * - `[%ctl Re4t+1]` text labels: color, square, position (`t` top, `m` middle, `b` bottom) and the text.
 *
 * A label after the entries (`[%cal Ge2e4 "Classical"]`) is not part of the drawing and is left out, as are entries
 * that cannot be read. A later entry for the same square (or the same square and position, for labels) replaces an
 * earlier one.
 * @param comment - Comment text, with the markup among other text.
 * @returns The overlays.
 */
export function parsePgnMarkup (comment: string): PgnMarkup {
    const arrows = new Map<string, StraightArrow>()
    const squares = new Map<string, { color: string, square: BoardSquare }>()
    const markers = new Map<string, SquareMarker>()
    const labels = new Map<string, SquareLabel>()
    for (const [, command, args] of comment.matchAll(COMMAND)) {
        if (command === 'ctl') {
            // Label text may contain spaces, so only commas separate the entries.
            for (const entry of args.split(',')) {
                const match = entry.trim().match(/^([a-z])([a-h][1-8])([tmb])(.+)$/is)
                if (match) {
                    const square = match[2] as BoardSquare
                    const position = POSITIONS[match[3].toLowerCase()]
                    labels.set(`${square}${position}`, new SquareLabel(square, match[4].trim(), match[1], position))
                }
            }
            continue
        }
        // The entries are the first word; the rest is a label for the drawing.
        for (const entry of args.trim().split(/\s+/)[0].split(',')) {
            const match = entry.match(/^([a-z])([a-h][1-8])([a-h][1-8])?$/i)
            if (!match) {
                continue
            }
            const [, color, square, target] = match as unknown as [string, string, BoardSquare, BoardSquare?]
            if (command === 'cal') {
                if (target && target !== square) {
                    arrows.set(`${square}${target}`, new StraightArrow(square, target, color))
                }
            } else if (!target) {
                if (command === 'csl') {
                    squares.set(square, { color: colorSquareValue(color), square })
                } else {
                    markers.set(square, new SquareMarker(square, command === 'ccl' ? 'circle' : 'cross', color))
                }
            }
        }
    }
    return {
        colorSquares: [...squares.values()],
        squareLabels: [...labels.values()],
        squareMarkers: [...markers.values()],
        straightArrows: [...arrows.values()],
    }
}
