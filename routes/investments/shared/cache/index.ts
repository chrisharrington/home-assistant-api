/**
 * Builds per-account valuation inputs from wealthsimple-api responses and
 * writes the accounts/symbols/valuation dashboard caches to MongoDB.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AccountBalance, SymbolPerformance, SymbolsCache, AccountsCache, ValuationCache } from '../../models';
import { getInvestmentsCollection } from '../db';
import { WealthsimpleStatus, WealthsimplePositionsResponse, WealthsimpleCash } from '../wealthsimple';
import { resolveYahooSymbol } from '../quotes';
import { isInvestmentAccount, AccountValuationInput, AccountValuationResult, Quote } from '../valuation';

dayjs.extend(utc);

/**
 * Builds per-account valuation inputs for every investment account, merging
 * wealthsimple-api's positions and balance responses and resolving each
 * position's Yahoo Finance query symbol.
 * @param positionsResponse - The wealthsimple-api /positions response.
 * @param balanceResponse - The wealthsimple-api /balance response.
 * @returns Investment accounts ready for valuation.
 */
export function buildAccountValuationInputs(
    positionsResponse: WealthsimplePositionsResponse,
    balanceResponse: { accounts: { accountId: string; cash: WealthsimpleCash; holdingsValue: WealthsimpleCash }[] }
): AccountValuationInput[] {
    const balanceByAccount = new Map(balanceResponse.accounts.map(account => [account.accountId, account])),
        accounts: AccountValuationInput[] = positionsResponse.accounts
            .filter(account => isInvestmentAccount(account.accountId))
            .map(account => {
                const balance = balanceByAccount.get(account.accountId);
                return {
                    accountId: account.accountId,
                    cash: balance?.cash || { cad: 0, usd: 0 },
                    holdingsValue: balance?.holdingsValue || { cad: 0, usd: 0 },
                    positions: account.positions.map(position => ({
                        securityId: position.securityId,
                        quantity: position.quantity,
                        symbol: position.symbol,
                        yahooSymbol: resolveYahooSymbol(position.symbol, position.primaryMic),
                        currency: position.currency,
                        syncPrice: position.price
                    }))
                };
            });

    // Include investment accounts that hold cash but no positions (e.g. a
    // freshly opened account) - they appear in /balance but not /positions.
    for (const balance of balanceResponse.accounts) {
        if (!isInvestmentAccount(balance.accountId)) continue;
        if (accounts.some(account => account.accountId === balance.accountId)) continue;

        accounts.push({
            accountId: balance.accountId,
            cash: balance.cash,
            holdingsValue: balance.holdingsValue,
            positions: []
        });
    }

    return accounts;
}

/**
 * Updates the cached account balances in MongoDB from a completed valuation.
 * @param accounts - Per-account valuation results.
 */
export async function updateAccountsCache(accounts: AccountValuationResult[]): Promise<void> {
    const accountBalances: AccountBalance[] = accounts
            .filter(account => account.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .map(account => ({ accountId: account.accountId, accountType: account.label, balance: account.balance })),
        collection = getInvestmentsCollection(),
        cache: Omit<AccountsCache, '_id'> = {
            type: 'accounts',
            accounts: accountBalances,
            updatedAt: new Date()
        };

    await collection.updateOne({ type: 'accounts' }, { $set: cache }, { upsert: true });

    console.log(`Updated accounts cache with ${accountBalances.length} accounts.`);
}

/**
 * Updates the cached symbol performance data in MongoDB. Aggregates unique
 * symbols across investment-account positions, naming each from
 * wealthsimple-api and pricing its daily change from the live Yahoo Finance
 * quote where one was retrieved.
 * @param positionsResponse - The wealthsimple-api /positions response.
 * @param quotes - Live quotes keyed by Yahoo Finance query symbol.
 */
export async function updateSymbolsCache(positionsResponse: WealthsimplePositionsResponse, quotes: Map<string, Quote>): Promise<void> {
    const bySymbol = new Map<string, { description: string; yahooSymbol: string | null }>();

    for (const account of positionsResponse.accounts) {
        if (!isInvestmentAccount(account.accountId)) continue;

        for (const position of account.positions) {
            if (!position.symbol || bySymbol.has(position.symbol)) continue;

            bySymbol.set(position.symbol, {
                description: position.name || '',
                yahooSymbol: resolveYahooSymbol(position.symbol, position.primaryMic)
            });
        }
    }

    const symbols: SymbolPerformance[] = Array.from(bySymbol.entries()).map(([symbol, info]) => {
        const quote = info.yahooSymbol ? quotes.get(info.yahooSymbol) : undefined,
            dayChangePercent = quote && quote.previousClose > 0
                ? Math.round(((quote.price - quote.previousClose) / quote.previousClose) * 10000) / 100
                : 0;

        return { symbol, description: info.description, dayChangePercent };
    });

    const collection = getInvestmentsCollection(),
        cache: Omit<SymbolsCache, '_id'> = { type: 'symbols', symbols, updatedAt: new Date() };

    await collection.updateOne({ type: 'symbols' }, { $set: cache }, { upsert: true });

    console.log(`Updated symbols cache with ${symbols.length} symbols.`);
}

/**
 * Updates the cached intraday valuation in MongoDB, including Wealthsimple
 * sync health so a frozen number is never silent - the balances sync is
 * considered stale if it's missing or older than 36 hours, or the session
 * is dead.
 * @param valuation - The completed portfolio valuation.
 * @param status - The wealthsimple-api session/sync status.
 */
export async function updateValuationCache(
    valuation: { changePercent: number; changeCad: number; degraded: boolean; degradedSymbols: string[] },
    status: WealthsimpleStatus
): Promise<void> {
    const balancesSyncedAt = status.jobs.balances.lastSyncedAt,
        stale = !balancesSyncedAt || dayjs.utc().diff(dayjs.utc(balancesSyncedAt), 'hour') >= 36 || !status.session.alive,
        collection = getInvestmentsCollection(),
        cache: Omit<ValuationCache, '_id'> = {
            type: 'valuation',
            changePercent: valuation.changePercent,
            change: valuation.changeCad,
            degraded: valuation.degraded,
            degradedSymbols: valuation.degradedSymbols,
            wealthsimple: {
                sessionAlive: status.session.alive,
                sessionReason: status.session.reason,
                balancesSyncedAt,
                stale
            },
            updatedAt: new Date()
        };

    await collection.updateOne({ type: 'valuation' }, { $set: cache }, { upsert: true });
}
