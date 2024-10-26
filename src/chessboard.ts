/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
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
    normalizePozition,
    objToFen,
    styles,
    renderPiece as renderWikipediaSVGPiece,
    validMove,
    validSquare,
    validPositionObject,
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
    type ChessboardEvent,
    type ChessPiece,
    type DraggingDragState,
    type DragState,
    type OffBoardAction,
    type SquareColor,
} from '#types'
import { AngledArrow, MarkerType, PathArrow, SquareMarker } from './utils/overlays'
import { presetColors } from './utils/chessboard-styles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// default animation speeds
const DEFAULT_APPEAR_SPEED = 200
const DEFAULT_MOVE_SPEED = 200
const DEFAULT_SNAPBACK_SPEED = 60
const DEFAULT_SNAP_SPEED = 30
const DEFAULT_TRASH_SPEED = 100

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

function assertIsDragging(
    dragState: DragState | undefined
): asserts dragState is DraggingDragState {
    if (dragState?.state !== 'dragging') {
        throw new Error(`unexpected drag state ${JSON.stringify(dragState)}`)
    }
}

const speedToMS = (speed: AnimationSpeed) => {
    if (typeof speed === 'number') {
        return speed
    }
    if (speed === 'fast') {
        return 200
    }
    if (speed === 'slow') {
        return 600
    }
    return parseInt(speed, 10)
}

const squareId = (square: BoardLocation) => `square-${square}`
const sparePieceId = (piece: ChessPiece) => `spare-piece-${piece}`
// const wikipediaPiece = (p: ChessPiece) =>
//     new URL(`../chesspieces/wikipedia/${p}.png`, import.meta.url).href

export type RenderPieceFunction = (
    piece: ChessPiece,
    container: HTMLElement
) => void

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
const renderPieceDirective = directive(RenderPieceDirective)

/**
 * A custom element that renders an interactive chess board.
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
 * @fires drag-start - Fired when a piece is picked up
 *         The event's `detail` object has the following properties:
 *             * `source`: the source of the piece
 *             * `piece`: the piece
 *             * `position`: the current position on the board
 *             * `orientation`: the current orientation.
 *
 *         The drag action is prevented if the listener calls `event.preventDefault()`.
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
 * @fires move-end - Fired when a piece move completes
 *        The event's `detail` object has the following properties:
 *            * `oldPosition`: the old position
 *            * `newPosition`: the new position
 *
 * @fires change - Fired when the board position changes
 *         The event's `detail` property has two properties:
 *             * `value`: the new position
 *             * `oldValue`: the old position
 *
 *         **Warning**: do *not* call any position-changing methods in your event
 *         listener or you may cause an infinite loop. BoardPosition-changing methods
 *         are: `clear()`, `move()`, `position()`, and `start()`.
 *
 * @fires error - Fired in the case of invalid attributes.
 *
 * @cssprop [--light-color=#f0d9b5] - The background for white squares and text color for black squares.
 * @cssprop [--dark-color=#b58863] - The background for black squares and text color for white squares.
 * @cssprop [--highlight-color=yellow] - The highlight color.
 * @cssprop [--highlight-color-available=yellowgreen] - The highlight color for squares that are available.
 * @cssprop [--highlight-color-unavailable=gray] - The highlight color for squares that are unavailable.
 *
 * @csspart board - The chess board.
 * @csspart square - A square on the board.
 * @csspart piece - A chess piece.
 * @csspart spare-pieces - The spare piece container.
 * @csspart dragged-piece - The currently dragged piece.
 * @csspart white - A white square.
 * @csspart black - A black square.
 * @csspart highlight - A highlighted square.
 * @csspart available - An available square.
 * @csspart unavailable - An unavailable square.
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
        return objToFen(this._currentPosition)
    }

    /**
     * The current position of the board, as a `PositionObject`. This property may
     * be set externally, but only to valid `PositionObject`s. The value is copied
     * before being applied to the board. Changes to the position object are not
     * reflected in th rendering.
     *
     * To set the position using FEN, or a keyword like `'start'`, or to use
     * animations, use the `setPosition` method.
     */
    @property({
        converter: (value: string | null) => normalizePozition(value),
    })
    get position(): BoardPositionObject {
        return this._currentPosition
    }

    set position(v: BoardPositionObject) {
        const oldValue = this._currentPosition
        this._setCurrentPosition(v)
        this.requestUpdate('position', oldValue)
    }

    /**
     * Whether to show the board notation.
     */
    @property({
        attribute: 'hide-notation',
        type: Boolean,
    })
    hideNotation = false

    /**
     * Whether to show the board notation. This is always the inverse of
     * `hideNotation`, which reflects the `hide-notation` attribute.
     *
     * @default true
     */
    get showNotation() {
        return !this.hideNotation
    }

    set showNotation(v: boolean) {
        this.hideNotation = !v
    }

    /**
     * Adjust the board size based on available height.
     */
    @property({
        attribute: 'adjust-by-height',
        type: Boolean,
    })
    adjustByHeight = false

    /**
     * A list on angled arrows to draw on the board.
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
    angledArrows: StraightArrow[] | null = null

    /**
     * Square codes with associated colors masks to add to them.
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
                } else if (!validSquare(params[1])) {
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
    colorSquares: { color: string, square: BoardSquare }[] | null = null

    /**
     * If `true`, pieces on the board are draggable to other squares.
     */
    @property({
        attribute: 'draggable-pieces',
        type: Boolean,
    })
    draggablePieces = false

    /**
     * If `'snapback'`, pieces dropped off the board will return to their original
     * square. If `'trash'`, pieces dropped off the board will be removed from the
     * board.
     *
     * This property has no effect when `draggable` is `false`.
     */
    @property({ attribute: 'drop-off-board' })
    dropOffBoard: OffBoardAction = 'snapback'

    /**
     * List of board squares that contain a piece than can be moved. List can be continuous or delimited.
     * Only pieces on this list can be interacted with and they will have the 'grab' cursor icon when hovered.
     * Null means any piece on the board can be moved.
     */
    @property({ attribute: 'movable-pieces', type: String })
    movablePieces: string | null = null

    /**
     * The orientation of the board. `'white'` for the white player at the bottom,
     * `'black'` for the black player at the bottom.
     */
    @property()
    orientation: SquareColor = 'white'

    /**
     * A template string or function used to determine the source of piece images,
     * used by the default `renderPiece` function, which renders an `<img>`
     * element.
     *
     * If `pieceTheme` is a string, the pattern {piece} will be replaced by the
     * piece code. The result should be an an `<img>` source.
     *
     * If `pieceTheme` is a function the first argument is the piece code. The
     * function should return an `<img>` source.
     */
    @property({ attribute: 'piece-theme' })
    pieceTheme?: string | ((piece: ChessPiece) => string)

    /**
     * A function that renders DOM for a piece to a container element. This
     * function can render any elements and text, including SVG.
     *
     * The default value renders an SVG image of the piece, unless the
     * `pieceTheme` property is set, then it uses `pieceTheme` to get the URL for
     * an `<img>` element.
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
     * Animation speed for when pieces move between squares or from spare pieces
     * to the board.
     */
    @property({
        attribute: 'move-speed',
    })
    moveSpeed: AnimationSpeed = DEFAULT_MOVE_SPEED

    /**
     * Animation speed for when pieces that were dropped outside the board return
     * to their original square.
     */
    @property({
        attribute: 'snapback-speed',
    })
    snapbackSpeed: AnimationSpeed = DEFAULT_SNAPBACK_SPEED

    /**
     * Animation speed for when pieces \"snap\" to a square when dropped.
     */
    @property({
        attribute: 'snap-speed',
    })
    snapSpeed: AnimationSpeed = DEFAULT_SNAP_SPEED

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
    straightArrows: StraightArrow[] | null = null

    /**
     * Animation speed for when pieces are removed.
     */
    @property({
        attribute: 'trash-speed',
    })
    trashSpeed: AnimationSpeed = DEFAULT_TRASH_SPEED

    /**
     * Animation speed for when pieces appear on a square.
     *
     * Note that the "appear" animation only occurs when `sparePieces` is `false`.
     */
    @property({
        attribute: 'appear-speed',
    })
    appearSpeed: AnimationSpeed = DEFAULT_APPEAR_SPEED

    /**
     * If `true`, the board will have spare pieces that can be dropped onto the
     * board. If `sparePieces` is set to `true`, `draggablePieces` gets set to
     * `true` as well.
     */
    @property({
        attribute: 'spare-pieces',
        type: Boolean,
    })
    sparePieces = false

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
    squareMarkers: SquareMarker[] | null = null

    @query('[part~="dragged-piece"]')
    private _draggedPieceElement!: HTMLElement

    private _highlightSquares = new Set()

    private _animations = new Map<BoardLocation, Animation>()

    private _currentPosition: BoardPositionObject = {}

    private _dragState?: DragState

    private get _squareSize () {
        // Note: this isn't cached, but is called during user interactions, so we
        // have a bit of time to use under RAIL guidelines.
        if (this.adjustByHeight && this.parentElement?.style.height) {
            return this.parentElement.offsetHeight / (this.sparePieces ? 10 : 8)
        } else {
            return this.offsetWidth / 8
        }
    }

    private _getSquareElement (square: BoardLocation): HTMLElement {
        return this.shadowRoot!.getElementById(squareId(square))!
    }

    private _getSparePieceElement (piece: ChessPiece): HTMLElement {
        return this.shadowRoot!.getElementById(sparePieceId(piece))!
    }

    // -------------------------------------------------------------------------
    // DOM Building
    // -------------------------------------------------------------------------

    render () {
        const styles = {
            height: `${this.sparePieces ? this._squareSize : 0}px`,
            width: `${this.sparePieces ? 8*this._squareSize : 0}px`,
        }
        return html`
            <div part="wrapper">
                <div part="spare-pieces" style="${styleMap(styles)}">
                    ${this._renderSparePieces(
                        this.orientation === 'white' ? 'black' : 'white'
                    )}
                </div>
                ${this._renderBoard()}
                <div part="spare-pieces" style="${styleMap(styles)}">
                    ${this._renderSparePieces(
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
                    ${this._renderDraggedPiece()}
                </div>
            </div>
        `
    }

    private _renderSparePieces (color: SquareColor) {
        if (!this.sparePieces) {
            return nothing
        }
        const pieces = color === 'black' ? blackPieces : whitePieces
        // The empty <div>s below are placeholders to get the shelf to line up with
        // the board's grid. Another option would be to try to use the same grid,
        // either with a single container, or subgrid/display:contents when those
        // are available.
        return html`
            <div></div>
            ${pieces.map(
                (p) =>
                    html`
                        <div
                            id="spare-${p}"
                            part="spare-piece"
                            @mousedown=${this._mousedownSparePiece}
                            @touchstart=${this._mousedownSparePiece}
                        >
                            ${this._renderPiece(p, {}, false, sparePieceId(p))}
                        </div>
                    `
            )}
            <div></div>
        `
    }

    private _renderDraggedPiece () {
        const styles: Partial<CSSStyleDeclaration> = {
            height: `${this._squareSize}px`,
            width: `${this._squareSize}px`,
        }
        const dragState = this._dragState
        if (dragState !== undefined) {
            styles.display = 'block'
            const rect = this.getBoundingClientRect()

            if (dragState.state === 'dragging') {
                const {x, y} = dragState
                Object.assign(styles, {
                    top: `${y - rect.top - this._squareSize / 2}px`,
                    left: `${x - rect.left - this._squareSize / 2}px`,
                })
            } else if (dragState.state === 'snapback') {
                const { source } = dragState
                const square = this._getSquareElement(source)
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
                    top: `${y - rect.top - this._squareSize / 2}px`,
                    left: `${x - rect.left - this._squareSize / 2}px`,
                })
            } else if (dragState.state === 'snap') {
                const square = this._getSquareElement(dragState.location)
                const squareRect = square.getBoundingClientRect()
                Object.assign(styles, {
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.snapSpeed)}ms`,
                    top: `${squareRect.top - rect.top}px`,
                    left: `${squareRect.left - rect.left}px`,
                })
            }
        }

        return this._renderPiece(
            this._dragState?.piece ?? '',
            styles,
            false,
            undefined,
            'dragged-piece'
        )
    }

    private _renderBoard () {
        const squares = []
        const isFlipped = this.orientation === 'black'
        const buildParts = (...parts: string[]) => {
            const nonEmpty = parts.filter(c => c.length > 0)
            return nonEmpty.join(' ')
        }
        for (let row=0; row<8; row++) {
            for (let col=0; col<8; col++) {
                const file = COLUMNS[isFlipped ? 7 - col : col]
                const rank = isFlipped ? row + 1 : 8 - row
                const square = `${file}${rank}` as BoardSquare
                const squareColor = getSquareColor(square)
                let piece = this._currentPosition[square]
                const isDragSource = square === this._dragState?.source
                const animation = this._animations.get(square)
                const squareHighlight =
                    isDragSource || this._highlightSquares.has(square)
                        ? 'highlight' : ''
                const colorSquare = this.colorSquares?.filter(s => s.square === square)[0]
                const squareStyles = colorSquare
                        ? { boxShadow: `inset 0 0 ${ this._squareSize }px 0 ${ colorSquare.color }` } : {}
                const draggable =
                    piece && (this.movablePieces === null || this.movablePieces?.toLowerCase().includes(square))
                        ? 'draggable' : ''
                const pieceStyles = this._getAnimationStyles(piece, animation)
                if (!piece && animation?.type === 'clear') {
                    // Preserve the piece until the animation is complete
                    piece = animation.piece
                }

                squares.push(html`
                    <div
                        id=${squareId(square)}
                        data-square=${square}
                        part="${buildParts(
                            'square',
                            square,
                            squareColor,
                            squareHighlight,
                            draggable
                        )}"
                        style="${styleMap(squareStyles)}"
                        @mousedown=${this._mousedownSquare}
                        @mouseenter=${this._mouseenterSquare}
                        @mouseleave=${this._mouseleaveSquare}
                        @touchstart=${this._mousedownSquare}
                    >
                        ${this.showNotation && row === 7
                            ? html`<div part="notation alpha">${file}</div>`
                            : nothing}
                        ${this.showNotation && col === 0
                            ? html`<div part="notation numeric">${rank}</div>`
                            : nothing}
                        ${this._renderPiece(piece, pieceStyles, isDragSource)}
                    </div>
                `)
            }
        }
        // Main board dimensions.
        const styles = {
            width: this._squareSize * 8 + 'px',
            height: this._squareSize * 8 + 'px',
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

    _renderPiece (
        piece: ChessPiece | undefined,
        styles: Partial<CSSStyleDeclaration>,
        isDragSource?: boolean,
        id?: string,
        part?: string
    ) {
        if (piece === undefined) {
            return nothing
        }

        const style: Partial<CSSStyleDeclaration> = {
            opacity: '1',
            transitionProperty: '',
            transitionDuration: '0ms',
            ...styles,
        }

        if (isDragSource || piece === '') {
            style.display = 'none'
        }

        if (piece === '') {
            return nothing
        }

        if (!isFunction(this.renderPiece)) {
            this._error(8272, 'invalid renderPiece.')
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

    private _getAnimationStyles (
        piece: ChessPiece | undefined,
        animation?: Animation | undefined
    ): Partial<CSSStyleDeclaration> {
        if (animation) {
            if (
                piece &&
                (animation.type === 'move-start' ||
                    (animation.type === 'add-start' && this.draggablePieces))
            ) {
                // BoardPosition the moved piece absolutely at the source
                const srcSquare =
                    animation.type === 'move-start'
                        ? this._getSquareElement(animation.source)
                        : this._getSparePieceElement(piece)
                const destSquare =
                    animation.type === 'move-start'
                        ? this._getSquareElement(animation.destination)
                        : this._getSquareElement(animation.square)

                const srcSquareRect = srcSquare.getBoundingClientRect()
                const destSquareRect = destSquare.getBoundingClientRect()

                return {
                    position: 'absolute',
                    left: `${srcSquareRect.left - destSquareRect.left}px`,
                    top: `${srcSquareRect.top - destSquareRect.top}px`,
                    width: `${this._squareSize}px`,
                    height: `${this._squareSize}px`,
                }
            }
            if (
                piece &&
                (animation.type === 'move' ||
                    (animation.type === 'add' && this.draggablePieces))
            ) {
                // Transition the moved piece to the destination
                return {
                    position: 'absolute',
                    transitionProperty: 'top, left',
                    transitionDuration: `${speedToMS(this.moveSpeed)}ms`,
                    top: `0`,
                    left: `0`,
                    width: `${this._squareSize}px`,
                    height: `${this._squareSize}px`,
                }
            }
            if (!piece && animation.type === 'clear') {
                // Preserve and transition a removed piece to opacity 0
                piece = animation.piece
                return {
                    transitionProperty: 'opacity',
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: '0',
                }
            }
            if (piece && animation.type === 'add-start') {
                // Initialize an added piece to opacity 0
                return {
                    opacity: '0',
                }
            }
            if (piece && animation.type === 'add') {
                // Transition an added piece to opacity 1
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

    private _mousedownSquare (e: MouseEvent | TouchEvent) {
        // do nothing if we're not draggable. sparePieces implies draggable
        if (!this.draggablePieces && !this.sparePieces) {
            return
        }

        // do nothing if there is no piece on this square
        const squareEl = e.currentTarget as HTMLElement
        const square = squareEl.getAttribute('data-square') as BoardSquare
        if (square === null || !this._currentPosition.hasOwnProperty(square)) {
            return
        }
        // Ignore squares that don't have a movable piece.
        if (this.movablePieces !== null && !this.movablePieces.includes(square)) {
            return
        }
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this._beginDraggingPiece(
            square,
            this._currentPosition[square]!,
            pos.clientX,
            pos.clientY
        )
    }

    private _mousedownSparePiece (e: MouseEvent | TouchEvent) {
        // do nothing if sparePieces is not enabled
        if (!this.sparePieces) {
            return
        }
        const sparePieceContainerEl = e.currentTarget as HTMLElement
        const pieceEl = sparePieceContainerEl.querySelector('[part~=piece]')
        const piece = pieceEl!.getAttribute('piece')! as ChessPiece
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this._beginDraggingPiece('spare', piece, pos.clientX, pos.clientY)
    }

    private _mouseenterSquare (e: Event) {
        // do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this._dragState !== undefined) {
            return
        }

        // get the square
        const square = (e.currentTarget as HTMLElement).getAttribute('data-square') as BoardSquare

        // NOTE: this should never happen; defensive
        if (!validSquare(square)) {
            return
        }

        // Get the piece on this square
        const piece =
            this._currentPosition.hasOwnProperty(square) &&
            this._currentPosition[square]!

        this.dispatchEvent(
            new CustomEvent<ChessboardEvent['mouseover-square']>(
                'mouseover-square',
                {
                    bubbles: true,
                    detail: {
                        square,
                        piece,
                        position: deepCopy(this._currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
    }

    private _mouseleaveSquare (e: Event) {
        // Do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this._dragState !== undefined) {
            return
        }

        const square = (e.currentTarget as HTMLElement).getAttribute('data-square') as BoardSquare

        // NOTE: this should never happen; defensive
        if (!validSquare(square)) {
            return
        }

        // Get the piece on this square
        const piece =
            this._currentPosition.hasOwnProperty(square) &&
            this._currentPosition[square]!

        // execute their function
        this.dispatchEvent(
            new CustomEvent<ChessboardEvent['mouseout-square']>(
                'mouseout-square',
                {
                    bubbles: true,
                    detail: {
                        square,
                        piece,
                        position: deepCopy(this._currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )
    }

    private _mousemoveWindow (e: MouseEvent | TouchEvent) {
        // Do nothing if we are not dragging a piece
        if (!(this._dragState?.state === 'dragging')) {
            return
        }
        // Prevent screen from scrolling
        e.preventDefault()
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        this._updateDraggedPiece(pos.clientX, pos.clientY)
    }

    private _mouseupWindow (e: MouseEvent | TouchEvent) {
        // Do nothing if we are not dragging a piece
        if (!(this._dragState?.state === 'dragging')) {
            return
        }
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0]
        const location = this._isXYOnSquare(pos.clientX, pos.clientY)
        this._stopDraggedPiece(location)
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Sets the position of the board.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *     show the new position instantly.
     */
    setPosition (position: BoardPosition, useAnimation = true) {
        position = normalizePozition(position)

        // validate position object
        if (!validPositionObject(position)) {
            throw this._error(
                6482,
                'Invalid value passed to the position method.',
                position
            )
        }

        if (useAnimation) {
            // start the animations
            const animations = this._calculateAnimations(
                this._currentPosition,
                position
            )
            this._doAnimations(animations, this._currentPosition, position)
        }
        this._setCurrentPosition(position)
        this.requestUpdate()
    }

    /**
     * Sets the board to the start position.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *     show the new position instantly.
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
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *     show the new position instantly.
     */
    clear (useAnimation?: boolean) {
        this.setPosition({}, useAnimation)
    }

    /**
     * Executes one or more moves on the board.
     *
     * Moves are strings the form of "e2-e4", "f6-d5", etc., Pass `false` as an
     * argument to disable animation.
     */
    move (...args: Array<string | false>) {
        let useAnimation = true

        // collect the moves into an object
        const moves: {[from: string]: string} = {}
        for (const arg of args) {
            // any "false" to this function means no animations
            if (arg === false) {
                useAnimation = false
                continue
            }

            // skip invalid arguments
            if (!validMove(arg)) {
                this._error(2826, 'Invalid move passed to the move method.', arg)
                continue
            }

            const [from, to] = arg.split('-')
            moves[from] = to
        }

        // calculate position from moves
        const newPos = calculatePositionFromMoves(this._currentPosition, moves)

        // update the board
        this.setPosition(newPos, useAnimation)

        // return the new position object
        return newPos
    }

    /**
     * Flip the orientation.
     */
    flip () {
        this.orientation = this.orientation === 'white' ? 'black' : 'white'
    }

    /**
     * Recalculates board and square sizes based on the parent element and redraws
     * the board accordingly.
     */
    resize () {
        this.requestUpdate()
    }

    // -------------------------------------------------------------------------
    // Lifecycle Callbacks
    // -------------------------------------------------------------------------

    firstUpdated () {
        // We need to re-render to read the size of the container
        this.requestUpdate()
        if (window.ResizeObserver !== undefined) {
            new ResizeObserver(() => {
                this.resize()
            }).observe(this)
        }
    }

    connectedCallback () {
        super.connectedCallback()
        window.addEventListener('mousemove', this._mousemoveWindow.bind(this))
        window.addEventListener('mouseup', this._mouseupWindow.bind(this))
        window.addEventListener('touchmove', this._mousemoveWindow.bind(this), {
            passive: false,
        })
        window.addEventListener('touchend', this._mouseupWindow.bind(this), {
            passive: false,
        })
    }

    disconnectedCallback () {
        super.disconnectedCallback()
        window.removeEventListener('mousemove', this._mousemoveWindow.bind(this))
        window.removeEventListener('mouseup', this._mouseupWindow.bind(this))
        window.removeEventListener('touchmove', this._mousemoveWindow.bind(this))
        window.removeEventListener('touchend', this._mouseupWindow.bind(this))
    }

    // -------------------------------------------------------------------------
    // Control Flow
    // -------------------------------------------------------------------------

    private _setCurrentPosition (position: BoardPositionObject) {
        const oldPos = deepCopy(this._currentPosition)
        const newPos = deepCopy(position)
        const oldFen = objToFen(oldPos)
        const newFen = objToFen(newPos)

        // do nothing if no change in position
        if (oldFen === newFen) return

        // Fire change event
        this.dispatchEvent(
            new CustomEvent<ChessboardEvent['change']>(
                'change', 
                {
                    bubbles: true,
                    detail: {
                        oldPosition: oldPos,
                        newPosition: newPos,
                    },
                }
            )
        )

        // update state
        this._currentPosition = position
    }

    private _isXYOnSquare (x: number, y: number): BoardLocation | 'offboard' {
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

    private _highlightSquare (square: BoardLocation, value = true) {
        if (value) {
            this._highlightSquares.add(square)
        } else {
            this._highlightSquares.delete(square)
        }
        this.requestUpdate('_highlightSquares')
    }

    private async _snapbackDraggedPiece () {
        assertIsDragging(this._dragState)
        const { source, piece } = this._dragState

        // there is no "snapback" for spare pieces
        if (source === 'spare') {
            return this._trashDraggedPiece()
        }

        this._dragState = {
            state: 'snapback',
            piece,
            source,
        }

        // Wait for a paint
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                this._draggedPieceElement.removeEventListener(
                    'transitionend',
                    transitionComplete
                )
                resolve()

                this.dispatchEvent(
                    new CustomEvent<ChessboardEvent['snapback-end']>(
                        'snapback-end', 
                        {
                            bubbles: true,
                            detail: {
                                piece,
                                square: source,
                                position: deepCopy(this._currentPosition),
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

    private async _trashDraggedPiece () {
        assertIsDragging(this._dragState)
        const { source, piece } = this._dragState

        // remove the source piece
        const newPosition = deepCopy(this._currentPosition)
        delete newPosition[source]
        this._setCurrentPosition(newPosition)

        this._dragState = {
            state: 'trash',
            piece,
            x: this._dragState.x,
            y: this._dragState.y,
            source: this._dragState.source,
        }

        // Wait for a paint
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

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

    private async _dropDraggedPieceOnSquare (square: BoardLocation) {
        assertIsDragging(this._dragState)
        const { source, piece } = this._dragState

        // update position
        const newPosition = deepCopy(this._currentPosition)
        delete newPosition[source]
        newPosition[square] = piece
        this._setCurrentPosition(newPosition)

        this._dragState = {
            state: 'snap',
            piece,
            location: square,
            source: square,
        }

        // Wait for a paint
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                this._draggedPieceElement.removeEventListener(
                    'transitionend',
                    transitionComplete
                )
                resolve()

                // Fire the snap-end event
                this.dispatchEvent(
                    new CustomEvent<ChessboardEvent['snap-end']>(
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

    private _beginDraggingPiece (
        source: BoardLocation,
        piece: ChessPiece,
        x: number,
        y: number
    ) {
        // Fire cancalable drag-start event
        const event = new CustomEvent<ChessboardEvent['drag-start']>(
            'drag-start',
            {
                bubbles: true,
                cancelable: true,
                detail: {
                    source,
                    piece,
                    position: deepCopy(this._currentPosition),
                    orientation: this.orientation,
                },
            }
        )
        this.dispatchEvent(event)
        if (event.defaultPrevented) {
            return
        }

        // set state
        this._dragState = {
            state: 'dragging',
            x,
            y,
            piece,
            // if the piece came from spare pieces, location is offboard
            location: source === 'spare' ? 'offboard' : source,
            source,
        }
        this.requestUpdate()
    }

    private _updateDraggedPiece (x: number, y: number) {
        assertIsDragging(this._dragState)

        // put the dragged piece over the mouse cursor
        this._dragState.x = x
        this._dragState.y = y

        this.requestUpdate()

        const location = this._isXYOnSquare(x, y)
        // do nothing more if the location has not changed
        if (location === this._dragState.location) {
            return
        }

        // remove highlight from previous square
        if (validSquare(this._dragState.location)) {
            this._highlightSquare(this._dragState.location, false)
        }

        // add highlight to new square
        if (validSquare(location)) {
            this._highlightSquare(location)
        }

        this.dispatchEvent(
            new CustomEvent<ChessboardEvent['drag-move']>(
                'drag-move',
                {
                    bubbles: true,
                    detail: {
                        newLocation: location,
                        oldLocation: this._dragState.location,
                        source: this._dragState.source,
                        piece: this._dragState.piece,
                        position: deepCopy(this._currentPosition),
                        orientation: this.orientation,
                    },
                }
            )
        )

        // update state
        this._dragState.location = location
    }

    private async _stopDraggedPiece (location: BoardLocation) {
        assertIsDragging(this._dragState)
        const {source, piece} = this._dragState
        // determine what the action should be
        let action: Action = 'drop'
        if (location === 'offboard') {
            action = this.dropOffBoard === 'trash' ? 'trash' : 'snapback'
        }
        const newPosition = deepCopy(this._currentPosition)
        const oldPosition = deepCopy(this._currentPosition)

        // source piece is a spare piece and position is on the board
        if (source === 'spare' && validSquare(location)) {
            // add the piece to the board
            newPosition[location] = piece
        }

        // source piece was on the board
        if (validSquare(source)) {
            // remove the piece from the board
            delete newPosition[source]
            // new position is on the board
            if (validSquare(location)) {
                // move the piece
                newPosition[location] = piece
            }
        }

        // Fire the drop event
        // Listeners can potentially change the drop action
        const dropEvent = new CustomEvent<ChessboardEvent['drop']>(
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

        this._highlightSquares.clear()

        // do it!
        if (action === 'snapback') {
            await this._snapbackDraggedPiece()
        } else if (action === 'trash') {
            await this._trashDraggedPiece()
        } else if (action === 'drop') {
            await this._dropDraggedPieceOnSquare(location)
        }

        // clear state
        this._dragState = undefined

        // Render the final non-dragging state
        this.requestUpdate()
    }

    // -------------------------------------------------------------------------
    // Animations
    // -------------------------------------------------------------------------

    // calculate an array of animations that need to happen in order to get
    // from pos1 to pos2
    private _calculateAnimations (
        pos1: BoardPositionObject,
        pos2: BoardPositionObject
    ): Animation[] {
        // make copies of both
        pos1 = deepCopy(pos1)
        pos2 = deepCopy(pos2)

        const animations: Animation[] = []
        const squaresMovedTo: {[square: string]: boolean} = {}

        // remove pieces that are the same in both positions
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) continue

            if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
                delete pos1[i]
                delete pos2[i]
            }
        }

        // find all the "move" animations
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) continue

            const closestPiece = findClosestPiece(pos1, pos2[i]!, i as BoardSquare)
            if (closestPiece) {
                animations.push({
                    type: 'move',
                    source: closestPiece,
                    destination: i as BoardSquare,
                    piece: pos2[i]!,
                })

                delete pos1[closestPiece]
                delete pos2[i]
                squaresMovedTo[i] = true
            }
        }

        // "add" animations
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

        // "clear" animations
        for (const i in pos1) {
            if (!pos1.hasOwnProperty(i)) continue

            // do not clear a piece if it is on a square that is the result
            // of a "move", ie: a piece capture
            if (squaresMovedTo.hasOwnProperty(i)) continue

            animations.push({
                type: 'clear',
                square: i as BoardSquare,
                piece: pos1[i]!,
            })

            delete pos1[i]
        }

        return animations
    }

    // execute an array of animations
    private async _doAnimations (
        animations: Animation[],
        oldPos: BoardPositionObject,
        newPos: BoardPositionObject
    ) {
        if (animations.length === 0) {
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
                this._animations.clear()
                this.requestUpdate()
                this.dispatchEvent(
                    new CustomEvent<ChessboardEvent['move-end']>(
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

        // Render once with added pieces at opacity 0
        this._animations.clear()
        for (const animation of animations) {
            if (animation.type === 'add' || animation.type === 'add-start') {
                this._animations.set(animation.square, {
                    ...animation,
                    type: 'add-start',
                })
            } else if (animation.type === 'move' || animation.type === 'move-start') {
                this._animations.set(animation.destination, {
                    ...animation,
                    type: 'move-start',
                })
            } else {
                this._animations.set(animation.square, animation)
            }
        }

        // Wait for a paint
        this.requestUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

        // Render again with the piece at opacity 1 with a transition
        this._animations.clear()
        for (const animation of animations) {
            if (animation.type === 'move' || animation.type === 'move-start') {
                this._animations.set(animation.destination, animation)
            } else {
                this._animations.set(animation.square, animation)
            }
        }
        this.requestUpdate()
    }

    // -------------------------------------------------------------------------
    // Validation / Errors
    // -------------------------------------------------------------------------

    private _error (code: number, msg: string, _obj?: unknown) {
        const errorText = `Chessboard Error ${code} : ${msg}`
        this.dispatchEvent(
            new ErrorEvent('error', {
                message: errorText,
            })
        )
        return new Error(errorText)
    }
}
