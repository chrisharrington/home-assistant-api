import WebSocket from 'ws';
import {
    Message,
    MessageType,
    MessageData,
    AuthInvalidMessage,
    AuthOkMessage,
    EventMessage,
    ErrorMessage
} from '.';


export class MessageBuilder {
    message(socket: WebSocket, event: WebSocket.MessageEvent) : Message<WebSocket.MessageEvent> {
        const data = JSON.parse(event.data as string) as MessageData;
        if (data.type === MessageType.authInvalid)
            return new AuthInvalidMessage(socket, event);
        if (data.type === MessageType.authOk)
            return new AuthOkMessage(socket, event);

        return new EventMessage(socket, event);
    }

    error(socket: WebSocket, event: WebSocket.ErrorEvent) : Message<WebSocket.ErrorEvent> {
        return new ErrorMessage(socket, event);
    }
}