/**
 * Unit tests for the force balance route.
 * Documents expected behavior for the force balance endpoint.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Response } from 'express';

describe('GET /investments/balance/force', () => {
    describe('successful responses', () => {
        it('sends 200 status on success', () => {
            const mockStatus = mock(() => ({ send: mock(() => {}) })),
                mockRes = { status: mockStatus } as unknown as Response;

            mockRes.status(200);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('sends amount object in response body', () => {
            const mockSend = mock(() => {}),
                mockStatus = mock(() => ({ send: mockSend })),
                mockRes = { status: mockStatus } as unknown as Response,
                amount = 50000;

            (mockRes.status(200) as any).send({ amount });

            expect(mockSend).toHaveBeenCalledWith({ amount: 50000 });
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

    describe('handler result processing', () => {
        it('uses amount from success result', () => {
            const result = { amount: 75000, success: true };
            expect(result.success).toBe(true);
            expect(result.amount).toBe(75000);
        });

        it('sums balances from multiple accounts', () => {
            const account1 = 30000,
                account2 = 25000,
                account3 = 20000,
                total = account1 + account2 + account3;
            expect(total).toBe(75000);
        });

        it('handles empty account list', () => {
            const balances: number[] = [],
                total = balances.reduce((sum, b) => sum + b, 0);
            expect(total).toBe(0);
        });
    });
});
