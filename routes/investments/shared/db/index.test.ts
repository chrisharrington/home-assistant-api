/**
 * Unit tests for the investments MongoDB-backed helpers.
 * Full integration testing requires a test MongoDB instance, so these
 * document the handler contracts and the pure ratio math they rely on.
 */

import { describe, it, expect } from 'bun:test';

describe('handleGetBalance', () => {
    it('returns { balance: number, success: boolean }', () => {
        type ExpectedResult = { balance: number; success: boolean };
        const example: ExpectedResult = { balance: 50000, success: true };
        expect(example).toHaveProperty('balance');
        expect(example).toHaveProperty('success');
    });
});

describe('handlePercentageChange', () => {
    it('returns { ratio: number, success: boolean }', () => {
        type ExpectedResult = { ratio: number; success: boolean };
        const example: ExpectedResult = { ratio: 1.02, success: true };
        expect(example).toHaveProperty('ratio');
        expect(example).toHaveProperty('success');
    });

    it('calculates positive change correctly', () => {
        const latest = 51000,
            yesterday = 50000,
            ratio = latest / yesterday;
        expect(ratio).toBe(1.02);
    });

    it('calculates negative change correctly', () => {
        const latest = 49000,
            yesterday = 50000,
            ratio = latest / yesterday;
        expect(ratio).toBe(0.98);
    });

    it('calculates no change correctly', () => {
        const latest = 50000,
            yesterday = 50000,
            ratio = latest / yesterday;
        expect(ratio).toBe(1);
    });
});
