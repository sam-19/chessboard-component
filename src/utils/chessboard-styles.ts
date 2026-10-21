/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import { css } from 'lit'

/**
 * Set of preset colors. A preset color can be used by referring to it by starting the color name with `@`,
 * for example `@red`, or by its single-letter code (see `presetColorCodes`).
 */
export const presetColors = {
    blue: `rgb(0, 110, 255)`,
    cyan: `rgb(0, 175, 225)`,
    green: `rgb(0, 200, 0)`,
    grey: `rgb(127, 127, 127)`,
    orange: `rgb(255, 127, 0)`, // Not so visible against the standard board.
    pink: `rgb(255, 60, 200)`,
    purple: `rgb(140, 60, 220)`,
    red: `rgb(255, 0, 0)`,
    yellow: `rgb(225, 200, 0)`,
}

export type PresetColor = keyof typeof presetColors

/**
 * Single-letter codes of the preset colors, as used in PGN board markup (`[%cal Gd2d4]`, `[%csl Re4]`): G, R, Y
 * and B are the common ones; C, O, U (purple), P (pink) and X (grey) cover the other presets.
 */
export const presetColorCodes: Record<string, PresetColor> = {
    B: 'blue',
    C: 'cyan',
    G: 'green',
    O: 'orange',
    P: 'pink',
    R: 'red',
    U: 'purple',
    X: 'grey',
    Y: 'yellow',
}

/**
 * The preset a color description refers to: `@name`, or a single-letter code with or without the `@` (`G`, `@g`).
 * @param color - Color description.
 * @returns The preset's name, `undefined` if the description refers to no preset (e.g. a CSS color), or `null` if it
 *          looks like a preset reference but names none (an unknown `@name` or letter).
 */
export function presetName (color: string): PresetColor | null | undefined {
    const code = color.match(/^@?([a-z])$/i)
    if (code) {
        return presetColorCodes[code[1].toUpperCase()] ?? null
    }
    if (color.startsWith('@')) {
        const name = color.substring(1)
        return name in presetColors ? name as PresetColor : null
    }
    return undefined
}

/**
 * The CSS color of a colored square: presets (`@name` or letter code) refer to their CSS custom properties, so they
 * can be themed; no color means yellow, an unknown preset grey.
 * @param color - Color description, possibly empty.
 */
export function colorSquareValue (color: string): string {
    const preset = color ? presetName(color) : 'yellow'
    return preset === undefined ? color : `var(--preset-color-${preset ?? 'grey'})`
}

export const styles = css`
    :host {
        display: block;
        position: relative;
        --dark-color: #b58863;
        --highlight-color-active: yellow;
        --highlight-color-available: yellowgreen;
        --highlight-color-check: rgb(225, 0, 0);
        --highlight-color-previous: steelblue;
        --highlight-color-unavailable: gray;
        --light-color: #f0d9b5;
        --preset-color-blue: rgb(0, 110, 255);
        --preset-color-cyan: rgb(0, 175, 225);
        --preset-color-green: rgb(0, 200, 0);
        --preset-color-grey: rgb(127, 127, 127);
        --preset-color-orange: rgb(255, 127, 0);
        --preset-color-pink: rgb(255, 60, 200);
        --preset-color-purple: rgb(140, 60, 220);
        --preset-color-red: rgb(255, 0, 0);
        --preset-color-yellow: rgb(225, 200, 0);
        --time-low-color: rgb(175, 0, 0);
    }

    [part~='wrapper'] {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    [part~='board'] {
        position: relative;
        border: 2px solid #404040;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(8, 12.5%);
        grid-template-rows: repeat(8, 12.5%);
    }

    [part~='square'] {
        position: relative;

        /* disable any native browser highlighting */
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }

    [part~='piece']  {
        width: 100%;
        height: 100%;
    }
    [part~='piece'] .piece-image {
        position: absolute;
        z-index: 10;
    }

    /* Under the square's own piece, and transparent to the pointer. */
    [part~='ghost-piece'] {
        position: absolute;
        inset: 0;
        z-index: 5;
        opacity: 0.5;
        pointer-events: none;
    }

    [part~='spare-pieces'] {
        display: grid;
        position: relative;
        box-sizing: border-box;
        padding: 0 2px;
        grid-template-columns: repeat(8, 12.5%);
    }
    [part~='spare-piece'] {
        /* Dragging must not scroll the page on touch screens. */
        touch-action: none;
    }
    [part~='spare-piece'] .piece-image {
        position: static;
        cursor: move;
        cursor: grab;
    }

    [part~='game-details'] {
        display: flex;
        flex-direction: row;
        position: relative;
        overflow: hidden;
    }
        [part~='player-details'] {
            flex: 1 1 0;
            font-size: inherit;
            padding-left: 2px;
            font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
        }
            [part~='player-name'] {
                height: 1.25em;
                line-height: 1.5em;
                font-size: 0.5em;
            }
            [part~='player-turn'] [part~='player-name'] {
                font-weight: 700;
            }
            [part~='player-rating'] {
                height: 1.5em;
                font-size: 0.25em;
            }
        [part~='player-timer'] {
            display: flex;
            flex-direction: row;
            font-family: Courier, monospace;
            font-size: 0.5em;
            line-height: 2em;
            padding-right: 2px;
        }
            [part~='timer-low'] {
                font-weight: 700;
                color: var(--time-low-color);
            }
            [part~='timer-fraction'] {
                font-size: 0.8em;
                line-height: 2.7em;
            }

    [part~='dragged-piece'] {
        display: none;
        position: absolute;
        /* Let pointer events reach the squares under the dragged piece. */
        pointer-events: none;
    }

    [part~='white'] {
        background-color: var(--light-color);
        color: var(--dark-color);
    }

    [part~='black'] {
        background-color: var(--dark-color);
        color: var(--light-color);
    }

    [part~='dragging'], [part~='dragging'] * {
        cursor: grabbing !important;
    }

    [part~='draggable'] {
        cursor: move;
        cursor: grab;
        touch-action: none;
    }
    
    [part~='disabled'] .piece-image {
        cursor: default;
        opacity: 0.5;
        pointer-events: none;
    }

    [part~='highlight-active'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-active);
    }
    [part~='highlight-available'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-available);
    }
    [part~='highlight-check'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-check);
    }
    [part~='highlight-previous'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-previous);
    }
    [part~='highlight-unavailable'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-unavailable);
    }

    [part~='notation'] {
        cursor: default;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: inherit;
        position: absolute;
    }

    [part~='alpha'] {
        bottom: 1%;
        right: 5%;
    }

    [part~='numeric'] {
        top: 3%;
        left: 3%;
    }
`