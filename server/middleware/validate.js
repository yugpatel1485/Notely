'use strict';

const { body, validationResult } = require('express-validator');
const { sendError }              = require('../utils/response');

/**
 * Runs after a chain of express-validator rules.
 * If there are errors, sends a 422 with the list; otherwise calls next().
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(
      res,
      'Validation failed',
      422,
      errors.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
  next();
}

// ── Auth validation chains ────────────────────────────────────────────────────
const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

const loginRules = [
  body('email').trim().toLowerCase().isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Note validation chains ────────────────────────────────────────────────────
const createNoteRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),

  body('content')
    .optional()
    .isString().withMessage('Content must be a string'),

  body('tags')
    .optional()
    .isArray({ max: 10 }).withMessage('Tags must be an array with at most 10 items'),

  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic must be a boolean'),

  body('color')
    .optional()
    .matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).withMessage('Invalid hex color'),
];

const updateNoteRules = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),

  body('content').optional().isString(),
  body('tags').optional().isArray({ max: 10 }),
  body('isPublic').optional().isBoolean(),
  body('color').optional().matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  createNoteRules,
  updateNoteRules,
};
