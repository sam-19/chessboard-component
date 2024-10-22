/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import { css } from 'lit'

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
        --light-color: #f0d9b5;
        --dark-color: #b58863;
        --highlight-color: yellow;
        --highlight--coloravailable: yellowgreen;
        --highlight-color-unavailable: gray;
    }

    [part~='wrapper'] {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    [part~='board'] {
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

    [part~='piece'],
    .piece-image {
        width: 100%;
        height: 100%;
        z-index: 10;
    }

    [part~='spare-pieces'] {
        display: grid;
        position: relative;
        padding: 0 2px;
        grid-template-columns: repeat(8, 12.5%);
    }

    [part~='spare-piece'] {
        cursor: move;
        cursor: grab;
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

    [part~='highlight'] {
        box-shadow: inset 0 0 1px 3px var(--highlight-color);
    }
    [part~='highlight available'] {
        box-shadow: inset 0 0 1px 3px var(--highlight-available-color);
    }
    [part~='highlight unavailable'] {
        box-shadow: inset 0 0 1px 3px var(--highlight-unavailable-color);
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