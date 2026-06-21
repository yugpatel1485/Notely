'use strict';

const { URL } = require('url');
const User = require('../models/User');
const Note = require('../models/Note');
const { cleanupNoteAttachments } = require('./uploadController');
const { signAccessToken, signRefreshToken,
  verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueTokens(userId) {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { username, email, password }
 */
async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    const user = await User.create({ username, email, password });
    const tokens = issueTokens(user._id);

    return sendSuccess(
      res,
      { user: user.toPublicProfile(), ...tokens },
      'Account created successfully',
      201
    );
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Explicitly re-select password (it's select:false on the schema)
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'This account has been deactivated', 401);
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const tokens = issueTokens(user._id);

    return sendSuccess(res, { user: user.toPublicProfile(), ...tokens }, 'Logged in successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/profile
 * Protected — requires valid access token.
 */
async function getProfile(req, res) {
  // req.user is attached by the protect middleware
  return sendSuccess(res, { user: req.user.toPublicProfile() }, 'Profile fetched');
}

/**
 * PUT /api/auth/profile
 * Protected — update username or avatar.
 */
async function updateProfile(req, res, next) {
  try {
    const allowedFields = ['username', 'avatar'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Validate avatar: must be empty string or a safe https:// URL.
    // Reject javascript: URIs, data: URIs, and internal URLs.
    if (updates.avatar !== undefined && updates.avatar !== '') {
      let parsed;
      try { parsed = new URL(updates.avatar); } catch {
        return sendError(res, 'avatar must be a valid URL', 400);
      }
      if (parsed.protocol !== 'https:') {
        return sendError(res, 'avatar URL must use HTTPS', 400);
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    return sendSuccess(res, { user: user.toPublicProfile() }, 'Profile updated');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Returns a new access token.
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return sendError(res, 'Refresh token is required', 400);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive', 401);
    }

    return sendSuccess(
      res,
      { accessToken: signAccessToken(user._id) },
      'Token refreshed'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/auth/account
 * Body: { password }
 * Protected — permanently deletes the authenticated user's account.
 *
 * What happens to data:
 *   - Notes the user OWNS are deleted entirely, including their attachments,
 *     versions, and any share links — collaborators lose access immediately.
 *   - Notes OTHERS own that were shared WITH this user are left untouched;
 *     the user is simply removed from those notes' sharedWith lists so they
 *     no longer show up as a stale collaborator.
 */
async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;

    // Re-fetch with password (select:false on the schema) and verify it —
    // this is a destructive, irreversible action, so we don't rely solely
    // on the access token already being valid.
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return sendError(res, 'User not found', 404);

    if (!password || !(await user.comparePassword(password))) {
      return sendError(res, 'Incorrect password', 401);
    }

    // 1. Clean up attachments (Cloudinary/local disk) for every note the
    //    user owns, then delete those notes outright.
    const ownedNotes = await Note.find({ owner: user._id });
    for (const note of ownedNotes) {
      if (note.attachments.length) await cleanupNoteAttachments(note);
    }
    await Note.deleteMany({ owner: user._id });

    // 2. Strip the user from sharedWith[] on any notes owned by other people.
    await Note.updateMany(
      { 'sharedWith.user': user._id },
      { $pull: { sharedWith: { user: user._id } } }
    );

    // 3. Finally, delete the user document itself.
    await User.findByIdAndDelete(user._id);

    return sendSuccess(res, null, 'Account and all owned notes deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getProfile, updateProfile, refreshToken, deleteAccount };
