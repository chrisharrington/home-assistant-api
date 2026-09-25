/**
 * HTTP client for wealthsimple-api. Every route except /health requires
 * bearer auth; the key comes from environment configuration and is never
 * hardcoded or logged. Only read routes are called here - balances are
 * synced by wealthsimple-api itself on its own schedule and must never be
 * triggered intraday from here.
 */

import fetch from 'node-fetch';
import Config from '@root/config';

/**
 * Wealthsimple session and background sync job status, from GET /status.
 */
export type WealthsimpleStatus = {
    session: {
        alive: boolean;
        reason: string | null;
    };
    jobs: {
        balances: {
            lastSyncedAt: string | null;
        };
    };
}

/**
 * A cash balance in both CAD and USD.
 */
export type WealthsimpleCash = {
    cad: number;
    usd: number;
}

/**
 * A Wealthsimple account and its per-account cash and holdings balance, from GET /balance.
 */
export type WealthsimpleBalanceAccount = {
    accountId: string;
    cash: WealthsimpleCash;
    holdingsValue: WealthsimpleCash;
    total: WealthsimpleCash;
}

/**
 * Response shape of GET /balance.
 */
export type WealthsimpleBalanceResponse = {
    accounts: WealthsimpleBalanceAccount[];
    total: WealthsimpleCash;
    syncedAt: string;
}

/**
 * A single held position, from GET /positions.
 */
export type WealthsimplePosition = {
    securityId: string;
    quantity: number;
    symbol: string | null;
    name: string | null;
    primaryExchange: string | null;
    primaryMic: string | null;
    price: number | null;
    currency: string | null;
}

/**
 * A Wealthsimple account and its held positions, from GET /positions.
 */
export type WealthsimplePositionsAccount = {
    accountId: string;
    positions: WealthsimplePosition[];
}

/**
 * Response shape of GET /positions.
 */
export type WealthsimplePositionsResponse = {
    accounts: WealthsimplePositionsAccount[];
    syncedAt: string;
}

/**
 * Issues an authenticated GET request against wealthsimple-api.
 * @param path - The route path, including leading slash.
 * @returns The parsed JSON response.
 * @throws Error if the request fails or the response isn't OK.
 */
async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${Config.wealthsimpleApiUrl}${path}`, {
        headers: { Authorization: `Bearer ${process.env.WEALTHSIMPLE_API_KEY}` }
    });

    if (!response.ok) throw new Error(`wealthsimple-api ${path} returned ${response.status} ${response.statusText}`);

    return (await response.json()) as T;
}

/**
 * Retrieves session and sync job status from wealthsimple-api.
 * @returns The status response.
 */
export function getStatus(): Promise<WealthsimpleStatus> {
    return get<WealthsimpleStatus>('/status');
}

/**
 * Retrieves per-account cash and holdings balances from wealthsimple-api.
 * @returns The balance response.
 */
export function getBalance(): Promise<WealthsimpleBalanceResponse> {
    return get<WealthsimpleBalanceResponse>('/balance');
}

/**
 * Retrieves per-account positions from wealthsimple-api.
 * @returns The positions response.
 */
export function getPositions(): Promise<WealthsimplePositionsResponse> {
    return get<WealthsimplePositionsResponse>('/positions');
}
