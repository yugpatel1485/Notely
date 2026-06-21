const crypto = require('crypto');
const Note   = require('../models/Note');
const User   = require('../models/User');
const { sendSuccess, sendError } = require('../utils/responseUtils');

// ── Helpers ───────────────────────────────────────────────────

/** Generate a cryptographically random share slug */
const generateSlug = () => crypto.randomBytes(8).toString('hex');

/** Parse pagination params from query */
const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// ── GET /api/notes ────────────────────────────────────────────
const getNotes = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, tag, sort = 'updatedAt' } = req.query;

    const filter = {
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id },
      ],
    };

    if (search) {
      filter.$text = { $search: search };
    }

    if (tag) {
      filter.tags = tag.toLowerCase();
    }

    const sortOrder = sort.startsWith('-') ? -1 : -1; // always desc by default
    const sortField = sort.replace(/^-/, '');
    const allowedSortFields = ['updatedAt', 'createdAt', 'title'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'updatedAt';

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .populate('owner', 'username avatar')
        .sort({ [safeSortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Note.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, {
      notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/notes/:id ────────────────────────────────────────
const getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).populate('owner', 'username avatar');

    if (!note) return sendError(res, 404, 'Note not found');

    const userId = req.user._id.toString();
    const canAccess =
      note.owner._id.toString() === userId ||
      note.sharedWith.some((id) => id.toString() === userId) ||
      note.isPublic;

    if (!canAccess) return sendError(res, 403, 'You do not have access to this note');

    return sendSuccess(res, 200, { note });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/notes ───────────────────────────────────────────
const createNote = async (req, res, next) => {
  try {
    const { title, content, tags, isPublic } = req.body;

    if (!title) return sendError(res, 400, 'Title is required');

    const note = await Note.create({
      title,
      content: content || '',
      tags:    tags    || [],
      isPublic: isPublic ?? false,
      owner:   req.user._id,
    });

    await note.populate('owner', 'username avatar');

    return sendSuccess(res, 201, { note }, 'Note created');
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/notes/:id ────────────────────────────────────────
const updateNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) return sendError(res, 404, 'Note not found');
    if (note.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Only the owner can edit this note');
    }

    const { title, content, tags, isPublic } = req.body;

    if (title   !== undefined) note.title    = title;
    if (content !== undefined) note.content  = content;
    if (tags    !== undefined) note.tags     = tags;
    if (isPublic !== undefined) note.isPublic = isPublic;

    await note.save();
    await note.populate('owner', 'username avatar');

    return sendSuccess(res, 200, { note }, 'Note updated');
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/notes/:id ─────────────────────────────────────
const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) return sendError(res, 404, 'Note not found');
    if (note.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Only the owner can delete this note');
    }

    await note.deleteOne();

    return sendSuccess(res, 200, {}, 'Note deleted');
  } catch (err) {
    next(err);
  }
};

// ── POST /api/notes/:id/share ─────────────────────────────────
const generateShareLink = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) return sendError(res, 404, 'Note not found');
    if (note.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Only the owner can share this note');
    }

    if (!note.shareSlug) {
      note.shareSlug = generateSlug();
      await note.save();
    }

    const shareUrl = `${process.env.CLIENT_URL}/shared/${note.shareSlug}`;

    return sendSuccess(res, 200, { shareUrl, shareSlug: note.shareSlug }, 'Share link generated');
  } catch (err) {
    next(err);
  }
};

// ── GET /api/notes/shared/:slug ───────────────────────────────
const getNoteBySlug = async (req, res, next) => {
  try {
    const note = await Note.findOne({ shareSlug: req.params.slug, isPublic: true })
      .populate('owner', 'username avatar')
      .lean();

    if (!note) return sendError(res, 404, 'Shared note not found or is private');

    return sendSuccess(res, 200, { note });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/notes/:id/share-with ───────────────────────────
const shareWithUser = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'Email is required');

    const note = await Note.findById(req.params.id);
    if (!note) return sendError(res, 404, 'Note not found');
    if (note.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Only the owner can share this note');
    }

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) return sendError(res, 404, 'User with that email not found');
    if (targetUser._id.toString() === req.user._id.toString()) {
      return sendError(res, 400, 'You cannot share a note with yourself');
    }

    const alreadyShared = note.sharedWith.some(
      (id) => id.toString() === targetUser._id.toString()
    );
    if (alreadyShared) return sendError(res, 409, 'Note already shared with this user');

    note.sharedWith.push(targetUser._id);
    await note.save();

    return sendSuccess(res, 200, {}, `Note shared with ${targetUser.username}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  generateShareLink,
  getNoteBySlug,
  shareWithUser,
};
