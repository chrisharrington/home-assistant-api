import WebSocket from 'ws';

import Config from '@root/config';
import Secret from '@root/secret';
import { MessageBuilder } from '@root/data/messages';


class HomeAssistant {
    private builder: MessageBuilder;
    private eventCallbacks: (() => void)[];

    constructor() {
        this.builder = new MessageBuilder();
        this.eventCallbacks = [];
    }

    async init() {
        try {
            const socket = new WebSocket(Config.homeAssistantUrl);
            socket.addEventListener('open', () => this.handleOpen(socket));
            socket.addEventListener('message', event => this.handleMessage(socket, event));
            socket.addEventListener('close', () => this.handleClose());
            socket.addEventListener('error', event => this.handleError(socket, event));
        } catch (e) {
            console.error(e);
        }
    }

    public async onEvent(callback: () => void) {
        this.eventCallbacks.push(callback);
    }

    private async handleOpen(socket: WebSocket) {
        try {
            socket.send(JSON.stringify({
                type: 'auth',
                access_token: Secret.homeAssistentApiToken
            }));
        } catch (err) {
            console.log('Error while opening socket.');
            console.error(err);
            socket.close();
        }
    }

    private async handleMessage(socket: WebSocket, event: WebSocket.MessageEvent) {
        await this.builder.message(socket, event).handle();
    }

    private async handleClose() {

    }

    private async handleError(socket: WebSocket, event: WebSocket.ErrorEvent) {
        await this.builder.error(socket, event).handle();
    }
}

export default new HomeAssistant();