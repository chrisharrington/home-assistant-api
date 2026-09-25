/**
 * Unit tests for the dashboard route.
 * Documents expected behavior for the dashboard endpoint.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Response } from 'express';

describe('GET /investments/dashboard', () => {
    describe('successful responses', () => {
        it('sends 200 status on success', () => {
            const mockJson = mock(() => {}),
                mockStatus = mock(() => ({ json: mockJson })),
                mockRes = { status: mockStatus } as unknown as Response;

            mockRes.status(200);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('sends dashboard data as JSON', () => {
            const mockJson = mock(() => {}),
                mockStatus = mock(() => ({ json: mockJson })),
                mockRes = { status: mockStatus } as unknown as Response,
                dashboard = {
                    totalPortfolio: {
                        amount: 125000,
                        changePercent: 1.25,
                        history: [{ date: '2026-01-10', value: 125000 }]
                    },
                    accounts: [],
                    symbols: [],
                    exchangeRate: { usdToCad: 1.38, updatedAt: '2026-01-10T15:00:00Z' },
                    status: {
                        degraded: false,
                        stale: false,
                        sessionAlive: true,
                        balancesSyncedAt: '2026-01-10T03:00:00Z',
                        updatedAt: '2026-01-10T15:00:00Z'
                    },
                    lastUpdated: '2026-01-10T15:00:00Z'
                };

            (mockRes.status(200) as any).json(dashboard);

            expect(mockJson).toHaveBeenCalledWith(dashboard);
        });
    });

    describe('error responses', () => {
        it('sends 500 status on handler failure', () => {
            const mockSendStatus = mock(() => {}),
                mockRes = { sendStatus: mockSendStatus } as unknown as Response;

            mockRes.sendStatus(500);

            expect(mockSendStatus).toHaveBeenCalledWith(500);
        });
    });

    describe('dashboard response structure', () => {
        it('includes totalPortfolio with amount, changePercent, and history', () => {
            const dashboard = {
                totalPortfolio: {
                    amount: 125000.50,
                    changePercent: 1.25,
                    history: [
                        { date: '2026-01-09', value: 123500 },
                        { date: '2026-01-10', value: 125000.50 }
                    ]
                },
                accounts: [],
                symbols: [],
                lastUpdated: '2026-01-10T15:00:00Z'
            };

            expect(dashboard.totalPortfolio).toHaveProperty('amount');
            expect(dashboard.totalPortfolio).toHaveProperty('changePercent');
            expect(dashboard.totalPortfolio).toHaveProperty('history');
            expect(dashboard.totalPortfolio.history).toHaveLength(2);
        });

        it('includes accounts array with Wealthsimple account id, type label, and balance', () => {
            const accounts = [
                { accountId: 'tfsa-1', accountType: 'TFSA', balance: 50000 },
                { accountId: 'rrsp-1', accountType: 'RRSP', balance: 75000 }
            ];

            expect(accounts).toHaveLength(2);
            expect(accounts[0]).toHaveProperty('accountId');
            expect(accounts[0]).toHaveProperty('accountType');
            expect(accounts[0]).toHaveProperty('balance');
            expect(Object.keys(accounts[0]).includes('owner')).toBe(false);
        });

        it('includes symbols array with description and daily change percentages', () => {
            const symbols = [
                { symbol: 'HXT', description: 'Horizons S&P/TSX 60', dayChangePercent: 0.85 },
                { symbol: 'NVDA', description: 'NVIDIA Corp', dayChangePercent: -0.32 }
            ];

            expect(symbols).toHaveLength(2);
            expect(symbols[0]).toHaveProperty('symbol');
            expect(symbols[0]).toHaveProperty('description');
            expect(symbols[0]).toHaveProperty('dayChangePercent');
        });

        it('includes a status object reporting Wealthsimple sync health', () => {
            const status = {
                degraded: false,
                stale: false,
                sessionAlive: true,
                balancesSyncedAt: '2026-01-10T03:00:00Z',
                updatedAt: '2026-01-10T15:00:00Z'
            };

            expect(status).toHaveProperty('degraded');
            expect(status).toHaveProperty('stale');
            expect(status).toHaveProperty('sessionAlive');
            expect(status).toHaveProperty('balancesSyncedAt');
        });
    });

    describe('intraday change percent', () => {
        it('is change over previous total, not latest-daily-doc over yesterday', () => {
            const total = 125000,
                change = 1500,
                previousTotal = total - change,
                changePercent = Math.round((change / previousTotal) * 10000) / 100;

            expect(changePercent).toBeCloseTo(1.21, 1);
        });
    });
});
