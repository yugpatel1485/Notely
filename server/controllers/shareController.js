'use strict';

/**
 * shareController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles sharing a note with specific users by email address.
 * Endpoint: POST /api/notes/:id/share-with
 *           DELETE /api/notes/:id/share-with/:userId
 *           GET    /api/notes/:id/collaborators
 */

const Note              = require('../models/Note');
const User              = require('../models/User');
const { sendSuccess,
        sendError }     = require('../utils/response');

/**
 * POST /api/notes/:id/share-with
 * Body: { email: string, permission?: 'read' | 'write' }
 *
 * Shares the note with the user matching the provided email.
 * Only the owner may call this endpoint.
 */
async function shareWithUser(req, res, next) {
  try {
    const { email, permission = 'read' } = req.body;

    if (!email) return sendError(res, 'email is required', 400);
    if (!['read', 'write'].includes(permission)) {
      return sendError(res, 'permission must be "read" or "write"', 400);
    }

    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    // Resolve target user
    const target = await User.findOne({ email: email.trim().toLowerCase() })
      .select('username avatar email');

    if (!target) return sendError(res, 'No Notely account found for that email address', 404);

    if (target._id.toString() === req.user._id.toString()) {
      return sendError(res, 'You cannot share a note with yourself', 400);
    }

    // Check if already shared
    const existing = note.sharedWith.find(
      (s) => s.user?.toString() === target._id.toString()
    );

    if (existing) {
      // Update permission if it changed
      if (existing.permission !== permission) {
        existing.permission = permission;
        await note.save();
        return sendSuccess(res, { note }, `Permission updated to "${permission}" for ${target.username}`);
      }
      return sendError(res, `Note already shared with ${target.username}`, 409);
    }

    note.sharedWith.push({ user: target._id, permission });
    await note.save();

    return sendSuccess(res, {
      sharedWith: { user: { _id: target._id, username: target.username, avatar: target.avatar }, permission },
    }, `Note shared with ${target.username}`);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/notes/:id/share-with/:userId
 * Removes a specific user from sharedWith. Owner-only.
 */
async function revokeUserAccess(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const before = note.sharedWith.length;
    note.sharedWith = note.sharedWith.filter(
      (s) => s.user?.toString() !== req.params.userId
    );

    if (note.sharedWith.length === before) {
      return sendError(res, 'That user does not have access to this note', 404);
    }

    await note.save();
    return sendSuccess(res, null, 'Access revoked');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notes/:id/collaborators
 * Returns the list of users a note is shared with.
 * Accessible by the owner or any shared user.
 */
async function getCollaborators(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
      .populate('sharedWith.user', 'username avatar email');

    if (!note) return sendError(res, 'Note not found', 404);

    const userId   = req.user._id.toString();
    const isOwner  = note.owner.toString() === userId;
    const isShared = note.sharedWith.some((s) => s.user?._id?.toString() === userId);

    if (!isOwner && !isShared) {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, { collaborators: note.sharedWith });
  } catch (err) {
    next(err);
  }
}

module.exports = { shareWithUser, revokeUserAccess, getCollaborators };
