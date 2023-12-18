declare global {
    namespace NodeJS {
        interface ProcessEnv {
            LOCAL_API_KEY: string;
            HOME_ASSISTANT_API_TOKEN: string;
            MONGO_CONNECTION_STRING: string;
            EXCHANGE_API_KEY: string;
            TELEGRAM_API_KEY: string;
        }
    }
}

export {}