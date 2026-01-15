import { ObjectId } from 'mongodb';

export type Auth = {
    _id?: ObjectId;
    auth: boolean;
    accessToken: string;
    refreshToken: string;
    expiry: Date;
    uri: string;
    owner: string;
}

export type DailyBalance = {
    _id?: ObjectId;
    date: Date;
    balance: number;
}

export type QuestradeRefreshTokenGrant = {
    access_token: string;
    api_server: string;
    expires_in: number;
    refresh_token: string;
    token_type: 'Bearer';
}

export type Account = {
    type: string;
    number: string;
}

/**
 * Daily percentage change for a stock symbol.
 */
export type SymbolPerformance = {
    symbol: string;
    symbolId: number;
    description: string;
    dayChangePercent: number;
}

/**
 * Balance information for a single Questrade account.
 */
export type AccountBalance = {
    accountNumber: string;
    accountType: string;
    owner: string;
    balance: number;
}

/**
 * Historical data point for portfolio chart.
 */
export type HistoryPoint = {
    date: string;
    value: number;
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
    lastUpdated: string;
}

/**
 * Position data from Questrade API.
 */
export type QuestradePosition = {
    symbol: string;
    symbolId: number;
    openQuantity: number;
    closedQuantity: number;
    currentMarketValue: number;
    currentPrice: number;
    averageEntryPrice: number;
    closedPnl: number;
    openPnl: number;
    totalCost: number;
    isRealTime: boolean;
    isUnderReorg: boolean;
}

/**
 * Quote data from Questrade API.
 */
export type QuestradeQuote = {
    symbol: string;
    symbolId: number;
    bidPrice: number;
    askPrice: number;
    lastTradePrice: number;
    openPrice: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
    delay: number;
    isHalted: boolean;
}

/**
 * Symbol details from Questrade API.
 */
export type QuestradeSymbol = {
    symbol: string;
    symbolId: number;
    description: string;
    securityType: string;
    listingExchange: string;
    currency: string;
    prevDayClosePrice: number | null;
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