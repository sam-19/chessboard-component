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
export type AnimationSpeed = 'fast' | 'slow' | number
export type ChessboardEventDetail<T> = T
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
export type ChessboardEvent = {
    [ChessboardEvents.CHANGE]: ChessboardEventDetail<{
        oldPosition: BoardPositionObject
        newPosition: BoardPositionObject
    }>
    [ChessboardEvents.DRAG_MOVE]: ChessboardEventDetail<{
        newLocation: BoardLocation
        oldLocation: BoardLocation
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }>
    [ChessboardEvents.DRAG_START]: ChessboardEventDetail<{
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        source: BoardLocation
    }>
    [ChessboardEvents.DROP]: ChessboardEventDetail<{
        newPosition: BoardPositionObject
        oldPosition: BoardPositionObject
        orientation: SquareColor
        piece: ChessPiece
        setAction (a: Action): void
        source: BoardLocation
        target: BoardLocation
    }>
    [ChessboardEvents.MOUSEOUT_SQUARE]: ChessboardEventDetail<{
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }>
    [ChessboardEvents.MOUSEOVER_SQUARE]: ChessboardEventDetail<{
        orientation: SquareColor
        piece: ChessPiece | false
        position: BoardPositionObject
        square: BoardSquare
    }>
    [ChessboardEvents.MOVE_END]: ChessboardEventDetail<{
        oldPosition: BoardPositionObject
        newPosition: BoardPositionObject
    }>
    [ChessboardEvents.SNAPBACK_END]: ChessboardEventDetail<{
        orientation: SquareColor
        piece: ChessPiece
        position: BoardPositionObject
        square: BoardLocation
    }>
    [ChessboardEvents.SNAP_END]: ChessboardEventDetail<{
        piece: ChessPiece
        source: BoardLocation
        square: BoardLocation
    }>
}
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
export type BoardLocation = BoardSquare | 'spare' | 'offboard'
export type OffBoardAction = 'trash' | 'snapback'
export type Offset = { top: number; left: number }
export type ChessPiece = 'bB' | 'bK' | 'bN' | 'bP' | 'bQ' | 'bR' | 
                    'wB' | 'wK' | 'wN' | 'wP' | 'wQ' | 'wR' | ''
export type BoardPositionObject = { [square: string]: ChessPiece | undefined }
export type BoardPosition = BoardPositionObject | 'start' | string
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
export type BoardSquare = 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' |
                     'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8' |
                     'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' |
                     'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8' |
                     'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8' |
                     'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' |
                     'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7' | 'g8'
export type SquareColor = 'black' | 'white'
export type TrashDragState = {
    state: 'trash'
    x: number
    y: number
    piece: ChessPiece
    source: BoardLocation
}