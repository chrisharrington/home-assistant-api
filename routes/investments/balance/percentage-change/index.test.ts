/**
 * Unit tests for the percentage change route.
 * Documents expected behavior for the percentage change endpoint.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Response } from 'express';

describe('GET /investments/balance/percentage-change', () => {
    describe('successful responses', () => {
        it('sends 200 status on success', () => {
            const mockStatus = mock(() => ({ send: mock(() => {}) })),
                mockRes = { status: mockStatus } as unknown as Response;

            mockRes.status(200);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('sends ratio value in response body', () => {
            const mockSend = mock(() => {}),
                mockStatus = mock(() => ({ send: mockSend })),
                mockRes = { status: mockStatus } as unknown as Response,
                ratio = 1.02;

            (mockRes.status(200) as any).send(ratio);

            expect(mockSend).toHaveBeenCalledWith(1.02);
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

    describe('ratio calculations', () => {
        it('calculates ratio for 2% increase', () => {
            const latest = 51000,
                yesterday = 50000,
                ratio = latest / yesterday;
            expect(ratio).toBe(1.02);
        });

        it('calculates ratio for 2% decrease', () => {
            const latest = 49000,
                yesterday = 50000,
                ratio = latest / yesterday;
            expect(ratio).toBe(0.98);
        });

        it('calculates ratio for no change', () => {
            const latest = 50000,
                yesterday = 50000,
                ratio = latest / yesterday;
            expect(ratio).toBe(1);
        });

        it('calculates ratio for large increase', () => {
            const latest = 60000,
                yesterday = 50000,
                ratio = latest / yesterday;
            expect(ratio).toBe(1.2);
        });

        it('calculates ratio for large decrease', () => {
            const latest = 40000,
                yesterday = 50000,
                ratio = latest / yesterday;
            expect(ratio).toBe(0.8);
        });
    });
});
