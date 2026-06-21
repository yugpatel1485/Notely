'use strict';

/**
 * Send a successful JSON response.
 * @param {Response} res
 * @param {any}      data
 * @param {string}   [message]
 * @param {number}   [statusCode=200]
 */
function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

/**
 * Send an error JSON response.
 * @param {Response} res
 * @param {string}   message
 * @param {number}   [statusCode=400]
 * @param {any}      [errors]
 */
function sendError(res, message, statusCode = 400, errors = null) {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
}

module.exports = { sendSuccess, sendError };
