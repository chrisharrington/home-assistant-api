import WebSocket from 'ws';


export enum MessageType {
    authRrequired = 'auth_required',
    authOk = 'auth_ok',
    authInvalid = 'auth_invalid',

    result = 'result',
    event = 'event'
}

export enum MessageType {
    events = 1
}

export interface MessageData {
    type: string;
    ha_version?: string;
    id?: number;
}

export abstract class Message<TMessageEventType> {
    private name: string;

    protected socket: WebSocket;
    protected event: TMessageEventType;

    constructor(name: string, socket: WebSocket, event: TMessageEventType) {
        this.name = name;
        this.socket = socket;
        this.event = event;
    }

    log(message: string) {
        console.log(`[${this.name}] ${message}`);
    }

    dump(obj?: any) {
        console.log(obj || (this.event as any).data);
    }

    abstract handle() : Promise<void>;
}