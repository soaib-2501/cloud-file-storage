// handlers/folders.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { getUserFromToken } = require('../middleware/auth');
const { response, errorResponse } = require('../utils/response');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_TABLE;

/**
 * POST /folders
 * Body: { folderName, parentFolder? }
 */
exports.createFolder = async (event) => {
  try {
    const user = getUserFromToken(event);
    const { folderName, parentFolder = 'root' } = JSON.parse(event.body || '{}');

    if (!folderName || folderName.trim().length === 0) {
      return errorResponse(400, 'folderName is required');
    }
    if (folderName.length > 100) {
      return errorResponse(400, 'Folder name too long (max 100 chars)');
    }
    if (/[/\\:*?"<>|]/.test(folderName)) {
      return errorResponse(400, 'Folder name contains invalid characters');
    }

    const folderId = uuidv4();
    const now = new Date().toISOString();

    const folderRecord = {
      userId: user.sub,
      fileId: `folder_${folderId}`,   // prefix to distinguish from files
      folderName: folderName.trim(),
      fileName: folderName.trim(),     // consistent with file records
      type: 'folder',
      parentFolder,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user.email,
    };

    await dynamodb.send(new PutCommand({
      TableName: TABLE,
      Item: folderRecord,
      ConditionExpression: 'attribute_not_exists(fileId)',
    }));

    return response(201, { folder: folderRecord });

  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return errorResponse(409, 'Folder already exists');
    }
    console.error('createFolder error:', err);
    return errorResponse(500, 'Failed to create folder');
  }
};

/**
 * GET /folders — list all folders for breadcrumb navigation
 */
exports.listFolders = async (event) => {
  try {
    const user = getUserFromToken(event);

    const result = await dynamodb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'userId = :uid',
      FilterExpression: '#type = :folder AND isDeleted = :false',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: {
        ':uid': user.sub,
        ':folder': 'folder',
        ':false': false,
      },
    }));

    return response(200, { folders: result.Items });

  } catch (err) {
    console.error('listFolders error:', err);
    return errorResponse(500, 'Failed to list folders');
  }
};
