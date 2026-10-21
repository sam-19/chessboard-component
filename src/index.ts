import { ChessBoard, type RenderPieceFunction } from './chessboard.js'
import {
    AngledArrow,
    PathArrow,
    SquareLabel,
    SquareMarker,
    StraightArrow,
    type LabelAlign,
    type LabelPosition,
    type MarkerLayer,
    type MarkerType,
} from './utils/overlays.js'
import { parsePgnMarkup, type PgnMarkup } from './utils/pgn-markup.js'
import { presetColorCodes, presetColors, type PresetColor } from './utils/chessboard-styles.js'
import { fenToObj, isValidFen, normalizePosition, objToFen, START_FEN, START_POSITION } from './utils/index.js'

export type * from './types.js'
export { ChessboardEvents } from './types.js'
export type { LabelAlign, LabelPosition, MarkerLayer, MarkerType, PgnMarkup, PresetColor, RenderPieceFunction }
export {
    AngledArrow,
    ChessBoard,
    PathArrow,
    SquareLabel,
    SquareMarker,
    StraightArrow,
    START_FEN,
    START_POSITION,
    fenToObj,
    isValidFen,
    normalizePosition,
    objToFen,
    parsePgnMarkup,
    presetColorCodes,
    presetColors,
}

export default ChessBoard
