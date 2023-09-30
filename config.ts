export default {
    timezone: 'America/Edmonton',
    apiPort: 5123,
    webSocketPort: 5124,
    homeAssistantUrl: 'ws://192.168.1.101:8123/api/websocket',
    questradeRefreshTokenUri: (refreshToken: string) => `https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=${refreshToken}`,
    questradeAccounts: 'v1/accounts',
    questradeBalance: (accountNumber: string) => `v1/accounts/${accountNumber}/balances`,
    questradeBalanceUpdateCron: '30 14 1 * *',
    exchangeRateApiUrl: (apiKey: string) => `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
}