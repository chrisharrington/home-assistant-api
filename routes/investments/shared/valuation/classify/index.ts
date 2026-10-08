/**
 * Account classification and shared valuation types: which Wealthsimple
 * accounts count toward the investment portfolio, and their display labels.
 */

/**
 * A cash amount in both CAD and USD, as returned by wealthsimple-api.
 */
export type CashAmount = {
    cad: number;
    usd: number;
}

/**
 * A live market quote for a single symbol.
 */
export type Quote = {
    price: number;
    previousClose: number;
}

/**
 * A single held position, pre-resolved to a Yahoo Finance query symbol (or
 * null if it can't be mapped) and carrying its Wealthsimple sync-time price
 * as a fallback.
 */
export type PositionInput = {
    securityId: string;
    quantity: number;
    symbol: string | null;
    yahooSymbol: string | null;
    currency: string | null;
    syncPrice: number | null;
}

/**
 * Everything needed to value a single Wealthsimple account.
 */
export type AccountValuationInput = {
    accountId: string;
    cash: CashAmount;
    positions: PositionInput[];
    holdingsValue: CashAmount;
    // Whether this account belongs to the household member (e.g. a spouse)
    // rather than to the account owner. Absent/undefined is treated as 'own'.
    scope?: 'own' | 'household';
}

/**
 * The result of valuing a single account.
 */
export type AccountValuationResult = {
    accountId: string;
    label: string;
    balance: number;
    changeCad: number;
    degraded: boolean;
    degradedSymbols: string[];
}

/**
 * The result of valuing the full portfolio.
 */
export type PortfolioValuation = {
    totalCad: number;
    changeCad: number;
    changePercent: number;
    degraded: boolean;
    degradedSymbols: string[];
    accounts: AccountValuationResult[];
}

// Account id prefixes that hold cash or credit rather than investments and
// are excluded from the portfolio total. `ca-cash-corporate-` is
// deliberately included here: despite the name similarity to `corporate-`
// (an investment account prefix), it's the corporate chequing/cash account,
// not an investment holding.
const excludedPrefixes = ['ca-cash-', 'ca-credit-card-'];

// Account id prefix to display label. Longer, more specific prefixes are
// checked first so `spousal-rrsp-` and `non-registered-` don't fall through
// to a shorter unrelated prefix.
const labelsByPrefix: [string, string][] = [
    ['spousal-rrsp-', 'Spousal RRSP'],
    ['non-registered-', 'Non-Registered'],
    ['rrsp-', 'RRSP'],
    ['tfsa-', 'TFSA'],
    ['resp-', 'RESP'],
    ['corporate-', 'Corporate']
];

/**
 * Determines whether an account counts toward the investment portfolio total.
 * @param accountId - The Wealthsimple account id.
 * @returns True if the account is an investment account, false if it's cash or credit.
 */
export function isInvestmentAccount(accountId: string): boolean {
    return !excludedPrefixes.some(prefix => accountId.startsWith(prefix));
}

/**
 * Maps an account id to a display label based on its id prefix, optionally
 * suffixed with a household member's name (e.g. "RRSP (Sarah)"). The owner
 * name is resolved by the caller - this stays a pure string mapping with no
 * config lookup.
 * @param accountId - The Wealthsimple account id.
 * @param householdOwnerName - The household member's name to append, or null/undefined for an own account.
 * @returns A human-readable account type label, or the prefix uppercased if unrecognized.
 */
export function labelForAccount(accountId: string, householdOwnerName?: string | null): string {
    const match = labelsByPrefix.find(([prefix]) => accountId.startsWith(prefix)),
        typeLabel = match ? match[1] : accountId.split('-')[0].toUpperCase();

    return householdOwnerName ? `${typeLabel} (${householdOwnerName})` : typeLabel;
}
