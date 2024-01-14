import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import utc from 'dayjs/plugin/utc';
import { sendTelegramMessage } from '@root/notifications/bot';
dayjs.extend(utc);

const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING);

export default ((app: Application) => {
    app.get('/energy/generation', getEnergyGeneration);
    app.post('/energy/generation/daily', insertDailyEnergyGeneration);
    app.get('/energy/usage', getEnergyUsage);
    app.post('/energy/usage/daily', insertDailyEnergyUsage);
});

const getEnergyGeneration = async (request: Request, response: Response) => {
    try {
        console.log('GET /energy/generation');
        console.log(JSON.stringify(request.query, null, 4));

        if (!request.query.start)
            return response.status(400).send('Missing start date.');
        if (!request.query.end)
            return response.status(400).send('Missing end date.');

        const start = dayjs(request.query.start as string),
            end = dayjs(request.query.end as string),
            db = mongo.db('home'),
            collection = db.collection('generation');

        const results = await collection
            .find({
                timestamp: {
                    $gte: start.toDate(),
                    $lte: end.toDate()
                }
            })
            .sort({ timestamp: 1 })
            .toArray();

        response
            .status(200)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(results.map(r => ({ timestamp: r.timestamp, value: r.daily }))));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertDailyEnergyGeneration = async (request: Request, response: Response) => {
    try {
        console.log('POST /energy/generation');
        console.log(JSON.stringify(request.body, null, 4));

        const db = mongo.db('home'),
            collection = db.collection('generation');

        await collection.insertOne({
            timestamp: dayjs.utc().toDate(),
            daily: request.body.generation
        });

        sendTelegramMessage(`Yesterday's energy generation was ${request.body.generation} kWh.`);

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
        sendTelegramMessage('An error occurred while updating daily energy generation.');
    }
}

const getEnergyUsage = async (request: Request, response: Response) => {
    try {
        console.log('GET /energy/usage');
        console.log(JSON.stringify(request.query, null, 4));

        if (!request.query.start)
            return response.status(400).send('Missing start date.');
        if (!request.query.end)
            return response.status(400).send('Missing end date.');

        const start = dayjs(request.query.start as string),
            end = dayjs(request.query.end as string),
            db = mongo.db('home'),
            collection = db.collection('usage');

        const results = await collection
            .find({
                timestamp: {
                    $gte: start.toDate(),
                    $lte: end.toDate()
                }
            })
            .sort({ timestamp: 1 })
            .toArray();

        response
            .status(200)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(results.map(r => ({ timestamp: r.timestamp, value: r.daily }))));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertDailyEnergyUsage = async (request: Request, response: Response) => {
    try {
        console.log('POST /energy/usage');

        const db = mongo.db('home'),
            collection = db.collection('usage');

        await collection.insertOne({
            timestamp: dayjs.utc().toDate(),
            daily: request.body.usage
        });

        sendTelegramMessage(`Yesterday's energy usage was ${request.body.usage} watts.`);

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
        sendTelegramMessage('An error occurred while updating daily energy usage.');
    }
}