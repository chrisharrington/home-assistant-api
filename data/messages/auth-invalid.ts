import WebSocket from 'ws';

import { Message } from '.';


export class AuthInvalidMessage extends Message<WebSocket.MessageEvent> {
    constructor(socket: WebSocket, event: WebSocket.MessageEvent) {
        super('auth-invalid-message', socket, event);
    }

    async handle() : Promise<void> {
        this.log('Invalid authentication.');
        this.dump();
        this.socket.close();
    }
}