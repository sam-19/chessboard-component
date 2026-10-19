/**
 * Copyright (c) 2019 Chris Oakman
 * Copyright (c) 2019 Justin Fagnani
 * Copyright (c) 2024 Sampsa Lohi
 * Released under the MIT license
 * https://github.com/sam-19/chessboard-component/blob/main/LICENSE.md
 */

import { LitElement, html, nothing, render, type AttributePart, noChange, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { directive, Directive, type DirectiveParameters } from 'lit/directive.js'
import { styleMap, type StyleInfo } from 'lit/directives/style-map.js'
import { ifDefined } from 'lit/directives/if-defined.js'

import {
    COLUMNS,
    blackPieces,
    calculatePositionFromMoves,
    deepCopy,
    findClosestPiece,
    getSquareColor,
    interpolateTemplate,
    isFunction,
    isString,
    isValidFen,
    normalizePosition,
    objToFen,
    parsePieceList,
    parseSquareList,
    isValidMove,
    isValidSquare,
    isValidPositionObject,
    whitePieces,
} from './utils/index.js'
import { styles, presetColors } from './utils/chessboard-styles.js'
import { renderPiece as renderWikipediaSVGPiece } from './utils/wikipedia-pieces-svg.js'
import type {
    Action,
    Animation,
    AnimationSpeed,
    BoardLocation,
    BoardPosition,
    BoardPositionObject,
    BoardSquare,
    ChessboardEventDetail,
    ChessboardEventMap,
    ChessPiece,
    DraggingDragState,
    DragState,
    HighlightStyle,
    OffBoardAction,
    SquareColor,
} from './types.js'
import { AngledArrow, PathArrow, SquareMarker, StraightArrow } from './utils/overlays.js'

declare global {
    interface HTMLElementTagNameMap {
        'chess-board': ChessBoard
    }
}

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
/** Extra time to wait for a transition to end before giving up on the `transitionend` event. */
const TRANSITION_GRACE = 50

/**
 * Split an overlay description (one item of a `;` separated list) into the leading square codes and the rest.
 * @param desc - Description, starting with square codes separated by whitespace, commas, colons or dashes.
 * @returns The square codes and the rest of the description (e.g. a color, which may itself contain commas).
 */
const parseOverlayDescription = (desc: string) => {
    const match = desc.trim().match(/^((?:[a-h][1-8](?:[\s,:-]+|$))*)(.*)$/s)!
    const squares = (match[1].match(/[a-h][1-8]/g) || []) as BoardSquare[]
    return { squares, rest: match[2].trim() }
}

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
            part.element.replaceChildren()
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
 *             * `oldFen`: FEN for the old position
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
 * @fires square-click - Fired when a square is clicked (or tapped), with or without a piece on it. A piece picked up
 *         and dropped back on its square also fires a `drop` event with `source` equal to `target`.
 *         The event's `detail` object has the following properties:
 *             * `square`: the square that was clicked
 *             * `piece`: the piece on that square (or `false` if there is no piece)
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
 * @cssprop [--highlight-color-active=yellow] - The highlight color of the square a piece is dragged over.
 * @cssprop [--highlight-color-available=yellowgreen] - The highlight color for squares that are available.
 * @cssprop [--highlight-color-check=rgb(225, 0, 0)] - The highlight color for a king in check.
 * @cssprop [--highlight-color-previous=steelblue] - The highlight color for the squares of the previous move.
 * @cssprop [--highlight-color-unavailable=gray] - The highlight color for squares that are unavailable.
 * @cssprop [--time-low-color=rgb(175, 0, 0)] - The color of a player's remaining time when it is low.
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
 * @csspart spare-piece - A square containing a spare piece.
 * @csspart spare-padding - An empty square surrounding the spare pieces to center them.
 * @csspart player-details - Container with player details.
 * @csspart dragged-piece - The currently dragged piece.
 * @csspart white - A white square.
 * @csspart black - A black square.
 * @csspart highlight-active - The square a piece is dragged over (and the square the piece was dragged from).
 * @csspart highlight-available - A square highlighted as `available`.
 * @csspart highlight-check - A square highlighted as `check`.
 * @csspart highlight-previous - A square highlighted as `previous`.
 * @csspart highlight-unavailable - A square highlighted as `unavailable`.
 * @csspart draggable - A square with a piece that can be dragged.
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
     * Fit the board (with possible spare pieces or player details) within the height of the parent element, as well
     * as the width of this element. The parent element must have its height set in its `style` attribute.
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
                const { squares, rest: color } = parseOverlayDescription(desc)
                if (squares.length < 2 || !color) {
                    continue
                }
                if (squares.length === 2) {
                    arrows.push(new AngledArrow(squares[0], squares[1], color))
                } else {
                    arrows.push(new PathArrow(squares, color))
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
                const { squares: colored, rest } = parseOverlayDescription(desc)
                // The color is optional and defaults to yellow.
                const color = !rest ? 'var(--preset-color-yellow)'
                            : rest.startsWith('@')
                              ? rest.substring(1) in presetColors
                                ? `var(--preset-color-${rest.substring(1)})`
                                : 'var(--preset-color-grey)'
                              : rest
                for (const square of colored) {
                    squares.push({ color: color, square: square })
                }
            }
            return squares
        },
        type: Array,
    })
    colorSquares: { color: string, square: BoardSquare }[] = []

    /**
     * If `true`, the displayed time of the player in turn counts down from the last value set to `blackSeconds` or
     * `whiteSeconds`. Only the display counts down; the properties keep the value that was set.
     * @default false
     */
    @property({
        attribute: 'countdown',
        type: Boolean,
    })
    countdown = false

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
     * Squares to highlight, mapped to their highlight style, e.g. `{ e2: 'previous', e4: 'previous', g8: 'check' }`.
     * Assign a new object to update the highlights.
     */
    @property({ attribute: false })
    highlights: Partial<Record<BoardSquare, HighlightStyle>> = {}

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
                const { squares, rest } = parseOverlayDescription(desc)
                // The rest is the marker type followed by the color.
                const [type, color] = [rest.charAt(0), rest.substring(1).trim()]
                const mType = type === 'o' ? 'circle' : type === 'x' ? 'cross' : null
                if (!mType || !color) {
                    continue
                }
                for (const square of squares) {
                    markers.push(new SquareMarker(square, mType, color))
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
                const { squares, rest: color } = parseOverlayDescription(desc)
                if (squares.length !== 2 || !color) {
                    continue
                }
                arrows.push(new StraightArrow(squares[0], squares[1], color))
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

    @query('[part~="board"]')
    private _boardElement?: HTMLElement

    /** Square highlights set during a drag operation. */
    #dragHighlights = new Map<BoardSquare, HighlightStyle>()

    #animations = new Map<BoardLocation, Animation>()
    /** Identifies the latest animation run, so that an interrupted run does not finish the next one. */
    #animationRun = 0

    /** Countdown state of the player in turn. */
    #clock: { color: SquareColor, seconds: number, startedAt: number } | null = null
    #clockTimeout: ReturnType<typeof setTimeout> | null = null

    #currentPosition: BoardPositionObject = {}

    #dragState?: DragState

    #resizeObserver: ResizeObserver | null = null
    /** Square size used in the latest render. */
    #renderedSquareSize = 0

    /**
     * Is the current drag state "dragging".
     */
    get #isDragging (): boolean {
        return this.#dragState?.state === 'dragging'
    }

    /**
     * Ratio of the rendered size of the element to its layout size, if the element is scaled with CSS transforms.
     */
    get #scale () {
        return this.offsetWidth ? this.getBoundingClientRect().width/this.offsetWidth || 1 : 1
    }

    /**
     * Get the edge length of a single square in pixels.
     */
    get #squareSize () {
        // Note: this isn't cached, but is called during user interactions, so we
        // have a bit of time to use under RAIL guidelines.
        const byWidth = this.offsetWidth / 8
        // The parent's height must be set explicitly, or it would follow the size of the board.
        const parentHeight = this.parentElement?.style.height ? this.parentElement.clientHeight : 0
        if (this.adjustByHeight && parentHeight) {
            const hasExtraRows = this.sparePieces || this.blackName || this.whiteName
            return Math.min(byWidth, parentHeight / (hasExtraRows ? 10 : 8))
        }
        return byWidth
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
        this.#renderedSquareSize = this.#squareSize
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
            <div part="${this.#concatParts('wrapper', this.#dragState ? 'dragging' : '')}">
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
        const playerTime = this.#remainingSeconds(color)
        const isLowTime = playerTime !== null && playerTime < LOW_TIME
        const isOutOfTime = playerTime !== null && playerTime <= 0
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
        // Round down to whole tenths, so that the displayed parts stay consistent with each other.
        const tenths = Math.floor(Math.max(playerTime ?? 0, 0)*10)
        const timeMinutes = Math.floor(tenths/600)
        const timeSeconds = (Math.floor(tenths/10)%60).toString().padStart(2, '0')
        const timeFraction = tenths%10
        const formattedTime = color === 'black' ? this.blackTime : this.whiteTime
        return html`
            <div part="${this.#concatParts(
                'player-details',
                `player-${color}`,
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
                    `timer-${color}`,
                    isOutOfTime ? 'timer-low' : '',
                )}"
                style="${styleMap(timerStyles)}"
            >
                ${playerTime === null ? formattedTime : html`
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
                `}
            </div>
        `
    }
    /**
     * Get the time remaining for the player of the given `color`, including a running countdown.
     * @param color - Color of the player.
     * @returns Remaining time in seconds, or null if `blackSeconds`/`whiteSeconds` is not set.
     */
    #remainingSeconds (color: SquareColor) {
        const seconds = color === 'black' ? this.blackSeconds : this.whiteSeconds
        if (seconds === null || seconds === undefined) {
            return null
        }
        if (this.#clock?.color === color) {
            return Math.max(this.#clock.seconds - (performance.now() - this.#clock.startedAt)/1000, 0)
        }
        return Math.max(seconds, 0)
    }
    /**
     * Start counting down the time of the player in turn from the current `blackSeconds`/`whiteSeconds` value, or stop
     * the countdown if it does not apply.
     */
    #restartCountdown () {
        const seconds = this.turn === 'black' ? this.blackSeconds
                      : this.turn === 'white' ? this.whiteSeconds
                      : null
        if (!this.countdown || !this.turn || !seconds || seconds <= 0) {
            this.#clock = null
            this.#stopClockTicks()
            return
        }
        this.#clock = { color: this.turn, seconds: seconds, startedAt: performance.now() }
        this.#scheduleClockTick()
    }
    /**
     * Schedule the next update of the countdown display at the moment the displayed time changes.
     */
    #scheduleClockTick () {
        this.#stopClockTicks()
        if (!this.#clock || !this.isConnected) {
            return
        }
        const remaining = this.#remainingSeconds(this.#clock.color) ?? 0
        if (remaining <= 0) {
            return
        }
        // Tenths of a second are displayed only when time is low.
        const step = remaining <= LOW_TIME ? 0.1 : 1
        // Time until the remaining time drops below the next displayed step (plus a small margin).
        const untilNext = (remaining % step || step)*1000 + 5
        this.#clockTimeout = setTimeout(() => {
            this.#clockTimeout = null
            this.requestUpdate()
            this.#scheduleClockTick()
        }, untilNext)
    }
    #stopClockTicks () {
        if (this.#clockTimeout !== null) {
            clearTimeout(this.#clockTimeout)
            this.#clockTimeout = null
        }
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
        const c = color === 'black' ? 'b' : 'w'
        const totalPieces = Object.values(this.position).filter(
            bp => bp?.startsWith(c)
        ).length
        // We need to know pawn and extra officer piece counts to determine the number of possible promotions.
        const pawnCount = Object.values(this.position).filter(bp => bp === `${c}P`).length
        const nExtra = {
            B: Math.max(Object.values(this.position).filter(bp => bp === `${c}B`).length - 2, 0),
            N: Math.max(Object.values(this.position).filter(bp => bp === `${c}N`).length - 2, 0),
            Q: Math.max(Object.values(this.position).filter(bp => bp === `${c}Q`).length - 1, 0),
            R: Math.max(Object.values(this.position).filter(bp => bp === `${c}R`).length - 2, 0),
        }
        const nExtraTotal = nExtra.B + nExtra.N + nExtra.Q + nExtra.R
        const availableSpares = this.availableSparePieces === null ? null : parsePieceList(this.availableSparePieces)
        // The empty <div>s below are placeholders to get the shelf to line up with the board's grid. Another option
        // would be to try to use the same grid, either with a single container, or subgrid/display:contents when those
        // are available.
        return html`
            <div part="spare-padding"></div>
            ${pieces.map(
                (p) => {
                    const availPieces = 16 - totalPieces
                    const pieceCount = Object.values(this.position).filter(bp => bp === p).length
                    /** Number of pawns missing from the board = possible promotions. */
                    const promoCount = 8 - pawnCount - nExtraTotal + (nExtra[p[1] as 'B' | 'N' | 'Q' | 'R'] || 0)
                    const availableForKind = p.endsWith('B') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('K') ? Math.min(1 - pieceCount, availPieces)
                                           : p.endsWith('N') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('P') ? Math.min(8 - pieceCount - nExtraTotal, availPieces)
                                           : p.endsWith('Q') ? Math.min((1 + promoCount) - pieceCount, availPieces)
                                           : p.endsWith('R') ? Math.min((2 + promoCount) - pieceCount, availPieces)
                                           : 0
                    const disabled = (availableForKind < 1 && !this.superfluousPieces) ||
                                     (availableSpares !== null && !availableSpares.has(p))
                    return html`
                        <div
                            id="spare-${p}"
                            part="${this.#concatParts(
                                'spare-piece',
                                disabled ? 'disabled' : '',
                            )}"
                            @pointerdown=${disabled ? null : this.#pointerdownSparePiece}
                        >
                            ${this.#renderPiece(p, {}, false, sparePieceId(p))}
                        </div>
                    `
                }
            )}
            <div part="spare-padding"></div>
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
            // Convert viewport distances into the element's own (possibly scaled) pixels.
            const scale = this.#scale

            if (dragState.state === 'dragging') {
                const {x, y} = dragState
                Object.assign(styles, {
                    top: `${(y - rect.top)/scale - this.#squareSize / 2}px`,
                    left: `${(x - rect.left)/scale - this.#squareSize / 2}px`,
                })
            } else if (dragState.state === 'snapback') {
                const { source } = dragState
                const square = this.#getSquareElement(source as BoardSquare)
                const squareRect = square.getBoundingClientRect()
                Object.assign(styles, {
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.snapbackSpeed)}ms`,
                    top: `${(squareRect.top - rect.top)/scale}px`,
                    left: `${(squareRect.left - rect.left)/scale}px`,
                })
            } else if (dragState.state === 'trash') {
                const {x, y} = dragState
                Object.assign(styles, {
                    transitionProperty: 'opacity',
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: '0',
                    top: `${(y - rect.top)/scale - this.#squareSize / 2}px`,
                    left: `${(x - rect.left)/scale - this.#squareSize / 2}px`,
                })
            } else if (dragState.state === 'snap') {
                const square = this.#getSquareElement(dragState.location as BoardSquare)
                const squareRect = square.getBoundingClientRect()
                Object.assign(styles, {
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.snapSpeed)}ms`,
                    top: `${(squareRect.top - rect.top)/scale}px`,
                    left: `${(squareRect.left - rect.left)/scale}px`,
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
        const availableSquares = this.availableBoardPieces === null ? null : parseSquareList(this.availableBoardPieces)
        for (let row=0; row<8; row++) {
            for (let col=0; col<8; col++) {
                const file = COLUMNS[isFlipped ? 7 - col : col]
                const rank = isFlipped ? row + 1 : 8 - row
                const square = `${file}${rank}` as BoardSquare
                const squareColor = getSquareColor(square)
                let piece = this.#currentPosition[square]
                const isDragSource = square === this.#dragState?.source
                const animation = this.#animations.get(square)
                const highlightStyle = this.#dragHighlights.get(square) ?? this.highlights?.[square]
                const squareHighlight =
                    isDragSource ? 'highlight-active'
                        : highlightStyle
                          ? `highlight-${highlightStyle}`
                          : ''
                const colorSquare = this.colorSquares?.filter(s => s.square === square)[0]
                const squareStyles = colorSquare
                        ? { boxShadow: `inset 0 0 ${ this.#squareSize }px 0 ${ colorSquare.color }` } : {}
                const draggable =
                    piece && (this.draggablePieces || this.sparePieces) &&
                    (availableSquares === null || availableSquares.has(square))
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
                        @click=${this.#clickSquare}
                        @pointerdown=${this.#pointerdownSquare}
                        @pointerenter=${this.#pointerenterSquare}
                        @pointerleave=${this.#pointerleaveSquare}
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
            // Scale the notation with the board.
            fontSize: `${Math.max(Math.round(this.#squareSize/5), 8)}px`,
        }
        // Add overlays.
        const arrows = []
        for (const arr of this.angledArrows || []) {
            arrows.push(arr.getSvg(isFlipped))
        }
        for (const arr of this.straightArrows || []) {
            arrows.push(arr.getSvg(isFlipped))
        }
        const markers = []
        for (const mrk of this.squareMarkers || []) {
            markers.push(mrk.getSvg(isFlipped))
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
     * Check if an added `piece` is animated from the spare pieces, instead of fading in.
     * @param piece - The added piece.
     */
    #isAddedFromSpares (piece: ChessPiece) {
        return this.sparePieces && this.draggablePieces && !!this.shadowRoot?.getElementById(sparePieceId(piece))
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
                    (animation.type === 'add-start' && this.#isAddedFromSpares(piece)))
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

                const scale = this.#scale
                return {
                    position: 'absolute',
                    left: `${(srcSquareRect.left - destSquareRect.left)/scale}px`,
                    top: `${(srcSquareRect.top - destSquareRect.top)/scale}px`,
                    width: `${this.#squareSize}px`,
                    height: `${this.#squareSize}px`,
                }
            }
            if (
                piece &&
                (animation.type === 'move' ||
                    (animation.type === 'add' && this.#isAddedFromSpares(piece)))
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
                // Transition a removed piece (preserved by the caller) to opacity 0.
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

    #clickSquare (e: MouseEvent) {
        const square = (e.currentTarget as HTMLElement).getAttribute('data-square')
        if (!isValidSquare(square)) {
            return
        }
        this.dispatchEvent(
            new CustomEvent<ChessboardEventDetail['square-click']>(
                'square-click',
                {
                    bubbles: true,
                    detail: {
                        square,
                        piece: this.#currentPosition[square] || false,
                        position: deepCopy(this.#currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
    }

    /**
     * Check if the pointer event can start a drag operation.
     * @param e - Pointer event.
     */
    #canStartDrag (e: PointerEvent) {
        // Only drag with the primary pointer and the main (left) mouse button, and one piece at a time.
        return e.isPrimary && e.button === 0 && this.#dragState === undefined
    }

    #pointerdownSquare (e: PointerEvent) {
        // Do nothing if we're not draggable. sparePieces implies draggable.
        if ((!this.draggablePieces && !this.sparePieces) || !this.#canStartDrag(e)) {
            return
        }
        // Do nothing if there is no piece on this square.
        const squareEl = e.currentTarget as HTMLElement
        const square = squareEl.getAttribute('data-square')
        if (!isValidSquare(square) || !this.#currentPosition[square]) {
            return
        }
        // Ignore squares that don't have a movable piece.
        if (this.availableBoardPieces !== null && !parseSquareList(this.availableBoardPieces).has(square)) {
            return
        }
        e.preventDefault()
        this.#startDraggingPiece(
            square,
            this.#currentPosition[square]!,
            e.clientX,
            e.clientY
        )
    }

    #pointerdownSparePiece (e: PointerEvent) {
        // Do nothing if sparePieces is not enabled.
        if (!this.sparePieces || !this.#canStartDrag(e)) {
            return
        }
        const sparePieceContainerEl = e.currentTarget as HTMLElement
        const pieceEl = sparePieceContainerEl.querySelector('[part~=piece]')
        const piece = pieceEl!.getAttribute('piece')! as ChessPiece
        e.preventDefault()
        this.#startDraggingPiece('spare', piece, e.clientX, e.clientY)
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
            Object.hasOwn(this.#currentPosition, square) &&
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
            Object.hasOwn(this.#currentPosition, square) &&
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

    // Window listeners are arrow functions, so that the same function can be removed later.

    #pointermoveWindow = (e: PointerEvent) => {
        // Do nothing if we are not dragging a piece.
        if (!this.#isDragging || !e.isPrimary) {
            return
        }
        e.preventDefault()
        this.#updateDraggedPiece(e.clientX, e.clientY)
    }

    #pointerupWindow = (e: PointerEvent) => {
        // Do nothing if we are not dragging a piece.
        if (!this.#isDragging || !e.isPrimary) {
            return
        }
        this.#removeWindowListeners()
        // A cancelled pointer (e.g. the browser took over a touch gesture) returns the piece.
        const location = e.type === 'pointercancel' ? 'offboard' : this.#isXYOnSquare(e.clientX, e.clientY)
        this.#stopDraggingPiece(location, e.type === 'pointercancel')
    }

    #addWindowListeners () {
        window.addEventListener('pointermove', this.#pointermoveWindow, { passive: false })
        window.addEventListener('pointerup', this.#pointerupWindow)
        window.addEventListener('pointercancel', this.#pointerupWindow)
    }

    #removeWindowListeners () {
        window.removeEventListener('pointermove', this.#pointermoveWindow)
        window.removeEventListener('pointerup', this.#pointerupWindow)
        window.removeEventListener('pointercancel', this.#pointerupWindow)
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
            if (!Object.hasOwn(pos2, i)) {
                continue
            }
            if (Object.hasOwn(pos1, i) && pos1[i] === pos2[i]) {
                delete pos1[i]
                delete pos2[i]
            }
        }
        // Find all the "move" animations.
        for (const i in pos2) {
            if (!Object.hasOwn(pos2, i)) {
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
            if (!Object.hasOwn(pos2, i)) {
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
            if (!Object.hasOwn(pos1, i)) {
                continue
            }
            // Do not clear a piece if it is on a square that is the result of a "move", ie: a piece capture.
            if (Object.hasOwn(squaresMovedTo, i)) {
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
        // A new run interrupts any animations still in progress.
        const run = ++this.#animationRun
        if (!animations.length) {
            this.#animations.clear()
            return
        }
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
        await this.#nextFrame()
        if (run !== this.#animationRun) {
            return
        }
        // Render again with the piece at opacity 1 with a transition.
        this.#animations.clear()
        let duration = 0
        for (const animation of animations) {
            if (animation.type === 'move' || animation.type === 'move-start') {
                this.#animations.set(animation.destination, animation)
                duration = Math.max(duration, speedToMS(this.moveSpeed))
            } else {
                this.#animations.set(animation.square, animation)
                duration = Math.max(
                    duration,
                    speedToMS(animation.type === 'clear' ? this.trashSpeed : this.appearSpeed),
                    // Pieces added from spare pieces move to their square.
                    animation.type === 'add' && this.#isAddedFromSpares(animation.piece) ? speedToMS(this.moveSpeed) : 0,
                )
            }
        }
        this.requestUpdate()
        // Transition events are not reliable (they don't fire if nothing changes or the element is removed), so wait
        // for the known duration of the transitions instead.
        await new Promise((resolve) => setTimeout(resolve, duration + TRANSITION_GRACE))
        if (run !== this.#animationRun) {
            return
        }
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
    /**
     * Wait for the element to update and the browser to apply the new styles, so that the styles set after this can
     * start a transition.
     */
    async #nextFrame () {
        await this.updateComplete
        // Reading layout forces the browser to compute the current styles.
        void this._boardElement?.offsetWidth
    }
    /**
     * Wait for the transition of the dragged piece to end.
     * @param speed - Speed of the transition, used to stop waiting if the transition never starts.
     */
    #draggedPieceTransition (speed: AnimationSpeed) {
        return new Promise<void>((resolve) => {
            const el = this._draggedPieceElement
            const done = () => {
                clearTimeout(timeout)
                el?.removeEventListener('transitionend', onEnd)
                resolve()
            }
            const onEnd = (e: Event) => {
                if (e.target === el) {
                    done()
                }
            }
            const timeout = setTimeout(done, speedToMS(speed) + TRANSITION_GRACE)
            el?.addEventListener('transitionend', onEnd)
        })
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
        await this.#nextFrame()
        // Wait until the piece has reached its position on the square.
        await this.#draggedPieceTransition(this.snapSpeed)
        this.#finishDrag()
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
            this.#dragHighlights.set(square, value)
        } else {
            this.#dragHighlights.delete(square)
        }
        this.requestUpdate()
    }
    /**
     * Check which square (or off the board) the given window x,y position is.
     * @param x - Pointer x-position.
     * @param y - Pointer y-position.
     * @returns Square name 'offboard'.
     */
    #isXYOnSquare (x: number, y: number): BoardLocation | 'offboard' {
        const rect = this._boardElement?.getBoundingClientRect()
        if (!rect || !rect.width || !rect.height) {
            return 'offboard'
        }
        // Squares fill the board inside its border. Convert layout pixels into viewport pixels, in case the board
        // is scaled with CSS transforms.
        const board = this._boardElement!
        const scale = rect.width/board.offsetWidth
        const size = board.clientWidth*scale/8
        const col = Math.floor((x - rect.left - board.clientLeft*scale)/size)
        const row = Math.floor((y - rect.top - board.clientTop*scale)/size)
        if (col < 0 || col > 7 || row < 0 || row > 7) {
            return 'offboard'
        }
        const isFlipped = this.orientation === 'black'
        return `${COLUMNS[isFlipped ? 7 - col : col]}${isFlipped ? row + 1 : 8 - row}` as BoardSquare
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
        this.#currentPosition = newPos
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
        await this.#nextFrame()
        // Wait until the snapback is complete.
        await this.#draggedPieceTransition(this.snapbackSpeed)
        this.#finishDrag()
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
        this.#addWindowListeners()
        this.requestUpdate()
    }
    /**
     * Stop the piece drag operation.
     * @param location - Board position where the operation stopped.
     * @param cancelled - Was the operation cancelled; the piece is returned without a `drop` event.
     */
    async #stopDraggingPiece (location: BoardLocation, cancelled = false) {
        isDragging(this.#dragState)
        const { source, piece } = this.#dragState
        if (cancelled) {
            this.#dragHighlights.clear()
            await this.#snapbackDraggedPiece()
            return
        }
        // Determine what the action should be.
        let action: Action = 'drop'
        if (location === 'offboard') {
            action = this.dropOffBoard === 'trash' ? 'trash' : 'snapback'
        }
        const newPosition = deepCopy(this.#currentPosition)
        const oldPosition = deepCopy(this.#currentPosition)
        // See if a spare piece was placed on the board.
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
        this.#dragHighlights.clear()
        // Check if action was changed and perform it.
        if (action === 'snapback') {
            await this.#snapbackDraggedPiece()
        } else if (action === 'trash') {
            await this.#trashDraggedPiece()
        } else if (action === 'drop') {
            await this.#dropDraggedPieceOnSquare(location)
        }
    }
    /**
     * Clear the drag state after the final animation of a drag operation, before firing the final event, so that a new
     * drag can be started from the event listener.
     */
    #finishDrag () {
        this.#dragState = undefined
        // Render the final post-dragging board state.
        this.requestUpdate()
    }
    /**
     * Stop any drag operation immediately, without animations or events.
     */
    #cancelDrag () {
        this.#removeWindowListeners()
        if (this.#dragState !== undefined) {
            this.#dragState = undefined
            this.#dragHighlights.clear()
            this.requestUpdate()
        }
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
        await this.#nextFrame()
        // Wait until the piece has been trashed.
        await this.#draggedPieceTransition(this.trashSpeed)
        this.#finishDrag()
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
        // Validate the position before normalizing, which would turn invalid positions into an empty board.
        const isValid = isString(position)
                      ? position.toLowerCase() === 'start' || isValidFen(position)
                      : isValidPositionObject(position)
        if (!isValid) {
            throw this.#error(
                6482,
                'Invalid value passed to the position method.',
                position
            )
        }
        position = normalizePosition(position)
        // Start the animations, or stop any animations still running from a previous change.
        const animations = useAnimation ? this.#calculateAnimations(this.#currentPosition, position) : []
        this.#doAnimations(animations, this.#currentPosition, position)
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

    // Typed listeners for the board's own events.
    addEventListener<K extends keyof ChessboardEventMap>(
        type: K,
        listener: (this: ChessBoard, ev: ChessboardEventMap[K]) => unknown,
        options?: boolean | AddEventListenerOptions
    ): void
    addEventListener<K extends keyof HTMLElementEventMap>(
        type: K,
        listener: (this: ChessBoard, ev: HTMLElementEventMap[K]) => unknown,
        options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void
    addEventListener (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ) {
        super.addEventListener(type, listener, options)
    }
    removeEventListener<K extends keyof ChessboardEventMap>(
        type: K,
        listener: (this: ChessBoard, ev: ChessboardEventMap[K]) => unknown,
        options?: boolean | EventListenerOptions
    ): void
    removeEventListener<K extends keyof HTMLElementEventMap>(
        type: K,
        listener: (this: ChessBoard, ev: HTMLElementEventMap[K]) => unknown,
        options?: boolean | EventListenerOptions
    ): void
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void
    removeEventListener (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ) {
        super.removeEventListener(type, listener, options)
    }

    // -------------------------------------------------------------------------
    // Lifecycle Callbacks
    // -------------------------------------------------------------------------

    updated (changed: PropertyValues<this>) {
        if (
            changed.has('countdown') || changed.has('turn') ||
            changed.has('blackSeconds') || changed.has('whiteSeconds')
        ) {
            this.#restartCountdown()
        }
    }

    connectedCallback () {
        super.connectedCallback()
        // The observer also reports the initial size, so the board is rendered again once its size is known.
        this.#resizeObserver = new ResizeObserver(() => {
            // Rendering in the observer callback would resize the observed elements again within the same frame,
            // which browsers report as an error. Render on the next frame instead, if the board size changed.
            requestAnimationFrame(() => {
                if (this.#squareSize !== this.#renderedSquareSize) {
                    this.resize()
                }
            })
        })
        this.#resizeObserver.observe(this)
        if (this.parentElement) {
            // Needed for `adjustByHeight`.
            this.#resizeObserver.observe(this.parentElement)
        }
        // Resume a countdown that was running when the element was disconnected.
        this.#scheduleClockTick()
    }

    disconnectedCallback () {
        super.disconnectedCallback()
        this.#resizeObserver?.disconnect()
        this.#resizeObserver = null
        this.#stopClockTicks()
        this.#cancelDrag()
    }
}
