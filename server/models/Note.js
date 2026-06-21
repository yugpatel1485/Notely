'use strict';

/**
 * Note.js  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 2:
 *   • attachments[] now stores rich objects { key, filename, mimetype, size, url }
 *     instead of bare strings
 *   • versions[] sub-schema — stores snapshot on every owner save (capped at 50)
 *   • analytics sub-doc — viewCount, uniqueViewers (simple counters)
 */

const mongoose = require('mongoose');

// ── Sub-schema: shared user ───────────────────────────────────────────────────
const sharedWithSchema = new mongoose.Schema(
  {
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, enum: ['read', 'write'], default: 'read' },
  },
  { _id: false }
);

// ── Sub-schema: file attachment ───────────────────────────────────────────────
const attachmentSchema = new mongoose.Schema(
  {
    key:       { type: String, required: true },   // storage key / path
    filename:  { type: String, required: true },   // original filename
    mimetype:  { type: String, required: true },
    size:      { type: Number, required: true },   // bytes
    url:       { type: String, required: true },   // public URL (or signed URL base)
    resourceType: { type: String },                 // Cloudinary resource_type ('image'|'video'|'raw'), unset for local disk
    uploadedAt:{ type: Date,   default: Date.now },
  },
  { _id: true }
);

// ── Sub-schema: version snapshot ──────────────────────────────────────────────
const versionSchema = new mongoose.Schema(
  {
    title:     { type: String, required: true },
    content:   { type: String, default: '' },
    savedAt:   { type: Date,   default: Date.now },
    savedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Human-readable label e.g. "v3 · 2 Jun 2026, 14:22"
    label:     { type: String },
  },
  { _id: true }
);

// ── Main Note schema ──────────────────────────────────────────────────────────
const noteSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },

    content:  { type: String, default: '', maxlength: [100_000, 'Note content must be at most 100,000 characters'] },

    tags: {
      type: [String],
      default: [],
      validate: { validator: (arr) => arr.length <= 10, message: 'Max 10 tags' },
    },

    owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    isPublic: { type: Boolean, default: false, index: true },

    sharedWith: { type: [sharedWithSchema], default: [] },

    shareToken: { type: String, unique: true, sparse: true },

    isPinned: { type: Boolean, default: false },

    color: {
      type:  String,
      default: '#ffffff',
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color'],
    },

    // ── Phase 3: rich attachments ─────────────────────────────────────────────
    attachments: { type: [attachmentSchema], default: [] },

    // ── Phase 3: version history (capped at 50 per note) ─────────────────────
    versions: { type: [versionSchema], default: [] },

    // ── Phase 3: basic analytics ──────────────────────────────────────────────
    analytics: {
      viewCount:    { type: Number, default: 0 },
      uniqueViewers:{ type: Number, default: 0 },
    },
  },
  { timestamps: true, versionKey: false }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
noteSchema.index({ owner: 1, updatedAt: -1 });
noteSchema.index({ owner: 1, tags: 1 });
noteSchema.index({ isPublic: 1, updatedAt: -1 });
// noteSchema.index({ shareToken: 1 });
noteSchema.index({ title: 'text', content: 'text', tags: 'text' });

// ── Helper: snapshot current state as a new version ───────────────────────────
noteSchema.methods.snapshotVersion = function (userId) {
  const MAX_VERSIONS = 50;
  const label = `v${this.versions.length + 1} · ${new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })}`;
  this.versions.push({ title: this.title, content: this.content, savedBy: userId, label });
  // Keep only the latest MAX_VERSIONS
  if (this.versions.length > MAX_VERSIONS) {
    this.versions = this.versions.slice(-MAX_VERSIONS);
  }
};

module.exports = mongoose.model('Note', noteSchema);
