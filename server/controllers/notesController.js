'use strict';

const crypto             = require('crypto');
const Note               = require('../models/Note');
const { sendSuccess,
        sendError }      = require('../utils/response');

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT     = 100;

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_LIMIT)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function generateShareToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/notes
 * Returns the authenticated user's notes (paginated, filterable, searchable).
 * Query params: page, limit, search, tag, isPublic, sort (updatedAt|-updatedAt|title|-title)
 */
async function getNotes(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const userId = req.user._id;

    // Base filter: notes owned by user OR shared with user
    const baseFilter = {
      $or: [
        { owner: userId },
        { 'sharedWith.user': userId },
      ],
    };

    // Full-text search
    if (req.query.search) {
      baseFilter.$text = { $search: req.query.search };
    }

    // Tag filter
    if (req.query.tag) {
      baseFilter.tags = req.query.tag;
    }

    // Public/private filter (only applies to owned notes)
    if (req.query.isPublic !== undefined) {
      baseFilter.isPublic = req.query.isPublic === 'true';
    }

    // Sorting
    const sortMap = {
      updatedAt:  { updatedAt: -1 },
      '-updatedAt': { updatedAt: 1 },
      title:       { title:  1 },
      '-title':    { title: -1 },
      pinned:      { isPinned: -1, updatedAt: -1 },
    };
    const sort = sortMap[req.query.sort] || { isPinned: -1, updatedAt: -1 };

    const [rawNotes, total] = await Promise.all([
      Note.find(baseFilter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'username avatar')
          .populate('sharedWith.user', 'username avatar'),
      Note.countDocuments(baseFilter),
    ]);

    // Tag each note with whether it's owned or shared-with-me, and the permission
    const notes = rawNotes.map((note) => {
      const obj = note.toObject();
      const isOwner = note.owner._id.toString() === userId.toString();
      obj.isSharedWithMe = !isOwner;
      if (!isOwner) {
        const entry = note.sharedWith.find((s) => s.user?._id?.toString() === userId.toString());
        obj.myPermission = entry?.permission || 'read';
      }
      // Remove sharedWith detail for non-owners
      if (!isOwner) delete obj.sharedWith;
      return obj;
    });

    return sendSuccess(res, {
      notes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notes/:id
 * Owner or shared user can read; also accessible by shareToken.
 */
async function getNoteById(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
      .populate('owner', 'username avatar')
      .populate('sharedWith.user', 'username avatar');

    if (!note) return sendError(res, 'Note not found', 404);

    const userId    = req.user._id.toString();
    const isOwner   = note.owner._id.toString() === userId;
    const isShared  = note.sharedWith.some((s) => s.user._id.toString() === userId);

    if (!isOwner && !isShared && !note.isPublic) {
      return sendError(res, 'You do not have access to this note', 403);
    }

    return sendSuccess(res, { note });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notes
 * Creates a new note for the authenticated user.
 */
async function createNote(req, res, next) {
  try {
    const { title, content, tags, isPublic, color, isPinned } = req.body;

    const note = await Note.create({
      title,
      content:  content  || '',
      tags:     tags     || [],
      isPublic: isPublic || false,
      color:    color    || '#ffffff',
      isPinned: isPinned || false,
      owner:    req.user._id,
    });

    return sendSuccess(res, { note }, 'Note created', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notes/:id
 * Owner can update all fields.
 * Users with 'write' share permission can update title and content only.
 */
async function updateNote(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const note = await Note.findById(req.params.id);

    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const isOwner = note.owner.toString() === userId;
    const sharedEntry = note.sharedWith.find((s) => s.user?.toString() === userId);
    const canWrite = isOwner || sharedEntry?.permission === 'write';

    if (!canWrite) return sendError(res, 'Access denied', 403);

    if (isOwner) {
      // Owner can update everything
      const allowedFields = ['title', 'content', 'tags', 'isPublic', 'color', 'isPinned'];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) note[field] = req.body[field];
      });
    } else {
      // Write-permission collaborator: title + content only
      if (req.body.title   !== undefined) note.title   = req.body.title;
      if (req.body.content !== undefined) note.content = req.body.content;
    }

    await note.save();
    return sendSuccess(res, { note }, 'Note updated');
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/notes/:id
 * Owner-only delete.
 */
async function deleteNote(req, res, next) {
  try {
    const note = await Note.findOneAndDelete({
      _id:   req.params.id,
      owner: req.user._id,
    });

    if (!note) return sendError(res, 'Note not found or access denied', 404);

    return sendSuccess(res, null, 'Note deleted');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notes/:id/share
 * Generates (or revokes) a public shareToken.
 * Body: { action: 'generate' | 'revoke' }
 */
async function manageShareToken(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const { action } = req.body;

    if (action === 'generate') {
      if (!note.shareToken) note.shareToken = generateShareToken();
      note.isPublic = true;
    } else if (action === 'revoke') {
      note.shareToken = undefined;
      note.isPublic   = false;
    } else {
      return sendError(res, 'action must be "generate" or "revoke"', 400);
    }

    await note.save();
    return sendSuccess(res, { note }, action === 'generate' ? 'Share link generated' : 'Share link revoked');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notes/shared/:token
 * Public — no auth required. Fetches a note by its shareToken.
 */
async function getNoteByShareToken(req, res, next) {
  try {
    const note = await Note.findOne({ shareToken: req.params.token })
      .populate('owner', 'username avatar');

    if (!note || !note.isPublic) {
      return sendError(res, 'Shared note not found or no longer public', 404);
    }

    return sendSuccess(res, { note });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notes/public
 * Returns all public notes (paginated).
 */
async function getPublicNotes(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = { isPublic: true };
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.tag)    filter.tags  = req.query.tag;

    const [notes, total] = await Promise.all([
      Note.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('owner', 'username avatar')
          .select('-sharedWith -shareToken'),
      Note.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      notes,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  manageShareToken,
  getNoteByShareToken,
  getPublicNotes,
};
