# chessboard-component

A web component to insert a custom <chess-board> element on your web pages.

## Documentation

Please check out the more useful full documentation site:

https://justinfagnani.github.io/chessboard-element/

## Quick Start

### unpkg.com

```html
<script type="module" src="https://unpkg.com/chessboard-element?module"></script>

<chess-board></chess-board>
```

### NPM
```bash
npm i chessboard-element
```

```html
<!--
  Adjust path to node_modules and use a dev server that support Node module
  resolution, like es-dev-server: https://www.npmjs.com/package/es-dev-server
-->
<script type="module" src="/node_modules/chessboard-element/index.js"></script>

<chess-board></chess-board>
```

## What is chessboard-component?

chessboard-component is a standalone chess board web component. It defines a `<chess-board>` custom element that works anywhere HTML works - in plain HTML pages, JavaScript, or your framework of choice. It is designed to be "just a board" and expose a powerful API so that it can be used in different ways.

Here's a non-exhaustive list of things you can do with chessboard-component:

- Use `<chess-board>` to show game positions alongside your expert commentary.
- Use `<chess-board>` to have a tactics website where users have to guess the best move.
- Integrate chessboard-component and [chess.js] with a PGN database and allow people to search and playback games.
- Build a chess server and have users play their games out using the
  `<chess-board>` element.

chessboard-component is flexible enough to handle any of these situations with relative ease.

### Relationship to chessboard-element and chessboard.js

This project is a fork of [chessboard-element](https://github.com/justinfagnani/chessboard-element), adding some functionality. chessboard-element is a fork of of the wonderful [chessboard.js] library, repackaging it as a web component and updating the implementation to modern JavaScript and CSS. The differences include:

  - No need to use JavaScript for basic boards, just use the `<chess-board>` element.
  - All chessboard DOM is encapsulated in a shadow root. Styles do not leak.
  - No dependency on jQuery
  - Just one script tag required, all dependencies and styles are imported directly.
  - Published as standard JS modules
  - Uses CSS transitions for all animations
  - Uses CSS grid and flexbox for layout
  - New declarative attribute and property APIs play nice with declarative frameworks and template libraries like React and lit-html
  - Supports arbitrary piece renderers and defaults to SVG pieces

Many thanks to Chris Oakman for chessboard.js.

## What can chessboard-component **not** do?

The scope of chessboard-component is limited to "just a board." This is intentional and makes chessboard-component flexible for handling a multitude of chess-related problems.

Specifically, chessboard-component does not understand anything about how the game of chess is played: how a knight moves, whose turn is it, is White in check?, etc.

Fortunately, the powerful [chess.js] library deals with exactly this sort of
problem domain and plays nicely with chessboard-component's flexible API. Some examples of chessboard-component combined with chess.js: [Example 5000], [Example 5001], [Example 5002]

Please see the powerful [chess.js] library for an API to deal with these sorts of questions.


This logic is distinct from the logic of the board. Please see the powerful [chess.js] library for this aspect of your application.

Here is a list of things that chessboard-component is **not**:

- A chess engine
- A legal move validator
- A PGN parser

chessboard-component is designed to work well with any of those things, but the idea behind chessboard-component is that the logic that controls the board should be independent of those other problems.

## Developing

```sh
# Build the TypeScript files
npm run build

# Docs...
npm run analyze
npm run bundle

# Build the docs site
cd docs-src
npm run build:ts
npm run build

# Start the docs server
npm run serve
```

## License

[MIT License](LICENSE.md)

[chessboard.js]: (https://github.com/oakmac/chessboardjs)
[chessboardjs.com]: http://chessboardjs.com
[chess.js]: https://github.com/jhlywa/chess.js
[Example 5000]: https://justinfagnani.github.io/chessboard-element/examples/5000-legal-moves/
[Example 5001]: https://justinfagnani.github.io/chessboard-element/examples/5001-play-random-computer/
[Example 5002]: https://justinfagnani.github.io/chessboard-element/examples/5002-random-vs-random/
