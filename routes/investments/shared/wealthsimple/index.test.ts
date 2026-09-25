/**
 * Unit tests for the wealthsimple-api client's response shapes.
 * The client itself is a thin authenticated fetch wrapper with no branching
 * logic to unit test in isolation (see CLAUDE.md - first-party network
 * clients aren't mocked here); these document the contracts the rest of the
 * investments module relies on.
 */

import { describe, it, expect } from 'bun:test';
import { WealthsimpleStatus, WealthsimpleBalanceResponse, WealthsimplePositionsResponse } from './index';

describe('wealthsimple-api response contracts', () => {
    it('WealthsimpleStatus carries session and balances-job sync state', () => {
        const example: WealthsimpleStatus = {
            session: { alive: true, reason: null },
            jobs: { balances: { lastSyncedAt: '2026-09-25T03:00:00.000Z' } }
        };

        expect(example.session).toHaveProperty('alive');
        expect(example.jobs.balances).toHaveProperty('lastSyncedAt');
    });

    it('WealthsimpleBalanceResponse carries per-account cash and holdings value in CAD/USD', () => {
        const example: WealthsimpleBalanceResponse = {
            accounts: [
                {
                    accountId: 'tfsa-1',
                    cash: { cad: 100, usd: 0 },
                    holdingsValue: { cad: 5000, usd: 0 },
                    total: { cad: 5100, usd: 0 }
                }
            ],
            total: { cad: 5100, usd: 0 },
            syncedAt: '2026-09-25T03:00:00.000Z'
        };

        expect(example.accounts[0]).toHaveProperty('cash');
        expect(example.accounts[0]).toHaveProperty('holdingsValue');
    });

    it('WealthsimplePositionsResponse carries per-account positions with symbol/MIC/price', () => {
        const example: WealthsimplePositionsResponse = {
            accounts: [
                {
                    accountId: 'tfsa-1',
                    positions: [
                        {
                            securityId: 'sec-1',
                            quantity: 10,
                            symbol: 'HXT',
                            name: 'Horizons S&P/TSX 60',
                            primaryExchange: 'TSX',
                            primaryMic: 'XTSE',
                            price: 45.5,
                            currency: 'CAD'
                        }
                    ]
                }
            ],
            syncedAt: '2026-09-25T03:00:00.000Z'
        };

        expect(example.accounts[0].positions[0]).toHaveProperty('primaryMic');
        expect(example.accounts[0].positions[0]).toHaveProperty('price');
    });
});
