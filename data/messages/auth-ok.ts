import WebSocket from 'ws';

import { Message, MessageType } from '.';


export class AuthOkMessage extends Message<WebSocket.MessageEvent> {
    constructor(socket: WebSocket, event: WebSocket.MessageEvent) {
        super('auth-ok-message', socket, event);
    }

    async handle() : Promise<void> {
        this.log('Authentication successful.');
        
        this.socket.send(JSON.stringify({
            type: 'subscribe_entities',
            id: MessageType.events    
        }));
    }
}