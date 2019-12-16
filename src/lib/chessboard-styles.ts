/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

import {css} from 'lit-element';

export const styles = css`
  :host {
    display: block;
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

  [part~='piece'] {
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

  [part~='dragged-piece'] {
    display: none;
    position: absolute;
  }

  [part~='white'] {
    background-color: #f0d9b5;
    color: #b58863;
  }

  [part~='black'] {
    background-color: #b58863;
    color: #f0d9b5;
  }

  [part~='highlight'] {
    box-shadow: inset 0 0 3px 3px yellow;
  }

  [part~='notation'] {
    cursor: default;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
    position: absolute;
  }

  [part~='alpha'] {
    bottom: 1px;
    right: 3px;
  }

  [part~='numeric'] {
    top: 2px;
    left: 2px;
  }
`;
