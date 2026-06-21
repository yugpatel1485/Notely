'use strict';

/**
 * versionController.js  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes:
 *   GET    /api/notes/:id/versions           — list all versions (owner only)
 *   POST   /api/notes/:id/versions           — manually snapshot current state
 *   GET    /api/notes/:id/versions/:verId    — fetch one version's content
 *   POST   /api/notes/:id/versions/:verId/restore — restore a version (creates new snapshot first)
 *   DELETE /api/notes/:id/versions/:verId    — delete a version entry
 */

const Note = require('../models/Note');
const { sendSuccess, sendError } = require('../utils/response');

// ── List all versions ─────────────────────────────────────────────────────────
async function listVersions(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id })
      .populate('versions.savedBy', 'username avatar')
      .select('versions title');

    if (!note) return sendError(res, 'Note not found or access denied', 404);

    // Return newest first, strip full content (too heavy for the list)
    const list = [...note.versions]
      .reverse()
      .map(({ _id, label, savedAt, savedBy }) => ({ _id, label, savedAt, savedBy }));

    return sendSuccess(res, { versions: list, total: list.length });
  } catch (err) {
    next(err);
  }
}

// ── Manually create a snapshot ────────────────────────────────────────────────
async function createSnapshot(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    note.snapshotVersion(req.user._id);
    await note.save();

    const latest = note.versions[note.versions.length - 1];
    return sendSuccess(res, { version: latest }, 'Snapshot saved', 201);
  } catch (err) {
    next(err);
  }
}

// ── Get one version's full content ────────────────────────────────────────────
async function getVersion(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id })
      .populate('versions.savedBy', 'username avatar');

    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const version = note.versions.id(req.params.verId);
    if (!version) return sendError(res, 'Version not found', 404);

    return sendSuccess(res, { version });
  } catch (err) {
    next(err);
  }
}

// ── Restore a version ─────────────────────────────────────────────────────────
async function restoreVersion(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const version = note.versions.id(req.params.verId);
    if (!version) return sendError(res, 'Version not found', 404);

    // Snapshot the current state before overwriting (safety net)
    note.snapshotVersion(req.user._id);

    // Restore
    note.title   = version.title;
    note.content = version.content;

    await note.save();
    return sendSuccess(res, { note }, `Restored to: ${version.label}`);
  } catch (err) {
    next(err);
  }
}

// ── Delete a single version entry ─────────────────────────────────────────────
async function deleteVersion(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) return sendError(res, 'Note not found or access denied', 404);

    const version = note.versions.id(req.params.verId);
    if (!version) return sendError(res, 'Version not found', 404);

    version.deleteOne();
    await note.save();

    return sendSuccess(res, null, 'Version deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { listVersions, createSnapshot, getVersion, restoreVersion, deleteVersion };
