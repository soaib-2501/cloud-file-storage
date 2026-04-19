// utils/cloudfront.js — Generates signed CloudFront URLs
// Files in S3 are private; CloudFront signed URLs provide time-limited access

const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
const KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID;
// Private key stored in Lambda env var (or fetch from SSM Parameter Store)
const PRIVATE_KEY = process.env.CLOUDFRONT_PRIVATE_KEY
  ? Buffer.from(process.env.CLOUDFRONT_PRIVATE_KEY, 'base64').toString('utf-8')
  : null;

/**
 * Generate a time-limited signed CloudFront URL
 * @param {string} s3Key - S3 object key
 * @param {number} expiresInSeconds - URL validity duration
 */
exports.generateSignedCloudfrontUrl = (s3Key, expiresInSeconds = 3600) => {
  if (!PRIVATE_KEY || !KEY_PAIR_ID) {
    // Fallback for local development: return direct S3 URL (not for production)
    console.warn('CloudFront signing keys not configured — returning S3 path');
    return `${CLOUDFRONT_URL}/${s3Key}`;
  }

  const url = `${CLOUDFRONT_URL}/${s3Key}`;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return getSignedUrl({
    url,
    keyPairId: KEY_PAIR_ID,
    dateLessThan: new Date(expiresAt * 1000).toISOString(),
    privateKey: PRIVATE_KEY,
  });
};
