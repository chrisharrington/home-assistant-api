export default {
    timezone: 'America/Edmonton',
    apiPort: 5123,
    webSocketPort: 5124,
    homeAssistantUrl: 'ws://bravo:8123/api/websocket',
    questradeRefreshTokenUri: (refreshToken: string) => `https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=${refreshToken}`,
    questradeAccounts: 'v1/accounts',
    questradeBalance: (accountNumber: string) => `v1/accounts/${accountNumber}/balances`,
    questradeBalanceUpdateCron: '30 23 * * *',
    exchangeRateApiUrl: (apiKey: string) => `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
}