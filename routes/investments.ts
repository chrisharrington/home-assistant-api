import { Application, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Secret from '@root/secret';
import Config from '@root/config';
import { CronJob } from 'cron';

dayjs.extend(utc);

// access_token: lYWOvSMe2ahI07W0v9hw0cqwXfVhAwtY0
// refresh_token: KsMjd1pdoFc9M5CNSvYdYAR7PJLcZYGF0

// https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=
// https://api06.iq.questrade.com/

const mongo = new MongoClient(Secret.mongoConnectionString);

type Auth = {
    _id?: ObjectId;
    auth: boolean;
    accessToken: string;
    refreshToken: string;
    expiry: Date;
    uri: string;
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

    app.get(`${prefix}/auth`, (request: Request, response: Response) => {
        console.log(request.query);
        response.sendStatus(200);
    });

    app.get(`${prefix}/balance`, async (_: Request, response: Response) => {
        try {
            const auth = await getAuth(),
                total = await getTotalBalance(auth);

            await updateDailyBalance(total);
    
            response.status(200).send(total.toString());
        } catch (e) {
            console.error(e);
            response.status(500).send(e);
        }
    });
});

const getTotalBalance : (auth: Auth) => Promise<number> = async (auth: Auth) => {
    const accountNumbers = await getAccountNumbers(auth),
        balances = await Promise.all(accountNumbers.map(accountNumber => getAccountBalance(auth, accountNumber)));
    return balances.reduce((sum: number, current: number) => sum + current, 0) as number;
}

const getAuth: () => Promise<Auth> = async () => {
    const db = mongo.db('home'),
        collection = db.collection('investments'),
        auth = (await collection.findOne({ auth: true })) as Auth;

    if (dayjs.utc(auth.expiry).isBefore(dayjs.utc())) {
        const grant = await getQuestradeRefreshTokenGrant(auth.refreshToken);
        auth.accessToken = grant.access_token;
        auth.refreshToken = grant.refresh_token;
        auth.uri = grant.api_server;
        auth.expiry = dayjs.utc().add(grant.expires_in, 'seconds').toDate();
        await collection.updateOne({ auth: true }, { $set: auth }, { upsert: true });
    }

    return auth;
}

const getQuestradeRefreshTokenGrant = async (refreshToken: string) => {
    const uri = Config.questradeRefreshTokenUri(refreshToken),
        response = await fetch(uri);

    if (!response.ok)
        throw response;

    return (await response.json()) as QuestradeRefreshTokenGrant;
}

const getAccountNumbers = async (auth: Auth) => {
    const response = await fetch(`${auth.uri}${Config.questradeAccounts}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    });

    if (!response.ok)
        throw response;

    const json = await response.json();
    return (json.accounts as Account[]).map(account => account.number);
}

const getAccountBalance = async (auth: Auth, accountNumber: string) => {
    const response = await fetch(`${auth.uri}${Config.questradeBalance(accountNumber)}`, {
        headers: {
            Authorization: `Bearer ${auth.accessToken}`
        }
    });

    if (!response.ok)
        throw response;

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
        const auth = await getAuth(),
            total = await getTotalBalance(auth);

        await updateDailyBalance(total);

        console.log(`Updated daily Questrade balance to $${total.toFixed(2)}.`);
    }, null, true, Config.timezone);

    job.start();

    console.log(`Started daily job to update Questrade balance. Next run on ${dayjs(job.nextDates().toJSDate()).format()}`);
}