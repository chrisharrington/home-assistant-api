/**
 * Dashboard route for investments.
 * Returns comprehensive portfolio data for Home Assistant dashboard display.
 */

import { Router, Request, Response } from 'express';
import {
    getLatestBalance,
    getYesterdayBalance,
    getHistoricalData,
    getInvestmentsCollection,
    updateAccountsCache,
    updateSymbolsCache,
    updateExchangeRateCache
} from '../shared';
import { DashboardResponse, SymbolsCache, AccountsCache, ExchangeRateCache } from '../models';

const router = Router();

/**
 * GET /investments/dashboard
 * Retrieves all dashboard data including portfolio totals, account breakdown,
 * and individual symbol performance from cached MongoDB data.
 * @returns JSON object with dashboard data.
 */
router.get('/', async (_: Request, response: Response) => {
    try {
        const collection = getInvestmentsCollection();

        // Get latest balance.
        const latestBalance = await getLatestBalance();

        // Get yesterday's balance for percentage change.
        const yesterdayBalance = await getYesterdayBalance(),
            changePercent = yesterdayBalance && yesterdayBalance > 0
                ? Math.round(((latestBalance - yesterdayBalance) / yesterdayBalance) * 10000) / 100
                : 0;

        // Get historical data (last 365 days).
        const history = await getHistoricalData(365);

        // Get cached accounts, populate if missing.
        let accountsCache = await collection.findOne({ type: 'accounts' }) as AccountsCache | null;
        if (!accountsCache) {
            await updateAccountsCache();
            accountsCache = await collection.findOne({ type: 'accounts' }) as AccountsCache | null;
        }
        const accounts = accountsCache?.accounts || [];

        // Get cached symbols, populate if missing.
        let symbolsCache = await collection.findOne({ type: 'symbols' }) as SymbolsCache | null;
        if (!symbolsCache) {
            await updateSymbolsCache();
            symbolsCache = await collection.findOne({ type: 'symbols' }) as SymbolsCache | null;
        }
        const symbols = symbolsCache?.symbols || [];

        // Get cached exchange rate, populate if missing.
        let exchangeRateCache = await collection.findOne({ type: 'exchange-rate' }) as ExchangeRateCache | null;
        if (!exchangeRateCache) {
            await updateExchangeRateCache();
            exchangeRateCache = await collection.findOne({ type: 'exchange-rate' }) as ExchangeRateCache | null;
        }

        // Determine last updated time.
        const lastUpdated = symbolsCache?.updatedAt || accountsCache?.updatedAt || new Date();

        const dashboard: DashboardResponse = {
            totalPortfolio: {
                amount: latestBalance,
                changePercent,
                history
            },
            accounts,
            symbols,
            exchangeRate: {
                usdToCad: exchangeRateCache?.usdToCad || 0,
                updatedAt: (exchangeRateCache?.updatedAt || new Date()).toISOString()
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
