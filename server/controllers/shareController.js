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

// ── Email helper ──────────────────────────────────────────────────────────────
// Sends via Resend's HTTP API (https://api.resend.com/emails) over standard
// HTTPS, rather than raw SMTP. Some hosts (Render included) have flaky or
// blocked outbound SMTP ports even with auth, which surfaces as
// ECONNTIMEDOUT connecting to smtp.resend.com:587 — the HTTP API sidesteps
// that entirely since it's just a normal HTTPS POST.
//
// EMAIL_PASS holds the Resend API key (same value you'd have used as the
// SMTP password) — kept under that name so existing env vars don't need
// renaming. EMAIL_HOST/EMAIL_PORT/EMAIL_SECURE/EMAIL_USER are no longer used
// and can be removed from your env whenever convenient.
async function sendShareNotificationEmail({ toEmail, toUsername, fromUsername, noteTitle, noteId, permission }) {
  if (!process.env.EMAIL_PASS) {
    console.warn('[Share] EMAIL_PASS not set — skipping email notification');
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
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EMAIL_PASS}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        // EMAIL_FROM must be a verified sender — use onboarding@resend.dev
        // until you verify your own domain in Resend.
        from:    `Notely <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
        to:      [toEmail],
        subject: `${fromUsername} shared a note with you: "${noteTitle}"`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API ${res.status}: ${body}`);
    }

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
