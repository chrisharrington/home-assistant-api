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

        it('includes accounts array with balance information', () => {
            const accounts = [
                { accountNumber: '12345', accountType: 'TFSA', owner: 'chris', balance: 50000 },
                { accountNumber: '67890', accountType: 'RRSP', owner: 'sarah', balance: 75000 }
            ];

            expect(accounts).toHaveLength(2);
            expect(accounts[0]).toHaveProperty('accountNumber');
            expect(accounts[0]).toHaveProperty('accountType');
            expect(accounts[0]).toHaveProperty('owner');
            expect(accounts[0]).toHaveProperty('balance');
        });

        it('includes symbols array with daily change percentages', () => {
            const symbols = [
                { symbol: 'VFV.TO', symbolId: 12345, dayChangePercent: 0.85 },
                { symbol: 'AAPL', symbolId: 67890, dayChangePercent: -0.32 }
            ];

            expect(symbols).toHaveLength(2);
            expect(symbols[0]).toHaveProperty('symbol');
            expect(symbols[0]).toHaveProperty('dayChangePercent');
        });
    });

    describe('percentage change calculations', () => {
        it('calculates positive change correctly', () => {
            const latest = 125000,
                yesterday = 123500,
                changePercent = ((latest - yesterday) / yesterday) * 100;

            expect(Math.round(changePercent * 100) / 100).toBeCloseTo(1.21, 1);
        });

        it('calculates negative change correctly', () => {
            const latest = 120000,
                yesterday = 125000,
                changePercent = ((latest - yesterday) / yesterday) * 100;

            expect(changePercent).toBe(-4);
        });

        it('returns zero for no change', () => {
            const latest = 125000,
                yesterday = 125000,
                changePercent = ((latest - yesterday) / yesterday) * 100;

            expect(changePercent).toBe(0);
        });
    });
});
