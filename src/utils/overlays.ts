/**
 * Chessboard component overlays.
 * @copyright Sampsa Lohi 2024
 * @license MIT
 */

import { BoardSquare } from '#types'
import { html } from 'lit'
import { styleMap } from 'lit/directives/style-map.js'
import { presetColors } from './chessboard-styles'

let arrowNr = 0

/**
 * Base class for board overlay elements.
 */
abstract class BoardOverlay {
    /** Arrow color. */
    protected _color: string
    /** Arrow opacity. */
    protected _opacity: number
    /** Width of a single board square in percents. */
    squareWidth = 100/8
    /**
     * Create a board overlay of the given color.
     * @param color - Arrow color. Preset colors can be used by starting the color with `@`, e.g. `@red`.
     * @param opacity - Optional opacity of the arrow.
     */
    constructor(color: string, opacity = 0.75) {
        this._color = color.startsWith('@') 
                    ? presetColors[
                        color.substring(1) as keyof typeof presetColors
                    ] || presetColors.grey
                    : color
        if (opacity < 0) {
            opacity = 0
        } else if (opacity > 1) {
            opacity = 1
        }
        this._opacity = opacity
    }
    protected getStyles (extra?: {[key: string]: string | number }) {
        return styleMap({
                position: 'absolute',
                width: '100%',
                height: '100%',
                color: this._color,
                opacity: this._opacity,
                pointerEvents: 'none',
                ...extra
        })
    }
    /**
     * Auxiliary function to convert a `square` code to an array of x,y coordinates.
     * @param square - Square code.
     * @returns Square coordinates as `[col, row]` with index range 1-8.
     */
    protected _getSquareCoordinates (square: BoardSquare) {
        const parts = square.match(/^([a-h])([1-8])$/)
        if (!parts || !parts[1] || !parts[2]) {
            console.error(`Square code ${square} given to arrow generator is not a valid board square.`)
            return null
        }
        if (parts[1]==='a') return [ 1, parseInt(parts[2]) ]
        else if (parts[1]==='b') return [ 2, parseInt(parts[2]) ]
        else if (parts[1]==='c') return [ 3, parseInt(parts[2]) ]
        else if (parts[1]==='d') return [ 4, parseInt(parts[2]) ]
        else if (parts[1]==='e') return [ 5, parseInt(parts[2]) ]
        else if (parts[1]==='f') return [ 6, parseInt(parts[2]) ]
        else if (parts[1]==='g') return [ 7, parseInt(parts[2]) ]
        else if (parts[1]==='h') return [ 8, parseInt(parts[2]) ]
        else {
            return null
        }
    }
}
/**
 * Type of square marker.
 */
export type MarkerType = 'circle' |'cross'
/**
 * A marker placed over a square on the board.
 */
export class SquareMarker extends BoardOverlay {
    protected _lineWidth = 0.125
    /** Square of the marker. */
    protected _square: BoardSquare
    protected _type: MarkerType
    /**
     * Create a marker on the given `square`.
     * @param square - Square code.
     * @param type - Type of the marker.
     * @param color - Color of the marker.
     * @param opacity . Optional opacity of the marker.
     */
    constructor (square: BoardSquare, type: MarkerType, color: string, opacity?: number) {
        super(color, opacity)
        this._square = square
        this._type =  type
    }
    /**
     * Line width of the marker as a fraction of square size.
     */
    get lineWidth () {
        return this._lineWidth
    }
    set lineWidth (value: number) {
        // Sanity check for the value.
        if (value < 0) {
            this._lineWidth = 0
        } else if (value > 0.25) {
            this._lineWidth = 0.25
        } else {
            this._lineWidth = value
        }
    } 
    getSvg () {
        const square = this._getSquareCoordinates(this._square)
        // Abort if square code was invalid.
        if (!square) {
            return
        }
        const x = square[0] - 0.5
        const y = 8 - (square[1] - 0.5)
        if (this._type === 'circle') {
            // Position the edge of circle 5% away from square edge.
            const r = 0.45 - 0.5*this.lineWidth
            // Place the circle marker below the board piece.
            const styles = this.getStyles({ zIndex: 5 })
            return html`
                <svg 
                    part="overlay-marker"
                    style="${styles}"
                >
                    <circle
                        cx="${x*this.squareWidth}%"
                        cy="${y*this.squareWidth}%"
                        r="${r*this.squareWidth}%"
                        stroke="currentColor"
                        stroke-width="${this.lineWidth*this.squareWidth}%"
                        fill="none"
                    />
                </svg>
            `
        } else if (this._type === 'cross') {
            // Place the cross marker above the board piece.
            const styles = this.getStyles({ zIndex: 15 })
            return html`
                <svg 
                    part="overlay-marker"
                    style="${styles}"
                >
                    <line
                        stroke="currentColor"
                        stroke-width="${this.lineWidth*this.squareWidth}%"
                        x1="${(x - 1/3)*this.squareWidth}%"
                        x2="${(x + 1/3)*this.squareWidth}%"
                        y1="${(y - 1/3)*this.squareWidth}%"
                        y2="${(y + 1/3)*this.squareWidth}%"
                    />
                    <line
                        stroke="currentColor"
                        stroke-width="${this.lineWidth*this.squareWidth}%"
                        x1="${(x - 1/3)*this.squareWidth}%"
                        x2="${(x + 1/3)*this.squareWidth}%"
                        y1="${(y + 1/3)*this.squareWidth}%"
                        y2="${(y - 1/3)*this.squareWidth}%"
                    />
                </svg>
            `
        }
        return html``
    }
}

/**
 * Creates a board overlay with an arrow pointing from one square to another. The created arrow always points straight
 * from the origin to the target, even when the move is not along a board axis.
 */
export class StraightArrow extends BoardOverlay {
    protected static _START_OFFSET = 0.4
    /**
     * Arrow start distance from the square center as a fraction of square size. Value between `0` and `0.5`.
     * Value 0 starts the arrow at the square center and value 0.5 at the square edge (for arrows along a board axis).
     */
    static get START_OFFSET () {
        return StraightArrow._START_OFFSET
    }
    static set START_OFFSET (value: number) {
        if (value < 0) {
            StraightArrow._START_OFFSET = 0
        } else if (value > 0.5) {
            StraightArrow._START_OFFSET = 0.5
        } else {
            StraightArrow._START_OFFSET = value
        }
    }
    protected static _TARGET_OFFSET = 0.5
    /** 
     * Distance of the arrow point from the center of the target square as a fraction of square size.
     * Value between `0` and `0.5`. 0 ends the arrow at the center of the target square, while 0.5 ends it at the
     * target square edge (for arrows along a board axis).
     */
    static get TARGET_OFFSET () {
        return StraightArrow._TARGET_OFFSET
    }
    static set TARGET_OFFSET (value: number) {
        if (value < 0) {
            StraightArrow._TARGET_OFFSET = 0
        } else if (value > 0.5) {
            StraightArrow._TARGET_OFFSET = 0.5
        } else {
            StraightArrow._TARGET_OFFSET = value
        }
    }
    protected _arrowSize = 0.25
    /** Unique ID for matching the arrow head with the shaft. */
    protected _id: number
    /** Origin square of the arrow. */
    protected _origin: BoardSquare
    /** Target square of the arrow. */
    protected _target: BoardSquare

    /**
     * Create an arrow pointing from the `origin` square to the `target` square.
     * @param origin - Square code of the arrow origin.
     * @param target - Square code of the arrow target.
     * @param color - Arrow color. Preset colors can be used by starting the color with `@`, e.g. `@red`.
     * @param opacity - Optional opacity of the arrow.
     */
    constructor(origin: BoardSquare, target: BoardSquare, color: string, opacity?: number) {
        super(color, opacity)
        this._id = arrowNr++
        this._origin = origin
        this._target = target
    }
    /**
     * Width of the arrow shaft as a fraction of square size.
     */
    get arrowSize () {
        return this._arrowSize
    }
    set arrowSize (value: number) {
        // Sanity check for the value.
        if (value < 0) {
            this._arrowSize = 0
        } else if (value > 0.25) {
            this._arrowSize = 0.25
        } else {
            this._arrowSize = value
        }
    } 
    /**
     * Calculate arrow offset from square center for an angled arrow.
     * @param origin - Coordinates for the origin square.
     * @param target - Coordinates for the target square.
     * @returns Offset coordinates for a line from origin to target.
     */
    protected _getStartOffset (origin: number[], target: number[]) {
        let dx = target[0] - origin[0]
        let dy = target[1] - origin[1]
        let angle = Math.atan2(dy, dx)
        let xPos = Math.cos(angle)
        let yPos = Math.sin(angle)
        return [xPos, yPos]
    }
    /**
     * Get SVG markup for the arrow.
     * @returns SVG markup template.
     */
    getSvg () {
        if (this._target === this._origin) {
            return html``
        }
        const origin = this._getSquareCoordinates(this._origin)
        const target = this._getSquareCoordinates(this._target)
        // Abort if square code was invalid.
        if (origin === null || target === null) {
            return
        }
        // Distance between origin and target squares.
        const distance = Math.sqrt((target[0] - origin[0])**2 + (target[1] - origin[1])**2)
        // Calculate arrow coordinates (as a fraction of board width) relative to board bottom left corner.
        const offset = this._getStartOffset(origin, target)
        // Origin and target coordinates in "square" units.
        const targetOffset = [
            (3*this.arrowSize + StraightArrow.TARGET_OFFSET)*offset[0],
            (3*this.arrowSize + StraightArrow.TARGET_OFFSET)*offset[1]
        ]
        const x2 = target[0] - 0.5 - targetOffset[0]
        const y2 = 8 - (target[1] - 0.5 - targetOffset[1])
        // Offsets and arrow size cannot exceed the distance between the squares, or it will skew the arrow.
        const maxOffset = distance - (3*this.arrowSize + StraightArrow.TARGET_OFFSET) - 1E-5
        const startOffset = [
            Math.min(StraightArrow.START_OFFSET, maxOffset)*offset[0],
            Math.min(StraightArrow.START_OFFSET, maxOffset)*offset[1]
        ]
        const x1 = origin[0] - (0.5 - startOffset[0])
        const y1 = 8 - (origin[1] - 0.5 + startOffset[1])
        // Place arrows above pieces and other board markers.
        const styles = this.getStyles({ zIndex: 25 })
        return html`
            <svg 
                part="overlay-arrow"
                style="${styles}"
            >
                <defs>
                    <marker
                        id="${this._id}-arrow-head"
                        markerHeight="3"
                        markerUnits="strokeWidth"
                        markerWidth="3"
                        orient="auto"
                        refX="0.1"
                        refY="1.5"
                    >
                        <path d="M0,0 L0,3 L3,1.5 z" fill="currentColor" />
                    </marker>
                </defs>
                <line
                    marker-end="url(#${this._id}-arrow-head)"
                    stroke="currentColor"
                    stroke-width="${this._arrowSize*this.squareWidth}%"
                    x1="${x1*this.squareWidth}%"
                    x2="${x2*this.squareWidth}%"
                    y1="${y1*this.squareWidth}%"
                    y2="${y2*this.squareWidth}%"
                />
            </svg>
        `
    }
}

/**
 * Creates a board overlay with an arrow pointing from one square to another. The arrow shaft(s) will always run along
 * a board axis, creating a straight angle if needed.
 */
export class AngledArrow extends StraightArrow {
    getSvg () {
        if (this._target === this._origin) {
            return html``
        }
        const origin = this._getSquareCoordinates(this._origin)
        const target = this._getSquareCoordinates(this._target)
        // Abort if square code was invalid.
        if (origin === null || target === null) {
            return
        }
        // Return a straight arrow, if origin and target share the row or column.
        if (origin[0] === target[0] || origin[1] === target[1]) {
            return super.getSvg()
        }
        // Calculate arrow coordinates (as a fraction of board width) relative to board bottom left corner.
        // We need to know if the target is closer to the row or column edge of the board.
        const targetColFromEdge = target[0] < 4 ? target[0] - 1 : 8 - target[0]
        const targetRowFromEdge = target[1] < 4 ? target[1] - 1 : 8 - target[1]
        // Start with the longer leg, if they are of different lengths.
        const interceptCol = Math.abs(target[0] - origin[0]) < Math.abs(target[1] - origin[1])
                           ? origin[0]
                           : Math.abs(target[0] - origin[0]) > Math.abs(target[1] - origin[1])
                             ? target[0]
                             // I the legs are of the same length, start towards the board edge, preferring the column
                             // axis (up or down along the board).
                             : targetColFromEdge > targetRowFromEdge ? target[0] : origin[0]
        const interceptRow = interceptCol === origin[0] ? target[1] : origin[1]
        // The starting leg must reach half of the line's withd over the square center to create a continuous arrow.
        const angleColEdge = interceptCol !== origin[0]
                           ? target[0] < origin[0]
                             ? -0.5*this.arrowSize : 0.5*this.arrowSize
                           : 0
        const angleRowEdge = interceptCol === origin[0]
                           ? target[1] < origin[1]
                             ? -0.5*this.arrowSize : 0.5*this.arrowSize
                           : 0
        // Arrow coordinates in "square" units.
        const offsetA = this._getStartOffset(origin, [interceptCol, interceptRow])
        const startOffset = [
            StraightArrow.START_OFFSET*offsetA[0],
            StraightArrow.START_OFFSET*offsetA[1]
        ]
        const aLegX1 = origin[0] - (0.5 - startOffset[0])
        const aLegY1 = 8 - (origin[1] - 0.5 + startOffset[1])
        const aLegX2 = interceptCol - 0.5 + angleColEdge
        const aLegY2 = 8 - (interceptRow - 0.5 + angleRowEdge)
        // Distance between turning point and target squares.
        const bLegDistance = Math.sqrt((target[0] - interceptCol)**2 + (target[1] - interceptRow)**2)
        // Offsets and arrow size cannot exceed the distance between the squares, or it will skew the arrow.
        const overflow = Math.max(3*this.arrowSize + StraightArrow.TARGET_OFFSET - bLegDistance + 1E-5, 0)
        const overflowX = overflow*(target[0] - interceptCol)
        const overflowY = overflow*(target[1] - interceptRow)
        const bLegX1 = interceptCol - overflowX - 0.5
        const bLegY1 = 8 - (interceptRow - overflowY - 0.5)
        const offsetB = this._getStartOffset([interceptCol, interceptRow], target)
        const targetOffset = [
            (3*this.arrowSize + AngledArrow.TARGET_OFFSET)*offsetB[0],
            (3*this.arrowSize + AngledArrow.TARGET_OFFSET)*offsetB[1]
        ]
        const bLegX2 = target[0] - 0.5 - targetOffset[0]
        const bLegY2 = 8 - (target[1] - 0.5 - targetOffset[1])
        // Place arrows above pieces and other board markers.
        const styles = this.getStyles({ zIndex: 25 })
        return html`
            <svg 
                part="overlay-arrow"
                style="${styles}"
            >
                <defs>
                    <marker
                        id="${this._id}-arrow-head"
                        markerHeight="3"
                        markerUnits="strokeWidth"
                        markerWidth="3"
                        orient="auto"
                        refX="0.1"
                        refY="1.5"
                    >
                        <path d="M0,0 L0,3 L3,1.5 z" fill="currentColor" />
                    </marker>
                </defs>
                <line
                    stroke="currentColor"
                    stroke-width="${this.arrowSize*this.squareWidth}%"
                    x1="${aLegX1*this.squareWidth}%"
                    x2="${aLegX2*this.squareWidth}%"
                    y1="${aLegY1*this.squareWidth}%"
                    y2="${aLegY2*this.squareWidth}%"
                />
                <line
                    marker-end="url(#${this._id}-arrow-head)"
                    stroke="currentColor"
                    stroke-width="${this.arrowSize*this.squareWidth}%"
                    x1="${bLegX1*this.squareWidth}%"
                    x2="${bLegX2*this.squareWidth}%"
                    y1="${bLegY1*this.squareWidth}%"
                    y2="${bLegY2*this.squareWidth}%"
                />
            </svg>
        `
    }
}

export class PathArrow extends StraightArrow {
    protected _path: BoardSquare[]
    constructor (path: BoardSquare[], color: string, opacity?: number) {
        super(path[0], path[path.length - 1], color, opacity)
        this._path = []
        for (const node of path) {
            if (!this._path.length || this._path[this._path.length - 1] !== node) {
                this._path.push(node)
            }
        }
    }
    getSvg () {
        if (this._path.length === 2) {
            return super.getSvg()
        } else if (this._path.length < 2) {
            return html``
        }
        const points = [] as string[]
        const finalLine = { x1: 0, x2: 0, y1: 0, y2: 0 }
        for (let i=0; i<this._path.length - 1; i++) {
            const origin = this._getSquareCoordinates(this._path[i])
            const target = this._getSquareCoordinates(this._path[i+1])
            // Abort if square code was invalid.
            if (origin === null || target === null) {
                return
            }
            // Arrow coordinates in "square" units.
            const offset = this._getStartOffset(origin, target)
            const startOffset = [
                i ? 0 : StraightArrow.START_OFFSET*offset[0],
                i ? 0 : StraightArrow.START_OFFSET*offset[1]
            ]
            const pathNode = [
                (origin[0] - (0.5 - startOffset[0]))*this.squareWidth,
                (8 - (origin[1] - 0.5 + startOffset[1]))*this.squareWidth
            ]
            points.push(`${pathNode[0]},${pathNode[1]}`)
            if (i === this._path.length - 2) {
                const offset = this._getStartOffset(origin, target)
                const endOffset = [
                    (3*this.arrowSize + AngledArrow.TARGET_OFFSET)*offset[0],
                    (3*this.arrowSize + AngledArrow.TARGET_OFFSET)*offset[1]
                ]
                const finalNode = [
                    (target[0] - 0.5 - endOffset[0])*this.squareWidth,
                    (8 - (target[1] - 0.5 - endOffset[1]))*this.squareWidth
                ]
                if (!(target[0] - origin[0]) || !(target[1] - origin[1])) {
                    // Paths ending in a 90 deg angle have a risk of the arrow start overlapping the path if offset
                    // from the target square is large enough. For a polyline this would flip the arrow into the wrong
                    // direction. We must limit the target offset in some cases to prevent this
                    const pathX = target[0] !== origin[0]
                                ? target[0] < origin[0]
                                    ? Math.min(finalNode[0], pathNode[0] - 1E-5)
                                    : Math.max(finalNode[0], pathNode[0] + 1E-5)
                                : finalNode[0]
                    const pathY = target[1] !== origin[1]
                                ? target[1] < origin[1]
                                    ? Math.max(finalNode[1], pathNode[1] + 1E-5)
                                    : Math.min(finalNode[1], pathNode[1] - 1E-5)
                                : finalNode[1]
                    points.push(`${pathX},${pathY}`)
                } else {
                    // Oblique paths don't have this risk within the limits set to arrow size and target offset.
                    // Add the final part as a path point.
                    points.push(`${finalNode[0]},${finalNode[1]}`)
                }
            }
        }
        // Place arrows above pieces and other board markers.
        const styles = this.getStyles({ zIndex: 25 })
        return html`
            <svg
                part="overlay-arrow"
                style="${styles}"
                viewBox="0 0 100 100"
            >
                <defs>
                    <marker
                        id="${this._id}-arrow-head"
                        markerHeight="3"
                        markerUnits="strokeWidth"
                        markerWidth="3"
                        orient="auto"
                        refX="0.1"
                        refY="1.5"
                    >
                        <path d="M0,0 L0,3 L3,1.5 z" fill="currentColor" />
                    </marker>
                </defs>
                <polyline
                    marker-end="${ finalLine.x1 ? '' : 'url(#' + this._id + '-arrow-head)' }"
                    points="${points.join(' ')}"
                    style="fill:none;stroke:currentColor;stroke-width:${this.arrowSize*this.squareWidth}"
                />
            </svg>
        `
    }
}