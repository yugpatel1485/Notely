'use strict';

/**
 * uploadController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DEV:        multer (memory) → local disk  (server/uploads/<noteId>/<file>)
 * PRODUCTION: multer (memory) → Cloudinary  (set CLOUDINARY_URL in server .env)
 *
 * Switch is automatic — if CLOUDINARY_URL is present, Cloudinary is used.
 *
 * Rewritten to avoid multer-storage-cloudinary: that plugin streams straight
 * from the request into Cloudinary's API and its callback can simply never
 * fire if credentials are wrong or the network can't reach Cloudinary — the
 * request then hangs forever with no response and no error. Buffering the
 * file in memory first and uploading explicitly lets us wrap the Cloudinary
 * call in a real timeout and surface a real error instead.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Note = require('../models/Note');
const { sendSuccess, sendError } = require('../utils/response');

const USE_CLOUDINARY = !!process.env.CLOUDINARY_URL;

// ── Cloudinary setup ─────────────────────────────────────────────────────────
let cloudinary;
if (USE_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
}

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 45_000;       // our wrapper — must exceed Cloudinary's own timeout below
const CLOUDINARY_SDK_TIMEOUT_MS = 40_000;
const MAX_UPLOAD_ATTEMPTS = 3;

// Note: image/svg+xml is intentionally NOT allowed. SVG files can embed
// <script> and event-handler attributes, and these files are served back
// to users directly (local disk or Cloudinary) without any sandboxing —
// allowing SVG upload would be a stored-XSS vector via attachments.
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'application/pdf',
  'text/plain', 'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// Cloudinary resource_type must match the file kind — 'image' only works for
// images and silently breaks (or rejects) PDFs, docs, and videos.
function resourceTypeFor(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw'; // pdf, doc/docx, txt, md, etc.
}

// Buffer the upload in memory — small files only (10 MB cap below), so this
// is safe and gives us a plain Buffer to hand to either Cloudinary or disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'File type not allowed'));
  },
}).single('file');

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => { if (err) reject(err); else resolve(); });
  });
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// Cloudinary's SDK doesn't always reject with a plain Error — sometimes it's
// an object like { error: { message } } or, on a raw timeout, something with
// no readable message at all. Normalize so the user always sees something useful.
function describeError(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.error?.message) return err.error.message;
  try { return JSON.stringify(err); } catch { return 'unknown error'; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Intermittent network issues (proxy/AV hiccups, brief connectivity drops)
// shouldn't fail an upload outright — retry a couple of times with backoff
// before giving up.
async function withRetry(fn, attempts) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[Upload] attempt ${i}/${attempts} failed: ${describeError(err)}`);
      if (i < attempts) await sleep(1000 * i); // 1s, 2s, ...
    }
  }
  throw lastErr;
}

/** Upload a buffer to Cloudinary as a plain (non-streamed) request.
 *  upload_stream sends a long-lived chunked multipart request, which some
 *  proxies/antivirus/VPNs silently swallow without ever closing the
 *  connection. A data-URI upload is a single ordinary POST — far more
 *  compatible with restrictive networks — and 10MB is well within reason
 *  for a base64 payload. */
function uploadBufferToCloudinary(buffer, { folder, resource_type, filenameNoExt, mimetype, ext }) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type,
    public_id: filenameNoExt,
    use_filename: true,
    unique_filename: true,
    timeout: CLOUDINARY_SDK_TIMEOUT_MS,
    // For 'raw' (pdf, doc, txt, md…) and 'video', Cloudinary only appends a
    // file extension to the delivery URL if you explicitly tell it the
    // format — otherwise the URL has none, and anything downloaded from it
    // shows up as a generic extensionless file (Windows can't tell it's a
    // PDF, etc). Images get correct extensions automatically, so this is
    // only needed for the rest.
    ...(resource_type !== 'image' && ext ? { format: ext } : {}),
  });
}

/** Write a buffer to local disk under server/uploads/<noteId>/<diskFilename>. */
function writeBufferToDisk(buffer, noteId, originalname) {
  const dir = path.join(UPLOAD_ROOT, noteId);
  fs.mkdirSync(dir, { recursive: true });
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const ext = path.extname(originalname);
  const diskFilename = `${unique}${ext}`;
  fs.writeFileSync(path.join(dir, diskFilename), buffer);
  return diskFilename;
}

function buildLocalUrl(req, noteId, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${noteId}/${filename}`;
}

function canWrite(note, userId) {
  if (note.owner.toString() === userId) return true;
  return note.sharedWith.some(
    (s) => s.user?.toString() === userId && s.permission === 'write'
  );
}

// ── Controllers ───────────────────────────────────────────────────────────────
async function uploadAttachment(req, res, next) {
  try {
    await runUpload(req, res);
    if (!req.file) return sendError(res, 'No file provided', 400);

    const note = await Note.findById(req.params.id);
    if (!note) return sendError(res, 'Note not found', 404);
    if (!canWrite(note, req.user._id.toString()))
      return sendError(res, 'Write permission required to upload attachments', 403);
    if (note.attachments.length >= 20)
      return sendError(res, 'A note can have at most 20 attachments', 400);

    let key, url, resourceType;

    if (USE_CLOUDINARY) {
      resourceType = resourceTypeFor(req.file.mimetype);
      const filenameNoExt = path.parse(req.file.originalname).name;
      const ext = path.extname(req.file.originalname).replace(/^\./, '');

      let result;
      try {
        result = await withRetry(
          () => withTimeout(
            uploadBufferToCloudinary(req.file.buffer, {
              folder: `notely/${req.params.id}`,
              resource_type: resourceType,
              filenameNoExt,
              mimetype: req.file.mimetype,
              ext,
            }),
            UPLOAD_TIMEOUT_MS,
            'Upload to Cloudinary timed out — check CLOUDINARY_URL and network access'
          ),
          MAX_UPLOAD_ATTEMPTS
        );
      } catch (cloudErr) {
        const msg = describeError(cloudErr);
        console.error('[Upload] Cloudinary upload failed after retries:', msg);
        return sendError(res, `Cloud upload failed: ${msg}`, 502);
      }

      key = result.public_id;
      url = result.secure_url;
    } else {
      const diskFilename = writeBufferToDisk(req.file.buffer, req.params.id, req.file.originalname);
      key = `${req.params.id}/${diskFilename}`;
      url = buildLocalUrl(req, req.params.id, diskFilename);
    }

    console.log('[Upload] file saved:', { key, url, mimetype: req.file.mimetype, cloud: USE_CLOUDINARY });

    const attachment = {
      key,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url,
      resourceType,
    };

    note.attachments.push(attachment);
    await note.save();

    return sendSuccess(res, { attachment: note.attachments[note.attachments.length - 1] }, 'File uploaded', 201);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return sendError(res, err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 10 MB limit' : err.message, 400);
    }
    next(err);
  }
}

async function deleteAttachment(req, res, next) {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return sendError(res, 'Note not found', 404);
    if (!canWrite(note, req.user._id.toString()))
      return sendError(res, 'Write permission required', 403);

    const att = note.attachments.id(req.params.attId);
    if (!att) return sendError(res, 'Attachment not found', 404);

    if (USE_CLOUDINARY) {
      // Try to delete from Cloudinary — non-fatal if it fails
      // (file may already be gone or key may differ)
      try {
        const resourceType = att.resourceType || resourceTypeFor(att.mimetype);
        const result = await cloudinary.uploader.destroy(att.key, { resource_type: resourceType });
        console.log('[Upload] Cloudinary delete result:', result);
      } catch (cloudErr) {
        console.warn('[Upload] Cloudinary delete failed (continuing):', cloudErr.message);
      }
    } else {
      // Delete from local disk (non-fatal).
      // Confine the resolved path within UPLOAD_ROOT to prevent path traversal
      // if att.key were ever tampered with in the database.
      const target = path.resolve(UPLOAD_ROOT, att.key);
      if (target.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
        fs.unlink(target, () => { });
      } else {
        console.warn('[Upload] Blocked path traversal attempt in deleteAttachment:', att.key);
      }
    }

    att.deleteOne();
    await note.save();
    return sendSuccess(res, null, 'Attachment deleted');
  } catch (err) {
    next(err);
  }
}

/**
 * Best-effort cleanup of every attachment on a note (Cloudinary or local
 * disk). Used when a note is deleted directly, and when a user's account
 * is deleted (cascading through all of their owned notes). Never throws —
 * a stuck/missing remote file shouldn't block the note/account deletion.
 */
async function cleanupNoteAttachments(note) {
  for (const att of note.attachments) {
    try {
      if (USE_CLOUDINARY) {
        const resourceType = att.resourceType || resourceTypeFor(att.mimetype);
        await cloudinary.uploader.destroy(att.key, { resource_type: resourceType });
      } else {
        const target = path.resolve(UPLOAD_ROOT, att.key);
        if (target.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
          fs.unlink(target, () => {});
        }
      }
    } catch (err) {
      console.warn('[Upload] cleanup failed for attachment (continuing):', att.key, err.message);
    }
  }
}

module.exports = { uploadAttachment, deleteAttachment, cleanupNoteAttachments };
