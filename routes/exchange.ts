import { Application, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import fetch from 'node-fetch';
import Secret from '@root/secret';
import Config from '@root/config';

const mongo = new MongoClient(Secret.mongoConnectionString);

type Exchange = {
    _id?: ObjectId;
    rate: number;
    date: Date;
}

export default ((app: Application) => {
    app.get('/exchange', async (_: Request, response: Response) => {
        try {
            const db = mongo.db('home'),
                collection = db.collection('exchange'),
                date = dayjs().startOf('day').toDate();

            let exchange = await collection.findOne({ date }) as Exchange;
            if (!exchange) {
                 const rate = await getRateFromRemote();
                 exchange = { rate, date };
            } else
                delete exchange._id;

            await collection.updateOne({}, { $set: exchange }, { upsert: true });

            response.status(200).send(exchange.rate.toString());
        } catch (e) {
            console.error(e);
            response.status(500).send(e);
        }
    });
});

const getRateFromRemote = async () => {
    const response = await fetch(Config.exchangeRateApiUrl(Secret.exchangeApiKey));
    if (!response.ok)
        throw response;

    const json = await response.json();
    if (json.result !== 'success')
        throw json;

    return json.conversion_rates.CAD;
}