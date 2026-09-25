/**
 * Unit tests for account classification: which Wealthsimple accounts count
 * toward the investment portfolio total, and their display labels.
 */

import { describe, it, expect } from 'bun:test';
import { isInvestmentAccount, labelForAccount } from './index';

describe('isInvestmentAccount', () => {
    it('excludes cash accounts', () => {
        expect(isInvestmentAccount('ca-cash-msb-1')).toBe(false);
    });

    it('excludes the corporate cash account despite the "corporate" name overlap', () => {
        expect(isInvestmentAccount('ca-cash-corporate-1')).toBe(false);
    });

    it('excludes credit card accounts', () => {
        expect(isInvestmentAccount('ca-credit-card-1')).toBe(false);
    });

    it('includes investment accounts', () => {
        expect(isInvestmentAccount('rrsp-1')).toBe(true);
        expect(isInvestmentAccount('tfsa-1')).toBe(true);
        expect(isInvestmentAccount('resp-1')).toBe(true);
        expect(isInvestmentAccount('spousal-rrsp-1')).toBe(true);
        expect(isInvestmentAccount('non-registered-1')).toBe(true);
        expect(isInvestmentAccount('corporate-1')).toBe(true);
    });
});

describe('labelForAccount', () => {
    it('maps known prefixes to display labels', () => {
        expect(labelForAccount('rrsp-1')).toBe('RRSP');
        expect(labelForAccount('tfsa-1')).toBe('TFSA');
        expect(labelForAccount('resp-1')).toBe('RESP');
        expect(labelForAccount('spousal-rrsp-1')).toBe('Spousal RRSP');
        expect(labelForAccount('non-registered-1')).toBe('Non-Registered');
        expect(labelForAccount('corporate-1')).toBe('Corporate');
    });

    it('uppercases the prefix for an unrecognized account type', () => {
        expect(labelForAccount('unknown-type-1')).toBe('UNKNOWN');
    });
});
