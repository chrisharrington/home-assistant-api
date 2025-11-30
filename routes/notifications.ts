import { Application, Request, Response } from 'express';

type Notification = {
    message: string;
    title: string;
    push_token: string;
    registration_info: {
        app_id: string;
        app_version: string;
        os_version: string;
        webhook_id: string;
    },
    data: {
        [key: string] : string
    }
}

export default ((app: Application) => {
    app.post('/notification', handleNotification);
});

const handleNotification = async (request: Request, response: Response) => {
    try {
        console.log('notification received');

        const notification = request.body as Notification;
        console.log(notification);

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.status(500).send(e);
    }
}