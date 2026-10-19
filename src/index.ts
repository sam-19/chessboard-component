import { ChessBoard, type RenderPieceFunction } from './chessboard.js'
import { AngledArrow, PathArrow, SquareMarker, StraightArrow, type MarkerType } from './utils/overlays.js'
import { presetColors } from './utils/chessboard-styles.js'
import { fenToObj, isValidFen, normalizePosition, objToFen, START_FEN, START_POSITION } from './utils/index.js'

export type * from './types.js'
export { ChessboardEvents } from './types.js'
export type { MarkerType, RenderPieceFunction }
export {
    AngledArrow,
    ChessBoard,
    PathArrow,
    SquareMarker,
    StraightArrow,
    START_FEN,
    START_POSITION,
    fenToObj,
    isValidFen,
    normalizePosition,
    objToFen,
    presetColors,
}

export default ChessBoard
