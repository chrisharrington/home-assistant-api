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
});

const getSolarData = (request: Request, response: Response) => {
    try {
        const start = request.query.start as string,
            end = request.query.end as string;

        console.log(dayjs(start).format(), dayjs(end).format());

        response.sendStatus(200);
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
            collection = db.collection('solar');

        await collection.insertOne({
            timestamp: dayjs.utc().toISOString(),
            currentEnergy: request.body.energy
        });

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}