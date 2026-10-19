/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Copyright (c) 2024 Sampsa Lohi
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import type {
    ChessPiece,
    BoardSquare,
    BoardPositionObject,
    BoardPosition,
} from '../types.js'

/**
 * GENERAL UTILITIES.
 */

/**
 * Type-safe check to see if a value is a string or not.
 * @param s - Possible string.
 * @returns True if `s` is a string, false otherwise.
 */
export const isString = (s: unknown): s is string => {
    return typeof s === 'string'
}
/**
 * Type-safe check to see if a value is a function or not.
 * @param f - Possible function.
 * @returns True if `f` is a function, false otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const isFunction = (f: unknown): f is Function => {
    return typeof f === 'function'
}
/**
 * Type-safe check to see if a value is a number or not.
 * @param s - Possible number.
 * @returns True if `n` is a number, false otherwise.
 */
export const isInteger = (n: unknown): n is number => {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n
}
/**
 * Make a new copy of an object and all its child properties.
 * @param thing - Object to copy.
 * @returns A new copy of the object.
 */
export const deepCopy = <T>(thing: T): T => {
    if (typeof thing !== 'object' || thing === null) {
        // Primitives don't need copying and functions cannot be copied.
        return thing
    }
    return JSON.parse(JSON.stringify(thing))
}

export const interpolateTemplate = (str: string, obj: object): string => {
    for (const [key, value] of Object.entries(obj)) {
        const keyTemplateStr = '{' + key + '}'
        while (str.includes(keyTemplateStr)) {
            str = str.replace(keyTemplateStr, String(value))
        }
    }
    return str
}


/**
 * CHESS UTILITIES.
 */

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
export const COLUMNS = 'abcdefgh'.split('')

export const whitePieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'] as ChessPiece[]
export const blackPieces = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as ChessPiece[]

/**
 * Get the color of the given square.
 * @param square - Square code.
 * @returns 'black' or 'white'.
 */
export const getSquareColor = (square: BoardSquare) =>
    square.charCodeAt(0) % 2 ^ square.charCodeAt(1) % 2 ? 'white' : 'black'

/**
 * Check if the given string is a valid board square.
 * @param square - Square code to check.
 * @returns True if valid square, false otherwise.
 */
export const isValidSquare = (square: unknown): square is BoardSquare => {
    return isString(square) && square.search(/^[a-h][1-8]$/) !== -1
}

/**
 * Parse all square codes from a list. The list may be delimited or continuous (`'e2 e4'`, `'e2,e4'` or `'e2e4'`).
 * @param list - List of square codes.
 * @returns Set of valid lowercase square codes in the list.
 */
export const parseSquareList = (list: string) => {
    return new Set((list.toLowerCase().match(/[a-h][1-8]/g) || []) as BoardSquare[])
}

/**
 * Parse all piece codes from a list. The list may be delimited or continuous (`'wP bP'` or `'wPbP'`).
 * @param list - List of piece codes.
 * @returns Set of valid piece codes in the list.
 */
export const parsePieceList = (list: string) => {
    const codes = list.match(/[bw][KQRBNP]/gi) || []
    return new Set(codes.map(c => c[0].toLowerCase() + c[1].toUpperCase()) as ChessPiece[])
}

/**
 * Check if the given move is valid or not.
 * @param move - Move to check.
 * @returns True if valid, false otherwise.
 */
export const isValidMove = (move: unknown): move is string => {
    // Move should be a string.
    if (!isString(move)) {
        return false
    }
    // Move should be in the form of "e2-e4", "f6-d5".
    const squares = move.split('-')
    if (squares.length !== 2) {
        return false
    }

    return isValidSquare(squares[0]) && isValidSquare(squares[1])
}


export const isValidPieceCode = (code: unknown): code is string => {
    return isString(code) && code.search(/^[bw][KQRNBP]$/) !== -1
}


const squeezeFenEmptySquares = (fen: string) => {
    return fen
        .replace(/11111111/g, '8')
        .replace(/1111111/g, '7')
        .replace(/111111/g, '6')
        .replace(/11111/g, '5')
        .replace(/1111/g, '4')
        .replace(/111/g, '3')
        .replace(/11/g, '2')
}

const expandFenEmptySquares = (fen: string) => {
    return fen
        .replace(/8/g, '11111111')
        .replace(/7/g, '1111111')
        .replace(/6/g, '111111')
        .replace(/5/g, '11111')
        .replace(/4/g, '1111')
        .replace(/3/g, '111')
        .replace(/2/g, '11')
}

/**
 * Check if the given string is a valid FEN position.
 * @param fen - Supposed FEN string.
 * @returns True if valid, false otherwise.
 */
export const isValidFen = (fen: unknown): fen is string => {
    if (!isString(fen)) {
        return false
    }
    // Cut off any move, castling, etc info from the end.
    // We're only interested in position information.
    fen = fen.replace(/ .+$/, '')
    // Expand the empty square numbers to just 1s.
    fen = expandFenEmptySquares(fen as string)
    // FEN should be 8 sections separated by slashes.
    const chunks = (fen as string).split('/')
    if (chunks.length !== 8) {
        return false
    }
    // Check each section.
    for (let i = 0; i < 8; i++) {
        if (chunks[i].length !== 8 || chunks[i].search(/[^kqrnbpKQRNBP1]/) !== -1) {
            return false
        }
    }
    return true
}


/**
 * Check if the given parameter is a valid board position object.
 * @param pos - Supposed valid board position.
 * @returns True if valid, false otherwise.
 */
export const isValidPositionObject = (pos: unknown): pos is BoardPositionObject => {
    if (typeof pos !== 'object' || pos === null) {
        return false
    }
    for (const [square, piece] of Object.entries(pos)) {
        if (!isValidSquare(square) || !isValidPieceCode(piece)) {
            return false
        }
    }
    return true
}


/**
 * Convert a single-character FEN piece code into a case-insensitive two-character piece code.
 * @param piece - A FEN piece code.
 * @returns Two-character piece code.
 */
const fenToPieceCode = (piece: string) => {
    // Black piece.
    if (piece.toLowerCase() === piece) {
        return 'b' + piece.toUpperCase() as ChessPiece
    }
    // White piece.
    return 'w' + piece.toUpperCase() as ChessPiece
}

/**
 * Convert a two-character piece code into a single-character FEN piece code.
 * @param piece - Two-character piece code.
 * @returns FEN piece code.
 */
const pieceCodeToFen = (piece: ChessPiece) => {
    const pieceCodeLetters = piece.split('')
    // White piece.
    if (pieceCodeLetters[0] === 'w') {
        return pieceCodeLetters[1].toUpperCase()
    }
    // Black piece.
    return pieceCodeLetters[1].toLowerCase()
}

/**
 * Convert a FEN position string into a position object.
 * @param fen - FEN position string.
 * @returns Position object or `false` if the FEN string is not valid.
 */
export const fenToObj = (fen: string) => {
    if (!isValidFen(fen)) return false
    // Cut off any move, castling, etc info from the end.
    // We're only interested in position information.
    fen = fen.replace(/ .+$/, '')
    const rows = fen.split('/')
    const position: BoardPositionObject = {}
    let currentRow = 8
    for (let i = 0; i < 8; i++) {
        const row = rows[i].split('')
        let colIdx = 0
        // Loop through each character in the FEN section.
        for (let j = 0; j < row.length; j++) {
            // Number / empty squares.
            if (row[j].search(/[1-8]/) !== -1) {
                const numEmptySquares = parseInt(row[j], 10)
                colIdx = colIdx + numEmptySquares
            } else {
                // Piece.
                const square = COLUMNS[colIdx] + currentRow
                position[square] = fenToPieceCode(row[j])
                colIdx = colIdx + 1
            }
        }
        currentRow = currentRow - 1
    }
    return position
}

export const START_POSITION = fenToObj(START_FEN) as BoardPositionObject

/**
 * Convert a position object into a FEN position string.
 * @param obj - Position object.
 * @returns FEN position string or `false` if the position obejct is not valid.
 */
export const objToFen = (obj: BoardPositionObject) => {
    if (!isValidPositionObject(obj)) return false
    let fen = ''
    let currentRow = 8
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const square = COLUMNS[j] + currentRow
            // Piece exists.
            if (Object.hasOwn(obj, square)) {
                fen = fen + pieceCodeToFen(obj[square]!)
            } else {
                // Empty space.
                fen = fen + '1'
            }
        }
        if (i !== 7) {
            fen = fen + '/'
        }
        currentRow = currentRow - 1
    }
    // Squeeze the empty numbers together.
    fen = squeezeFenEmptySquares(fen)
    return fen
}


/**
 * Convert a standard `position` description string into a board position object.
 * @param position - A position object or description; null or empty string means empty board.
 * @returns Board position object.
 */
export const normalizePosition = (
    position: BoardPosition | null
): BoardPositionObject => {
    if (!position) {
        return {}
    }
    // start position
    if (isString(position)) {
        if (position.toLowerCase() === 'start') {
            return deepCopy(START_POSITION)
        }
        // convert FEN to position object
        if (isValidFen(position)) {
            return fenToObj(position) as BoardPositionObject
        }
        return {}
    }
    if (!isValidPositionObject(position)) {
        return {}
    }
    return deepCopy(position as BoardPositionObject)
}

/**
 * Get the larger distance between two board squares.
 * @param squareA - Square code for the first square.
 * @param squareB - Square code for the other square.
 * @returns Distance as number of squares.
 */
const squareDistance = (squareA: BoardSquare, squareB: BoardSquare) => {
    const squareAArray = squareA.split('')
    const squareAx = COLUMNS.indexOf(squareAArray[0]) + 1
    const squareAy = parseInt(squareAArray[1], 10)

    const squareBArray = squareB.split('')
    const squareBx = COLUMNS.indexOf(squareBArray[0]) + 1
    const squareBy = parseInt(squareBArray[1], 10)

    const xDelta = Math.abs(squareAx - squareBx)
    const yDelta = Math.abs(squareAy - squareBy)

    return xDelta >= yDelta ? xDelta : yDelta
}

/**
 * Get a list of squares arranged by their distance to the given `square`.
 * @param square - Board square to check.
 * @returns Board square codes as an array.
 */
const createRadius = (square: BoardSquare) => {
    const squares = []
    // Calculate distance to all squares.
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const s = COLUMNS[i] + (j + 1) as BoardSquare
            // Skip the square we're starting from.
            if (square === s) {
                continue
            }
            squares.push({
                square: s,
                distance: squareDistance(square, s),
            })
        }
    }
    // Sort by distance.
    squares.sort(function (a, b) {
        return a.distance - b.distance
    })
    // Just return the square code.
    const surroundingSquares = [] as BoardSquare[]
    for (let i = 0; i < squares.length; i++) {
        surroundingSquares.push(squares[i].square)
    }
    return surroundingSquares
}

/**
 * Find the closest instance of given `piece` from the given `square`.
 * @param position - Board position.
 * @param piece - Piece to find.
 * @param square - Square to check.
 * @returns Board square of 'false', if the given piece is not found in the position.
 */
export const findClosestPiece = (
    position: BoardPositionObject,
    piece: ChessPiece,
    square: BoardSquare
) => {
    // Create array of closest squares from square.
    const closestSquares = createRadius(square)
    // Search through the position in order of distance for the piece.
    for (let i = 0; i < closestSquares.length; i++) {
        const s = closestSquares[i]
        if (Object.hasOwn(position, s) && position[s] === piece) {
            return s as BoardSquare
        }
    }
    return false
}

/**
 * Get the new board position after the given set of (valid) `moves`.
 * @param position - Board position to start from.
 * @param moves - List of moves as a object `{ [<from>: square code]: <to>: board square }`.
 * @returns The new board position object.
 */
export const calculatePositionFromMoves = (
    position: BoardPositionObject,
    moves: { [from: string]: string }
) => {
    const newPosition = deepCopy(position)
    // Lift all moved pieces before placing them, so that moves can be given in any order.
    const lifted = [] as [string, ChessPiece | undefined][]
    for (const [from, to] of Object.entries(moves)) {
        // Skip the move if the position doesn't have a piece on the source square.
        if (!Object.hasOwn(position, from)) {
            continue
        }
        lifted.push([to, position[from]])
        delete newPosition[from]
    }
    for (const [to, piece] of lifted) {
        newPosition[to] = piece
    }
    return newPosition
}