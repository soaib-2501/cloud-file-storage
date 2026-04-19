// handlers/upload.js
// Generates presigned S3 URLs so the browser uploads DIRECTLY to S3
// This bypasses the 6MB Lambda payload limit entirely

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const { getUserFromToken } = require('../middleware/auth');
const { response, errorResponse } = require('../utils/response');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BUCKET = process.env.S3_BUCKET_NAME;
const TABLE = process.env.DYNAMODB_TABLE;
const URL_EXPIRY_SECONDS = 900; // 15 minutes
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

/**
 * POST /files/upload-url
 * Body: { fileName, fileSize, mimeType, parentFolder?, description? }
 * Returns: { uploadUrl, fileId, fields }
 */
exports.getUploadUrl = async (event) => {
  try {
    const user = getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');

    // Validate input
    const { fileName, fileSize, mimeType, parentFolder = 'root', description = '' } = body;

    if (!fileName || !fileSize) {
      return errorResponse(400, 'fileName and fileSize are required');
    }
    if (fileSize > MAX_FILE_SIZE) {
      return errorResponse(400, 'File size exceeds 5 GB limit');
    }
    if (fileName.length > 255) {
      return errorResponse(400, 'File name too long');
    }

    const fileId = uuidv4();
    const ext = fileName.split('.').pop().toLowerCase();
    const contentType = mimeType || mime.lookup(fileName) || 'application/octet-stream';

    // S3 key: userId/folder/fileId.ext  — scoped per user for security
    const s3Key = `${user.sub}/${parentFolder}/${fileId}.${ext}`;

    // Generate presigned PUT URL (browser uploads directly — no Lambda size limit)
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
        'original-name': encodeURIComponent(fileName),
        'user-id': user.sub,
        'file-id': fileId,
      },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });

    // Save file metadata to DynamoDB (status: pending — updated by S3 event trigger)
    const now = new Date().toISOString();
    const fileRecord = {
      userId: user.sub,
      fileId,
      fileName,
      originalName: fileName,
      s3Key,
      contentType,
      fileSize,
      parentFolder,
      description,
      status: 'pending',    // → 'uploaded' after S3 event fires
      isDeleted: false,
      isShared: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user.email,
      tags: [],
    };

    await dynamodb.send(new PutCommand({
      TableName: TABLE,
      Item: fileRecord,
    }));

    return response(200, {
      uploadUrl,
      fileId,
      s3Key,
      expiresIn: URL_EXPIRY_SECONDS,
      instructions: 'PUT the file directly to uploadUrl with correct Content-Type header',
    });

  } catch (err) {
    console.error('getUploadUrl error:', err);
    return errorResponse(500, 'Failed to generate upload URL');
  }
};
