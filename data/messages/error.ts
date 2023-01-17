import WebSocket from 'ws';

import { Message } from '.';


export class ErrorMessage extends Message<WebSocket.ErrorEvent> {
    constructor(socket: WebSocket, event: WebSocket.ErrorEvent) {
        super('error-message', socket, event);
    }

    async handle() : Promise<void> {
        this.log('Error occurred');
        console.error(this.event.error);
    }
}