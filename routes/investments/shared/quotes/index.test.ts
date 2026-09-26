/**
 * Unit tests for the Yahoo Finance quote client's pure pieces: MIC-to-symbol
 * mapping and chart response parsing. Parsing is tested against sample JSON
 * rather than by mocking the network call.
 */

import { describe, it, expect } from 'bun:test';
import { resolveYahooSymbol, parseYahooChartResponse, localDate } from './index';

describe('resolveYahooSymbol', () => {
    it('maps XTSE to a .TO suffix', () => {
        expect(resolveYahooSymbol('HXT', 'XTSE')).toBe('HXT.TO');
    });

    it('maps XTSX to a .V suffix', () => {
        expect(resolveYahooSymbol('ABC', 'XTSX')).toBe('ABC.V');
    });

    it('maps NEOE and XNEO to a .NE suffix', () => {
        expect(resolveYahooSymbol('ABC', 'NEOE')).toBe('ABC.NE');
        expect(resolveYahooSymbol('ABC', 'XNEO')).toBe('ABC.NE');
    });

    it('maps XCNQ to a .CN suffix', () => {
        expect(resolveYahooSymbol('ABC', 'XCNQ')).toBe('ABC.CN');
    });

    it('maps US exchanges to no suffix', () => {
        expect(resolveYahooSymbol('NVDA', 'XNAS')).toBe('NVDA');
        expect(resolveYahooSymbol('NVDA', 'XNYS')).toBe('NVDA');
        expect(resolveYahooSymbol('NVDA', 'ARCX')).toBe('NVDA');
        expect(resolveYahooSymbol('NVDA', 'BATS')).toBe('NVDA');
        expect(resolveYahooSymbol('NVDA', 'XASE')).toBe('NVDA');
    });

    it('returns null for an unmapped MIC', () => {
        expect(resolveYahooSymbol('ABC', 'XLON')).toBeNull();
    });

    it('returns null when the symbol is missing', () => {
        expect(resolveYahooSymbol(null, 'XTSE')).toBeNull();
    });

    it('returns null when the MIC is missing', () => {
        expect(resolveYahooSymbol('HXT', null)).toBeNull();
    });
});

describe('parseYahooChartResponse', () => {
    it('extracts price and previous close from a valid response', () => {
        const json = {
            chart: {
                result: [{ meta: { regularMarketPrice: 42.5, chartPreviousClose: 41.75, currency: 'CAD' } }]
            }
        };

        expect(parseYahooChartResponse(json)).toEqual({ price: 42.5, previousClose: 41.75 });
    });

    // Friday 2026-09-25 16:00 EDT close.
    const fridayClose = Date.UTC(2026, 8, 25, 20, 0) / 1000,
        closedJson = {
            chart: {
                result: [{
                    meta: {
                        regularMarketPrice: 45.97,
                        chartPreviousClose: 45.71,
                        regularMarketTime: fridayClose,
                        exchangeTimezoneName: 'America/Toronto'
                    }
                }]
            }
        };

    it('keeps the previous close when the last trade was today', () => {
        const fridayEvening = new Date('2026-09-25T23:00:00Z');
        expect(parseYahooChartResponse(closedJson, fridayEvening)).toEqual({ price: 45.97, previousClose: 45.71 });
    });

    it('reports no change when the last trade was on an earlier day', () => {
        const saturday = new Date('2026-09-26T15:00:00Z');
        expect(parseYahooChartResponse(closedJson, saturday)).toEqual({ price: 45.97, previousClose: 45.97 });
    });

    it('compares dates in the exchange timezone, not UTC', () => {
        // 2026-09-26 01:00 UTC is still Friday evening in Toronto.
        const fridayLateUtc = new Date('2026-09-26T01:00:00Z');
        expect(parseYahooChartResponse(closedJson, fridayLateUtc)).toEqual({ price: 45.97, previousClose: 45.71 });
    });

    it('returns null when the result array is empty', () => {
        expect(parseYahooChartResponse({ chart: { result: [] } })).toBeNull();
    });

    it('returns null when meta fields are missing', () => {
        expect(parseYahooChartResponse({ chart: { result: [{ meta: {} }] } })).toBeNull();
    });

    it('returns null for a malformed response', () => {
        expect(parseYahooChartResponse({})).toBeNull();
        expect(parseYahooChartResponse(null)).toBeNull();
        expect(parseYahooChartResponse(undefined)).toBeNull();
    });
});

describe('localDate', () => {
    it('formats the calendar date in the given timezone', () => {
        const instant = new Date('2026-09-26T03:00:00Z');
        expect(localDate(instant, 'America/Edmonton')).toBe('2026-09-25');
        expect(localDate(instant, 'UTC')).toBe('2026-09-26');
    });
});
