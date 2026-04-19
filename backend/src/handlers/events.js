// handlers/events.js — Triggered by S3 upload event
// Runs AFTER browser uploads file directly to S3

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({ region: process.env.AWS_REGION });

const TABLE = process.env.DYNAMODB_TABLE;
const SNS_TOPIC = process.env.SNS_TOPIC_ARN;

/**
 * Triggered by S3 ObjectCreated event
 * 1. Gets actual file metadata from S3
 * 2. Updates DynamoDB record: status pending → uploaded
 * 3. Publishes SNS notification
 */
exports.s3EventHandler = async (event) => {
  console.log('S3 event received:', JSON.stringify(event, null, 2));

  const results = await Promise.allSettled(
    event.Records.map(record => processRecord(record))
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Record ${i} failed:`, r.reason);
    }
  });
};

async function processRecord(record) {
  const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const fileSize = record.s3.object.size;
  const bucket = record.s3.bucket.name;

  // Extract fileId from S3 key: userId/folder/fileId.ext
  const parts = s3Key.split('/');
  const userId = parts[0];
  const fileNameWithExt = parts[parts.length - 1];
  const fileId = fileNameWithExt.split('.')[0];

  // Get actual S3 object metadata
  const headResult = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
  const etag = headResult.ETag?.replace(/"/g, '');
  const contentType = headResult.ContentType;

  // Update DynamoDB: mark as uploaded
  await dynamodb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, fileId },
    UpdateExpression: `
      SET #status = :uploaded,
          fileSize = :size,
          etag = :etag,
          contentType = :ct,
          uploadedAt = :now,
          updatedAt = :now
    `,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':uploaded': 'uploaded',
      ':size': fileSize,
      ':etag': etag,
      ':ct': contentType,
      ':now': new Date().toISOString(),
    },
  }));

  // Query file record to get user email etc.
  const fileResult = await dynamodb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid AND fileId = :fid',
    ExpressionAttributeValues: { ':uid': userId, ':fid': fileId },
    Limit: 1,
  }));

  const file = fileResult.Items?.[0];
  if (!file) return;

  // Publish SNS event (triggers email notification Lambda)
  await sns.send(new PublishCommand({
    TopicArn: SNS_TOPIC,
    Subject: 'File Upload Complete',
    Message: JSON.stringify({
      type: 'UPLOAD_COMPLETE',
      userId,
      fileId,
      fileName: file.fileName,
      fileSize,
      userEmail: file.createdBy,
      uploadedAt: new Date().toISOString(),
    }),
  }));

  console.log(`✅ File processed: ${fileId} (${fileSize} bytes)`);
}
