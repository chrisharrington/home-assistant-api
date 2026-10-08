export default {
    timezone: 'America/Edmonton',
    apiPort: 5123,
    webSocketPort: 5124,
    homeAssistantUrl: 'ws://bravo:8123/api/websocket',
    wealthsimpleApiUrl: 'http://wealthsimple-api:8080',
    exchangeRateApiUrl: (apiKey: string) => `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,

    // Household (non-own) Wealthsimple accounts, keyed by account id, mapped
    // to the member's name for display, e.g. "RRSP (Sarah)".
    householdAccountOwners: {
        'rrsp-ZFgB7yct0Q': 'Sarah'
    } as Record<string, string>
}