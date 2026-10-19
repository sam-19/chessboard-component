import { describe, expect, it } from 'vitest'
import {
    START_FEN,
    START_POSITION,
    calculatePositionFromMoves,
    fenToObj,
    getSquareColor,
    interpolateTemplate,
    isValidFen,
    isValidPieceCode,
    isValidPositionObject,
    isValidSquare,
    normalizePosition,
    objToFen,
    parsePieceList,
    parseSquareList,
} from '../src/utils/index.js'

describe('Utilities', () => {
    it('interpolates templates', () => {
        expect(interpolateTemplate('abc', { a: 'x' })).toBe('abc')
        expect(interpolateTemplate('{a}bc', {})).toBe('{a}bc')
        expect(interpolateTemplate('{a}bc{a}bc', { a: 'x' })).toBe('xbcxbc')
        expect(interpolateTemplate('{a}{a}{b}', { a: 'x', b: 'y' })).toBe('xxy')
    })
    it('validates squares and piece codes', () => {
        expect(isValidSquare('a1')).toBe(true)
        expect(isValidSquare('f6')).toBe(true)
        for (const bad of ['D2', 'g9', 'a', true, null, {}]) {
            expect(isValidSquare(bad)).toBe(false)
        }
        expect(isValidPieceCode('bP')).toBe(true)
        expect(isValidPieceCode('wK')).toBe(true)
        for (const bad of ['WR', 'Wr', 'a', true, null, {}]) {
            expect(isValidPieceCode(bad)).toBe(false)
        }
    })
    it('gets square colors', () => {
        expect(getSquareColor('a1')).toBe('black')
        expect(getSquareColor('h1')).toBe('white')
        expect(getSquareColor('d8')).toBe('black')
        expect(getSquareColor('e4')).toBe('white')
    })
    it('validates FEN strings', () => {
        expect(isValidFen(START_FEN)).toBe(true)
        expect(isValidFen('8/8/8/8/8/8/8/8')).toBe(true)
        expect(isValidFen('3r3r/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1')).toBe(true)
        expect(isValidFen('3r3z/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1')).toBe(false)
        expect(isValidFen('anbqkbnr/8/8/8/8/8/PPPPPPPP/8')).toBe(false)
        expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/')).toBe(false)
        expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN')).toBe(false)
        expect(isValidFen('888888/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toBe(false)
        expect(isValidFen({})).toBe(false)
    })
    it('validates position objects', () => {
        expect(isValidPositionObject({})).toBe(true)
        expect(isValidPositionObject({ e2: 'wP', d2: 'wP' })).toBe(true)
        for (const bad of [{ e2: 'BP' }, { y2: 'wP' }, null, undefined, 1, 'start', START_FEN]) {
            expect(isValidPositionObject(bad)).toBe(false)
        }
    })
    it('converts between FEN and position objects', () => {
        expect(objToFen(START_POSITION)).toBe(START_FEN)
        expect(objToFen({})).toBe('8/8/8/8/8/8/8/8')
        expect(objToFen({ a2: 'wP', b2: 'bP' })).toBe('8/8/8/8/8/8/Pp6/8')
        expect(fenToObj('8/8/8/8/8/5n2/8/8 w - - 0 1')).toEqual({ f3: 'bN' })
    })
    it('normalizes a position into a copy', () => {
        const position = { e4: 'wP' } as const
        const normalized = normalizePosition(position)
        expect(normalized).toEqual(position)
        expect(normalized).not.toBe(position)
        expect(normalizePosition('start')).toEqual(START_POSITION)
        expect(normalizePosition('invalid')).toEqual({})
    })
    it('parses square and piece lists', () => {
        expect([...parseSquareList('e2 E4,a1h8')]).toEqual(['e2', 'e4', 'a1', 'h8'])
        expect([...parsePieceList('wP bk')]).toEqual(['wP', 'bK'])
        // A continuous list must not match codes that span two items ("wB" followed by "bK" contains "bb").
        expect(parsePieceList('wBbK').has('bB')).toBe(false)
    })
    it('calculates positions from moves given in any order', () => {
        const position = { a1: 'wR', a2: 'wP', e1: 'wK', h1: 'wR' } as const
        expect(calculatePositionFromMoves(position, { e1: 'g1', h1: 'f1' }))
            .toEqual({ a1: 'wR', a2: 'wP', g1: 'wK', f1: 'wR' })
        // A piece moving away from a square that another piece moves to.
        expect(calculatePositionFromMoves(position, { a1: 'a2', a2: 'a3' }))
            .toEqual({ a2: 'wR', a3: 'wP', e1: 'wK', h1: 'wR' })
        // Moves from empty squares are skipped.
        expect(calculatePositionFromMoves(position, { b1: 'b2' })).toEqual(position)
    })
})
