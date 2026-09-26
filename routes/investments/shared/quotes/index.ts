/**
 * Yahoo Finance quote client used for intraday position pricing. Yahoo has
 * no official public quote API, so this uses its unauthenticated chart
 * endpoint; the response shape isn't guaranteed to stay stable, so callers
 * must treat a fetch or parse failure as a normal, expected outcome (see the
 * degraded-valuation fallback in the shared module).
 */

import fetch from 'node-fetch';
import { Quote } from '../valuation';

// A regular browser user agent. Yahoo's unauthenticated chart endpoint
// rejects requests that look like they're coming from a script.
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Default per-quote request timeout.
const defaultTimeoutMs = 5000;

// Market identifier code mapped to its Yahoo Finance ticker suffix. US
// exchanges take no suffix. An MIC missing from this map has no known
// mapping and is skipped for live quoting.
const suffixByMic: Record<string, string> = {
    XTSE: '.TO',
    XTSX: '.V',
    NEOE: '.NE',
    XNEO: '.NE',
    XCNQ: '.CN',
    XNAS: '',
    XNYS: '',
    ARCX: '',
    BATS: '',
    XASE: ''
};

/**
 * Resolves a Wealthsimple position's symbol and primary market identifier
 * code to a Yahoo Finance query symbol.
 * @param symbol - The position's ticker symbol.
 * @param primaryMic - The position's primary market identifier code.
 * @returns The Yahoo Finance query symbol, or null if the symbol or MIC can't be mapped.
 */
export function resolveYahooSymbol(symbol: string | null, primaryMic: string | null): string | null {
    if (!symbol || !primaryMic) return null;

    const suffix = suffixByMic[primaryMic];
    return suffix === undefined ? null : `${symbol}${suffix}`;
}

/**
 * Formats an instant as a calendar date (YYYY-MM-DD) in the given timezone.
 * @param date - The instant to format.
 * @param timeZone - The IANA timezone to interpret it in.
 * @returns The local calendar date.
 */
export function localDate(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/**
 * Extracts price and previous close from a Yahoo Finance chart API response.
 * Separated from the network call so it can be unit tested with sample JSON
 * rather than by mocking the network.
 *
 * When the market is closed for the day (weekend, holiday, or before the
 * open), Yahoo still returns the last session's price and that session's
 * previous close, which would report the last session's change as today's.
 * If the last trade isn't from today in the exchange's timezone, previous
 * close is set to the price so the quote contributes no change.
 * @param json - The parsed response body.
 * @param now - The current time, injectable for tests.
 * @returns The quote, or null if the response doesn't contain the expected fields.
 */
export function parseYahooChartResponse(json: unknown, now: Date = new Date()): Quote | null {
    const meta = (json as { chart?: { result?: { meta?: unknown }[] } })?.chart?.result?.[0]?.meta as
        { regularMarketPrice?: unknown; chartPreviousClose?: unknown; regularMarketTime?: unknown; exchangeTimezoneName?: unknown } | undefined;

    if (typeof meta?.regularMarketPrice !== 'number' || typeof meta?.chartPreviousClose !== 'number') return null;

    const price = meta.regularMarketPrice,
        tradedToday = typeof meta.regularMarketTime !== 'number' || typeof meta.exchangeTimezoneName !== 'string'
            || localDate(new Date(meta.regularMarketTime * 1000), meta.exchangeTimezoneName) === localDate(now, meta.exchangeTimezoneName);

    return { price, previousClose: tradedToday ? meta.chartPreviousClose : price };
}

/**
 * Fetches a single live quote from Yahoo Finance.
 * @param yahooSymbol - The Yahoo Finance query symbol (e.g. "HXT.TO").
 * @param timeoutMs - Request timeout in milliseconds.
 * @returns The quote, or null if the request or response fails.
 */
export async function fetchYahooQuote(yahooSymbol: string, timeoutMs: number = defaultTimeoutMs): Promise<Quote | null> {
    const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`,
            { headers: { 'User-Agent': userAgent }, signal: controller.signal as AbortSignal }
        );

        if (!response.ok) return null;

        return parseYahooChartResponse(await response.json());
    } catch (e) {
        console.error(`Error fetching Yahoo quote for ${yahooSymbol}: ${e instanceof Error ? e.message : e}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetches live quotes for a set of Yahoo Finance query symbols in parallel,
 * de-duplicating repeats. A failed individual quote is simply omitted from
 * the result map rather than failing the whole batch.
 * @param yahooSymbols - The Yahoo Finance query symbols to quote.
 * @returns Quotes keyed by Yahoo Finance query symbol.
 */
export async function fetchYahooQuotes(yahooSymbols: string[]): Promise<Map<string, Quote>> {
    const unique = Array.from(new Set(yahooSymbols)),
        results = await Promise.all(unique.map(async symbol => [symbol, await fetchYahooQuote(symbol)] as const)),
        quotes = new Map<string, Quote>();

    for (const [symbol, quote] of results) {
        if (quote) quotes.set(symbol, quote);
    }

    return quotes;
}
