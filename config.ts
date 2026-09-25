export default {
    timezone: 'America/Edmonton',
    apiPort: 5123,
    webSocketPort: 5124,
    homeAssistantUrl: 'ws://bravo:8123/api/websocket',
    wealthsimpleApiUrl: 'http://wealthsimple-api:8080',
    exchangeRateApiUrl: (apiKey: string) => `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
}