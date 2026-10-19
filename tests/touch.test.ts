import { afterEach, expect, it } from 'vitest'
import { cdp } from 'vitest/browser'
import '../src/index.js'
import type { ChessBoard } from '../src/index.js'

const mount = async (attributes = '') => {
    const c = document.createElement('div')
    c.style.width = '400px'
    c.innerHTML = `<chess-board ${attributes}></chess-board>`
    document.body.append(c)
    const b = c.querySelector('chess-board')!
    await b.updateComplete
    await new Promise(r => requestAnimationFrame(r))
    await b.updateComplete
    return b
}
const center = (b: ChessBoard, s: string) => {
    const r = b.shadowRoot!.querySelector(`[data-square="${s}"]`)!.getBoundingClientRect()
    return { x: r.left + r.width/2, y: r.top + r.height/2 }
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number, y: number }) => {
    await cdp().send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] })
}
afterEach(() => document.body.replaceChildren())

// Real touch input through the Chrome DevTools Protocol.
it('taps a draggable piece', async () => {
    const b = await mount('position="start" draggable-pieces')
    const clicks: string[] = []
    b.addEventListener('square-click', e => clicks.push(e.detail.square))
    await touch('touchStart', center(b, 'e2'))
    await touch('touchEnd')
    await wait(300)
    expect(clicks).toEqual(['e2'])
})
it('drags with touch', async () => {
    const b = await mount('position="start" draggable-pieces')
    const clicks: string[] = []
    const drops: string[] = []
    b.addEventListener('square-click', e => clicks.push(e.detail.square))
    b.addEventListener('drop', e => drops.push(e.detail.target))
    const from = center(b, 'e2'), to = center(b, 'e4')
    await touch('touchStart', from)
    for (let i = 1; i <= 5; i++) {
        await touch('touchMove', { x: from.x, y: from.y + (to.y - from.y)*i/5 })
    }
    await touch('touchEnd')
    await wait(300)
    expect(drops).toEqual(['e4'])
    expect(clicks).toEqual([])
    expect(b.position.e4).toBe('wP')
})
