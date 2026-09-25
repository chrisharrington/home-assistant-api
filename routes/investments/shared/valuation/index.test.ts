/**
 * Unit tests for the pure investment valuation math: per-account pricing
 * with fallbacks, and portfolio-level totals and intraday change. Account
 * classification/labeling is tested in ./classify/index.test.ts.
 */

import { describe, it, expect } from 'bun:test';
import { valuateAccount, valuatePortfolio, AccountValuationInput, Quote } from './index';

describe('valuateAccount', () => {
    it('prices a position from a live quote and includes cash', () => {
        const account: AccountValuationInput = {
                accountId: 'tfsa-1',
                cash: { cad: 100, usd: 0 },
                holdingsValue: { cad: 0, usd: 0 },
                positions: [{ securityId: 'sec-1', quantity: 10, symbol: 'HXT', yahooSymbol: 'HXT.TO', currency: 'CAD', syncPrice: 45 }]
            },
            quotes = new Map<string, Quote>([['HXT.TO', { price: 50, previousClose: 49 }]]),
            result = valuateAccount(account, quotes, 1.35);

        expect(result.balance).toBe(100 + 10 * 50);
        expect(result.changeCad).toBeCloseTo(10 * (50 - 49), 5);
        expect(result.degraded).toBe(false);
        expect(result.degradedSymbols).toEqual([]);
    });

    it('converts USD cash and USD-priced positions to CAD', () => {
        const account: AccountValuationInput = {
                accountId: 'non-registered-1',
                cash: { cad: 0, usd: 100 },
                holdingsValue: { cad: 0, usd: 0 },
                positions: [{ securityId: 'sec-nvda', quantity: 2, symbol: 'NVDA', yahooSymbol: 'NVDA', currency: 'USD', syncPrice: 900 }]
            },
            quotes = new Map<string, Quote>([['NVDA', { price: 1000, previousClose: 950 }]]),
            fx = 1.4,
            result = valuateAccount(account, quotes, fx);

        expect(result.balance).toBeCloseTo(100 * fx + 2 * 1000 * fx, 5);
        expect(result.changeCad).toBeCloseTo(2 * (1000 - 950) * fx, 5);
    });

    it('falls back to the Wealthsimple sync-time price when no live quote is available, and flags degraded', () => {
        const account: AccountValuationInput = {
                accountId: 'rrsp-1',
                cash: { cad: 0, usd: 0 },
                holdingsValue: { cad: 999, usd: 0 },
                positions: [{ securityId: 'sec-2', quantity: 5, symbol: 'QQC', yahooSymbol: null, currency: 'CAD', syncPrice: 40 }]
            },
            result = valuateAccount(account, new Map(), 1.35);

        expect(result.balance).toBe(5 * 40);
        expect(result.changeCad).toBe(0);
        expect(result.degraded).toBe(true);
        expect(result.degradedSymbols).toEqual(['QQC']);
    });

    it('falls back to the account holdings value when a position has neither a live quote nor a sync price', () => {
        const account: AccountValuationInput = {
                accountId: 'rrsp-1',
                cash: { cad: 10, usd: 0 },
                holdingsValue: { cad: 1000, usd: 50 },
                positions: [{ securityId: 'sec-3', quantity: 5, symbol: null, yahooSymbol: null, currency: 'CAD', syncPrice: null }]
            },
            fx = 1.3,
            result = valuateAccount(account, new Map(), fx);

        expect(result.balance).toBeCloseTo(10 + 1000 + 50 * fx, 5);
        expect(result.degraded).toBe(true);
        expect(result.degradedSymbols).toEqual(['sec-3']);
    });

    it('assigns the correct display label from the account id', () => {
        const account: AccountValuationInput = {
                accountId: 'spousal-rrsp-1',
                cash: { cad: 0, usd: 0 },
                holdingsValue: { cad: 0, usd: 0 },
                positions: []
            },
            result = valuateAccount(account, new Map(), 1.35);

        expect(result.label).toBe('Spousal RRSP');
    });
});

describe('valuatePortfolio', () => {
    it('sums balances and change across accounts, and computes changePercent against the previous total', () => {
        const accounts: AccountValuationInput[] = [
                {
                    accountId: 'tfsa-1',
                    cash: { cad: 0, usd: 0 },
                    holdingsValue: { cad: 0, usd: 0 },
                    positions: [{ securityId: 'sec-1', quantity: 10, symbol: 'HXT', yahooSymbol: 'HXT.TO', currency: 'CAD', syncPrice: null }]
                },
                {
                    accountId: 'rrsp-1',
                    cash: { cad: 500, usd: 0 },
                    holdingsValue: { cad: 0, usd: 0 },
                    positions: []
                }
            ],
            quotes = new Map<string, Quote>([['HXT.TO', { price: 50, previousClose: 49 }]]),
            result = valuatePortfolio(accounts, quotes, 1.35);

        expect(result.totalCad).toBe(10 * 50 + 500);
        expect(result.changeCad).toBeCloseTo(10 * (50 - 49), 5);
        // changePercent = change / (total - change) * 100.
        const expectedPreviousTotal = result.totalCad - result.changeCad,
            expectedPercent = Math.round((result.changeCad / expectedPreviousTotal) * 10000) / 100;
        expect(result.changePercent).toBe(expectedPercent);
        expect(result.degraded).toBe(false);
        expect(result.accounts).toHaveLength(2);
    });

    it('is degraded if any account is degraded, and de-duplicates degraded symbols', () => {
        const accounts: AccountValuationInput[] = [
                {
                    accountId: 'tfsa-1',
                    cash: { cad: 0, usd: 0 },
                    holdingsValue: { cad: 100, usd: 0 },
                    positions: [{ securityId: 'sec-1', quantity: 1, symbol: 'QQC', yahooSymbol: null, currency: 'CAD', syncPrice: null }]
                },
                {
                    accountId: 'rrsp-1',
                    cash: { cad: 0, usd: 0 },
                    holdingsValue: { cad: 100, usd: 0 },
                    positions: [{ securityId: 'sec-1', quantity: 1, symbol: 'QQC', yahooSymbol: null, currency: 'CAD', syncPrice: null }]
                }
            ],
            result = valuatePortfolio(accounts, new Map(), 1.35);

        expect(result.degraded).toBe(true);
        expect(result.degradedSymbols).toEqual(['QQC']);
    });

    it('returns zero changePercent when the previous total is zero', () => {
        const result = valuatePortfolio([], new Map(), 1.35);

        expect(result.totalCad).toBe(0);
        expect(result.changePercent).toBe(0);
    });
});
