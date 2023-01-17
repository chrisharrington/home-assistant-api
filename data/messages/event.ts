import WebSocket from 'ws';

import { Message } from '.';


export class EventMessage extends Message<WebSocket.MessageEvent> {
    constructor(socket: WebSocket, event: WebSocket.MessageEvent) {
        super('event-message', socket, event);
    }

    async handle() : Promise<void> {
        this.log('Event message received.');
        this.dump(this.event.data);
    }
}