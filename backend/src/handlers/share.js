// handlers/share.js — Generate shareable links

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { generateSignedCloudfrontUrl } = require('../utils/cloudfront');
const { getUserFromToken } = require('../middleware/auth');
const { response, errorResponse } = require('../utils/response');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_TABLE;

/**
 * POST /files/:fileId/share
 * Body: { expiresInHours: 24, password?: 'optional' }
 * Returns: { shareUrl, shareId, expiresAt }
 */
exports.shareFile = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { fileId } = event.pathParameters;
    const { expiresInHours = 24, allowDownload = true } = JSON.parse(event.body || '{}');

    // Validate expiry
    const maxHours = 168; // 7 days
    const hours = Math.min(parseInt(expiresInHours), maxHours);

    // Get file record + verify ownership
    const result = await dynamodb.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
    }));

    if (!result.Item || result.Item.isDeleted) {
      return errorResponse(404, 'File not found');
    }

    const file = result.Item;
    const shareId = uuidv4();
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const expiresInSeconds = hours * 3600;

    // Generate signed CloudFront URL for the share
    const signedUrl = generateSignedCloudfrontUrl(file.s3Key, expiresInSeconds);

    // Store share record in DynamoDB
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
      UpdateExpression: `
        SET isShared = :true,
            shareId = :sid,
            shareExpiresAt = :exp,
            shareUrl = :url,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':true': true,
        ':sid': shareId,
        ':exp': expiresAt,
        ':url': signedUrl,
        ':now': new Date().toISOString(),
      },
    }));

    return response(200, {
      shareId,
      shareUrl: signedUrl,
      fileName: file.fileName,
      expiresAt,
      expiresInHours: hours,
    });

  } catch (err) {
    console.error('shareFile error:', err);
    return errorResponse(500, 'Failed to generate share link');
  }
};
