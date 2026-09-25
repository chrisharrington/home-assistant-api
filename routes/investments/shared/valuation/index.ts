/**
 * Pure valuation math for the investments module: per-account and
 * portfolio-level value, and intraday change. Contains no I/O so it can be
 * unit tested without mocking the network or MongoDB. Account
 * classification/labeling lives in ./classify.
 */

import { AccountValuationInput, AccountValuationResult, PortfolioValuation, PositionInput, Quote, labelForAccount } from './classify';

export type { CashAmount, Quote, PositionInput, AccountValuationInput, AccountValuationResult, PortfolioValuation } from './classify';
export { isInvestmentAccount, labelForAccount } from './classify';

/**
 * Values a single position, preferring a live quote, then falling back to
 * the Wealthsimple sync-time price. Also computes the position's
 * contribution to intraday change, which only ever comes from a live quote.
 * @param position - The position to price.
 * @param quotes - Live quotes keyed by Yahoo Finance query symbol.
 * @param fxUsdToCad - The USD to CAD exchange rate.
 * @returns The position's CAD value (null if unpriceable), its CAD change contribution, and whether pricing it required a fallback.
 */
function valuePosition(position: PositionInput, quotes: Map<string, Quote>, fxUsdToCad: number): {
    valueCad: number | null;
    changeCad: number;
    degraded: boolean;
} {
    const fx = position.currency === 'USD' ? fxUsdToCad : 1,
        quote = position.yahooSymbol ? quotes.get(position.yahooSymbol) : undefined;

    // Live quote available: price and change both come from it.
    if (quote) {
        return {
            valueCad: position.quantity * quote.price * fx,
            changeCad: position.quantity * (quote.price - quote.previousClose) * fx,
            degraded: false
        };
    }

    // No live quote. Fall back to the Wealthsimple sync-time price; no
    // previous close is available for it, so it contributes no change.
    if (position.syncPrice !== null) {
        return { valueCad: position.quantity * position.syncPrice * fx, changeCad: 0, degraded: true };
    }

    // Neither a live quote nor a sync-time price. The caller falls back to
    // the account's holdings value rather than dropping this holding.
    return { valueCad: null, changeCad: 0, degraded: true };
}

/**
 * Values a single account: cash plus positions, falling back to the
 * Wealthsimple sync-time holdings value for the whole account if any
 * position can't be priced individually.
 * @param account - The account to value.
 * @param quotes - Live quotes keyed by Yahoo Finance query symbol.
 * @param fxUsdToCad - The USD to CAD exchange rate.
 * @returns The account's valuation result.
 */
export function valuateAccount(account: AccountValuationInput, quotes: Map<string, Quote>, fxUsdToCad: number): AccountValuationResult {
    const cashCad = account.cash.cad + account.cash.usd * fxUsdToCad;

    let holdingsCad = 0,
        changeCad = 0,
        degraded = false,
        unpriced = false;
    const degradedSymbols: string[] = [];

    for (const position of account.positions) {
        const result = valuePosition(position, quotes, fxUsdToCad);

        if (result.degraded) {
            degraded = true;
            degradedSymbols.push(position.symbol || position.securityId);
        }

        changeCad += result.changeCad;

        if (result.valueCad === null) unpriced = true;
        else holdingsCad += result.valueCad;
    }

    // A fully unpriceable position means we can't trust the summed position
    // value for this account, so use its Wealthsimple sync-time holdings
    // value for the whole account instead of dropping just that holding.
    if (unpriced) holdingsCad = account.holdingsValue.cad + account.holdingsValue.usd * fxUsdToCad;

    return {
        accountId: account.accountId,
        label: labelForAccount(account.accountId),
        balance: cashCad + holdingsCad,
        changeCad,
        degraded,
        degradedSymbols
    };
}

/**
 * Values the full portfolio across a set of investment accounts.
 * @param accounts - Investment accounts to value (cash/credit accounts already excluded).
 * @param quotes - Live quotes keyed by Yahoo Finance query symbol.
 * @param fxUsdToCad - The USD to CAD exchange rate.
 * @returns The portfolio valuation, including per-account results.
 */
export function valuatePortfolio(accounts: AccountValuationInput[], quotes: Map<string, Quote>, fxUsdToCad: number): PortfolioValuation {
    const results = accounts.map(account => valuateAccount(account, quotes, fxUsdToCad)),
        totalCad = results.reduce((sum, result) => sum + result.balance, 0),
        changeCad = results.reduce((sum, result) => sum + result.changeCad, 0),
        previousTotal = totalCad - changeCad,
        changePercent = previousTotal > 0 ? Math.round((changeCad / previousTotal) * 10000) / 100 : 0,
        degraded = results.some(result => result.degraded),
        degradedSymbols = Array.from(new Set(results.flatMap(result => result.degradedSymbols)));

    return { totalCad, changeCad, changePercent, degraded, degradedSymbols, accounts: results };
}
