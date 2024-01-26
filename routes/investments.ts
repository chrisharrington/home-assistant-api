import { Application, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Config from '@root/config';
import { CronJob } from 'cron';
import { sendTelegramMessage } from '@root/notifications/bot';

dayjs.extend(utc);

const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

type Auth = {
    _id?: ObjectId;
    auth: boolean;
    accessToken: string;
    refreshToken: string;
    expiry: Date;
    uri: string;
    owner: string;
}

type DailyBalance = {
    _id?: ObjectId;
    date: Date;
    balance: number;
}

type QuestradeRefreshTokenGrant = {
    access_token: string;
    api_server: string;
    expires_in: number;
    refresh_token: string;
    token_type: 'Bearer';
}

type Account = {
    type: string;
    number: string;
}

export default ((app: Application) => {
    const prefix = '/investments';

    app.get(`${prefix}/auth`, (_: Request, response: Response) => {
        response.sendStatus(200);
    });

    app.get(`${prefix}/balance`, async (_: Request, response: Response) => {
        try {
            let today = await getTodayBalance(),
                yesterday = await getYesterdayBalance();

            if (!today) {
                const auths = await getAuths(),
                    balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth)));

                today = balances.reduce((sum: number, current: number) => sum + current, 0);
            }

            await updateDailyBalance(today);
    
            response.status(200).send({
                amount: today,
                change: today && yesterday ? (today - yesterday) / yesterday * 100 : 0
            });
        } catch (e) {
            console.error(e);
            response.sendStatus(500);
        }
    });
});

const getYesterdayBalance = async () => {
    const db = mongo.db('home'),
        collection = db.collection('investments'),
        yesterday = await collection.findOne({ date: dayjs().subtract(1, 'day').startOf('day').toDate() }) as DailyBalance | null;

    return yesterday?.balance;
}

const getTodayBalance = async () => {
    const db = mongo.db('home'),
        collection = db.collection('investments'),
        balance = await collection.findOne({ date: dayjs().startOf('day').toDate() }) as DailyBalance | null;

    if (dayjs(balance.date).diff(dayjs(), 'minutes') <= 15)
        return balance?.balance;

    const auths = await getAuths(),
        balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
        total = balances.reduce((sum: number, current: number) => sum + current, 0);
    
    await updateDailyBalance(total);
    return total;
}

const getAuths: () => Promise<Auth[]> = async () => {
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

const getQuestradeRefreshTokenGrant = async (refreshToken: string) => {
    const uri = Config.questradeRefreshTokenUri(refreshToken),
        response = await fetch(uri);

    if (!response.ok) {
        const message = `Error getting Questrade refresh token grant: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${uri}`);
        sendTelegramMessage(message);
        throw response;
    }

    return (await response.json()) as QuestradeRefreshTokenGrant;
}

const getAccountNumbers = async (auth: Auth) => {
    const response = await fetch(`${auth.uri}${Config.questradeAccounts}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    });

    if (!response.ok) {
        const message = `Error getting Questrade account numbers: ${response.status} ${response.statusText}`;
        console.log(message);
        console.log(`GET ${auth.uri}${Config.questradeAccounts} with access token ${auth.accessToken}`);
        sendTelegramMessage(message)
        throw response;
    }

    const json = await response.json();
    return (json.accounts as Account[]).map(account => account.number);
}

const getRemoteTotalBalance : (auth: Auth) => Promise<number> = async (auth: Auth) => {
    const accountNumbers = await getAccountNumbers(auth),
        balances = await Promise.all(accountNumbers.map(accountNumber => getRemoteAccountBalance(auth, accountNumber)));
    return balances.reduce((sum: number, current: number) => sum + current, 0) as number;
}

const getRemoteAccountBalance = async (auth: Auth, accountNumber: string) => {
    const response = await fetch(`${auth.uri}${Config.questradeBalance(accountNumber)}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    });

    if (!response.ok) {
        const message = `Error getting Questrade account balance: ${response.status} ${response.statusText}`;
        console.log(message)
        console.log(`GET ${auth.uri}${Config.questradeBalance(accountNumber)} with access token ${auth.accessToken}`);
        sendTelegramMessage(message);
        throw response;
    }

    const json = await response.json();
    return json.combinedBalances
        .find((balance: { currency: 'CAD' | 'USD', totalEquity: number }) => balance.currency === 'CAD')
        .totalEquity;
}

const updateDailyBalance = async (balance: number) => {
    const db = mongo.db('home'),
        collection = db.collection('investments');

    let current = (await collection.findOne({ date: dayjs().startOf('day').toDate() })) as DailyBalance | null;
    if (current)
        await collection.updateOne({ date: dayjs().startOf('day').toDate() }, { $set: { balance }});
    else {
        current = {
            date: dayjs().startOf('day').toDate(),
            balance
        };

        await collection.insertOne(current);
    }
}

export const startDailyJobToUpdateDailyBalance = async () => {
    const job = new CronJob(Config.questradeBalanceUpdateCron, async () => {
        const auths = await getAuths(),
            balances = await Promise.all(auths.map(auth => getRemoteTotalBalance(auth))),
            total = balances.reduce((sum: number, current: number) => sum + current, 0);

        await updateDailyBalance(total);

        const message = `Updated daily Questrade balance to $${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.`;
        console.log(message);
        sendTelegramMessage(message);
    }, null, true, Config.timezone);

    job.start();

    console.log(`Started daily job to update Questrade balance. Next run on ${dayjs(job.nextDates().toJSDate()).format()}`);
}