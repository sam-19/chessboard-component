/**
 * Copyright (c) 2019 Chris Oakman
 * Copyright (c) 2019 Justin Fagnani
 * Copyright (c) 2024 Sampsa Lohi
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import { LitElement, html, nothing, render, AttributePart, noChange } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { directive, Directive, DirectiveParameters } from 'lit/directive.js'
import { styleMap, StyleInfo } from 'lit/directives/style-map.js'
import { ifDefined } from 'lit/directives/if-defined.js'

import {
    StraightArrow,
    COLUMNS,
    blackPieces,
    calculatePositionFromMoves,
    deepCopy,
    findClosestPiece,
    getSquareColor,
    interpolateTemplate,
    isFunction,
    isString,
    normalizePosition,
    objToFen,
    styles,
    renderPiece as renderWikipediaSVGPiece,
    isValidMove,
    isValidSquare,
    isValidPositionObject,
    whitePieces,
} from './utils'
import { 
    type Action,
    type Animation,
    type AnimationSpeed,
    type BoardLocation,
    type BoardPosition,
    type BoardPositionObject,
    type BoardSquare,
    type ChessboardEventDetail,
    type ChessPiece,
    type DraggingDragState,
    type DragState,
    type HighlightStyle,
    type OffBoardAction,
    type SquareColor,
} from '#types'
import { AngledArrow, MarkerType, PathArrow, SquareMarker } from './utils/overlays'
import { presetColors } from './utils/chessboard-styles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Default animation speeds.
const DEFAULT_APPEAR_SPEED = 200
const DEFAULT_MOVE_SPEED = 200
const DEFAULT_SNAPBACK_SPEED = 100
const DEFAULT_SNAP_SPEED = 50
const DEFAULT_TRASH_SPEED = 100
/** Time threshold in seconds below which the player is considered to have low time remaining. */
const LOW_TIME = 10

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/**
 * Is the the current state "dragging".
 * @param dragState - Drag state object.
 */
function isDragging(
    dragState: DragState | undefined
): asserts dragState is DraggingDragState {
    if (dragState?.state !== 'dragging') {
        throw new Error(`unexpected drag state ${JSON.stringify(dragState)}`)
    }
}
/**
 * Directive for chess pieces.
 */
class RenderPieceDirective extends Directive {
    render (_piece: ChessPiece, _renderPiece?: RenderPieceFunction) {
        return nothing
    }
    update (part: AttributePart, [piece, renderPiece]: DirectiveParameters<this>) {
        if (isFunction(renderPiece)) {
            renderPiece(piece, part.element)
        } else {
            (part.element as any).replaceChildren()
        }
        return noChange
    }
}
/**
 * Create a rendering directive for the chess piece.
 */
const renderPieceDirective = directive(RenderPieceDirective)
/**
 * Convert the descriptive speed value into move time in milliseconds.
 * @param speed - Speed value.
 * @returns Move time in ms.
 */
const speedToMS = (speed: AnimationSpeed) => {
    if (typeof speed === 'number') {
        return speed
    }
    if (speed === 'snap') {
        return 50
    }
    if (speed === 'veryfast') {
        return 100
    }
    if (speed === 'fast') {
        return 200
    }
    if (speed === 'regular') {
        return 300
    }
    if (speed === 'slow') {
        return 400
    }
    if (speed === 'veryslow') {
        return 600
    }
    return parseInt(speed, 10)
}
/**
 * Get ID string for the give `square`.
 * @param square - Square name.
 * @returns Square ID string.
 */
const squareId = (square: BoardLocation) => `square-${square}`
/**
 * Get ID string for the give space `piece`.
 * @param square - Space piece name.
 * @returns Spare piece ID string.
 */
const sparePieceId = (piece: ChessPiece) => `spare-piece-${piece}`
/**
 * A function to render a chess piece on the board.
 * @param piece - Name of the chess piece to render.
 * @param container - The HTML element that contains the chess piece.
 */
export type RenderPieceFunction = (
    /**
     * Name of the chess piece to render.
     */
    piece: ChessPiece,
    /**
     * The HTML element that contains the chess piece.
     */
    container: HTMLElement
) => void

/**
 * A custom element that renders an interactive chess board.
 *
 * @fires change - Fired when the board position changes
 *         The event's `detail` property has two properties:
 *             * `newPosition`: the new position
 *             * `newFen`: FEN for the new position
 *             * `oldPosition`: the old position
 *             * `noldFen`: FEN for the old position
 *
 *         **Warning**: do *not* call any position-changing methods in your event
 *         listener or you may cause an infinite loop. BoardPosition-changing methods
 *         are: `clear()`, `move()`, `position()`, and `start()`.
 *
 * @fires drag-move - Fired when a user-initiated drag moves
 *         The event's `detail` object has the following properties:
 *             * `newLocation`: the new location of the piece
 *             * `oldLocation`: the old location of the piece
 *             * `source`: the source of the dragged piece
 *             * `piece`: the piece
 *             * `position`: the current position on the board
 *             * `orientation`: the current orientation.
 *
 * @fires drag-start - Fired when a piece is picked up
 *         The event's `detail` object has the following properties:
 *             * `source`: the source of the piece
 *             * `piece`: the piece
 *             * `position`: the current position on the board
 *             * `orientation`: the current orientation.
 *
 *         The drag action is prevented if the listener calls `event.preventDefault()`.
 *
 * @fires drop - Fired when a user-initiated drag ends
 *         The event's `detail` object has the following properties:
 *             * `source`: the source of the dragged piece
 *             * `target`: the target of the dragged piece
 *             * `piece`: the piece
 *             * `newPosition`: the new position once the piece drops
 *             * `oldPosition`: the old position before the piece was picked up
 *             * `orientation`: the current orientation.
 *             * `setAction(action)`: a function to call to change the default action.
 *                 If `'snapback'` is passed to `setAction`, the piece will return to it's source square.
 *                 If `'trash'` is passed to `setAction`, the piece will be removed.
 *
 * @fires error - Fired in the case of invalid attributes.
 *
 * @fires mouseover-square - Fired when the cursor is over a square
 *         The event's `detail` object has the following properties:
 *             * `square`: the square that was entered
 *             * `piece`: the piece on that square (or `false` if there is no piece)
 *             * `position`: the current position
 *             * `orientation`: the current orientation.
 *
 *         Note that `mouseover-square` will *not* fire during piece drag and drop.
 *         Use `drag-move` instead.
 *
 * @fires mouseout-square - Fired when the cursor exits a square
 *         The event's `detail` object has the following properties:
 *             `square`: the square that was left
 *             `piece`: the piece on that square (or `false` if there is no piece)
 *             `position`: the current position
 *             `orientation`: the current orientation.
 *
 *         Note that `mouseout-square` will *not* fire during piece drag and drop.
 *         Use `drag-move` instead.
 *
 * @fires move-end - Fired when a piece move completes
 *        The event's `detail` object has the following properties:
 *            * `oldPosition`: the old position
 *            * `newPosition`: the new position
 *
 * @fires snapback-end - Fired when the snapback animation is complete when
 *         pieces are dropped off the board.
 *         The event's `detail` object has the following properties:
 *             * `piece`: the dragged piece
 *             * `square`: the square the piece returned to
 *             * `position`: the current position
 *             * `orientation`: the current orientation.
 *
 * @fires snap-end - Fired when a piece completes a snap animation
 *         The event's `detail` object has the following properties:
 *             * `source`: the source of the dragged piece
 *             * `square`: the target of the dragged piece
 *             * `piece`: the dragged piece
 *
 * @cssprop [--light-color=#f0d9b5] - The background for white squares and text color for black squares.
 * @cssprop [--dark-color=#b58863] - The background for black squares and text color for white squares.
 * @cssprop [--highlight-color=yellow] - The highlight color.
 * @cssprop [--highlight-color-available=yellowgreen] - The highlight color for squares that are available.
 * @cssprop [--highlight-color-unavailable=gray] - The highlight color for squares that are unavailable.
 * @cssprop [--preset-color-blue: rgb(0, 110, 255)] - Blue preset color for overlays and colored squares.
 * @cssprop [--preset-color-cyan: rgb(0, 175, 225)] - Cyan preset color for overlays and colored squares.
 * @cssprop [--preset-color-green: rgb(0, 200, 0)] - Green preset color for overlays and colored squares.
 * @cssprop [--preset-color-grey: rgb(127, 127, 127)] - Grey preset color for overlays and colored squares.
 * @cssprop [--preset-color-orange: rgb(255, 127, 0)] - Orange preset color for overlays and colored squares.
 * @cssprop [--preset-color-purple: rgb(200, 0, 100)] - Purple preset color for overlays and colored squares.
 * @cssprop [--preset-color-red: rgb(255, 0, 0)] - Red preset color for overlays and colored squares.
 * @cssprop [--preset-color-yellow: rgb(225, 200, 0)] - Yellow preset color for overlays and colored squares.
 *
 * @csspart board - The chess board.
 * @csspart square - A square on the board.
 * @csspart piece - A chess piece.
 * @csspart spare-pieces - The spare piece container.
 * @csspart player-details - Container with player details.
 * @csspart dragged-piece - The currently dragged piece.
 * @csspart white - A white square.
 * @csspart black - A black square.
 * @csspart highlight - A highlighted square.
 * @csspart available - An available square.
 * @csspart unavailable - An unavailable square.
 * @csspart colored - A colored square.
 * @csspart notation - The square location labels.
 * @csspart alpha - The alpha (column) labels.
 * @csspart numeric - The numeric (row) labels.
 */
@customElement('chess-board')
export class ChessBoard extends LitElement {
    static styles = styles

    /**
     * The current position as a FEN string.
     */
    get fen () {
        return objToFen(this.#currentPosition)
    }

    /**
     * The current position of the board, as a `PositionObject`. This property may be set externally, but only to valid
     * `PositionObject`s. The value is copied before being applied to the board. Changes to the position object are not
     * reflected in th rendering.
     *
     * To set the position using FEN, or a keyword like `'start'`, or to use animations, use the `setPosition` method.
     */
    @property({
        converter: (value: string | null) => normalizePosition(value),
    })
    get position(): BoardPositionObject {
        return this.#currentPosition
    }
    set position(value: BoardPositionObject) {
        const oldValue = this.#currentPosition
        this.#setCurrentPosition(value)
        this.requestUpdate('position', oldValue)
    }

    /**
     * Whether to show the board notation.
     * @default false
     */
    @property({
        attribute: 'hide-notation',
        type: Boolean,
    })
    hideNotation = false

    /**
     * Whether to show the board notation. This is always the inverse of `hideNotation`, which reflects the
     * `hide-notation` attribute.
     */
    get showNotation() {
        return !this.hideNotation
    }
    set showNotation(value: boolean) {
        this.hideNotation = !value
    }

    /**
     * Adjust the board size based on available height.
     * @default false
     */
    @property({
        attribute: 'adjust-by-height',
        type: Boolean,
    })
    adjustByHeight = false

    /**
     * A list on angled arrow overlays to draw on the board.
     */
    @property({
        attribute: 'angled-arrows',
        converter: (value: string | null) => {
            if (!value) {
                return null
            }
            const arrows = []
            const arrowDescriptions = value.split(';')
            for (const desc of arrowDescriptions) {
                const params = desc.trim().split(/[,\-:\s]/)
                if (params.length < 3) {
                    continue
                }
                if (params.length === 3) {
                    arrows.push(new AngledArrow(params[0] as BoardSquare, params[1] as BoardSquare, params[2]))
                } else {
                    const lastIdx = params.length - 1
                    arrows.push(new PathArrow(params.slice(0, lastIdx) as BoardSquare[], params[lastIdx]))
                }
            }
            return arrows
        },
        type: Array,
    })
    angledArrows: StraightArrow[] = []

    /**
     * Animation speed for when pieces appear on a square.
     *
     * Note that the "appear" animation only occurs when `sparePieces` is `false`.
     * @default 'fast'
     */
    @property({
        attribute: 'appear-speed',
    })
    appearSpeed: AnimationSpeed = DEFAULT_APPEAR_SPEED

    /**
     * List of board squares that contain a piece that are available to the user. List can be continuous or delimited.
     * Only pieces on this list can be interacted with and they will have the 'grab' cursor icon when hovered.
     * 
     * Null means any piece on the board can be moved.
     * @default null
     */
    @property({ attribute: 'available-board-pieces', type: String })
    availableBoardPieces: string | null = null

    /**
     * List of spare pieces that are available to the user. List can be continuous or delimited.
     * Only the spare pieces on this list can be interacted with and dragged to the board.
     * 
     * Null means that all spare pieces are available.
     * @default null
     */
    @property({ attribute: 'available-spare-pieces', type: String })
    availableSparePieces: string | null = null

    /**
     * Name of the black player.
     */
    @property({ attribute: 'black-name', type: String })
    blackName: string | null = null

    /**
     * Rating of the black player.
     */
    @property({ attribute: 'black-rating', type: String })
    blackRating: string | null = null

    /**
     * Time left for black player in seconds. This will be formatted in separate minutes, seconds and second fractions
     * for time display. For freely formatted time display, use the `blackTime` property instead.
     */
    @property({ attribute: 'black-seconds', type: Number })
    blackSeconds: number | null = null

    /**
     * Time left for black player as a formatted string. Ignored if `blackSeconds` is set.
     */
    @property({ attribute: 'black-time', type: String })
    blackTime: string | null = null

    /**
     * Title of the black player.
     */
    @property({ attribute: 'black-title', type: String })
    blackTitle: string | null = null

    /**
     * Square codes with associated color masks to add to them.
     */
    @property({
        attribute: 'color-squares',
        converter: (value: string | null) => {
            if (!value) {
                return null
            }
            const squares = []
            const squareDescriptions = value.split(';')
            for (const desc of squareDescriptions) {
                const params = desc.trim().split(/[,\-:\s]/)
                if (params.length < 2) {
                    continue
                }
                let color = 'var(--preset-color-yellow)'
                if (
                    params[params.length - 1].startsWith('@') &&
                    params[params.length - 1].substring(1) in presetColors
                ) {
                    color = `var(--preset-color-${params[params.length - 1].substring(1)})`
                } else if (!isValidSquare(params[1])) {
                    color = params[1]
                }
                for (let i=0; i<params.length - 1; i++) {
                    squares.push({ color: color, square: params[i] })
                }
            }
            return squares
        },
        type: Array,
    })
    colorSquares: { color: string, square: BoardSquare }[] = []

    /**
     * If `true`, the time remaining for the player in turn will count down.
     * @default false
     */
    @property({
        attribute: 'countdown',
        type: Boolean,
    })
    countdown = false

    @property({ type: Number })
    countdownTimeout = 0

    /**
     * If `true`, pieces on the board are draggable to other squares.
     * @default false
     */
    @property({
        attribute: 'draggable-pieces',
        type: Boolean,
    })
    draggablePieces = false

    /**
     * If `'snapback'`, pieces dropped off the board will return to their original square. If `'trash'`, pieces dropped
     * off the board will be removed from the board.
     *
     * This property has no effect when `draggable` is `false`.
     * @default 'snapback'
     */
    @property({ attribute: 'drop-off-board' })
    dropOffBoard: OffBoardAction = 'snapback'

    /**
     * Animation speed for when pieces move between squares or from spare pieces to the board.
     * @default 'fast'
     */
    @property({
        attribute: 'move-speed',
    })
    moveSpeed: AnimationSpeed = DEFAULT_MOVE_SPEED

    /**
     * The orientation of the board. `'white'` for the white player at the bottom, `'black'` for the black player at
     * the bottom.
     * @default 'white'
     */
    @property()
    orientation: SquareColor = 'white'

    /**
     * A template string or function used to determine the source of piece images, used by the default `renderPiece`
     * function, which renders an `<img>` element.
     *
     * If `pieceTheme` is a string, the pattern {piece} will be replaced by the piece code. The result should be an
     * `<img>` source.
     *
     * If `pieceTheme` is a function the first argument is the piece code. The function should return an `<img>` source.
     */
    @property({ attribute: 'piece-theme' })
    pieceTheme?: string | ((piece: ChessPiece) => string)

    /**
     * A function that renders DOM for a piece to a container element. This function can render any elements and text,
     * including SVG.
     *
     * The default value renders an SVG image of the piece, unless the `pieceTheme` property is set, then it uses
     * `pieceTheme` to get the URL for an `<img>` element.
     *
     * @default Function
     */
    @property({ attribute: false })
    renderPiece?: RenderPieceFunction = (
        piece: ChessPiece,
        container: HTMLElement
    ) => {
        let pieceImage: string | undefined = undefined
        if (isString(this.pieceTheme)) {
            pieceImage = interpolateTemplate(this.pieceTheme, {piece: piece})
        } else if (isFunction(this.pieceTheme)) {
            pieceImage = this.pieceTheme(piece)
        }
        if (pieceImage === undefined) {
            renderWikipediaSVGPiece(piece, container)
        } else {
            render(html`<img class="piece-image" src=${pieceImage} />`, container)
        }
    }

    /**
     * Animation speed for when pieces that were dropped outside the board return to their original square.
     * @default 'veryfast'
     */
    @property({
        attribute: 'snapback-speed',
    })
    snapbackSpeed: AnimationSpeed = DEFAULT_SNAPBACK_SPEED

    /**
     * Animation speed for when pieces \"snap\" to a square when dropped.
     * @default 'snap'
     */
    @property({
        attribute: 'snap-speed',
    })
    snapSpeed: AnimationSpeed = DEFAULT_SNAP_SPEED

    /**
     * If `true`, the board will have spare pieces that can be dropped onto the board. If `sparePieces` is set to
     * `true`, `draggablePieces` gets set to `true` as well.
     * @default false
     */
    @property({
        attribute: 'spare-pieces',
        type: Boolean,
    })
    sparePieces = false

    /**
     * List of markers to overlay on the given squares.
     */
    @property({
        attribute: 'square-markers',
        converter: (value: string | null) => {
            if (!value) {
                return null
            }
            const markers = []
            const markerDescriptions = value.split(';')
            for (const desc of markerDescriptions) {
                const params = desc.trim().split(/[,\-:\s]/)
                if (params.length < 3) {
                    continue
                }
                let mType = '' as MarkerType
                if (params[params.length - 2] === 'o') {
                    mType = 'circle'
                } else if (params[params.length - 2] === 'x') {
                    mType = 'cross'
                }
                if (mType) {
                    for (let i=0; i< params.length - 2; i++) {
                        markers.push(new SquareMarker(params[i] as BoardSquare, mType, params[params.length - 1]))
                    }
                }
            }
            return markers
        },
        type: Array,
    })
    squareMarkers: SquareMarker[] = []

    /**
     * A list of straight arrows to draw on the board.
     */
    @property({
        attribute: 'straight-arrows',
        converter: (value: string | null) => {
            if (!value) {
                return null
            }
            const arrows = []
            const arrowDescriptions = value.split(';')
            for (const desc of arrowDescriptions) {
                const params = desc.trim().split(/[,\-:\s]/)
                if (params.length !== 3) {
                    continue
                }
                arrows.push(new StraightArrow(params[0] as BoardSquare, params[1] as BoardSquare, params[2]))
            }
            return arrows
        },
        type: Array,
    })
    straightArrows: StraightArrow[] = []

    /**
     * If `true`, more pieces of a kind can be added to the board than is allowed by the rules.
     * @default false
     */
    @property({
        attribute: 'superfluous-pieces',
        type: Boolean,
    })
    superfluousPieces = false

    /**
     * Animation speed for when pieces are removed.
     * @default 'veryfast'
     */
    @property({
        attribute: 'trash-speed',
    })
    trashSpeed: AnimationSpeed = DEFAULT_TRASH_SPEED

    /**
     * The player in turn. This only affects the appearance of player details and possible time countdown.
     * Either `black` or `white`.
     */
    @property()
    turn: SquareColor | null = null

    /**
     * Name of the white player.
     */
    @property({ attribute: 'white-name', type: String })
    whiteName: string | null = null

    /**
     * Rating of the white player.
     */
    @property({ attribute: 'white-rating', type: String })
    whiteRating: string | null = null

    /**
     * Time left for white player in seconds. This will be formatted in separate minutes, seconds and second fractions
     * for time display. For freely formatted time display, use the `whiteTime` property instead.
     */
    @property({ attribute: 'white-seconds', type: Number })
    whiteSeconds: number | null = null

    /**
     * Time left for white player as a formatted string. Ignored if `whiteSeconds` is set.
     */
    @property({ attribute: 'white-time', type: String })
    whiteTime: string | null = null

    /**
     * Title of the white player.
     */
    @property({ attribute: 'white-title', type: String })
    whiteTitle: string | null = null

    // ---------------------------------------------------------------------------
    // Internal properties and getters.
    // ---------------------------------------------------------------------------

    @query('[part~="dragged-piece"]')
    private _draggedPieceElement!: HTMLElement

    #highlightSquares = new Map<BoardSquare, HighlightStyle >()

    #animations = new Map<BoardLocation, Animation>()

    #currentPosition: BoardPositionObject = {}

    #dragState?: DragState

    /**
     * Is the current drag state "dragging".
     */
    get #isDragging (): boolean {
        return this.#dragState?.state === 'dragging'
    }

    /**
     * Get the edge length of a single square in pixels.
     */
    get #squareSize () {
        // Note: this isn't cached, but is called during user interactions, so we
        // have a bit of time to use under RAIL guidelines.
        if (this.adjustByHeight && this.parentElement?.style.height) {
            const hasExtraRows = this.sparePieces || this.blackName || this.whiteName
            return this.parentElement.offsetHeight / (hasExtraRows ? 10 : 8)
        } else {
            return this.offsetWidth / 8
        }
    }

    /**
     * Build a list of CSS parts from the given part names.
     * @param parts - List of part names (empty strings are omitted).
     * @returns A CSS part string.
     */
    #concatParts (...parts: string[]) {
        const nonEmpty = parts.filter(c => c.length > 0)
        return nonEmpty.join(' ')
    }

    /**
     * Get the HTML element of the given `square`.
     * @param square - Square code.
     * @returns HTML element.
     */
    #getSquareElement (square: BoardSquare): HTMLElement {
        return this.shadowRoot!.getElementById(squareId(square))!
    }

    /**
     * Get the HTML element for the give spare `piece`. 
     * @param piece - Piece code.
     * @returns HTML element.
     */
    #getSparePieceElement (piece: ChessPiece): HTMLElement {
        return this.shadowRoot!.getElementById(sparePieceId(piece))!
    }

    // -------------------------------------------------------------------------
    // DOM Building
    // -------------------------------------------------------------------------

    render () {
        const detailStyles = {
            height: `${!this.sparePieces && (this.blackName || this.whiteName) ? this.#squareSize : 0}px`,
            width: `${!this.sparePieces && (this.blackName || this.whiteName) ? 8*this.#squareSize : 0}px`,
            // Set base font size to adjust label sizes according to board size.
            fontSize: `${this.#squareSize}px`
        }
        const spareStyles = {
            height: `${this.sparePieces ? this.#squareSize : 0}px`,
            width: `${this.sparePieces ? 8*this.#squareSize : 0}px`,
        }
        return html`
            <div part="wrapper">
                <div part="spare-pieces" style="${styleMap(spareStyles)}">
                    ${this.#renderSparePieces(
                        this.orientation === 'white' ? 'black' : 'white'
                    )}
                </div>
                <div part="game-details" style="${styleMap(detailStyles)}">
                    ${this.#renderGameDetails(
                        this.orientation === 'white' ? 'black' : 'white'
                    )}
                </div>
                ${this.#renderBoard()}
                <div part="game-details" style="${styleMap(detailStyles)}">
                    ${this.#renderGameDetails(
                        this.orientation === 'white' ? 'white' : 'black'
                    )}
                </div>
                <div part="spare-pieces" style="${styleMap(spareStyles)}">
                    ${this.#renderSparePieces(
                        this.orientation === 'white' ? 'white' : 'black'
                    )}
                </div>
                <div
                    id="dragged-pieces"
                    part="dragged-pieces"
                    style=${styleMap({
                            width: `0px`,
                            height: `0px`,
                            cursor: `grabbing`,
                            overflow: `visible`,
                    })}
                >
                    ${this.#renderDraggedPiece()}
                </div>
            </div>
        `
    }
    /**
     * Render player details if they are available.
     * @param color - Color of the player.
     */
    #renderGameDetails (color: SquareColor) {
        // Spare pieces overrides player details.
        if (this.sparePieces) {
            return nothing
        }
        if (!this.blackName && !this.whiteName) {
            return nothing
        }
        // Only display the timer component if there is something to display.
        const timerStyles = {
            display: (
                (color === 'black' && (this.blackSeconds !== null || this.blackTime !== null)) ||
                (color === 'white' && (this.whiteSeconds !== null || this.whiteTime !== null))
            ) ? 'flex' : 'none'
        }
        const isLowTime = (color === 'black' && this.blackSeconds !== null && this.blackSeconds < LOW_TIME) ||
                          (color === 'white' && this.whiteSeconds !== null && this.whiteSeconds < LOW_TIME)
        const playerTime = color === 'black' ? (this.blackSeconds || 0) : (this.whiteSeconds || 0)
        const isOutOfTime = playerTime === 0
        // Only display the second fraction if total time remaining is below threshold.
        const fractionStyles = {
            display: isLowTime && !isOutOfTime ? 'block' : 'none'
        }
        const playerName = (color === 'black' ? this.blackName : this.whiteName) || 'Unknown'
        const playerTitle = (color === 'black' ? this.blackTitle : this.whiteTitle) || ''
        // Display something below the name for consistent visuals, either title or rating.
        const playerRating = 
            (color === 'black' ? this.blackRating : this.whiteRating) ||
            (playerTitle ? '' : 'Unrated')
        const timeMinutes = Math.floor(playerTime/60)
        const timeSeconds = Math.floor(playerTime%60).toString().padStart(2, '0')
        const timeFraction = playerTime.toFixed(1).split('.')[1]
        // Start possible countdown for the color in turn.
        if (this.countdown && this.turn === color && playerTime && !this.countdownTimeout) {
            // Take note of the time of the next exat seconds to keep the clock in sync.
            const startTime = Date.now()
            // Add 50 ms to make sure that the displayed second always changes.
            const secOffset = (playerTime*1000)%1000 + 50
            let timeCountedDown = secOffset
            const updateTime = (delta: number) => {
                const timeRemaining = color === 'black' ? (this.blackSeconds || 0) : (this.whiteSeconds || 0)
                if (color = 'black') {
                    (this.blackSeconds as number) -= delta/1000
                    if ((this.blackSeconds as number) <= 0) {
                        // Don't go into negative numbers...
                        this.blackSeconds = 0
                        return
                    }
                } else {
                    (this.whiteSeconds as number) -= delta/1000
                    if ((this.whiteSeconds as number) <= 0) {
                        this.whiteSeconds = 0
                        return
                    }
                }
                const timeSync = Date.now() - startTime - timeCountedDown
                // Start faster update interval the seconds before we reach low time range.
                const tickTarget = timeRemaining > LOW_TIME + 1 ? 100 : 50
                const nexTick = tickTarget - timeSync
                this.countdownTimeout = setTimeout(() => updateTime(nexTick), nexTick)
                timeCountedDown += tickTarget + timeSync
            }
            if (this.countdownTimeout) {
                clearTimeout(this.countdownTimeout)
            }
            // Countdown the remaining fraction first.
            this.countdownTimeout = setTimeout(() => updateTime(secOffset), secOffset)
        }
        return html`
            <div part="${this.#concatParts(
                'player-details',
                'player-${color}',
                color === this.turn ? 'player-turn' : '',
            )}">
                <div part="player-name">
                    ${ playerName }
                </div>
                <div part="player-rating">
                    ${ playerTitle }${ playerTitle && playerRating ? ', ' : '' }
                    ${ playerRating }
                </div>
            </div>
            <div part="${this.#concatParts(
                    'player-timer',
                    'timer-${color}',
                    isOutOfTime ? 'timer-low' : '',
                )}"
                style="${styleMap(timerStyles)}"
            >
                <div part="timer-minutes">
                    ${timeMinutes}
                </div>
                :
                <div part="${this.#concatParts(
                    'timer-seconds',
                    isLowTime && !isOutOfTime ? 'timer-low' : ''
                )}">
                    ${timeSeconds}
                </div>
                <div part="timer-fraction timer-low" style="${styleMap(fractionStyles)}">
                    .${timeFraction}
                </div>
            </div>
        `
    }
    /**
     * Render spare pieces of the given `color`. Pieces are rendered on an additional row instead of the player details.
     * @param color - Color of the side with the spare pieces.
     */
    #renderSparePieces (color: SquareColor) {
        if (!this.sparePieces) {
            return nothing
        }
        const pieces = color === 'black' ? blackPieces : whitePieces
        const totalPieces = Object.values(this.position).filter(
            bp => (color === 'black' ? bp?.startsWith('b') : bp?.startsWith('w'))
        ).length
        const pawnCount = Object.values(this.position).filter(bp => bp === (color === 'black' ? 'bP' : 'wP')).length
        // The empty <div>s below are placeholders to get the shelf to line up with the board's grid. Another option
        // would be to try to use the same grid, either with a single container, or subgrid/display:contents when those
        // are available.
        return html`
            <div></div>
            ${pieces.map(
                (p) => {
                    const availPieces = 16 - totalPieces
                    const pieceCount = Object.values(this.position).filter(bp => bp === p).length
                    /** Number of pawns missing from the board = possible promotions. */
                    const promoCount = 8 - pawnCount 
                    const availableForKind = p.endsWith('B') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('K') ? Math.min(1 - pieceCount, availPieces)
                                           : p.endsWith('N') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('P') ? Math.min(8 - pieceCount, availPieces)
                                           : p.endsWith('Q') ? Math.min((1 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('R') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : 0
                    const disabled = (availableForKind < 1 || this.superfluousPieces) ||
                                     (
                                        this.availableSparePieces !== null &&
                                        !this.availableSparePieces.toLowerCase().includes(p.toLowerCase())
                                     )
                    return html`
                        <div
                            id="spare-${p}"
                            part="${this.#concatParts(
                                'spare-piece',
                                disabled ? 'disabled' : '',
                            )}"
                            @mousedown=${disabled ? null : this.#pointerdownSparePiece}
                            @touchstart=${disabled ? null : this.#pointerdownSparePiece}
                        >
                            ${this.#renderPiece(p, {}, false, sparePieceId(p))}
                        </div>
                    `
                }
            )}
            <div></div>
        `
    }
    /**
     * Render the piece that is being dragged.
     */
    #renderDraggedPiece () {
        const styles: Partial<CSSStyleDeclaration> = {
            height: `${this.#squareSize}px`,
            width: `${this.#squareSize}px`,
        }
        const dragState = this.#dragState
        if (dragState !== undefined) {
            styles.display = 'block'
            const rect = this.getBoundingClientRect()

            if (dragState.state === 'dragging') {
                const {x, y} = dragState
                Object.assign(styles, {
                    top: `${y - rect.top - this.#squareSize / 2}px`,
                    left: `${x - rect.left - this.#squareSize / 2}px`,
                })
            } else if (dragState.state === 'snapback') {
                const { source } = dragState
                const square = this.#getSquareElement(source as BoardSquare)
                const squareRect = square.getBoundingClientRect()
                Object.assign(styles, {
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.snapbackSpeed)}ms`,
                    top: `${squareRect.top - rect.top}px`,
                    left: `${squareRect.left - rect.left}px`,
                })
            } else if (dragState.state === 'trash') {
                const {x, y} = dragState
                Object.assign(styles, {
                    transitionProperty: 'opacity',
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: '0',
                    top: `${y - rect.top - this.#squareSize / 2}px`,
                    left: `${x - rect.left - this.#squareSize / 2}px`,
                })
            } else if (dragState.state === 'snap') {
                const square = this.#getSquareElement(dragState.location as BoardSquare)
                const squareRect = square.getBoundingClientRect()
                Object.assign(styles, {
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.snapSpeed)}ms`,
                    top: `${squareRect.top - rect.top}px`,
                    left: `${squareRect.left - rect.left}px`,
                })
            }
        }

        return this.#renderPiece(
            this.#dragState?.piece ?? '',
            styles,
            false,
            undefined,
            'dragged-piece'
        )
    }
    /**
     * Render the chess board and pieces on the board.
     */
    #renderBoard () {
        const squares = []
        const isFlipped = this.orientation === 'black'
        for (let row=0; row<8; row++) {
            for (let col=0; col<8; col++) {
                const file = COLUMNS[isFlipped ? 7 - col : col]
                const rank = isFlipped ? row + 1 : 8 - row
                const square = `${file}${rank}` as BoardSquare
                const squareColor = getSquareColor(square)
                let piece = this.#currentPosition[square]
                const isDragSource = square === this.#dragState?.source
                const animation = this.#animations.get(square)
                const highlightStyle = this.#highlightSquares.get(square)
                const squareHighlight =
                    isDragSource ? 'highlight-active'
                        : highlightStyle
                          ? `highlight-${highlightStyle}`
                          : ''
                const colorSquare = this.colorSquares?.filter(s => s.square === square)[0]
                const squareStyles = colorSquare
                        ? { boxShadow: `inset 0 0 ${ this.#squareSize }px 0 ${ colorSquare.color }` } : {}
                const draggable =
                    piece && (
                        this.availableBoardPieces === null ||
                        this.availableBoardPieces?.toLowerCase().includes(square)
                    )
                        ? 'draggable' : ''
                const pieceStyles = this.#getAnimationStyles(piece, animation)
                if (!piece && animation?.type === 'clear') {
                    // Preserve the piece until the animation is complete
                    piece = animation.piece
                }

                squares.push(html`
                    <div
                        id=${squareId(square)}
                        data-square=${square}
                        part="${this.#concatParts(
                            'square',
                            square,
                            squareColor,
                            squareHighlight,
                            colorSquare ? 'colored' : '',
                            draggable
                        )}"
                        style="${styleMap(squareStyles)}"
                        @mousedown=${this.#pointerdownSquare}
                        @mouseenter=${this.#pointerenterSquare}
                        @mouseleave=${this.#pointerleaveSquare}
                        @touchstart=${this.#pointerdownSquare}
                    >
                        ${this.showNotation && row === 7
                            ? html`<div part="notation alpha">${file}</div>`
                            : nothing}
                        ${this.showNotation && col === 0
                            ? html`<div part="notation numeric">${rank}</div>`
                            : nothing}
                        ${this.#renderPiece(piece, pieceStyles, isDragSource)}
                    </div>
                `)
            }
        }
        // Main board dimensions.
        const styles = {
            width: this.#squareSize * 8 + 'px',
            height: this.#squareSize * 8 + 'px',
        }
        // Add overlays.
        const arrows = []
        for (const arr of this.angledArrows || []) {
            arrows.push(arr.getSvg())
        }
        for (const arr of this.straightArrows || []) {
            arrows.push(arr.getSvg())
        }
        const markers = []
        for (const mrk of this.squareMarkers || []) {
            markers.push(mrk.getSvg())
        }
        return html`<div part="board" style=${styleMap(styles)}>${squares}${arrows}${markers}</div>`
    }
    /**
     * Render the the given piece on the board.
     * @param piece - The piece to render.
     * @param styles - Additional piece styles.
     * @param isDragSource - Is this piece currently being dragged.
     * @param id - Optional piece ID.
     * @param part - Additional CSS parts.
     */
    #renderPiece (
        piece: ChessPiece | undefined,
        styles: Partial<CSSStyleDeclaration>,
        isDragSource?: boolean,
        id?: string,
        part?: string
    ) {
        if (piece === undefined || piece === '') {
            return nothing
        }
        // Required and additional styles.
        const style: Partial<CSSStyleDeclaration> = {
            opacity: '1',
            transitionProperty: '',
            transitionDuration: '0ms',
            ...styles,
        }
        // Do not display a piece that is being dragged on the source square.
        if (isDragSource) {
            style.display = 'none'
        }

        if (!isFunction(this.renderPiece)) {
            this.#error(8272, 'invalid renderPiece.')
        }

        return html`
            <div
                id=${ifDefined(id)}
                part="piece ${part ?? ''}"
                piece=${piece}
                style=${styleMap(style as StyleInfo)}
                ...=${renderPieceDirective(piece, this.renderPiece)}
            ></div>
        `
    }
    /**
     * Get possible `animation` styles for the given `piece`.
     * @param piece - The chess piece.
     * @param animation - Possible animation.
     * @returns Animation styles as an object.
     */
    #getAnimationStyles (
        piece: ChessPiece | undefined,
        animation?: Animation | undefined
    ): Partial<CSSStyleDeclaration> {
        if (animation) {
            if (
                piece &&
                (animation.type === 'move-start' ||
                    (animation.type === 'add-start' && this.draggablePieces))
            ) {
                // BoardPosition the moved piece absolutely at the source.
                const srcSquare =
                    animation.type === 'move-start'
                        ? this.#getSquareElement(animation.source as BoardSquare)
                        : this.#getSparePieceElement(piece)
                const destSquare =
                    animation.type === 'move-start'
                        ? this.#getSquareElement(animation.destination)
                        : this.#getSquareElement(animation.square)

                const srcSquareRect = srcSquare.getBoundingClientRect()
                const destSquareRect = destSquare.getBoundingClientRect()

                return {
                    position: 'absolute',
                    left: `${srcSquareRect.left - destSquareRect.left}px`,
                    top: `${srcSquareRect.top - destSquareRect.top}px`,
                    width: `${this.#squareSize}px`,
                    height: `${this.#squareSize}px`,
                }
            }
            if (
                piece &&
                (animation.type === 'move' ||
                    (animation.type === 'add' && this.draggablePieces))
            ) {
                // Transition the moved piece to the destination.
                return {
                    position: 'absolute',
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.moveSpeed)}ms`,
                    top: `0`,
                    left: `0`,
                    width: `${this.#squareSize}px`,
                    height: `${this.#squareSize}px`,
                }
            }
            if (!piece && animation.type === 'clear') {
                // Preserve and transition a removed piece to opacity 0.
                piece = animation.piece
                return {
                    transitionProperty: 'opacity',
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: '0',
                }
            }
            if (piece && animation.type === 'add-start') {
                // Initialize an added piece to opacity 0.
                return {
                    opacity: '0',
                }
            }
            if (piece && animation.type === 'add') {
                // Transition an added piece to opacity 1.
                return {
                    transitionProperty: 'opacity',
                    transitionDuration: `${speedToMS(this.appearSpeed)}ms`,
                }
            }
        }
        return {}
    }

    // -------------------------------------------------------------------------
    // Event Listeners
    // -------------------------------------------------------------------------

    #pointerdownSquare (e: PointerEvent | TouchEvent) {
        // Do nothing if we're not draggable. sparePieces implies draggable.
        if (!this.draggablePieces && !this.sparePieces) {
            return
        }
        // Do nothing if there is no piece on this square.
        const squareEl = e.currentTarget as HTMLElement
        const square = squareEl.getAttribute('data-square') as BoardSquare
        if (square === null || !this.#currentPosition.hasOwnProperty(square)) {
            return
        }
        // Ignore squares that don't have a movable piece.
        if (this.availableBoardPieces !== null && !this.availableBoardPieces.includes(square)) {
            return
        }
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this.#startDraggingPiece(
            square,
            this.#currentPosition[square]!,
            pos.clientX,
            pos.clientY
        )
    }

    #pointerdownSparePiece (e: PointerEvent | TouchEvent) {
        // Do nothing if sparePieces is not enabled.
        if (!this.sparePieces) {
            return
        }
        const sparePieceContainerEl = e.currentTarget as HTMLElement
        const pieceEl = sparePieceContainerEl.querySelector('[part~=piece]')
        const piece = pieceEl!.getAttribute('piece')! as ChessPiece
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this.#startDraggingPiece('spare', piece, pos.clientX, pos.clientY)
    }

    #pointerenterSquare (e: PointerEvent) {
        // Do not fire this event if we are dragging a piece.
        // NOTE: this should never happen, but it's a safeguard.
        if (this.#dragState !== undefined) {
            return
        }
        const square = (e.currentTarget as HTMLElement).getAttribute('data-square') as BoardSquare
        // NOTE: this should never happen; defensive.
        if (!isValidSquare(square)) {
            return
        }
        const piece =
            this.#currentPosition.hasOwnProperty(square) &&
            this.#currentPosition[square]!
        // Dispatch custom event.
        this.dispatchEvent(
            new CustomEvent<ChessboardEventDetail['mouseover-square']>(
                'mouseover-square',
                {
                    bubbles: true,
                    detail: {
                        square,
                        piece,
                        position: deepCopy(this.#currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
    }

    #pointerleaveSquare (e: PointerEvent) {
        // Do not fire this event if we are dragging a piece.
        // NOTE: this should never happen, but it's a safeguard.
        if (this.#dragState !== undefined) {
            return
        }
        const square = (e.currentTarget as HTMLElement).getAttribute('data-square') as BoardSquare
        // NOTE: this should never happen; defensive.
        if (!isValidSquare(square)) {
            return
        }
        const piece =
            this.#currentPosition.hasOwnProperty(square) &&
            this.#currentPosition[square]!
        // Dispatch custom event.
        this.dispatchEvent(
            new CustomEvent<ChessboardEventDetail['mouseout-square']>(
                'mouseout-square',
                {
                    bubbles: true,
                    detail: {
                        square,
                        piece,
                        position: deepCopy(this.#currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
    }

    #pointermoveWindow (e: PointerEvent | TouchEvent) {
        // Do nothing if we are not dragging a piece.
        if (!this.#isDragging) {
            return
        }
        // Prevent screen from scrolling.
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this.#updateDraggedPiece(pos.clientX, pos.clientY)
    }

    #pointerupWindow (e: PointerEvent | TouchEvent) {
        // Do nothing if we are not dragging a piece.
        if (!this.#isDragging) {
            return
        }
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        const location = this.#isXYOnSquare(pos.clientX, pos.clientY)
        this.#stopDraggingPiece(location)
    }

    // -------------------------------------------------------------------------
    // Internal methods.
    // -------------------------------------------------------------------------

    /**
     * Calculate an array of animations that need to happen in order to get from `pos1` to `pos2`.
     * @param pos1 - First (starting) board position.
     * @param pos2 - Second (ending) board position.
     * @returns Array of possible animations.
     */
    #calculateAnimations (
        pos1: BoardPositionObject,
        pos2: BoardPositionObject
    ): Animation[] {
        // Make copies of both.
        pos1 = deepCopy(pos1)
        pos2 = deepCopy(pos2)
        // Always return an array.
        const animations: Animation[] = []
        const squaresMovedTo: {[square: string]: boolean} = {}
        // Ignore pieces that are the same in both positions.
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) {
                continue
            }
            if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
                delete pos1[i]
                delete pos2[i]
            }
        }
        // Find all the "move" animations.
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) {
                continue
            }
            const closestPiece = findClosestPiece(pos1, pos2[i]!, i as BoardSquare)
            if (closestPiece) {
                animations.push({
                    type: 'move',
                    source: closestPiece,
                    destination: i as BoardSquare,
                    piece: pos2[i]!,
                })
                // Remove the processed pieces.
                delete pos1[closestPiece]
                delete pos2[i]
                squaresMovedTo[i] = true
            }
        }
        // '"add" animations for new pieces on the board.
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) {
                continue
            }
            animations.push({
                type: 'add',
                square: i as BoardSquare,
                piece: pos2[i]!,
            })
            delete pos2[i]
        }
        // "clear" animations for pieces removed from the board.
        for (const i in pos1) {
            if (!pos1.hasOwnProperty(i)) {
                continue
            }
            // Do not clear a piece if it is on a square that is the result of a "move", ie: a piece capture.
            if (squaresMovedTo.hasOwnProperty(i)) {
                continue
            }
            animations.push({
                type: 'clear',
                square: i as BoardSquare,
                piece: pos1[i]!,
            })
            delete pos1[i]
        }
        return animations
    }
    /**
     * Perform the given `animations` to change the state of the board.
     * @param animations - Array of animations to perform.
     * @param oldPos - The starting board position.
     * @param newPos - The resulting board position.
     */
    async #doAnimations (
        animations: Animation[],
        oldPos: BoardPositionObject,
        newPos: BoardPositionObject
    ) {
        if (!animations.length) {
            return
        }
        let numFinished = 0
        const transitionEndListener = () => {
            numFinished++
            if (numFinished === animations.length) {
                this.shadowRoot!.removeEventListener(
                    'transitionend',
                    transitionEndListener
                )
                this.#animations.clear()
                this.requestUpdate()
                this.dispatchEvent(
                    new CustomEvent<ChessboardEventDetail['move-end']>(
                        'move-end',
                        {
                            bubbles: true,
                            detail: {
                                oldPosition: deepCopy(oldPos),
                                newPosition: deepCopy(newPos),
                            },
                        })
                )
            }
        }
        this.shadowRoot!.addEventListener('transitionend', transitionEndListener)
        // Render once with added pieces at opacity 0 to "fade the pieces in".
        this.#animations.clear()
        for (const animation of animations) {
            if (animation.type === 'add' || animation.type === 'add-start') {
                this.#animations.set(animation.square, {
                    ...animation,
                    type: 'add-start',
                })
            } else if (animation.type === 'move' || animation.type === 'move-start') {
                this.#animations.set(animation.destination, {
                    ...animation,
                    type: 'move-start',
                })
            } else {
                this.#animations.set(animation.square, animation)
            }
        }
        // Wait for a paint.
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        // Render again with the piece at opacity 1 with a transition.
        this.#animations.clear()
        for (const animation of animations) {
            if (animation.type === 'move' || animation.type === 'move-start') {
                this.#animations.set(animation.destination, animation)
            } else {
                this.#animations.set(animation.square, animation)
            }
        }
        this.requestUpdate()
    }
    /**
     * Place the currently dragged piece on the given `square`.
     * @param square - The target square name.
     * @returns A promise that resolves when the action is complete.
     */
    async #dropDraggedPieceOnSquare (square: BoardLocation) {
        isDragging(this.#dragState)
        const { source, piece } = this.#dragState
        // Update position.
        const newPosition = deepCopy(this.#currentPosition)
        delete newPosition[source]
        newPosition[square] = piece
        this.#setCurrentPosition(newPosition)
        // Set initial state.
        this.#dragState = {
            state: 'snap',
            piece,
            location: square,
            source: square,
        }
        // Wait for a paint.
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        // Promise that resolves when the piece has reached its position on the square.
        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                this._draggedPieceElement.removeEventListener(
                    'transitionend',
                    transitionComplete
                )
                resolve()
                // Fire the snap-end event.
                this.dispatchEvent(
                    new CustomEvent<ChessboardEventDetail['snap-end']>(
                        'snap-end', 
                        {
                            bubbles: true,
                            detail: {
                                source,
                                square,
                                piece,
                            },
                        }
                    )
                )
            }
            this._draggedPieceElement.addEventListener(
                'transitionend',
                transitionComplete
            )
        })
    }
    /**
     * Create and dispatch a new error.
     * @param code - Error code.
     * @param msg - Error message.
     * @param _obj - Possible error object?
     * @returns The created error.
     */
    #error (code: number, msg: string, _obj?: unknown) {
        const errorText = `Chessboard Error ${code} : ${msg}`
        this.dispatchEvent(
            new ErrorEvent('error', {
                message: errorText,
            })
        )
        return new Error(errorText)
    }
    /**
     * Highlight the given square.
     * @param square - Square name.
     * @param value - Optional highlight style.
     */
    #highlightSquare (square: BoardSquare, value = null as HighlightStyle | null) {
        if (value) {
            this.#highlightSquares.set(square, value)
        } else {
            this.#highlightSquares.delete(square)
        }
        this.requestUpdate('_highlightSquares')
    }
    /**
     * Check which square (or off the board) the given window x,y position is.
     * @param x - Pointer x-position.
     * @param y - Pointer y-position.
     * @returns Square name 'offboard'.
     */
    #isXYOnSquare (x: number, y: number): BoardLocation | 'offboard' {
        // TODO: remove cast when TypeScript fixes ShadowRoot.elementsFromPoint
        const elements = (this
            .shadowRoot as unknown as Document)!.elementsFromPoint(x, y)
        const squareEl = elements.find((e) => e.part.contains('square'))
        const square =
            squareEl === undefined
                ? 'offboard'
                : (squareEl.getAttribute('data-square') as BoardLocation)
        return square
    }
    /**
     * Set the board to the given board `position`.
     * @param position - The position to set.
     * @param playerMove - Is this position change a move made by a player (default true).
     */
    #setCurrentPosition (position: BoardPositionObject, playerMove = true) {
        const oldPos = deepCopy(this.#currentPosition)
        const newPos = deepCopy(position)
        const oldFen = objToFen(oldPos)
        const newFen = objToFen(newPos)
        // Do nothing if no change in position.
        if (oldFen === newFen) {
            return
        }
        // Update board state.
        this.#currentPosition = position
        // Fire change event, wait for animation time if this is a programmatic change.
        setTimeout(() => {
            this.dispatchEvent(
                new CustomEvent<ChessboardEventDetail['change']>(
                    'change', 
                    {
                        bubbles: true,
                        detail: {
                            oldFen: oldFen || '',
                            oldPosition: oldPos,
                            newFen: newFen || '',
                            newPosition: newPos,
                        },
                    }
                )
            )
        }, playerMove ? 0 : speedToMS(this.moveSpeed))
    }
    /**
     * Perform a 'snapback' action for the given piece, or trash it if it is a spare piece.
     * @returns A promise that resolves when the action is complete.
     */
    async #snapbackDraggedPiece () {
        isDragging(this.#dragState)
        const { source, piece } = this.#dragState
        // There is no "snapback" for spare pieces.
        if (source === 'spare') {
            return this.#trashDraggedPiece()
        }
        // Set initial state.
        this.#dragState = {
            state: 'snapback',
            piece,
            source,
        }
        // Wait for a paint.
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        // Promise that resolves when the snapback is complete.
        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                this._draggedPieceElement.removeEventListener(
                    'transitionend',
                    transitionComplete
                )
                resolve()
                this.dispatchEvent(
                    new CustomEvent<ChessboardEventDetail['snapback-end']>(
                        'snapback-end', 
                        {
                            bubbles: true,
                            detail: {
                                piece,
                                square: source,
                                position: deepCopy(this.#currentPosition),
                                orientation: this.orientation,
                            },
                        }
                    )
                )
            }
            this._draggedPieceElement.addEventListener(
                'transitionend',
                transitionComplete
            )
        })
    }
    /**
     * Start dragging a chess `piece`.
     * @param source - Source square of the dragged piece.
     * @param piece - The dragged chess piece.
     * @param x - Window x-position of the pointer at start of the drag operation.
     * @param y - Window y-position of the pointer at start of the drag operation.
     */
    #startDraggingPiece (
        source: BoardLocation,
        piece: ChessPiece,
        x: number,
        y: number
    ) {
        // Fire cancalable drag-start event.
        const event = new CustomEvent<ChessboardEventDetail['drag-start']>(
            'drag-start',
            {
                bubbles: true,
                cancelable: true,
                detail: {
                    source,
                    piece,
                    position: deepCopy(this.#currentPosition),
                    orientation: this.orientation,
                },
            }
        )
        // Dispatch the drag-start event.
        this.dispatchEvent(event)
        if (event.defaultPrevented) {
            return
        }
        // Set initial state.
        this.#dragState = {
            state: 'dragging',
            x,
            y,
            piece,
            // If the piece came from spare pieces, location is offboard.
            location: source === 'spare' ? 'offboard' : source,
            source,
        }
        this.requestUpdate()
    }
    /**
     * Stop the piece drag operation.
     * @param location - Board position where the operation stopped.
     */
    async #stopDraggingPiece (location: BoardLocation) {
        isDragging(this.#dragState)
        const { source, piece } = this.#dragState
        // Determine what the action should be.
        let action: Action = 'drop'
        if (location === 'offboard') {
            action = this.dropOffBoard === 'trash' ? 'trash' : 'snapback'
        }
        const newPosition = deepCopy(this.#currentPosition)
        const oldPosition = deepCopy(this.#currentPosition)
        // Ssee if a spare piece was placed on the board.
        if (source === 'spare' && isValidSquare(location)) {
            newPosition[location] = piece
        }
        // See if source piece was on the board.
        if (isValidSquare(source)) {
            // Remove the piece from the board.
            delete newPosition[source]
            // New position is on the board.
            if (isValidSquare(location)) {
                newPosition[location] = piece
            }
        }
        // Dispatch the drop event.
        // Allow listeners to change the drop action using the `setAction` method..
        const dropEvent = new CustomEvent<ChessboardEventDetail['drop']>(
            'drop',
            {
                bubbles: true,
                detail: {
                    source,
                    target: location,
                    piece,
                    newPosition,
                    oldPosition,
                    orientation: this.orientation,
                    setAction (a: Action) {
                        action = a
                    },
                },
            }
        )
        this.dispatchEvent(dropEvent)
        // Remove square highlight hints from the board.
        this.#highlightSquares.clear()
        // Check if action was changed and perform it.
        if (action === 'snapback') {
            await this.#snapbackDraggedPiece()
        } else if (action === 'trash') {
            await this.#trashDraggedPiece()
        } else if (action === 'drop') {
            await this.#dropDraggedPieceOnSquare(location)
        }
        // Clear dragging state.
        this.#dragState = undefined
        // Render the final post-dragging board state.
        this.requestUpdate()
    }
    /**
     * Trash (remove) the currently dragged piece.
     * @returns A promise that resolves when the action is complete.
     */
    async #trashDraggedPiece () {
        isDragging(this.#dragState)
        const { source, piece } = this.#dragState
        // Remove the source piece.
        const newPosition = deepCopy(this.#currentPosition)
        delete newPosition[source]
        this.#setCurrentPosition(newPosition)
        // Set initial state.
        this.#dragState = {
            state: 'trash',
            piece,
            x: this.#dragState.x,
            y: this.#dragState.y,
            source: this.#dragState.source,
        }
        // Wait for a paint.
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        // Promise that resolves when the piece has been trashed.
        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                this._draggedPieceElement.removeEventListener(
                    'transitionend',
                    transitionComplete
                )
                resolve()
            }
            this._draggedPieceElement.addEventListener(
                'transitionend',
                transitionComplete
            )
        })
    }
    /**
     * Update the position of a piece being dragged.
     * @param x - Current window x-position of the pointer.
     * @param y - Current window y-position of the pointer.
     */
    #updateDraggedPiece (x: number, y: number) {
        isDragging(this.#dragState)
        // Put the dragged piece over the mouse cursor.
        this.#dragState.x = x
        this.#dragState.y = y
        this.requestUpdate()
        // Check the current lcoation of the pointer.
        const location = this.#isXYOnSquare(x, y)
        // Do nothing more if the location has not changed.
        if (location === this.#dragState.location) {
            return
        }
        // Remove highlight from previous square.
        if (isValidSquare(this.#dragState.location)) {
            this.#highlightSquare(this.#dragState.location as BoardSquare, null)
        }
        // Add highlight to new square.
        if (isValidSquare(location)) {
            this.#highlightSquare(location as BoardSquare, 'active')
        }
        // Dispatch the drag-move event.
        this.dispatchEvent(
            new CustomEvent<ChessboardEventDetail['drag-move']>(
                'drag-move',
                {
                    bubbles: true,
                    detail: {
                        newLocation: location,
                        oldLocation: this.#dragState.location,
                        source: this.#dragState.source,
                        piece: this.#dragState.piece,
                        position: deepCopy(this.#currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
        // Update drag state.
        this.#dragState.location = location
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Sets the position of the board.
     * @param useAnimation If `true`, animate to the new position. If `false`, show the new position instantly.
     */
    setPosition (position: BoardPosition, useAnimation = true) {
        position = normalizePosition(position)
        // Validate position object.
        if (!isValidPositionObject(position)) {
            throw this.#error(
                6482,
                'Invalid value passed to the position method.',
                position
            )
        }
        if (useAnimation) {
            // Start the animations.
            const animations = this.#calculateAnimations(
                this.#currentPosition,
                position
            )
            this.#doAnimations(animations, this.#currentPosition, position)
        }
        this.#setCurrentPosition(position)
        this.requestUpdate()
    }
    /**
     * Sets the board to the start position.
     * @param useAnimation If `true`, animate to the new position. If `false`, show the new position instantly.
     */
    start (useAnimation?: boolean) {
        this.setPosition('start', useAnimation)
    }

    /**
     * Removes all the pieces on the board. If `useAnimation` is `false`, removes
     * pieces instantly.
     *
     * This is shorthand for `setPosition({})`.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`, show the new position instantly.
     */
    clear (useAnimation?: boolean) {
        this.setPosition({}, useAnimation)
    }

    /**
     * Executes one or more moves on the board.
     *
     * Moves are strings the form of "e2-e4", "f6-d5", etc., Pass `false` as an argument to disable animation.
     */
    move (...args: Array<string | false>) {
        let useAnimation = true
        // Collect the moves into an object.
        const moves: {[from: string]: string} = {}
        for (const arg of args) {
            // Any "false" to this function means no animations.
            if (arg === false) {
                useAnimation = false
                continue
            }
            // Skip invalid arguments.
            if (!isValidMove(arg)) {
                this.#error(2826, 'Invalid move passed to the move method.', arg)
                continue
            }
            const [from, to] = arg.split('-')
            moves[from] = to
        }
        // Calculate position from moves.
        const newPos = calculatePositionFromMoves(this.#currentPosition, moves)
        // Update the board.
        this.setPosition(newPos, useAnimation)
        // Return the new position object.
        return newPos
    }
    /**
     * Flip the orientation.
     */
    flip () {
        this.orientation = this.orientation === 'white' ? 'black' : 'white'
    }
    /**
     * Recalculates board and square sizes based on the parent element and redraws the board accordingly.
     */
    resize () {
        this.requestUpdate()
    }

    // -------------------------------------------------------------------------
    // Lifecycle Callbacks
    // -------------------------------------------------------------------------

    firstUpdated () {
        // We need to re-render to read the size of the container.
        this.requestUpdate()
        if (window.ResizeObserver !== undefined) {
            new ResizeObserver(() => {
                this.resize()
            }).observe(this)
        }
    }

    connectedCallback () {
        super.connectedCallback()
        window.addEventListener('pointermove', this.#pointermoveWindow.bind(this))
        window.addEventListener('pointerup', this.#pointerupWindow.bind(this))
        window.addEventListener('touchmove', this.#pointermoveWindow.bind(this), {
            passive: false,
        })
        window.addEventListener('touchend', this.#pointerupWindow.bind(this), {
            passive: false,
        })
    }

    disconnectedCallback () {
        super.disconnectedCallback()
        window.removeEventListener('pointermove', this.#pointermoveWindow.bind(this))
        window.removeEventListener('pointerup', this.#pointerupWindow.bind(this))
        window.removeEventListener('touchmove', this.#pointermoveWindow.bind(this))
        window.removeEventListener('touchend', this.#pointerupWindow.bind(this))
    }
}
