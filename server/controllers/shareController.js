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
const nodemailer        = require('nodemailer');

// ── Email helper ──────────────────────────────────────────────────────────────
function createTransporter() {
  // Supports any SMTP provider. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in .env
  // For Gmail: EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=587, use an App Password
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',  // true for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendShareNotificationEmail({ toEmail, toUsername, fromUsername, noteTitle, noteId, permission }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Share] EMAIL_USER or EMAIL_PASS not set — skipping email notification');
    return;
  }

  const appUrl    = process.env.CLIENT_URL || 'http://localhost:5173';
  const noteUrl   = `${appUrl}/dashboard`;   // User opens dashboard and sees the note in "Shared with me"
  const permLabel = permission === 'write' ? 'view and edit' : 'view';

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <h2 style="color:#1a1a1a;margin-top:0">📝 A note has been shared with you</h2>
      <p style="color:#444"><strong>${fromUsername}</strong> shared the note <strong>"${noteTitle}"</strong> with you on Notely.</p>
      <p style="color:#444">You have <strong>${permLabel}</strong> access.</p>
      <a href="${noteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
        Open in Notely →
      </a>
      <p style="color:#888;font-size:13px">The note will appear in the <em>Shared with me</em> section of your dashboard.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#aaa;font-size:12px">You received this because someone shared a note with your Notely account (${toEmail}).</p>
    </div>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"Notely" <${process.env.EMAIL_USER}>`,
      to:      toEmail,
      subject: `${fromUsername} shared a note with you: "${noteTitle}"`,
      html,
    });
    console.log(`[Share] Email sent to ${toEmail}`);
  } catch (err) {
    // Non-fatal — sharing still succeeds, email just didn't send
    console.error('[Share] Failed to send email notification:', err.message);
  }
}

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

    // Send email notification (non-blocking — failure doesn't break the share)
    sendShareNotificationEmail({
      toEmail:      target.email,
      toUsername:   target.username,
      fromUsername: req.user.username || req.user.email,
      noteTitle:    note.title,
      noteId:       note._id.toString(),
      permission,
    });

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
