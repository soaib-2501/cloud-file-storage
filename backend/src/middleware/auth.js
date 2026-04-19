// middleware/auth.js — Validates Cognito JWT tokens

const https = require('https');
const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');

const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const JWKS_URL = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

// Cache JWKS keys (avoids fetching on every Lambda invocation)
let cachedKeys = null;

async function getJwks() {
  if (cachedKeys) return cachedKeys;

  return new Promise((resolve, reject) => {
    https.get(JWKS_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const { keys } = JSON.parse(data);
          cachedKeys = {};
          keys.forEach(key => {
            cachedKeys[key.kid] = jwkToPem(key);
          });
          resolve(cachedKeys);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Extract and validate JWT from Authorization header
 * Returns decoded token payload (includes sub, email, cognito:groups etc.)
 */
exports.getUserFromToken = (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  }

  const token = authHeader.split(' ')[1];

  // API Gateway with Cognito authorizer already validates the token.
  // This decode is to get the claims (userId, email etc.)
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.sub) {
      throw new Error('Invalid token payload');
    }
    return {
      sub: decoded.sub,
      email: decoded.email || decoded['cognito:username'],
      groups: decoded['cognito:groups'] || [],
      username: decoded['cognito:username'],
    };
  } catch (err) {
    throw Object.assign(new Error('Invalid token'), { statusCode: 401 });
  }
};

/**
 * Full JWT verification (use for Lambda Authorizer if not using Cognito built-in)
 */
exports.verifyToken = async (token) => {
  const keys = await getJwks();
  const { header } = jwt.decode(token, { complete: true });
  const pem = keys[header.kid];

  if (!pem) throw new Error('Unknown key ID');

  return jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  });
};
