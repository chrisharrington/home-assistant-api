import type { Application, Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';

const command = ffmpeg('rtsp://192.168.1.101:8554/driveway')
    .format('mp4')
    .videoCodec('copy')
    .audioCodec('copy')
    .inputOptions('-avoid_negative_ts make_zero')
    .inputOptions('-fflags nobuffer+genpts+discardcorrupt')
    .inputOptions('-flags low_delay')
    .inputOptions('-strict experimental')
    .inputOptions('-rtsp_transport tcp')
    .inputOptions('-analyzeduration 0')
    .inputOptions('-probesize 500000')
    .outputOptions('-movflags frag_keyframe+empty_moov')
    .outputOptions('-bsf:a aac_adtstoasc')
    .on('start', command => console.log(command))
    .on('stderr', err => console.log(err))
    .on('error', err => console.log(err));


export default ((app: Application) => {
    app.get('/', getPage);
    app.get('/camera', getCameraStream);
});

const getPage = async (request: Request, response: Response) => {
    response.sendFile(path.resolve('./api/routes/test.html'));
}

const getCameraStream = (request: Request, response: Response) => {
    // ffmpeg -i rtsp://@192.168.241.1:62156 -acodec copy -vcodec copy c:/abc.mp4
    // response.sendStatus(200);

    response.setHeader('Content-Type', 'video/mp4');
    command.pipe(response);
}