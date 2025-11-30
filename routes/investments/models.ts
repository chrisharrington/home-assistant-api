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