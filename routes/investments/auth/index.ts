/**
 * Authentication health check route for investments.
 * Provides a simple endpoint to verify the investments API is accessible.
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /investments/auth
 * Health check endpoint that returns 200 OK.
 * Used by Home Assistant to verify API availability.
 */
router.get('/', (_: Request, response: Response) => {
    response.sendStatus(200);
});

export default router;
