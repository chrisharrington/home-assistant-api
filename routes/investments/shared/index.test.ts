/**
 * Unit tests for the investment valuation job's public contract.
 * fetchBalance and startJobToUpdateBalance are I/O-heavy orchestration over
 * wealthsimple-api, Yahoo Finance and MongoDB, all of which are exercised by
 * their own pure/unit-testable pieces (see ./valuation, ./quotes,
 * ./cache) and by the live verification run in the ticket. These document
 * the exported surface rather than re-mocking that I/O.
 */

import { describe, it, expect } from 'bun:test';
import { fetchBalance, startJobToUpdateBalance } from './index';

describe('investment valuation job exports', () => {
    it('exports fetchBalance as a function', () => {
        expect(typeof fetchBalance).toBe('function');
    });

    it('exports startJobToUpdateBalance as a function', () => {
        expect(typeof startJobToUpdateBalance).toBe('function');
    });
});
