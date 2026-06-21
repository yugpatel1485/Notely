'use strict';

const jwt = require('jsonwebtoken');

// ── Startup guard ─────────────────────────────────────────────────────────────
// Fail fast if JWT secrets are missing or too weak. This prevents the silent
// "sign with undefined" vulnerability where jsonwebtoken accepts undefined as
// a secret and produces trivially-forgeable tokens.
(function validateSecrets() {
  const errors = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters long');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be set and at least 32 characters long');
  }

  if (errors.length > 0) {
    console.error('[FATAL] JWT configuration error:');
    errors.forEach((e) => console.error('  •', e));
    process.exit(1);
  }
})();

/**
 * Signs an access token for the given userId.
 * @param {string|ObjectId} userId
 * @returns {string} signed JWT
 */
function signAccessToken(userId) {
  return jwt.sign(
    { sub: userId.toString(), type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Signs a refresh token for the given userId.
 * @param {string|ObjectId} userId
 * @returns {string} signed JWT
 */
function signRefreshToken(userId) {
  return jwt.sign(
    { sub: userId.toString(), type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

/**
 * Verifies an access token.
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Verifies a refresh token.
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
