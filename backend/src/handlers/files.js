// handlers/files.js — List, Get, Delete file operations

const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, QueryCommand, GetCommand,
  UpdateCommand, DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const { getUserFromToken } = require('../middleware/auth');
const { response, errorResponse } = require('../utils/response');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_TABLE;

/**
 * GET /files?folder=root&limit=50&cursor=xxx&search=xxx
 */
exports.listFiles = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { folder = 'root', limit = '50', cursor, search } = event.queryStringParameters || {};

    let params = {
      TableName: TABLE,
      IndexName: 'FolderIndex',
      KeyConditionExpression: 'userId = :uid AND parentFolder = :folder',
      FilterExpression: 'isDeleted = :false',
      ExpressionAttributeValues: {
        ':uid': user.sub,
        ':folder': folder,
        ':false': false,
      },
      Limit: Math.min(parseInt(limit), 100),
    };

    // Keyword search
    if (search) {
      params.FilterExpression += ' AND contains(fileName, :search)';
      params.ExpressionAttributeValues[':search'] = search;
    }

    if (cursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString());
    }

    const result = await dynamodb.send(new QueryCommand(params));

    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    return response(200, {
      files: result.Items,
      nextCursor,
      count: result.Count,
    });

  } catch (err) {
    console.error('listFiles error:', err);
    return errorResponse(500, 'Failed to list files');
  }
};

/**
 * GET /files/:fileId
 * Returns metadata + temporary signed S3 download URL
 */
exports.getFile = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { fileId } = event.pathParameters;

    const result = await dynamodb.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
    }));

    if (!result.Item || result.Item.isDeleted) {
      return errorResponse(404, 'File not found');
    }

    const file = result.Item;

    // Generate presigned S3 download URL (expires in 1 hour)
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.s3Key,
        ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
      }),
      { expiresIn: 3600 }
    );

    // Update last accessed timestamp
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
      UpdateExpression: 'SET lastAccessedAt = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));

    return response(200, { ...file, downloadUrl });

  } catch (err) {
    console.error('getFile error:', err);
    return errorResponse(500, 'Failed to get file');
  }
};

/**
 * DELETE /files/:fileId  — soft delete (moves to trash)
 */
exports.deleteFile = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { fileId } = event.pathParameters;
    const { permanent } = event.queryStringParameters || {};

    const result = await dynamodb.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
    }));

    if (!result.Item) {
      return errorResponse(404, 'File not found');
    }

    const file = result.Item;

    if (permanent === 'true') {
      // Hard delete: remove from S3 + DynamoDB
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.s3Key,
      }));

      await dynamodb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { userId: user.sub, fileId },
      }));

      return response(200, { message: 'File permanently deleted', fileId });
    }

    // Soft delete: mark as deleted
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
      UpdateExpression: 'SET isDeleted = :true, deletedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
      },
    }));

    return response(200, { message: 'File moved to trash', fileId });

  } catch (err) {
    console.error('deleteFile error:', err);
    return errorResponse(500, 'Failed to delete file');
  }
};

/**
 * PUT /files/:fileId  — rename or update metadata
 */
exports.updateFile = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { fileId } = event.pathParameters;
    const { fileName, description, tags, parentFolder } = JSON.parse(event.body || '{}');

    const updates = [];
    const values = { ':now': new Date().toISOString() };
    const names = {};

    if (fileName) {
      updates.push('#fn = :fn');
      values[':fn'] = fileName;
      names['#fn'] = 'fileName';
    }
    if (description !== undefined) {
      updates.push('description = :desc');
      values[':desc'] = description;
    }
    if (tags) {
      updates.push('tags = :tags');
      values[':tags'] = tags;
    }
    if (parentFolder) {
      updates.push('parentFolder = :pf');
      values[':pf'] = parentFolder;
    }

    updates.push('updatedAt = :now');

    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: user.sub, fileId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ConditionExpression: 'attribute_exists(fileId)',
    }));

    return response(200, { message: 'File updated', fileId });

  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return errorResponse(404, 'File not found');
    }
    console.error('updateFile error:', err);
    return errorResponse(500, 'Failed to update file');
  }
};