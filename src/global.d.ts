import { ChessBoard } from './chessboard'

declare global {
    interface HTMLElementTagNameMap {
        "chess-board": ChessBoard
    }
}