/**
 * Shared utilities for investment routes.
 * Provides MongoDB access, rate limiting, Questrade API integration,
 * balance database operations, and cron job management.
 */

import { MongoClient, Collection, Db } from 'mongodb';
import Bottleneck from 'bottleneck';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';
import fetch from 'node-fetch';
import Config from '@root/config';
import {
    Auth,
    DailyBalance,
    QuestradeRefreshTokenGrant,
    Account,
    QuestradePosition,
    QuestradeQuote,
    QuestradeSymbol,
    SymbolPerformance,
    AccountBalance,
    SymbolsCache,
    AccountsCache,
    ExchangeRateCache
} from '../models';

dayjs.extend(utc);
dayjs.extend(timezone);

// MongoDB client instance for database operations.
const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

// Rate limiter for Questrade account API calls (30 req/sec limit).
const limiter = new Bottleneck({
    minTime: 120,
    maxConcurrent: 1
});

// Rate limiter for Questrade market data API calls (20 req/sec limit).
const marketLimiter = new Bottleneck({
    minTime: 50,
    maxConcurrent: 1
});

/**
 * Retrieves the investments collection from MongoDB.
 * @returns The investments collection.
 */
export function getInvestmentsCollection(): Collection {
    const db: Db = mongo.db('home');
    return db.collection('investments');
}

/**
 * Retrieves the most recent balance from the database.
 * @returns The latest balance amount, or 0 if none exists.
 */
export async function getLatestBalance(): Promise<number> {
    const collection = getInvestmentsCollection(),
        latest = await collection.findOne({}, { sort: { date: -1 } }) as DailyBalance | null;
    return latest?.balance || 0;
}

/**
 * Retrieves yesterday's balance from the database.
 * @returns Yesterday's balance amount, or undefined if not found.
 */
export async function getYesterdayBalance(): Promise<number | undefined> {
    const date = dayjs.utc().startOf('day').subtract(1, 'day').toDate();

    console.log(`Yesterday's date: ${date}`);

    const collection = getInvestmentsCollection(),
        yesterdayLatest = await collection.findOne({ date }, { sort: { date: -1 } });
    return yesterdayLatest?.balance;
}

/**
 * Retrieves today's cached balance if it was updated within the last 15 minutes.
 * @returns Today's balance if fresh, or null if stale or not found.
 */
export async function getTodayBalance(): Promise<number | null> {
    const collection = getInvestmentsCollection(),
        balance = await collection.findOne({ date: dayjs().startOf('day').toDate() }) as DailyBalance | null;

    return balance && dayjs(balance.date).diff(dayjs(), 'minutes') <= 15 ? balance.balance : null;
}

/**
 * Updates or inserts the daily balance record for today.
 * @param balance - The balance amount to store.
 */
export async function updateDailyBalance(balance: number): Promise<void> {
    const collection = getInvestmentsCollection(),
        todayDate = dayjs().startOf('day').toDate(),
        current = (await collection.findOne({ date: todayDate })) as DailyBalance | null;

    if (current) {
        await collection.updateOne({ date: todayDate }, { $set: { balance } });
    } else {
        const newBalance: DailyBalance = {
            date: todayDate,
            balance
        };
        await collection.insertOne(newBalance);
    }
}

/**
 * Retrieves and refreshes authentication tokens for all Questrade accounts.
 * Automatically refreshes expired tokens using the refresh token grant.
 * @returns Array of authentication objects with valid tokens.
 */
export async function getAuths(): Promise<Auth[]> {
    const collection = getInvestmentsCollection(),
        auths = await collection.find({ auth: true }).toArray() as Auth[];

    // Refresh expired tokens.
    for (const auth of auths) {
        if (dayjs.utc(auth.expiry).isBefore(dayjs.utc())) {
            const grant = await getQuestradeRefreshTokenGrant(auth.refreshToken);
            delete auth._id;
            auth.accessToken = grant.access_token;
            auth.refreshToken = grant.refresh_token;
            auth.uri = grant.api_server;
            auth.expiry = dayjs.utc().add(grant.expires_in - 30, 'seconds').toDate();
            await collection.updateOne({ owner: auth.owner }, { $set: auth }, { upsert: true });
        }
    }

    return auths;
}

/**
 * Exchanges a refresh token for new access credentials from Questrade.
 * @param refreshToken - The refresh token to exchange.
 * @returns The token grant response containing new credentials.
 * @throws Response object if the request fails.
 */
export async function getQuestradeRefreshTokenGrant(refreshToken: string): Promise<QuestradeRefreshTokenGrant> {
    const uri = Config.questradeRefreshTokenUri(refreshToken),
        response = await limiter.schedule(async () => await fetch(uri));

    if (!response.ok) {
        const message = `Error getting Questrade refresh token grant: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${uri}`);
        throw response;
    }

    return (await response.json()) as QuestradeRefreshTokenGrant;
}

/**
 * Retrieves all account numbers for a given authentication.
 * @param auth - The authentication object containing API credentials.
 * @returns Array of account number strings.
 * @throws Response object if the request fails.
 */
export async function getAccountNumbers(auth: Auth): Promise<string[]> {
    const response = await limiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeAccounts}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    }));

    if (!response.ok) {
        const message = `Error getting Questrade account numbers: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${auth.uri}${Config.questradeAccounts} with access token ${auth.accessToken}`);
        throw response;
    }

    const json = await response.json();
    return (json.accounts as Account[]).map(account => account.number);
}

/**
 * Retrieves the total balance across all accounts for a given authentication.
 * @param auth - The authentication object containing API credentials.
 * @returns The sum of all account balances.
 */
export async function getRemoteTotalBalance(auth: Auth): Promise<number> {
    const accountNumbers = await getAccountNumbers(auth),
        balances = await Promise.all(accountNumbers.map(accountNumber => getRemoteAccountBalance(auth, accountNumber)));
    return balances.reduce((sum: number, current: number) => sum + current, 0);
}

/**
 * Retrieves the balance for a specific account.
 * @param auth - The authentication object containing API credentials.
 * @param accountNumber - The account number to query.
 * @returns The total equity in CAD for the account.
 * @throws Response object if the request fails.
 */
export async function getRemoteAccountBalance(auth: Auth, accountNumber: string): Promise<number> {
    const response = await limiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeBalance(accountNumber)}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    }));

    if (!response.ok) throw response;

    const json = await response.json();
    return json.combinedBalances
        .find((balance: { currency: 'CAD' | 'USD', totalEquity: number }) => balance.currency === 'CAD')
        .totalEquity;
}

/**
 * Fetches the current balance from Questrade and updates the database.
 * Also updates account balances, symbol performance, and exchange rate caches.
 * Called by the cron job and can be invoked manually.
 */
export async function fetchBalance(): Promise<void> {
    try {
        const auths = await getAuths(),
            balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
            total = balances.reduce((sum: number, current: number) => sum + current, 0);

        console.log(`Fetched Questrade balance: $${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);

        if (total > 0) await updateDailyBalance(total);

        // Update dashboard caches.
        await updateAccountsCache();
        await updateSymbolsCache();
        await updateExchangeRateCache();
    } catch (e) {
        console.error('Error updating Questrade balance:', e);
    }
}

/**
 * Starts a cron job to automatically update balances every 5 minutes during market hours.
 * Runs from 7 AM to 4 PM in the configured timezone.
 */
export function startJobToUpdateBalance(): void {
    const job = new CronJob('*/5 7-16 * * *', fetchBalance, null, true, Config.timezone);

    job.start();

    console.log(`Started job to update Questrade balance every five minutes. Next run on ${dayjs(job.nextDates().toJSDate()).format()}`);
}

/**
 * Handler logic for GET /investments/balance.
 * Separated from route for testability.
 * @returns Object with balance and success status.
 */
export async function handleGetBalance(): Promise<{ balance: number; success: boolean }> {
    try {
        let balance = await getTodayBalance() || 0;

        if (balance > 0) {
            await updateDailyBalance(balance);
        } else {
            balance = await getLatestBalance();
        }

        return { balance, success: true };
    } catch (e) {
        console.error(e);
        return { balance: 0, success: false };
    }
}

/**
 * Handler logic for GET /investments/balance/force.
 * Separated from route for testability.
 * @returns Object with total amount and success status.
 */
export async function handleForceBalance(): Promise<{ amount: number; success: boolean }> {
    try {
        const auths = await getAuths(),
            balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
            total = balances.reduce((sum: number, current: number) => sum + current, 0);

        return { amount: total, success: true };
    } catch (e) {
        console.error(e);
        return { amount: 0, success: false };
    }
}

/**
 * Handler logic for GET /investments/balance/percentage-change.
 * Separated from route for testability.
 * @returns Object with ratio and success status.
 */
export async function handlePercentageChange(): Promise<{ ratio: number; success: boolean }> {
    try {
        const latest = await getLatestBalance(),
            yesterday = await getYesterdayBalance();

        console.log(`Latest: ${latest}, Yesterday: ${yesterday}`);

        return { ratio: latest / yesterday, success: true };
    } catch (e) {
        console.error(e);
        return { ratio: 0, success: false };
    }
}

/**
 * Retrieves positions for a specific account from Questrade.
 * @param auth - The authentication object containing API credentials.
 * @param accountNumber - The account number to query.
 * @returns Array of position objects.
 */
export async function getRemotePositions(auth: Auth, accountNumber: string): Promise<QuestradePosition[]> {
    const response = await limiter.schedule(async () => await fetch(`${auth.uri}${Config.questradePositions(accountNumber)}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    }));

    if (!response.ok) {
        const message = `Error getting Questrade positions: ${response.status} ${response.statusText}`;
        console.log(message);
        throw response;
    }

    const json = await response.json();
    return json.positions as QuestradePosition[];
}

/**
 * Retrieves quotes for multiple symbols from Questrade.
 * @param auth - The authentication object containing API credentials.
 * @param symbolIds - Array of symbol IDs to query.
 * @returns Array of quote objects.
 */
export async function getRemoteQuotes(auth: Auth, symbolIds: number[]): Promise<QuestradeQuote[]> {
    if (symbolIds.length === 0) return [];

    const symbolIdsStr = symbolIds.join(','),
        response = await marketLimiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeQuotes(symbolIdsStr)}`, {
            headers: {
                Authorization: `Bearer ${auth.accessToken}`
            }
        }));

    if (!response.ok) {
        const errorBody = await response.text();
        console.log(`Error getting Questrade quotes: ${response.status} ${response.statusText}`);
        console.log(`Response body: ${errorBody}`);
        console.log(`Request URL: ${auth.uri}${Config.questradeQuotes(symbolIdsStr)}`);
        throw new Error(`Questrade quotes API error: ${response.status} - ${errorBody}`);
    }

    const json = await response.json();
    return json.quotes as QuestradeQuote[];
}

/**
 * Retrieves symbol details (including descriptions) from Questrade.
 * @param auth - The authentication object containing API credentials.
 * @param symbolIds - Array of symbol IDs to query.
 * @returns Array of symbol detail objects.
 */
export async function getRemoteSymbolDetails(auth: Auth, symbolIds: number[]): Promise<QuestradeSymbol[]> {
    if (symbolIds.length === 0) return [];

    const symbolIdsStr = symbolIds.join(','),
        response = await marketLimiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeSymbols(symbolIdsStr)}`, {
            headers: {
                Authorization: `Bearer ${auth.accessToken}`
            }
        }));

    if (!response.ok) {
        const errorBody = await response.text();
        console.log(`Error getting Questrade symbol details: ${response.status} ${response.statusText}`);
        console.log(`Response body: ${errorBody}`);
        throw new Error(`Questrade symbols API error: ${response.status} - ${errorBody}`);
    }

    const json = await response.json();
    return json.symbols as QuestradeSymbol[];
}

/**
 * Retrieves account details including type for a given authentication.
 * @param auth - The authentication object containing API credentials.
 * @returns Array of account objects with type and number.
 */
export async function getAccounts(auth: Auth): Promise<Account[]> {
    const response = await limiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeAccounts}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    }));

    if (!response.ok) {
        const message = `Error getting Questrade accounts: ${response.status} ${response.statusText}`;
        console.log(message);
        throw response;
    }

    const json = await response.json();
    return json.accounts as Account[];
}

/**
 * Updates the cached account balances in MongoDB.
 * Fetches balance for each account and stores with owner information.
 */
export async function updateAccountsCache(): Promise<void> {
    try {
        const auths = await getAuths(),
            accountBalances: AccountBalance[] = [];

        // Fetch accounts and balances for each auth.
        for (const auth of auths) {
            const accounts = await getAccounts(auth);

            for (const account of accounts) {
                const balance = await getRemoteAccountBalance(auth, account.number);
                accountBalances.push({
                    accountNumber: account.number,
                    accountType: account.type,
                    owner: auth.owner,
                    balance
                });
            }
        }

        // Store in MongoDB.
        const collection = getInvestmentsCollection(),
            cache: Omit<AccountsCache, '_id'> = {
                type: 'accounts',
                accounts: accountBalances,
                updatedAt: new Date()
            };

        await collection.updateOne(
            { type: 'accounts' },
            { $set: cache },
            { upsert: true }
        );

        console.log(`Updated accounts cache with ${accountBalances.length} accounts.`);
    } catch (e) {
        console.error('Error updating accounts cache:', e);
    }
}

/**
 * Updates the cached symbol performance data in MongoDB.
 * Fetches positions from all accounts, aggregates by symbol, and gets quotes.
 */
export async function updateSymbolsCache(): Promise<void> {
    try {
        const auths = await getAuths(),
            symbolMap = new Map<number, { symbol: string; symbolId: number }>();

        // Collect unique symbols from all positions across all accounts.
        for (const auth of auths) {
            const accounts = await getAccounts(auth);

            for (const account of accounts) {
                const positions = await getRemotePositions(auth, account.number);

                for (const position of positions) {
                    if (position.openQuantity > 0 && !symbolMap.has(position.symbolId)) {
                        symbolMap.set(position.symbolId, {
                            symbol: position.symbol,
                            symbolId: position.symbolId
                        });
                    }
                }
            }
        }

        // Get quotes and symbol details for all unique symbols.
        const symbolIds = Array.from(symbolMap.keys()),
            symbols: SymbolPerformance[] = [];

        if (symbolIds.length > 0) {
            // Refresh auths to ensure valid token for market data call.
            const freshAuths = await getAuths();
            if (freshAuths.length === 0) {
                console.log('No auths available for market data call.');
                return;
            }

            // Fetch quotes and symbol details in parallel.
            const [quotes, symbolDetails] = await Promise.all([
                getRemoteQuotes(freshAuths[0], symbolIds),
                getRemoteSymbolDetails(freshAuths[0], symbolIds)
            ]);

            // Create maps of symbol descriptions and previous close prices.
            const descriptionMap = new Map<number, string>(),
                prevCloseMap = new Map<number, number | null>();
            for (const detail of symbolDetails) {
                descriptionMap.set(detail.symbolId, detail.description);
                prevCloseMap.set(detail.symbolId, detail.prevDayClosePrice);
            }

            for (const quote of quotes) {
                // Calculate daily change percentage using previous close if available, otherwise open price.
                const prevClose = prevCloseMap.get(quote.symbolId),
                    basePrice = prevClose ?? quote.openPrice,
                    dayChangePercent = basePrice > 0
                        ? ((quote.lastTradePrice - basePrice) / basePrice) * 100
                        : 0;

                symbols.push({
                    symbol: quote.symbol,
                    symbolId: quote.symbolId,
                    description: descriptionMap.get(quote.symbolId) || '',
                    dayChangePercent: Math.round(dayChangePercent * 100) / 100
                });
            }
        }

        // Store in MongoDB.
        const collection = getInvestmentsCollection(),
            cache: Omit<SymbolsCache, '_id'> = {
                type: 'symbols',
                symbols,
                updatedAt: new Date()
            };

        await collection.updateOne(
            { type: 'symbols' },
            { $set: cache },
            { upsert: true }
        );

        console.log(`Updated symbols cache with ${symbols.length} symbols.`);
    } catch (e) {
        console.error('Error updating symbols cache:', e);
    }
}

/**
 * Retrieves historical balance data for the chart.
 * @param days - Number of days of history to return (default 365).
 * @returns Array of history points sorted by date ascending.
 */
export async function getHistoricalData(days: number = 365): Promise<{ date: string; value: number }[]> {
    const collection = getInvestmentsCollection(),
        cutoffDate = dayjs().subtract(days, 'day').startOf('day').toDate(),
        balances = await collection
            .find({
                date: { $gte: cutoffDate },
                balance: { $exists: true }
            })
            .toArray() as DailyBalance[];

    // Sort by date ascending and map to response format.
    return balances
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(b => ({
            date: dayjs(b.date).format('YYYY-MM-DD'),
            value: b.balance
        }));
}

/**
 * Fetches the current USD to CAD exchange rate from Frankfurter API.
 * @returns The exchange rate (USD to CAD).
 */
async function getRemoteExchangeRate(): Promise<number> {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD');

    if (!response.ok) {
        throw new Error(`Error fetching exchange rate: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { rates: { CAD: number } };
    return json.rates.CAD;
}

/**
 * Updates the cached exchange rate in MongoDB.
 * Fetches from Frankfurter API and stores in the investments collection.
 */
export async function updateExchangeRateCache(): Promise<void> {
    try {
        const usdToCad = await getRemoteExchangeRate(),
            collection = getInvestmentsCollection(),
            cache: Omit<ExchangeRateCache, '_id'> = {
                type: 'exchange-rate',
                usdToCad,
                updatedAt: new Date()
            };

        await collection.updateOne(
            { type: 'exchange-rate' },
            { $set: cache },
            { upsert: true }
        );

        console.log(`Updated exchange rate cache: 1 USD = ${usdToCad} CAD`);
    } catch (e) {
        console.error('Error updating exchange rate cache:', e);
    }
}
