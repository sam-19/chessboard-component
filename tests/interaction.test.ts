import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import '../src/index.js'
import type { ChessBoard } from '../src/index.js'

const mount = async (attributes = '', width = 400) => {
    const c = document.createElement('div')
    c.style.width = `${width}px`
    c.innerHTML = `<chess-board ${attributes}></chess-board>`
    document.body.append(c)
    const b = c.querySelector('chess-board')!
    await b.updateComplete
    await new Promise(r => requestAnimationFrame(r))
    await b.updateComplete
    return b
}
const sq = (b: ChessBoard, s: string) => b.shadowRoot!.querySelector<HTMLElement>(`[data-square="${s}"]`)!
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
afterEach(() => document.body.replaceChildren())

// Interactions with real (Playwright) input, and regressions found in review.
describe('Interactions', () => {
    it('fires square-click when a draggable piece is clicked', async () => {
        const b = await mount('position="start" draggable-pieces')
        const clicks: string[] = []
        b.addEventListener('square-click', e => clicks.push(e.detail.square))
        await userEvent.click(sq(b, 'e2'))
        await wait(300)
        expect(clicks).toEqual(['e2'])
    })
    it('moves a piece with a real drag', async () => {
        const b = await mount('position="start" draggable-pieces')
        await userEvent.dragAndDrop(sq(b, 'e2'), sq(b, 'e4'))
        await wait(300)
        expect(b.position.e4).toBe('wP')
    })
    it('animates a piece added to a draggable board without spare pieces', async () => {
        const b = await mount('position="8/4P3/8/8/8/8/8/K6k" draggable-pieces')
        const errors: unknown[] = []
        window.addEventListener('error', e => errors.push(e.message))
        b.setPosition('4Q3/8/8/8/8/8/8/K6k')
        await wait(400)
        await b.updateComplete
        expect(errors).toEqual([])
        expect(sq(b, 'e8').querySelector('[piece]')?.getAttribute('piece')).toBe('wQ')
    })
    it('stops a running animation when the position is set without one', async () => {
        const b = await mount('position="start" move-speed="200"')
        const ends: unknown[] = []
        b.addEventListener('move-end', e => ends.push(e.detail))
        b.setPosition('8/8/8/8/8/8/8/K6k')
        b.setPosition('start', false)
        await wait(20)
        await b.updateComplete
        // No ghost pieces from the cleared position should remain beyond the real position.
        const rendered = [...b.shadowRoot!.querySelectorAll('[part~="square"] [piece]')].length
        expect(rendered).toBe(32)
        await wait(400)
        expect(ends).toEqual([])
    })
    it('accepts overlay colors with commas and dashes', async () => {
        const b = await mount('color-squares="a3 rgb(255, 0, 0); b3 var(--x)" straight-arrows="e2 e4 rgb(0, 0, 255)"')
        expect(b.colorSquares).toEqual([{ color: 'rgb(255, 0, 0)', square: 'a3' }, { color: 'var(--x)', square: 'b3' }])
        expect(b.straightArrows).toHaveLength(1)
    })
    it('finds the drop square on a scaled board', async () => {
        const b = await mount('position="start" draggable-pieces')
        b.parentElement!.style.transform = 'scale(0.5)'
        b.parentElement!.style.transformOrigin = '0 0'
        const drops: string[] = []
        b.addEventListener('drop', e => drops.push(e.detail.target))
        await userEvent.dragAndDrop(sq(b, 'b1'), sq(b, 'c3'))
        await wait(300)
        expect(drops).toEqual(['c3'])
    })
    it('resizes without ResizeObserver loop errors', async () => {
        const errors: string[] = []
        const h = (e: ErrorEvent) => errors.push(e.message)
        window.addEventListener('error', h)
        const b = await mount('position="start" white-name="W" black-name="B"')
        b.parentElement!.style.width = '300px'
        await wait(200)
        b.parentElement!.style.width = '500px'
        await wait(200)
        window.removeEventListener('error', h)
        expect(errors).toEqual([])
    })
})
