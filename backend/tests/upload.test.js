// tests/upload.test.js — Unit tests for upload handler

const { getUploadUrl } = require('../src/handlers/upload');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url?sig=abc123'),
}));
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) }) ) },
  PutCommand: jest.fn(),
}));
jest.mock('../src/middleware/auth', () => ({
  getUserFromToken: jest.fn().mockReturnValue({
    sub: 'user-123',
    email: 'test@example.com',
  }),
}));

const mockEvent = (body) => ({
  headers: { Authorization: 'Bearer mock-token' },
  body: JSON.stringify(body),
});

describe('getUploadUrl', () => {
  beforeEach(() => {
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
    jest.clearAllMocks();
  });

  test('returns presigned URL for valid input', async () => {
    const event = mockEvent({ fileName: 'test.pdf', fileSize: 1024, mimeType: 'application/pdf' });
    const result = await getUploadUrl(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.uploadUrl).toContain('presigned-url');
    expect(body.fileId).toBeDefined();
    expect(body.expiresIn).toBe(900);
  });

  test('rejects missing fileName', async () => {
    const event = mockEvent({ fileSize: 1024 });
    const result = await getUploadUrl(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('fileName');
  });

  test('rejects file over 5 GB', async () => {
    const event = mockEvent({ fileName: 'huge.zip', fileSize: 6 * 1024 * 1024 * 1024 });
    const result = await getUploadUrl(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('5 GB');
  });

  test('rejects filename over 255 chars', async () => {
    const event = mockEvent({ fileName: 'a'.repeat(256) + '.pdf', fileSize: 100 });
    const result = await getUploadUrl(event);
    expect(result.statusCode).toBe(400);
  });

  test('uses root folder by default', async () => {
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    const mockSend = jest.fn().mockResolvedValue({});
    DynamoDBDocumentClient.from.mockReturnValue({ send: mockSend });

    const event = mockEvent({ fileName: 'file.txt', fileSize: 100 });
    await getUploadUrl(event);

    const putCall = mockSend.mock.calls[0][0];
    expect(putCall.input?.Item?.parentFolder || 'root').toBe('root');
  });
});
