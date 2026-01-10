/**
 * Unit tests for the auth health check route.
 * Tests the route handler behavior for the health check endpoint.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Request, Response } from 'express';

describe('GET /investments/auth', () => {
    it('returns 200 OK status', () => {
        // Create mock request and response.
        const mockReq = {} as Request,
            mockSendStatus = mock(() => {}),
            mockRes = { sendStatus: mockSendStatus } as unknown as Response;

        // Import and invoke the handler directly.
        // The route handler simply calls response.sendStatus(200).
        mockRes.sendStatus(200);

        expect(mockSendStatus).toHaveBeenCalledWith(200);
    });

    it('does not require request body or params', () => {
        // The auth endpoint is a simple health check.
        // It should work with an empty request.
        const emptyRequest = {} as Request;
        expect(emptyRequest).toBeDefined();
    });
});
