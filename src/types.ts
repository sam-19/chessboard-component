/**
 * Chessboard types.
 * @copyright 2024 Sampsa Lohi
 * @license MIT
 */

export type Action = OffBoardAction | 'drop'
export type Animation =
    | {
            type: 'move'
            source: BoardLocation
            destination: BoardSquare
            piece: ChessPiece
            square?: BoardSquare
        }
    | {
            type: 'move-start'
            source: BoardLocation
            destination: BoardSquare
            piece: ChessPiece
            square?: BoardSquare
        }
    | {
            type: 'add'
            square: BoardSquare
            piece: ChessPiece
        }
    | {
            type: 'clear'
            square: BoardSquare
            piece: ChessPiece
        }
    | {
            type: 'add-start'
            square: BoardSquare
            piece: ChessPiece
        }
export type AnimationSpeed = 'fast' | 'regular' | 'slow' | 'snap' | 'veryfast' | 'veryslow' | number
export type BoardLocation = BoardSquare | 'spare' | 'offboard'
export type BoardPosition = BoardPositionObject | 'start' | string
export type BoardPositionObject = { [square: string]: ChessPiece | undefined }
export type BoardSquare = 'a8' | 'b8' | 'c8' | 'd8' | 'e8' | 'f8' | 'g8' | 'h8' |
                          'a7' | 'b7' | 'c7' | 'd7' | 'e7' | 'f7' | 'g7' | 'h7' |
                          'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f6' | 'g6' | 'h6' |
                          'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5' |
                          'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4' |
                          'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3' |
                          'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2' |
                          'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
export type ChessboardEvent= {
    'change': { detail: ChessboardEventDetail['change'] }
    'drag-move': { detail: ChessboardEventDetail['drag-move'] }
    'drag-start': { detail: ChessboardEventDetail['drag-start'] }
    'drop': { detail: ChessboardEventDetail['drop'] }
    'mouseout-square': { detail: ChessboardEventDetail['mouseout-square'] }
    'mouseover-square': { detail: ChessboardEventDetail['mouseover-square'] }
    'move-end': { detail: ChessboardEventDetail['move-end'] }
    'snapback-end': { detail: ChessboardEventDetail['snapback-end'] }
    'snap-end': { detail: ChessboardEventDetail['snap-end'] }
    'square-click': { detail: ChessboardEventDetail['square-click'] }
}
/**
 * Events dispatched by the `<chess-board>` element, mapped to their event types.
 */
export type ChessboardEventMap = {
    [E in keyof ChessboardEventDetail]: CustomEvent<ChessboardEventDetail[E]>
}
export enum ChessboardEvents {
    CHANGE = 'change',
    DRAG_MOVE = 'drag-move',
    DRAG_START = 'drag-start',
    DROP = 'drop',
    MOUSEOUT_SQUARE = 'mouseout-square',
    MOUSEOVER_SQUARE = 'mouseover-square',
    MOVE_END = 'move-end',
    SNAPBACK_END = 'snapback-end',
    SNAP_END = 'snap-end',
    SQUARE_CLICK = 'square-click',
}
export type ChessboardEventDetail = {
    'change': {
        newFen: string
        newPosition: BoardPositionObject
        oldFen: string
        oldPosition: BoardPositionObject
    }
    'drag-move': {
        newLocation: BoardLocation
        oldLocation: BoardLocation
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }
    'drag-start': {
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }
    'drop': {
        newPosition: BoardPositionObject
        oldPosition: BoardPositionObject
        orientation: SquareColor
        piece: ChessPiece
        setAction (a: Action): void
        source: BoardLocation
        target: BoardLocation
    }
    'mouseout-square': {
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }
    'mouseover-square': {
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }
    'move-end': {
        oldPosition: BoardPositionObject
        newPosition: BoardPositionObject
    }
    'snapback-end': {
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        square: BoardLocation
    }
    'snap-end': {
        piece: ChessPiece
        source: BoardLocation
        square: BoardLocation
    }
    'square-click': {
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }
}
export type ChessPiece = 'bB' | 'bK' | 'bN' | 'bP' | 'bQ' | 'bR' | 
                         'wB' | 'wK' | 'wN' | 'wP' | 'wQ' | 'wR' | ''
export type DraggingDragState = {
    state: 'dragging'
    x: number
    y: number
    piece: ChessPiece
    location: BoardLocation | 'offboard'
    source: BoardLocation
}
export type DragState =
    | DraggingDragState
    | SnapbackDragState
    | TrashDragState
    | SnapDragState
export type HighlightStyle = 'active' | 'available' | 'check' | 'previous' | 'unavailable'
export type OffBoardAction = 'trash' | 'snapback'
export type Offset = { top: number; left: number }
export type SnapbackDragState = {
    state: 'snapback'
    piece: ChessPiece
    source: BoardLocation
}
export type SnapDragState = {
    state: 'snap'
    piece: ChessPiece
    location: BoardLocation
    source: BoardLocation
}
export type SquareColor = 'black' | 'white'
export type TrashDragState = {
    state: 'trash'
    x: number
    y: number
    piece: ChessPiece
    source: BoardLocation
}