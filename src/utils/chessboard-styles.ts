/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import { css } from 'lit'

/**
 * Set of preset colors. A preset color can be used by referring to it by starting the color name with `@`,
 * for example `@red`.
 */
export const presetColors = {
    blue: `rgb(0, 110, 255)`,
    cyan: `rgb(0, 175, 225)`,
    green: `rgb(0, 200, 0)`,
    grey: `rgb(127, 127, 127)`,
    orange: `rgb(255, 127, 0)`, // Not so visible against the standard board.
    purple: `rgb(200, 0, 100)`,
    red: `rgb(255, 0, 0)`,
    yellow: `rgb(225, 200, 0)`,
}

export const styles = css`
    :root {
        font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
        font-weight: 400;

        color-scheme: light dark;

        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
    
    :host {
        display: block;
        position: relative;
        --dark-color: #b58863;
        --highlight-color-active: yellow;
        --highlight-color-available: yellowgreen;
        --highlight-color-previous: steelblue;
        --highlight-color-unavailable: gray;
        --light-color: #f0d9b5;
        --preset-color-blue: rgb(0, 110, 255);
        --preset-color-cyan: rgb(0, 175, 225);
        --preset-color-green: rgb(0, 200, 0);
        --preset-color-grey: rgb(127, 127, 127);
        --preset-color-orange: rgb(255, 127, 0);
        --preset-color-purple: rgb(200, 0, 100);
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

    [part~='spare-pieces'] {
        display: grid;
        position: relative;
        box-sizing: border-box;
        padding: 0 2px;
        grid-template-columns: repeat(8, 12.5%);
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
    }

    [part~='white'] {
        background-color: var(--light-color);
        color: var(--dark-color);
    }

    [part~='black'] {
        background-color: var(--dark-color);
        color: var(--light-color);
    }

    [part~='draggable'] {
        cursor: move;
        cursor: grab;
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
    [part~='highlight-previous'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-previous);
    }
    [part~='highlight-unavailable'] {
        box-shadow: inset 0 0 1px 5px var(--highlight-color-unavailable);
    }

    [part~='notation'] {
        cursor: default;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 14px;
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