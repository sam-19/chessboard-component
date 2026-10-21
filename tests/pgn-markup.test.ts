import { describe, expect, it } from 'vitest'
import { parsePgnMarkup } from '../src/index.js'

describe('parsePgnMarkup', () => {
    it('reads arrows, colored squares, markers and labels', () => {
        const markup = parsePgnMarkup(
            'We will [%cal Rb2c3 "recapture"] and go for [%cal Gd2d4,Bg1f3] with [%csl Re4,Yd5] '
            + '[%ccl Gc6] [%cxl Rf7] [%ctl Ue4t+1,Gd5bEval -0.3]'
        )
        expect(markup.straightArrows.map((a) => [a.origin, a.target])).toEqual([['b2', 'c3'], ['d2', 'd4'], ['g1', 'f3']])
        expect(markup.colorSquares).toEqual([
            { color: 'var(--preset-color-red)', square: 'e4' },
            { color: 'var(--preset-color-yellow)', square: 'd5' },
        ])
        expect(markup.squareMarkers.map((m) => [m.square, m.type])).toEqual([['c6', 'circle'], ['f7', 'cross']])
        expect(markup.squareLabels.map((l) => [l.square, l.position, l.text])).toEqual([
            ['e4', 'top', '+1'],
            ['d5', 'bottom', 'Eval -0.3'],
        ])
    })
    it('lets a later entry replace an earlier one on the same square', () => {
        const markup = parsePgnMarkup('[%csl Re4] [%csl Ge4] [%ctl Re4tA] [%ctl Ge4tB,Ge4bC]')
        expect(markup.colorSquares).toEqual([{ color: 'var(--preset-color-green)', square: 'e4' }])
        expect(markup.squareLabels.map((l) => l.text)).toEqual(['B', 'C'])
    })
    it('skips entries it cannot read', () => {
        const markup = parsePgnMarkup('[%cal Ge2,Gz9e4,Ge2e2] [%csl e4] [%ctl Re4] [%clk 0:01:00] plain text')
        expect(markup).toEqual({ colorSquares: [], squareLabels: [], squareMarkers: [], straightArrows: [] })
    })
})
