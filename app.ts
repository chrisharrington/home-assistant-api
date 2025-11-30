import 'module-alias/register';
require('dotenv').config();

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Config from '@root/config';
import energy from '@root/routes/energy';
import investments, { startJobToUpdateBalance } from '@root/routes/investments';
import exchange from '@root/routes/exchange';
import notifications from './routes/notifications';
import { init } from './notifications/bot';

init();

const app = express();

app.use(cors());
app.use(bodyParser.json());

energy(app);
investments(app);
exchange(app);
notifications(app);

startJobToUpdateBalance();

app.listen(Config.apiPort, () => console.log(`API listening on port ${Config.apiPort}...`));