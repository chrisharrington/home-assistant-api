import 'module-alias/register';

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import camera from '@root/routes/camera';

import Config from '@root/config';
import Secret from '@root/secret';


const app = express();

app.use(cors());
app.use(bodyParser.json());
// app.use(auth);

camera(app);

app.listen(Config.apiPort, () => console.log(`API listening on port ${Config.apiPort}...`));

function auth(request: Request, response: Response, next: any) {
    if (request.headers.authorization !== `Bearer ${Secret.apiKey}`)
        response.sendStatus(403);
    else
        next();
}