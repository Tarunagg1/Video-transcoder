import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import type { S3Event } from 'aws-lambda';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';


const client = new SQSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
});

const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
});



async function init() {
    const command = new ReceiveMessageCommand({
        QueueUrl: "https://sqs.ap-south-1.amazonaws.com/333746049876/temp-raw-video",
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20
    });

    while (true) {
        const { Messages } = await client.send(command);
        if (!Messages) {
            console.log('No messages received');
            continue;
        }

        try {
            for (const message of Messages) {
                const { MessageId, Body } = message;
                // console.log('Message received ', { MessageId, Body });
                // Validate the event

                if (!Body) continue;

                const event = JSON.parse(Body) as S3Event;

                // Ignore the test  event
                if ("Service" in event && "Event" in event) {
                    if (event.Event === "s3:TestEvent") {
                        await client.send(new DeleteMessageCommand({
                            QueueUrl: "https://sqs.ap-south-1.amazonaws.com/333746049876/temp-raw-video",
                            ReceiptHandle: message.ReceiptHandle
                        }));
                        continue;
                    };
                }

                for (const record of event.Records) {
                    const { s3 } = record;
                    console.log(s3);

                    const { bucket, object: { key }, } = s3;
                    // spin the container

                    const runTashCommand = new RunTaskCommand({
                        taskDefinition: 'arn:aws:ecs:ap-south-1:333746049876:task-definition/video-transcoder',
                        cluster: 'arn:aws:ecs:ap-south-1:333746049876:cluster/dev',
                        launchType: 'FARGATE',
                        networkConfiguration: {
                            awsvpcConfiguration: {
                                assignPublicIp: "ENABLED",
                                subnets: ["subnet-07ba45178a233265e", "subnet-09e92476fb025eeb2", "subnet-0a2234eb5d30ed545"],
                                securityGroups: ["sg-0a63d2431a8539f16"],
                            }
                        },
                        overrides: {
                            containerOverrides: [{
                                name: 'videotranscoder',
                                environment: [
                                    {
                                        name: "BUCKET_NAME",
                                        value: bucket.name
                                    },
                                    {
                                        name: "KEY",
                                        value: key
                                    }
                                ]
                            }]
                        }
                    });
                    await ecsClient.send(runTashCommand);
                    // delete the message

                    await client.send(new DeleteMessageCommand({
                        QueueUrl: "https://sqs.ap-south-1.amazonaws.com/333746049876/temp-raw-video",
                        ReceiptHandle: message.ReceiptHandle
                    }));
                }

            }
        } catch (error) {
            console.log(error);
        }
    }
}



init();




