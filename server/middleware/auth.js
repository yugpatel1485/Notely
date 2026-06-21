'use strict';

const User                          = require('../models/User');
const { verifyAccessToken }         = require('../utils/jwt');
const { sendError }                 = require('../utils/response');

/**
 * Protects a route by verifying the Bearer JWT in Authorization header.
 * On success, attaches `req.user` (full document minus password).
 */
async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Not authenticated — no token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return sendError(res, 'User belonging to this token no longer exists', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'This account has been deactivated', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token has expired — please log in again', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token — please log in again', 401);
    }
    next(err);
  }
}

/**
 * Restricts access to specific roles.
 * Must be used AFTER `protect`.
 * @param {...string} roles
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
}

module.exports = { protect, restrictTo };
