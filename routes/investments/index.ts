/**
 * Investment routes module.
 * Provides endpoints for retrieving investment balance information from Questrade.
 * Routes are organized into submodules for maintainability.
 */

import { Application } from 'express';
import authRouter from './auth';
import balanceRouter from './balance';
import dashboardRouter from './dashboard';
import { startJobToUpdateBalance, fetchBalance } from './shared';

/**
 * Registers all investment routes with the Express application.
 * @param app - The Express application instance.
 */
export default function (app: Application): void {
    const prefix = '/investments';

    // Mount route modules.
    app.use(`${prefix}/auth`, authRouter);
    app.use(`${prefix}/balance`, balanceRouter);
    app.use(`${prefix}/dashboard`, dashboardRouter);
}

// Re-export shared functions for external use.
export { startJobToUpdateBalance, fetchBalance };
