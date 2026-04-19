// utils/response.js — Standardized Lambda HTTP responses

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

exports.response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

exports.errorResponse = (statusCode, message, details = null) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ error: message, ...(details && { details }) }),
});
