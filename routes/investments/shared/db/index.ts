/**
 * MongoDB access for the investments module: the investments collection,
 * daily balance history, and the read-only balance/percentage-change route
 * handlers. Also owns the cached USD to CAD exchange rate, which the
 * valuation job refreshes on every run and the dashboard route reads.
 */

import { MongoClient, Collection, Db } from 'mongodb';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import fetch from 'node-fetch';
import { DailyBalance, ExchangeRateCache } from '../../models';

dayjs.extend(utc);

// MongoDB client instance for database operations.
const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

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
 * Handler logic for GET /investments/balance.
 * Separated from route for testability. Reads only from MongoDB - the
 * balance itself is kept fresh by the cron job in startJobToUpdateBalance.
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
 * Updates the cached exchange rate in MongoDB and returns it for immediate
 * use in valuation math. Falls back to the previously cached rate (or 1) if
 * the remote fetch fails, rather than blocking the whole valuation run.
 * @returns The USD to CAD exchange rate, fresh if the fetch succeeded.
 */
export async function updateExchangeRateCache(): Promise<number> {
    const collection = getInvestmentsCollection(),
        existing = await collection.findOne({ type: 'exchange-rate' }) as ExchangeRateCache | null,
        fallback = existing?.usdToCad ?? 1;

    try {
        const usdToCad = await getRemoteExchangeRate(),
            cache: Omit<ExchangeRateCache, '_id'> = {
                type: 'exchange-rate',
                usdToCad,
                updatedAt: new Date()
            };

        await collection.updateOne({ type: 'exchange-rate' }, { $set: cache }, { upsert: true });

        console.log(`Updated exchange rate cache: 1 USD = ${usdToCad} CAD`);
        return usdToCad;
    } catch (e) {
        console.error('Error updating exchange rate cache:', e);
        return fallback;
    }
}
