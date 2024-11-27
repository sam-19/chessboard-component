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
                          'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f7' | 'g6' | 'h6' |
                          'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5' |
                          'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4' |
                          'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3' |
                          'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2' |
                          'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
export type ChessboardEvent= {
    [ChessboardEvents.CHANGE]: { detail: ChessboardEventDetail['change'] }
    [ChessboardEvents.DRAG_MOVE]: { detail: ChessboardEventDetail['drag-move'] }
    [ChessboardEvents.DRAG_START]: { detail: ChessboardEventDetail['drag-start'] }
    [ChessboardEvents.DROP]: { detail: ChessboardEventDetail['drop'] }
    [ChessboardEvents.MOUSEOUT_SQUARE]: { detail: ChessboardEventDetail['mouseout-square'] }
    [ChessboardEvents.MOUSEOVER_SQUARE]: { detail: ChessboardEventDetail['mouseover-square'] }
    [ChessboardEvents.MOVE_END]: { detail: ChessboardEventDetail['move-end'] }
    [ChessboardEvents.SNAPBACK_END]: { detail: ChessboardEventDetail['snapback-end'] }
    [ChessboardEvents.SNAP_END]: { detail: ChessboardEventDetail['snap-end'] }
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
}
export type ChessboardEventDetail = {
    [ChessboardEvents.CHANGE]: {
        newFen: string
        newPosition: BoardPositionObject
        oldFen: string
        oldPosition: BoardPositionObject
    }
    [ChessboardEvents.DRAG_MOVE]: {
        newLocation: BoardLocation
        oldLocation: BoardLocation
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }
    [ChessboardEvents.DRAG_START]: {
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }
    [ChessboardEvents.DROP]: {
        newPosition: BoardPositionObject
        oldPosition: BoardPositionObject
        orientation: SquareColor
        piece: ChessPiece
        setAction (a: Action): void
        source: BoardLocation
        target: BoardLocation
    }
    [ChessboardEvents.MOUSEOUT_SQUARE]: {
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }
    [ChessboardEvents.MOUSEOVER_SQUARE]: {
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }
    [ChessboardEvents.MOVE_END]: {
        oldPosition: BoardPositionObject
        newPosition: BoardPositionObject
    }
    [ChessboardEvents.SNAPBACK_END]: {
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        square: BoardLocation
    }
    [ChessboardEvents.SNAP_END]: {
        piece: ChessPiece
        source: BoardLocation
        square: BoardLocation
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
export type HighlightStyle = 'active' | 'available' | 'previous' | 'unavailable'
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