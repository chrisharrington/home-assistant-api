/**
 * Investment valuation job. On a five-minute cron during market hours,
 * fetches holdings from wealthsimple-api, prices them intraday against
 * Yahoo Finance, and updates the daily balance, dashboard caches, and
 * sync-health cache. Also re-exports the MongoDB-backed helpers the routes
 * use directly.
 */

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';
import Config from '@root/config';
import { getStatus, getBalance, getPositions } from './wealthsimple';
import { fetchYahooQuotes } from './quotes';
import { valuatePortfolio } from './valuation';
import { buildAccountValuationInputs, updateAccountsCache, updateSymbolsCache, updateValuationCache } from './cache';
import { updateDailyBalance, updateExchangeRateCache } from './db';

dayjs.extend(timezone);

export {
    getInvestmentsCollection,
    getLatestBalance,
    getYesterdayBalance,
    getTodayBalance,
    updateDailyBalance,
    handleGetBalance,
    handlePercentageChange,
    getHistoricalData,
    updateExchangeRateCache
} from './db';

/**
 * Fetches holdings from wealthsimple-api, prices them intraday against
 * Yahoo Finance, and updates the database. Updates the daily balance record,
 * the accounts/symbols dashboard caches, the exchange rate cache, and the
 * intraday valuation/sync-health cache. Never triggers a Wealthsimple sync
 * itself - only reads wealthsimple-api's already-synced data.
 * Called by the cron job and can be invoked manually (e.g. on a dashboard
 * cache miss).
 */
export async function fetchBalance(): Promise<void> {
    try {
        const [positionsResponse, balanceResponse, status] = await Promise.all([
                getPositions(),
                getBalance(),
                getStatus()
            ]),
            fxUsdToCad = await updateExchangeRateCache(),
            accounts = buildAccountValuationInputs(positionsResponse, balanceResponse),
            yahooSymbols = accounts
                .flatMap(account => account.positions.map(position => position.yahooSymbol))
                .filter((symbol): symbol is string => symbol !== null),
            quotes = await fetchYahooQuotes(yahooSymbols),
            valuation = valuatePortfolio(accounts, quotes, fxUsdToCad);

        console.log(`Fetched Wealthsimple valuation: $${valuation.totalCad.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);

        if (valuation.totalCad > 0) await updateDailyBalance(valuation.totalCad);

        await updateAccountsCache(valuation.accounts);
        await updateSymbolsCache(positionsResponse, quotes);
        await updateValuationCache(valuation, status);
    } catch (e) {
        console.error('Error updating Wealthsimple valuation:', e);
    }
}

/**
 * Starts a cron job to automatically update the intraday valuation every
 * five minutes during market hours (7 AM to 4 PM, Monday to Friday, in the
 * configured timezone), plus one run immediately at startup so the
 * dashboard isn't left showing stale data until the next tick.
 */
export function startJobToUpdateBalance(): void {
    const job = new CronJob('*/5 7-16 * * 1-5', fetchBalance, null, true, Config.timezone);

    job.start();
    fetchBalance();

    console.log(`Started job to update Wealthsimple valuation every five minutes during market hours. Next run on ${dayjs(job.nextDates().toJSDate()).format()}`);
}
