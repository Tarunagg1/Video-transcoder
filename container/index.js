const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const fs = require('node:fs/promises');
const path = require('node:path');
var ffmpeg = require('fluent-ffmpeg');
const fsOld = require('fs');

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

const transCodedBucket = 'taruntranscoded-videos';


const RESOLUTIONSS = [
    { name: "360p", width: "400", height: "360" },
    { name: "480p", width: "858", height: "400" },
    { name: "720p", width: "1280", height: "720" }
]

async function init() {
    // downlload the origin  video
    try {
        console.log({
            Bucket: BUCKET_NAME,
            key: KEY
        });

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: KEY
        });

        const result = await s3Client.send(command);

        const originalFilePath = 'original-video.mp4';


        await fs.writeFile(originalFilePath, result.Body);

        const originalVideoPath = path.resolve(originalFilePath);


        const promises = RESOLUTIONSS.map((resolution) => {
            const output = `video-${Date.now()}-${resolution.name}.mp4`;
            console.log(output);

            return new Promise((resolve, reject) => {
                // start the transcoder
                ffmpeg(originalVideoPath).output(output)
                    .withVideoCodec("libx264")
                    .withAudioCodec("aac")
                    .withSize(`${resolution.width}x${resolution.height}`)
                    .on('end', async () => {
                        console.log('start ', `${resolution.width}x${resolution.height}`);
                        const command = new PutObjectCommand({
                            Bucket: transCodedBucket,
                            Key: output,
                            Body: fsOld.createReadStream(path.resolve(output))
                        });
                        await s3Client.send(command);
                        resolve(output);
                    })
                    .format("mp4")
                    .run();
            })
        })

        await Promise.all(promises);
    } catch (error) {
        console.log(error);
    }
}


init().finally(() => {
    process.exit(0);
})


// upload the videos