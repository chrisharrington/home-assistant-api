/**
 * Unit tests for buildAccountValuationInputs, the pure merge of
 * wealthsimple-api's /positions and /balance responses into per-account
 * valuation inputs, and for computeStaleness, the pure Wealthsimple
 * sync-health calculation. The cache-writing functions (updateAccountsCache,
 * updateSymbolsCache, updateValuationCache) touch MongoDB directly and
 * aren't unit tested here - see CLAUDE.md on not mocking first-party I/O.
 */

import { describe, it, expect } from 'bun:test';
import { buildAccountValuationInputs, computeStaleness } from './index';
import { WealthsimplePositionsResponse, WealthsimpleStatus } from '../wealthsimple';

describe('buildAccountValuationInputs', () => {
    it('excludes cash and credit accounts', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{ accountId: 'rrsp-1', positions: [] }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = {
                accounts: [
                    { accountId: 'rrsp-1', cash: { cad: 0, usd: 0 }, holdingsValue: { cad: 0, usd: 0 } },
                    { accountId: 'ca-cash-corporate-1', cash: { cad: 500, usd: 0 }, holdingsValue: { cad: 0, usd: 0 } },
                    { accountId: 'ca-credit-card-1', cash: { cad: -100, usd: 0 }, holdingsValue: { cad: 0, usd: 0 } }
                ]
            },
            accounts = buildAccountValuationInputs(positions, balance);

        expect(accounts.map(a => a.accountId)).toEqual(['rrsp-1']);
    });

    it('merges cash and holdings value from /balance into the matching /positions account', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{
                    accountId: 'tfsa-1',
                    positions: [{
                        securityId: 'sec-1',
                        quantity: 10,
                        symbol: 'HXT',
                        name: 'Horizons S&P/TSX 60',
                        primaryExchange: 'TSX',
                        primaryMic: 'XTSE',
                        price: 45,
                        currency: 'CAD'
                    }]
                }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = {
                accounts: [{ accountId: 'tfsa-1', cash: { cad: 100, usd: 0 }, holdingsValue: { cad: 450, usd: 0 } }]
            },
            [account] = buildAccountValuationInputs(positions, balance);

        expect(account.cash).toEqual({ cad: 100, usd: 0 });
        expect(account.holdingsValue).toEqual({ cad: 450, usd: 0 });
        expect(account.positions).toHaveLength(1);
        expect(account.positions[0].yahooSymbol).toBe('HXT.TO');
        expect(account.positions[0].syncPrice).toBe(45);
    });

    it('includes an investment account that holds cash but has no positions', () => {
        const positions: WealthsimplePositionsResponse = { accounts: [], syncedAt: '2026-09-25T00:00:00.000Z' },
            balance = {
                accounts: [{ accountId: 'tfsa-1', cash: { cad: 200, usd: 0 }, holdingsValue: { cad: 0, usd: 0 } }]
            },
            accounts = buildAccountValuationInputs(positions, balance);

        expect(accounts).toHaveLength(1);
        expect(accounts[0].accountId).toBe('tfsa-1');
        expect(accounts[0].positions).toEqual([]);
    });

    it('defaults cash and holdings value to zero when an account is missing from /balance', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{ accountId: 'rrsp-1', positions: [] }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = { accounts: [] },
            [account] = buildAccountValuationInputs(positions, balance);

        expect(account.cash).toEqual({ cad: 0, usd: 0 });
        expect(account.holdingsValue).toEqual({ cad: 0, usd: 0 });
    });

    it('carries scope from /positions, merged by accountId with no double count', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{ accountId: 'rrsp-ZFgB7yct0Q', positions: [], scope: 'household' }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = {
                accounts: [{ accountId: 'rrsp-ZFgB7yct0Q', cash: { cad: 0, usd: 0 }, holdingsValue: { cad: 0, usd: 0 }, scope: 'household' as const }]
            },
            accounts = buildAccountValuationInputs(positions, balance);

        expect(accounts).toHaveLength(1);
        expect(accounts[0].scope).toBe('household');
    });

    it('falls back to /balance scope when /positions omits it', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{ accountId: 'rrsp-ZFgB7yct0Q', positions: [] }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = {
                accounts: [{ accountId: 'rrsp-ZFgB7yct0Q', cash: { cad: 0, usd: 0 }, holdingsValue: { cad: 0, usd: 0 }, scope: 'household' as const }]
            },
            [account] = buildAccountValuationInputs(positions, balance);

        expect(account.scope).toBe('household');
    });

    it('defaults scope to own when neither response reports it', () => {
        const positions: WealthsimplePositionsResponse = {
                accounts: [{ accountId: 'rrsp-1', positions: [] }],
                syncedAt: '2026-09-25T00:00:00.000Z'
            },
            balance = { accounts: [{ accountId: 'rrsp-1', cash: { cad: 0, usd: 0 }, holdingsValue: { cad: 0, usd: 0 } }] },
            [account] = buildAccountValuationInputs(positions, balance);

        expect(account.scope).toBe('own');
    });

    it('carries scope for a household account that only appears in /balance', () => {
        const positions: WealthsimplePositionsResponse = { accounts: [], syncedAt: '2026-09-25T00:00:00.000Z' },
            balance = {
                accounts: [{ accountId: 'rrsp-ZFgB7yct0Q', cash: { cad: 200, usd: 0 }, holdingsValue: { cad: 0, usd: 0 }, scope: 'household' as const }]
            },
            [account] = buildAccountValuationInputs(positions, balance);

        expect(account.scope).toBe('household');
    });
});

describe('computeStaleness', () => {
    const baseStatus = (): WealthsimpleStatus => ({
        session: { alive: true, reason: null },
        jobs: { balances: { lastSyncedAt: new Date().toISOString() } }
    });

    it('is not stale, and household-not-stale, when the own sync is fresh and no household job is reported', () => {
        const result = computeStaleness(baseStatus());

        expect(result.stale).toBe(false);
        expect(result.householdStale).toBe(false);
        expect(result.householdSyncedAt).toBeNull();
    });

    it('is household-stale when the household sync reports failure', () => {
        const status = baseStatus();
        status.jobs.householdBalances = { lastSyncedAt: new Date().toISOString(), lastResult: 'failure' };

        const result = computeStaleness(status);

        expect(result.householdStale).toBe(true);
        expect(result.stale).toBe(true);
    });

    it('is household-stale when the household sync is older than 36 hours', () => {
        const status = baseStatus();
        status.jobs.householdBalances = {
            lastSyncedAt: new Date(Date.now() - 37 * 60 * 60 * 1000).toISOString(),
            lastResult: 'success'
        };

        const result = computeStaleness(status);

        expect(result.householdStale).toBe(true);
        expect(result.stale).toBe(true);
    });

    it('is household-stale when the household sync has never run', () => {
        const status = baseStatus();
        status.jobs.householdBalances = { lastSyncedAt: null, lastResult: null };

        const result = computeStaleness(status);

        expect(result.householdStale).toBe(true);
        expect(result.stale).toBe(true);
    });

    it('is not household-stale when the household job is absent entirely', () => {
        const status = baseStatus();

        const result = computeStaleness(status);

        expect(result.householdStale).toBe(false);
    });

    it('ORs household staleness into overall staleness even when the own sync is fine', () => {
        const status = baseStatus();
        status.jobs.householdBalances = { lastSyncedAt: null };

        const result = computeStaleness(status);

        expect(result.stale).toBe(true);
    });
});
