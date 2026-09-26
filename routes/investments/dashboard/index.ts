/**
 * Dashboard route for investments.
 * Returns comprehensive portfolio data for Home Assistant dashboard display.
 */

import { Router, Request, Response } from 'express';
import {
    getLatestBalance,
    getHistoricalData,
    getInvestmentsCollection,
    fetchBalance
} from '../shared';
import { localDate } from '../shared/quotes';
import Config from '@root/config';
import { DashboardResponse, SymbolsCache, AccountsCache, ExchangeRateCache, ValuationCache } from '../models';

const router = Router();

/**
 * Loads the accounts, symbols, exchange-rate and valuation caches together.
 * @returns The four caches, any of which may be null if not yet populated.
 */
async function loadCaches() {
    const collection = getInvestmentsCollection();

    const [accountsCache, symbolsCache, exchangeRateCache, valuationCache] = await Promise.all([
        collection.findOne({ type: 'accounts' }) as Promise<AccountsCache | null>,
        collection.findOne({ type: 'symbols' }) as Promise<SymbolsCache | null>,
        collection.findOne({ type: 'exchange-rate' }) as Promise<ExchangeRateCache | null>,
        collection.findOne({ type: 'valuation' }) as Promise<ValuationCache | null>
    ]);

    return { accountsCache, symbolsCache, exchangeRateCache, valuationCache };
}

/**
 * GET /investments/dashboard
 * Retrieves all dashboard data including portfolio totals, account breakdown,
 * symbol performance, and Wealthsimple sync status from cached MongoDB data.
 * @returns JSON object with dashboard data.
 */
router.get('/', async (_: Request, response: Response) => {
    try {
        let { accountsCache, symbolsCache, exchangeRateCache, valuationCache } = await loadCaches();

        // If any core cache is missing (e.g. first run), run the valuation
        // job once rather than silently returning empty/stale data.
        if (!accountsCache || !symbolsCache || !exchangeRateCache || !valuationCache) {
            await fetchBalance();
            ({ accountsCache, symbolsCache, exchangeRateCache, valuationCache } = await loadCaches());
        }

        const latestBalance = await getLatestBalance(),
            history = await getHistoricalData(365),
            accounts = accountsCache?.accounts || [],
            lastUpdated = valuationCache?.updatedAt || symbolsCache?.updatedAt || accountsCache?.updatedAt || new Date(),
            // The valuation job only runs on weekdays during market hours, so
            // on a weekend the caches still hold the last session's change.
            // Report no change unless the valuation was refreshed today.
            changedToday = !!valuationCache && localDate(valuationCache.updatedAt, Config.timezone) === localDate(new Date(), Config.timezone),
            symbols = (symbolsCache?.symbols || []).map(symbol => changedToday ? symbol : { ...symbol, dayChangePercent: 0 });

        const dashboard: DashboardResponse = {
            totalPortfolio: {
                amount: latestBalance,
                changePercent: changedToday ? valuationCache?.changePercent || 0 : 0,
                history
            },
            accounts,
            symbols,
            exchangeRate: {
                usdToCad: exchangeRateCache?.usdToCad || 0,
                updatedAt: (exchangeRateCache?.updatedAt || new Date()).toISOString()
            },
            status: {
                degraded: valuationCache?.degraded || false,
                stale: valuationCache?.wealthsimple.stale ?? true,
                sessionAlive: valuationCache?.wealthsimple.sessionAlive ?? false,
                balancesSyncedAt: valuationCache?.wealthsimple.balancesSyncedAt || null,
                updatedAt: (valuationCache?.updatedAt || new Date()).toISOString()
            },
            lastUpdated: lastUpdated.toISOString()
        };

        response.status(200).json(dashboard);
    } catch (e) {
        console.error('Error getting dashboard data:', e);
        response.sendStatus(500);
    }
});

export default router;
