import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import Secret from '@root/secret';

import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const mongo = new MongoClient(Secret.mongoConnectionString);

export default ((app: Application) => {
    app.get('/energy', getEnergyData);
    app.post('/energy', insertEnergyData);
    app.get('/energy/generation', getEnergyGeneration);
    app.post('/energy/generation/daily', insertDailyEnergyGeneration);
    app.get('/energy/usage', getEnergyUsage);
    app.post('/energy/usage/daily', insertDailyEnergyUsage);
});

const getEnergyData = async (request: Request, response: Response) => {
    try {
        console.log('GET /energy');
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

        response
            .status(200)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(results));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertEnergyData = async (request: Request, response: Response) => {
    try {
        console.log('POST /energy:');
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
            .send(JSON.stringify(results));
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

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
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
            .send(JSON.stringify(results));
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}

const insertDailyEnergyUsage = async (request: Request, response: Response) => {
    try {
        console.log('POST /energy/usage');
        console.log(JSON.stringify(request.body, null, 4));

        const db = mongo.db('home'),
            collection = db.collection('usage');

        await collection.insertOne({
            timestamp: dayjs.utc().toDate(),
            daily: request.body.usage
        });

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}