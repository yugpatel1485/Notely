'use strict';

/**
 * Central error-handling middleware.
 * Must be registered LAST with app.use().
 */
function errorHandler(err, req, res, _next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // Mongoose: duplicate key (e.g. email/username already taken)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} is already in use`;
    statusCode = 409;
  }

  // Mongoose: validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    message    = errors.join('. ');
    statusCode = 422;
  }

  // Mongoose: bad ObjectId
  if (err.name === 'CastError') {
    message    = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  // Never leak stack traces in production
  const payload = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
