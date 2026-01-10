/**
 * Balance route for investments.
 * Retrieves the current investment balance from cache or database.
 */

import { Router, Request, Response } from 'express';
import { handleGetBalance } from '../shared';
import forceRouter from './force';
import percentageChangeRouter from './percentage-change';

const router = Router();

// Mount nested routes.
router.use('/force', forceRouter);
router.use('/percentage-change', percentageChangeRouter);

/**
 * GET /investments/balance
 * Retrieves the current investment balance.
 * Returns cached balance if updated within 15 minutes, otherwise returns latest from database.
 * Updates the daily balance record if a fresh balance is retrieved.
 */
router.get('/', async (_: Request, response: Response) => {
    const result = await handleGetBalance();

    if (result.success) {
        response.status(200).send(result.balance);
    } else {
        response.sendStatus(500);
    }
});

export default router;
