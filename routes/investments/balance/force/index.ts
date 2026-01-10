/**
 * Force balance route for investments.
 * Forces a fresh balance fetch from Questrade API bypassing any caching.
 */

import { Router, Request, Response } from 'express';
import { handleForceBalance } from '../../shared';

const router = Router();

/**
 * GET /investments/balance/force
 * Forces a fresh balance fetch from all Questrade accounts.
 * Bypasses local caching and queries the Questrade API directly.
 * @returns JSON object with the total balance amount.
 */
router.get('/', async (_: Request, response: Response) => {
    const result = await handleForceBalance();

    if (result.success) {
        response.status(200).send({ amount: result.amount });
    } else {
        response.sendStatus(500);
    }
});

export default router;
