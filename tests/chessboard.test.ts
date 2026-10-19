import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChessBoard, START_POSITION, type BoardSquare, type ChessboardEventDetail } from '../src/index.js'

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
