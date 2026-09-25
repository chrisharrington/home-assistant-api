import { ObjectId } from 'mongodb';

/**
 * A daily portfolio balance snapshot, used for history and day-over-day change.
 */
export type DailyBalance = {
    _id?: ObjectId;
    date: Date;
    balance: number;
}

/**
 * Daily percentage change for a stock symbol, cached for the dashboard.
 */
export type SymbolPerformance = {
    symbol: string;
    description: string;
    dayChangePercent: number;
}

/**
 * Balance information for a single Wealthsimple account, cached for the dashboard.
 */
export type AccountBalance = {
    accountId: string;
    accountType: string;
    balance: number;
}

/**
 * Historical data point for the portfolio chart.
 */
export type HistoryPoint = {
    date: string;
    value: number;
}

/**
 * Wealthsimple sync/session status surfaced on the dashboard so a frozen
 * number isn't silent when the upstream sync stops, which is what happened
 * with Questrade.
 */
export type WealthsimpleStatusSummary = {
    degraded: boolean;
    stale: boolean;
    sessionAlive: boolean;
    balancesSyncedAt: string | null;
    updatedAt: string;
}

/**
 * Complete dashboard response structure.
 */
export type DashboardResponse = {
    totalPortfolio: {
        amount: number;
        changePercent: number;
        history: HistoryPoint[];
    };
    accounts: AccountBalance[];
    symbols: SymbolPerformance[];
    exchangeRate: {
        usdToCad: number;
        updatedAt: string;
    };
    status: WealthsimpleStatusSummary;
    lastUpdated: string;
}

/**
 * Cached symbols document stored in MongoDB.
 */
export type SymbolsCache = {
    _id?: ObjectId;
    type: 'symbols';
    symbols: SymbolPerformance[];
    updatedAt: Date;
}

/**
 * Cached accounts document stored in MongoDB.
 */
export type AccountsCache = {
    _id?: ObjectId;
    type: 'accounts';
    accounts: AccountBalance[];
    updatedAt: Date;
}

/**
 * Cached exchange rate document stored in MongoDB.
 */
export type ExchangeRateCache = {
    _id?: ObjectId;
    type: 'exchange-rate';
    usdToCad: number;
    updatedAt: Date;
}

/**
 * Cached intraday valuation document stored in MongoDB. Captures the
 * portfolio's change since previous close plus Wealthsimple sync health, so
 * the dashboard can flag degraded or stale data instead of silently showing
 * a frozen number.
 */
export type ValuationCache = {
    _id?: ObjectId;
    type: 'valuation';
    changePercent: number;
    change: number;
    degraded: boolean;
    degradedSymbols: string[];
    wealthsimple: {
        sessionAlive: boolean;
        sessionReason: string | null;
        balancesSyncedAt: string | null;
        stale: boolean;
    };
    updatedAt: Date;
}
