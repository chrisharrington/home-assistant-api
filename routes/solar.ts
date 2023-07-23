import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import Secret from '@root/secret';

import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const mongo = new MongoClient(Secret.mongoConnectionString);

export default ((app: Application) => {
    app.get('/solar', getSolarData);
    app.post('/solar', insertSolarData);
    app.get('/solar/generation', getSolarGeneration);
    app.post('/solar/daily', insertDailySolarGeneration);
});

const getSolarData = async (request: Request, response: Response) => {
    try {
        console.log('GET /solar');
        console.log(JSON.stringify(request.query, null, 4));

        if (!request.query.start)
            return response.status(400).send('Missing start date.');
        if (!request.query.end)
            return response.status(400).send('Missing end date.');

        const start = dayjs(request.query.start as string),
            end = dayjs(request.query.end as string),
            db = mongo.db('home'),
            collection = db.collection('watts');

        const results = await collection.find({
            timestamp: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        }).toArray();

        response.status(200).send(JSON.stringify(results));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertSolarData = async (request: Request, response: Response) => {
    try {
        console.log('POST /solar:');
        console.log(JSON.stringify(request.body, null, 4));

        const db = mongo.db('home'),
            collection = db.collection('watts');

        await collection.insertOne({
            timestamp: dayjs.utc().toDate(),
            currentEnergy: request.body.energy
        });

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const getSolarGeneration = async (request: Request, response: Response) => {
    try {
        console.log('GET /solar/generation');
        console.log(JSON.stringify(request.query, null, 4));

        if (!request.query.start)
            return response.status(400).send('Missing start date.');
        if (!request.query.end)
            return response.status(400).send('Missing end date.');

        const start = dayjs(request.query.start as string),
            end = dayjs(request.query.end as string),
            db = mongo.db('home'),
            collection = db.collection('generation');

        const results = await collection.find({
            timestamp: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        }).toArray();

        response.status(200).send(JSON.stringify(results));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertDailySolarGeneration = async (request: Request, response: Response) => {
    try {
        console.log('POST /solar/generation');
        console.log(JSON.stringify(request.body, null, 4));

        const db = mongo.db('home'),
            collection = db.collection('generation');

        await collection.insertOne({
            timestamp: dayjs.utc().toDate(),
            daily: request.body.generation
        });

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}