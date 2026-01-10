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
import { Auth, DailyBalance, QuestradeRefreshTokenGrant, Account } from '../models';

dayjs.extend(utc);
dayjs.extend(timezone);

// MongoDB client instance for database operations.
const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

// Rate limiter to prevent exceeding Questrade API rate limits.
const limiter = new Bottleneck({
    minTime: 120,
    maxConcurrent: 1
});

/**
 * Retrieves the investments collection from MongoDB.
 * @returns The investments collection.
 */
function getInvestmentsCollection(): Collection {
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
    const date = dayjs.utc().startOf('day').subtract(1, 'day');

    console.log(`Yesterday's date: ${date.format()}`);

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
 * Called by the cron job and can be invoked manually.
 */
export async function fetchBalance(): Promise<void> {
    try {
        const auths = await getAuths(),
            balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
            total = balances.reduce((sum: number, current: number) => sum + current, 0);

        console.log(`Fetched Questrade balance: $${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);

        if (total > 0) await updateDailyBalance(total);
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
