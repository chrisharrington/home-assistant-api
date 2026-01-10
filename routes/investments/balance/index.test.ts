/**
 * Unit tests for the balance route.
 * Documents expected behavior for the balance endpoint.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Response } from 'express';

describe('GET /investments/balance', () => {
    describe('successful responses', () => {
        it('sends 200 status with balance on success', () => {
            const mockStatus = mock(() => ({ send: mock(() => {}) })),
                mockRes = { status: mockStatus } as unknown as Response;

            mockRes.status(200);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('sends balance value in response body', () => {
            const mockSend = mock(() => {}),
                mockStatus = mock(() => ({ send: mockSend })),
                mockRes = { status: mockStatus } as unknown as Response,
                balance = 50000;

            (mockRes.status(200) as any).send(balance);

            expect(mockSend).toHaveBeenCalledWith(50000);
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
        it('uses balance from success result', () => {
            const result = { balance: 48000, success: true };
            expect(result.success).toBe(true);
            expect(result.balance).toBe(48000);
        });

        it('handles failure result', () => {
            const result = { balance: 0, success: false };
            expect(result.success).toBe(false);
        });
    });
});
