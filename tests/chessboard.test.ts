import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChessBoard, START_POSITION, SquareLabel, StraightArrow, type BoardSquare, type ChessboardEventDetail } from '../src/index.js'

const BOARD_WIDTH = 400
const SQUARE_SIZE = BOARD_WIDTH/8

/**
 * Mount a board inside a container of a known width.
 */
const mount = async (attributes = '') => {
    const container = document.createElement('div')
    container.style.width = `${BOARD_WIDTH}px`
    container.innerHTML = `<chess-board ${attributes}></chess-board>`
    document.body.append(container)
    const board = container.querySelector('chess-board')!
    // The board is rendered again when the resize observer reports its size.
    await board.updateComplete
    await new Promise(resolve => requestAnimationFrame(resolve))
    await board.updateComplete
    return board
}

const part = (board: ChessBoard, selector: string) => board.shadowRoot!.querySelector<HTMLElement>(selector)
const square = (board: ChessBoard, sq: BoardSquare) => part(board, `[data-square="${sq}"]`)!
const center = (board: ChessBoard, sq: BoardSquare) => {
    const rect = square(board, sq).getBoundingClientRect()
    return { clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 }
}
const pointer = (type: string, at: { clientX: number, clientY: number }, init: PointerEventInit = {}) =>
    new PointerEvent(type, { bubbles: true, composed: true, isPrimary: true, button: 0, ...at, ...init })

/**
 * Drag the piece on `from` to `to` with pointer events.
 */
const drag = async (board: ChessBoard, from: BoardSquare, to: BoardSquare | 'offboard') => {
    square(board, from).dispatchEvent(pointer('pointerdown', center(board, from)))
    await board.updateComplete
    const target = to === 'offboard' ? { clientX: BOARD_WIDTH*2, clientY: BOARD_WIDTH*2 } : center(board, to)
    window.dispatchEvent(pointer('pointermove', target))
    await board.updateComplete
    window.dispatchEvent(pointer('pointerup', target))
}

const nextEvent = <K extends keyof ChessboardEventDetail>(board: ChessBoard, type: K, timeout = 2000) =>
    new Promise<ChessboardEventDetail[K]>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No ${type} event`)), timeout)
        board.addEventListener(type, (e) => {
            clearTimeout(timer)
            resolve((e as CustomEvent).detail)
        }, { once: true })
    })

afterEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
})

describe('Rendering', () => {
    it('renders the position and square colors', async () => {
        const board = await mount('position="start"')
        expect(board.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
        expect(square(board, 'e1').querySelector('[piece]')!.getAttribute('piece')).toBe('wK')
        expect(square(board, 'a1').part.contains('black')).toBe(true)
        expect(square(board, 'f6').part.contains('black')).toBe(true)
        expect(square(board, 'a1').getBoundingClientRect().width).toBeCloseTo(SQUARE_SIZE - 0.5, 0)
    })
    it('renders player parts with the player color', async () => {
        const board = await mount('white-name="W" black-name="B" white-seconds="65" turn="white"')
        expect(part(board, '[part~="player-white"]')).not.toBeNull()
        expect(part(board, '[part~="player-black"]')).not.toBeNull()
        expect(part(board, '[part~="timer-white"]')).not.toBeNull()
        expect(part(board, '[part~="player-white"]')!.part.contains('player-turn')).toBe(true)
        expect(part(board, '[part~="timer-white"]')!.textContent!.replace(/\s/g, '')).toBe('1:05.0')
    })
    it('shows a formatted time when seconds are not given', async () => {
        const board = await mount('white-name="W" white-time="5 min"')
        expect(part(board, '[part~="timer-white"]')!.textContent!.trim()).toBe('5 min')
    })
    it('rounds the displayed time down consistently', async () => {
        const board = await mount('white-name="W" white-seconds="9.96"')
        expect(part(board, '[part~="timer-white"]')!.textContent!.replace(/\s/g, '')).toBe('0:09.9')
    })
    it('highlights squares', async () => {
        const board = await mount('position="start"')
        board.highlights = { e2: 'previous', e1: 'check' }
        await board.updateComplete
        expect(square(board, 'e2').part.contains('highlight-previous')).toBe(true)
        expect(square(board, 'e1').part.contains('highlight-check')).toBe(true)
    })
    it('marks pieces draggable only when dragging is enabled', async () => {
        const board = await mount('position="start"')
        expect(square(board, 'e2').part.contains('draggable')).toBe(false)
        board.draggablePieces = true
        board.availableBoardPieces = 'e2 d2'
        await board.updateComplete
        expect(square(board, 'e2').part.contains('draggable')).toBe(true)
        expect(square(board, 'e1').part.contains('draggable')).toBe(false)
    })
})

describe('Overlay attributes', () => {
    it('colors squares with and without a color', async () => {
        const board = await mount('color-squares="a3 b3; c3 @red; d3 e3 blue"')
        expect(board.colorSquares).toEqual([
            { color: 'var(--preset-color-yellow)', square: 'a3' },
            { color: 'var(--preset-color-yellow)', square: 'b3' },
            { color: 'var(--preset-color-red)', square: 'c3' },
            { color: 'blue', square: 'd3' },
            { color: 'blue', square: 'e3' },
        ])
    })
    it('accepts single-letter color codes, as in PGN markup', async () => {
        const board = await mount('straight-arrows="e2 e4 G; d2 d4 @r; c2 c4 U; b2 b4 Q" color-squares="e4 R; d4 @y; c4 Q; b4"')
        const colors = [...board.shadowRoot!.querySelectorAll<SVGElement>('[part~="overlay-arrow"]')]
            .map((svg) => svg.style.color)
        expect(colors).toEqual(['rgb(0, 200, 0)', 'rgb(255, 0, 0)', 'rgb(140, 60, 220)', 'rgb(127, 127, 127)'])
        expect(board.colorSquares.map((c) => c.color)).toEqual([
            'var(--preset-color-red)',
            'var(--preset-color-yellow)',
            // An unknown code is grey, like an unknown preset name; no color at all is yellow.
            'var(--preset-color-grey)',
            'var(--preset-color-yellow)',
        ])
    })
    it('skips invalid overlay descriptions', async () => {
        const board = await mount('straight-arrows="e2 e4 @red; e2 x9 @red;  e7  e5  @blue" square-markers="a1 z9 x @red"')
        expect(board.straightArrows).toHaveLength(2)
        // A description with an invalid square is skipped as a whole.
        expect(board.squareMarkers).toHaveLength(0)
    })
    it('draws arrows according to the board orientation', async () => {
        const board = await mount('straight-arrows="a1 a2 @red"')
        const y1 = () => parseFloat(part(board, '[part~="overlay-arrow"] line')!.getAttribute('y1')!)
        // a1 is at the bottom of the board.
        expect(y1()).toBeGreaterThan(87.5)
        board.orientation = 'black'
        await board.updateComplete
        // a1 is at the top of the board.
        expect(y1()).toBeLessThan(12.5)
    })
    describe('arrow geometry', () => {
        /** The arrow's lines as numbers (percent of the board), and where its head's tip lands. */
        const lines = (board: ChessBoard) => [...board.shadowRoot!.querySelectorAll('[part~="overlay-arrow"] line')]
            .map((l) => ['x1', 'y1', 'x2', 'y2'].map((a) => parseFloat(l.getAttribute(a)!)))
        /** The tip: the head (half a square long) goes on beyond the end of the last line. */
        const tip = (board: ChessBoard, headSize = 0.5) => {
            const [x1, y1, x2, y2] = lines(board).at(-1)!
            const length = Math.hypot(x2 - x1, y2 - y1)
            const head = headSize*12.5
            return [x2 + (x2 - x1)/length*head, y2 + (y2 - y1)/length*head]
        }
        /** The square a point (percent of the board) is on, for white's orientation. */
        const squareAt = ([x, y]: number[]) => `${'abcdefgh'[Math.floor(x/12.5)]}${8 - Math.floor(y/12.5)}`

        it('gives a one-square arrow a shaft pointing at the target', async () => {
            const board = await mount('straight-arrows="e2 e3 @red"')
            const [[x1, y1, x2, y2]] = lines(board)
            expect(x2).toBeCloseTo(x1)
            // Upwards on the board, with a shaft at least as long as the line is wide.
            expect(y1 - y2).toBeGreaterThanOrEqual(0.2*12.5 - 1E-6)
            expect(squareAt(tip(board))).toBe('e3')
        })
        it('moves both ends of a short arrow towards the square centers by the same factor', async () => {
            const board = await mount('straight-arrows="e2 e3 @red"')
            const [[, y1]] = lines(board)
            // Distances from the centers of e2 and e3, in squares (e2's center is at 81.25%, e3's at 68.75%).
            const start = (81.25 - y1)/12.5
            const tipOffset = (tip(board)[1] - 68.75)/12.5
            // Both came in from the defaults (0.4 and 0.5), keeping their ratio.
            expect(start).toBeGreaterThan(0)
            expect(start).toBeLessThan(StraightArrow.START_OFFSET)
            expect(tipOffset).toBeLessThan(StraightArrow.TARGET_OFFSET)
            expect(start/tipOffset).toBeCloseTo(StraightArrow.START_OFFSET/StraightArrow.TARGET_OFFSET)
        })
        it('keeps an end that starts at the square center there', async () => {
            const defaultStart = StraightArrow.START_OFFSET
            StraightArrow.START_OFFSET = 0
            try {
                const board = await mount('straight-arrows="e2 e3 @red"')
                const [[, y1]] = lines(board)
                expect(y1).toBeCloseTo(81.25)
                expect(squareAt(tip(board))).toBe('e3')
            } finally {
                StraightArrow.START_OFFSET = defaultStart
            }
        })
        it('draws both legs of a knight-move arrow, the head reaching the target', async () => {
            const board = await mount('angled-arrows="g1 f3 @blue"')
            const [aLeg, bLeg] = lines(board)
            // The long leg up the g-file, then left towards f3.
            expect(aLeg[1] - aLeg[3]).toBeGreaterThan(12.5)
            expect(bLeg[0] - bLeg[2]).toBeGreaterThan(1)
            expect(bLeg[3]).toBeCloseTo(bLeg[1])
            expect(squareAt(tip(board))).toBe('f3')
            board.orientation = 'black'
            await board.updateComplete
            // f3 is now on the left side's third row from the top.
            const [x, y] = tip(board)
            expect(squareAt([100 - x, 100 - y])).toBe('f3')
        })
        it('draws straight knight-move arrows angled with angled-knight-arrows', async () => {
            const angled = await mount('angled-arrows="g1 f3 @blue"')
            const expected = lines(angled)
            const board = await mount('straight-arrows="g1 f3 @blue; e2 e4 @red" angled-knight-arrows')
            const drawn = lines(board)
            // The knight's two legs, then the pawn's straight arrow.
            expect(drawn).toHaveLength(3)
            drawn.slice(0, 2).forEach((line, i) => line.forEach((v, j) => expect(v).toBeCloseTo(expected[i][j])))
            expect(board.straightArrows[0]).toBeInstanceOf(StraightArrow)
            board.angledKnightArrows = false
            await board.updateComplete
            expect(lines(board)).toHaveLength(2)
        })
        it('sizes the head in squares, independently of the line width', async () => {
            const board = await mount('straight-arrows="a2 a6 @red"')
            const marker = () => board.shadowRoot!.querySelector('[part~="overlay-arrow"] marker')!
            // Line width 0.2 squares, head 0.5: 2.5 line widths.
            expect(parseFloat(marker().getAttribute('markerWidth')!)).toBeCloseTo(2.5)
            const arrow = board.straightArrows[0]!
            arrow.arrowSize = 0.1
            board.requestUpdate()
            await board.updateComplete
            expect(parseFloat(marker().getAttribute('markerWidth')!)).toBeCloseTo(5)
        })
        it('keeps a long arrow stopping at the edge of the target square', async () => {
            const board = await mount('straight-arrows="e2 e4 @green"')
            const [x, y] = tip(board)
            // Half a square short of e4's center: on the boundary between e3 and e4.
            expect(x).toBeCloseTo(56.25)
            expect(y).toBeCloseTo(62.5)
        })
    })
})

describe('Square labels and markers', () => {
    const svgs = (board: ChessBoard, partName: string) =>
        [...board.shadowRoot!.querySelectorAll<SVGElement>(`[part~="${partName}"]`)]

    it('reads text labels with their position, alignment and color', async () => {
        const board = await mount('square-labels="e4 t R: +1; d5 mc @blue: !?; a1 h1 bl: Rooks; c3 x: nope; f6 t G:"')
        expect(board.squareLabels.map((l) => [l.square, l.position, l.align, l.text])).toEqual([
            ['e4', 'top', 'right', '+1'],
            ['d5', 'middle', 'center', '!?'],
            ['a1', 'bottom', 'left', 'Rooks'],
            ['h1', 'bottom', 'left', 'Rooks'],
        ])
        const texts = svgs(board, 'overlay-label').map((svg) => svg.querySelector('text')!)
        expect(texts.map((t) => t.textContent)).toEqual(['+1', '!?', 'Rooks', 'Rooks'])
        expect(svgs(board, 'overlay-label')[0]!.style.color).toBe('rgb(255, 0, 0)')
        // Top right of e4: the right edge of the e-file, the top of the fourth rank (in board percents).
        const e4 = texts[0]!
        expect(e4.getAttribute('text-anchor')).toBe('end')
        expect(parseFloat(e4.getAttribute('x')!)).toBeLessThan(62.5)
        expect(parseFloat(e4.getAttribute('x')!)).toBeGreaterThan(56.25)
        expect(parseFloat(e4.getAttribute('y')!)).toBeGreaterThan(50)
        expect(parseFloat(e4.getAttribute('y')!)).toBeLessThan(56.25)
        expect(texts[1]!.getAttribute('text-anchor')).toBe('middle')
        expect(texts[1]!.getAttribute('dominant-baseline')).toBe('central')
    })
    it('draws labels as text, not markup', async () => {
        const board = await mount()
        board.squareLabels = [new SquareLabel('e4', '<b>bold</b>', 'R')]
        await board.updateComplete
        const text = svgs(board, 'overlay-label')[0]!.querySelector('text')!
        expect(text.textContent).toBe('<b>bold</b>')
        expect(text.querySelector('b')).toBeNull()
    })
    it('places labels for the board orientation', async () => {
        const board = await mount('square-labels="a1 tl G: x"')
        const x = () => parseFloat(svgs(board, 'overlay-label')[0]!.querySelector('text')!.getAttribute('x')!)
        expect(x()).toBeLessThan(12.5)
        board.orientation = 'black'
        await board.updateComplete
        // a1 is in the top right corner, the label at its left edge.
        expect(x()).toBeGreaterThan(87.5)
    })
    it('draws markers over or under the piece', async () => {
        const board = await mount('square-markers="e4 o G; d4 x R; c4 o+ B; b4 x- Y"')
        expect(board.squareMarkers.map((m) => m.layer)).toEqual(['under', 'over', 'over', 'under'])
        const z = svgs(board, 'overlay-marker').map((svg) => Number(svg.style.zIndex))
        // Pieces are at z-index 10.
        expect(z.map((v) => v > 10)).toEqual([false, true, true, false])
    })
    it('draws ghost pieces under the pieces, transparent to the pointer', async () => {
        const board = await mount('position="8/8/8/8/4P3/8/8/8" ghost-pieces="e2 wP; g1 f3 wN; c3 nope; e4 bQ"')
        expect(board.ghostPieces).toEqual({ e2: 'wP', g1: 'wN', f3: 'wN', e4: 'bQ' })
        const ghost = part(board, '[data-square="e2"] [part~="ghost-piece"]')!
        expect(ghost.getAttribute('piece')).toBe('wP')
        expect(ghost.querySelector('.piece-image')).not.toBeNull()
        const style = getComputedStyle(ghost)
        expect(style.opacity).toBe('0.5')
        expect(style.pointerEvents).toBe('none')
        // Under the piece on its own square (pieces are at z-index 10).
        expect(Number(style.zIndex)).toBeLessThan(10)
        expect(part(board, '[data-square="e4"] [part~="piece"]')!.getAttribute('piece')).toBe('wP')
        expect(part(board, '[data-square="c3"] [part~="ghost-piece"]')).toBeNull()
        board.ghostPieces = {}
        await board.updateComplete
        expect(part(board, '[part~="ghost-piece"]')).toBeNull()
    })
    it('passes a click on a ghost piece to its square', async () => {
        const board = await mount('ghost-pieces="e2 wP"')
        const click = nextEvent(board, 'square-click')
        const ghost = part(board, '[part~="ghost-piece"]')!
        const rect = ghost.getBoundingClientRect()
        const hit = board.shadowRoot!.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2)
        expect(hit?.closest('[part~="ghost-piece"]')).toBeNull()
        ;(hit as HTMLElement).click()
        expect((await click).square).toBe('e2')
    })
})

describe('Dragging', () => {
    it('drops a piece on a square', async () => {
        const board = await mount('position="start" draggable-pieces')
        const drop = nextEvent(board, 'drop')
        const snapEnd = nextEvent(board, 'snap-end')
        await drag(board, 'e2', 'e4')
        const detail = await drop
        expect(detail.source).toBe('e2')
        expect(detail.target).toBe('e4')
        await snapEnd
        expect(board.position.e4).toBe('wP')
        expect(board.position.e2).toBeUndefined()
    })
    it('finds the dropped square on a flipped board', async () => {
        const board = await mount('position="start" draggable-pieces orientation="black"')
        const drop = nextEvent(board, 'drop')
        await drag(board, 'e7', 'e5')
        expect((await drop).target).toBe('e5')
    })
    it('snaps back when the drop action is changed', async () => {
        const board = await mount('position="start" draggable-pieces')
        board.addEventListener('drop', (e) => e.detail.setAction('snapback'))
        const snapbackEnd = nextEvent(board, 'snapback-end')
        await drag(board, 'e2', 'e5')
        await snapbackEnd
        expect(board.position.e2).toBe('wP')
        expect(board.position.e5).toBeUndefined()
    })
    it('finishes a drop even when there is no transition', async () => {
        // A speed of 0 means no transition and no transitionend event.
        const board = await mount('position="start" draggable-pieces snap-speed="0" snapback-speed="0"')
        const snapEnd = nextEvent(board, 'snap-end', 500)
        await drag(board, 'g1', 'f3')
        await snapEnd
        const snapbackEnd = nextEvent(board, 'snapback-end', 500)
        await drag(board, 'f3', 'offboard')
        await snapbackEnd
        expect(board.position.f3).toBe('wN')
        // The board accepts new drags after the previous one has finished.
        const snapEnd2 = nextEvent(board, 'snap-end', 500)
        await drag(board, 'f3', 'g5')
        await snapEnd2
        expect(board.position.g5).toBe('wN')
    })
    it('ignores buttons other than the main button', async () => {
        const board = await mount('position="start" draggable-pieces')
        const dragStart = vi.fn()
        board.addEventListener('drag-start', dragStart)
        square(board, 'e2').dispatchEvent(pointer('pointerdown', center(board, 'e2'), { button: 2 }))
        expect(dragStart).not.toHaveBeenCalled()
    })
    it('returns the piece when the pointer is cancelled', async () => {
        const board = await mount('position="start" draggable-pieces')
        const drop = vi.fn()
        board.addEventListener('drop', drop)
        const snapbackEnd = nextEvent(board, 'snapback-end')
        square(board, 'e2').dispatchEvent(pointer('pointerdown', center(board, 'e2')))
        window.dispatchEvent(pointer('pointermove', center(board, 'e3')))
        window.dispatchEvent(pointer('pointercancel', center(board, 'e4')))
        await snapbackEnd
        expect(drop).not.toHaveBeenCalled()
        expect(board.position.e2).toBe('wP')
    })
    it('stops listening to the window when the drag ends or the board is removed', async () => {
        const board = await mount('position="start" draggable-pieces')
        const dragMove = vi.fn()
        board.addEventListener('drag-move', dragMove)
        const snapEnd = nextEvent(board, 'snap-end')
        await drag(board, 'e2', 'e4')
        await snapEnd
        dragMove.mockClear()
        // Start a new drag and remove the board in the middle of it.
        square(board, 'd2').dispatchEvent(pointer('pointerdown', center(board, 'd2')))
        board.remove()
        window.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 1 }))
        expect(dragMove).not.toHaveBeenCalled()
    })
    it('picks a piece up only after the pointer has moved past the drag threshold', async () => {
        const board = await mount('position="start" draggable-pieces')
        const dragStart = vi.fn()
        board.addEventListener('drag-start', dragStart)
        const at = center(board, 'e2')
        square(board, 'e2').dispatchEvent(pointer('pointerdown', at))
        window.dispatchEvent(pointer('pointermove', { clientX: at.clientX + 2, clientY: at.clientY + 2 }))
        expect(dragStart).not.toHaveBeenCalled()
        window.dispatchEvent(pointer('pointermove', { clientX: at.clientX + 4, clientY: at.clientY }))
        expect(dragStart).toHaveBeenCalledOnce()
    })
    it('leaves a clicked piece in place', async () => {
        const board = await mount('position="start" draggable-pieces')
        const dragStart = vi.fn()
        board.addEventListener('drag-start', dragStart)
        const at = center(board, 'e2')
        square(board, 'e2').dispatchEvent(pointer('pointerdown', at))
        window.dispatchEvent(pointer('pointermove', { clientX: at.clientX + 1, clientY: at.clientY }))
        window.dispatchEvent(pointer('pointerup', at))
        await board.updateComplete
        expect(dragStart).not.toHaveBeenCalled()
        expect(part(board, '[part~="dragged-piece"]')?.style.display).not.toBe('block')
        // The press is over: a later move picks nothing up.
        window.dispatchEvent(pointer('pointermove', center(board, 'e4')))
        expect(dragStart).not.toHaveBeenCalled()
        expect(board.position.e2).toBe('wP')
    })
    it('picks a piece up on press with a drag threshold of 0', async () => {
        const board = await mount('position="start" draggable-pieces drag-threshold="0"')
        const dragStart = vi.fn()
        board.addEventListener('drag-start', dragStart)
        square(board, 'e2').dispatchEvent(pointer('pointerdown', center(board, 'e2')))
        expect(dragStart).toHaveBeenCalledOnce()
    })
    it('fires square-click for clicked squares', async () => {
        const board = await mount('position="start"')
        const click = nextEvent(board, 'square-click')
        square(board, 'e4').click()
        expect(await click).toMatchObject({ square: 'e4', piece: false })
    })
})

describe('Positions and animations', () => {
    it('rejects invalid positions instead of clearing the board', async () => {
        const board = await mount('position="start"')
        expect(() => board.setPosition('not a fen')).toThrow()
        expect(board.position).toEqual(START_POSITION)
    })
    it('keeps a copy of the position it was given', async () => {
        const board = await mount()
        const position = { e4: 'wP' } as const
        board.setPosition(position, false)
        expect(board.position).not.toBe(position)
    })
    it('fires move-end after an animation, also when interrupted', async () => {
        const board = await mount('position="start" move-speed="50"')
        const moveEnds = [] as ChessboardEventDetail['move-end'][]
        board.addEventListener('move-end', (e) => moveEnds.push(e.detail))
        board.move('e2-e4')
        // Interrupt the first animation with a second one.
        board.move('e7-e5')
        await new Promise(resolve => setTimeout(resolve, 300))
        // Only the latest animation finishes.
        expect(moveEnds).toHaveLength(1)
        expect(moveEnds[0].newPosition.e5).toBe('bP')
        expect(board.position.e4).toBe('wP')
    })
    it('fires a change event', async () => {
        const board = await mount('position="start"')
        // Skip the change event from setting the initial position.
        await nextEvent(board, 'change')
        const change = nextEvent(board, 'change')
        board.move('g1-f3', false)
        const detail = await change
        expect(detail.oldFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
        expect(detail.newFen).toBe('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R')
    })
})

describe('Countdown', () => {
    const timerText = (board: ChessBoard, color: string) =>
        part(board, `[part~="timer-${color}"]`)!.textContent!.replace(/\s/g, '')

    it('counts down the player in turn only', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
        const board = await mount(
            'countdown turn="white" white-name="W" black-name="B" white-seconds="30" black-seconds="30"'
        )
        // The display updates just after the displayed second changes.
        await vi.advanceTimersByTimeAsync(5010)
        await board.updateComplete
        expect(timerText(board, 'white')).toBe('0:24.9')
        expect(timerText(board, 'black')).toBe('0:30.0')
        // The properties keep the value that was set.
        expect(board.whiteSeconds).toBe(30)
    })
    it('switches the countdown when the turn changes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
        const board = await mount(
            'countdown turn="white" white-name="W" black-name="B" white-seconds="30" black-seconds="30"'
        )
        await vi.advanceTimersByTimeAsync(5000)
        board.whiteSeconds = 25
        board.turn = 'black'
        await board.updateComplete
        await vi.advanceTimersByTimeAsync(3010)
        await board.updateComplete
        expect(timerText(board, 'white')).toBe('0:25.0')
        expect(timerText(board, 'black')).toBe('0:26.9')
    })
    it('stops at zero', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
        const board = await mount('countdown turn="black" black-name="B" black-seconds="2"')
        await vi.advanceTimersByTimeAsync(5000)
        await board.updateComplete
        expect(timerText(board, 'black')).toBe('0:00.0')
        expect(part(board, '[part~="timer-black"]')!.part.contains('timer-low')).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
    })
    it('stops ticking when the board is removed', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
        const board = await mount('countdown turn="black" black-name="B" black-seconds="60"')
        expect(vi.getTimerCount()).toBeGreaterThan(0)
        board.remove()
        expect(vi.getTimerCount()).toBe(0)
    })
})
