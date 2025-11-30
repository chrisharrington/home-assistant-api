import { Application, Request, Response } from 'express';
import { MongoClient } from 'mongodb';
import Bottleneck from 'bottleneck';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Config from '@root/config';
import { CronJob } from 'cron';
import { sendTelegramMessage } from '@root/notifications/bot';
import { DailyBalance, QuestradeRefreshTokenGrant, Account, Auth } from './models';
import fetch from 'node-fetch';

dayjs.extend(utc);
dayjs.extend(timezone);

const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

const limiter = new Bottleneck({
    minTime: 120,
    maxConcurrent: 1
});

export default (function (app: Application) {
    const prefix = '/investments';

    app.get(`${prefix}/auth`, (_: Request, response: Response) => {
        response.sendStatus(200);
    });

    app.get(`${prefix}/balance`, async (_: Request, response: Response) => {
        try {
            let balance = await getTodayBalance() || 0;
            if (balance > 0) await updateDailyBalance(balance);
            else balance = await getLatestBalance();
            response.status(200).send(balance);
        } catch (e) {
            console.error(e);
            response.sendStatus(500);
        }
    });

    app.get(`${prefix}/balance/force`, async (_: Request, response: Response) => {
        try {
            const auths = await getAuths(),
                balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth)));

            response.status(200).send({ amount: balances.reduce((sum: number, current: number) => sum + current, 0) });
        } catch (e) {
            console.error(e);
            response.sendStatus(500);
        }
    });

    app.get(`${prefix}/balance/percentage-change`, async (_: Request, response: Response) => {
        try {
            const latest = await getLatestBalance(),
                yesterday = await getYesterdayBalance();
            console.log(`Latest: ${latest}, Yesterday: ${yesterday}`);
            response.status(200).send(latest / yesterday);
        } catch (e) {
            console.error(e);
            response.sendStatus(500);
        }
    });
});

async function getLatestBalance(): Promise<number> {
    const db = mongo.db('home'),
        collection = db.collection('investments'),
        latest = await collection.findOne({}, { sort: { date: -1 } }) as DailyBalance | null;
    return latest?.balance || 0;
}

async function getYesterdayBalance(): Promise<number | undefined> {
    const date = dayjs.utc().startOf('day').subtract(1, 'day');

    console.log(`Yesterday's date: ${date.format()}`);

    const db = mongo.db('home');
    const yesterdayLatest = await db.collection('investments')
        .findOne({ date }, { sort: { date: -1 } });
    return yesterdayLatest?.balance;
}

async function getTodayBalance() {
    const db = mongo.db('home'),
        collection = db.collection('investments'),
        balance = await collection.findOne({ date: dayjs().startOf('day').toDate() }) as DailyBalance | null;

    return balance && dayjs(balance.date).diff(dayjs(), 'minutes') <= 15 ? balance.balance : null;
}

async function getAuths(): Promise<Auth[]> {
    let db = mongo.db('home'),
        collection = db.collection('investments'),
        auths = await collection.find({ auth: true }).toArray() as Auth[];

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

async function getQuestradeRefreshTokenGrant(refreshToken: string) {
    const uri = Config.questradeRefreshTokenUri(refreshToken),
        response = await limiter.schedule(async () => await fetch(uri));

    if (!response.ok) {
        const message = `Error getting Questrade refresh token grant: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${uri}`);
        // sendTelegramMessage(message);
        throw response;
    }

    return (await response.json()) as QuestradeRefreshTokenGrant;
}

async function getAccountNumbers(auth: Auth) {
    const response = await limiter.schedule(async () => await fetch(`${auth.uri}${Config.questradeAccounts}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    }));

    if (!response.ok) {
        const message = `Error getting Questrade account numbers: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${auth.uri}${Config.questradeAccounts} with access token ${auth.accessToken}`);
        // sendTelegramMessage(message)
        throw response;
    }

    const json = await response.json();
    return (json.accounts as Account[]).map(account => account.number);
}

async function getRemoteTotalBalance(auth: Auth): Promise<number> {
    const accountNumbers = await getAccountNumbers(auth),
        balances = await Promise.all(accountNumbers.map(accountNumber => getRemoteAccountBalance(auth, accountNumber)));
    return balances.reduce((sum: number, current: number) => sum + current, 0) as number;
}

async function getRemoteAccountBalance(auth: Auth, accountNumber: string) {
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

async function updateDailyBalance(balance: number) {
    const db = mongo.db('home'),
        collection = db.collection('investments');

    let current = (await collection.findOne({ date: dayjs().startOf('day').toDate() })) as DailyBalance | null;
    if (current)
        await collection.updateOne({ date: dayjs().startOf('day').toDate() }, { $set: { balance } });
    else {
        current = {
            date: dayjs().startOf('day').toDate(),
            balance
        };

        await collection.insertOne(current);
    }
}

export function startJobToUpdateBalance() {
    const job = new CronJob('*/5 7-16 * * *', fetchBalance, null, true, Config.timezone);

    job.start();

    console.log(`Started job to update Questrade balance every five minutes. Next run on ${dayjs(job.nextDates().toJSDate()).format()}`);
}

export async function fetchBalance() {
    try {
        const auths = await getAuths(),
            balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
            total = balances.reduce((sum: number, current: number) => sum + current, 0);

        console.log(`Fetched Questrade balance: $${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);

        if (total > 0) await updateDailyBalance(total);

        // sendTelegramMessage(`Updated Questrade balance to $${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.`);
    } catch (e) {
        console.error('Error updating Questrade balance:', e);
        // sendTelegramMessage(`Error updating Questrade balance: ${e.message}`);
    }
}