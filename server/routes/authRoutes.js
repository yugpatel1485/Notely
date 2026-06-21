'use strict';

const express         = require('express');
const rateLimit       = require('express-rate-limit');
const {
  register, login, getProfile, updateProfile, refreshToken, deleteAccount,
}                     = require('../controllers/authController');
const { protect }     = require('../middleware/auth');
const {
  registerRules, loginRules, deleteAccountRules, validate,
}                     = require('../middleware/validate');

const router = express.Router();

// Tighter rate limit on auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      20,
  message:  { success: false, message: 'Too many requests from this IP — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login',    authLimiter, loginRules,    validate, login);
router.post('/refresh',  authLimiter, refreshToken);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get   ('/profile', protect, getProfile);
router.put   ('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccountRules, validate, deleteAccount);

module.exports = router;
