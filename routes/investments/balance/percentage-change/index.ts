/**
 * Percentage change route for investments.
 * Calculates the ratio between current and yesterday's balance.
 */

import { Router, Request, Response } from 'express';
import { handlePercentageChange } from '../../shared';

const router = Router();

/**
 * GET /investments/balance/percentage-change
 * Calculates the ratio between the latest balance and yesterday's balance.
 * @returns The ratio as a decimal (e.g., 1.02 for a 2% increase).
 */
router.get('/', async (_: Request, response: Response) => {
    const result = await handlePercentageChange();

    if (result.success) {
        response.status(200).send(result.ratio);
    } else {
        response.sendStatus(500);
    }
});

export default router;
