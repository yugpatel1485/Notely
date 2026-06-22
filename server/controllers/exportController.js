'use strict';

/**
 * exportController.js
 * Routes:
 *   GET /api/notes/:id/export?format=pdf
 *   GET /api/notes/:id/export?format=docx
 *
 * Security fix: fetchBuffer now validates URLs against an allowlist of
 * trusted origins before making any outbound request, preventing SSRF.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const Note = require('../models/Note');
const PDFDocument = require('pdfkit');
const { Document, Paragraph, TextRun, HeadingLevel, Packer, ExternalHyperlink, ImageRun } = require('docx');
const sizeOf = require('image-size');
const { sendError } = require('../utils/response');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

// ── SSRF protection ───────────────────────────────────────────────────────────
// Only fetch from these trusted origins when embedding attachments.
// Populated at startup from env vars so no code change is needed when domains
// change.  Falls back to safe defaults for local dev.
function buildAllowedOrigins() {
  const origins = new Set();

  // Local dev: allow same host (http://localhost:5000)
  origins.add('localhost');
  origins.add('127.0.0.1');

  // Cloudinary CDN (all accounts use *.cloudinary.com or res.cloudinary.com)
  origins.add('res.cloudinary.com');

  // Allow operator to extend via env var (comma-separated hostnames)
  const extra = process.env.ATTACHMENT_ALLOWED_HOSTS || '';
  extra.split(',').map((h) => h.trim()).filter(Boolean).forEach((h) => origins.add(h));

  return origins;
}

const ALLOWED_ATTACHMENT_HOSTS = buildAllowedOrigins();

// Private / link-local ranges that must never be fetched regardless of hostname.
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,    // AWS/GCP metadata
  /^::1$/,          // IPv6 loopback
  /^fc00:/i,        // IPv6 ULA
  /^fe80:/i,        // IPv6 link-local
];

/**
 * Validates a URL before fetching.
 * Throws if the URL is not allowed.
 */
function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid attachment URL: ${rawUrl}`);
  }

  // Only http and https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Disallowed protocol in attachment URL: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();

  // Block raw private/link-local IPs regardless of allowlist
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error(`Attachment URL resolves to a private/reserved address: ${host}`);
    }
  }

  // Must be on the allowlist
  const hostOk = [...ALLOWED_ATTACHMENT_HOSTS].some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
  if (!hostOk) {
    throw new Error(`Attachment URL host not in allowlist: ${host}`);
  }
}

function canAccess(note, userId) {
  // note.owner may be a populated document (has ._id) or a raw ObjectId,
  // depending on the query — handle both so this stays correct either way.
  const ownerId = note.owner?._id ? note.owner._id.toString() : note.owner?.toString();
  if (ownerId === userId) return true;
  if (note.isPublic) return true;
  return note.sharedWith.some((s) => s.user?.toString() === userId);
}

function stripMarkdown(md = '') {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** Fetch a URL and return a Buffer — only after URL safety validation. */
function fetchBuffer(url) {
  // Throws synchronously if the URL is disallowed; the caller catches it.
  assertSafeUrl(url);

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── PDF ───────────────────────────────────────────────────────────────────────
const PDF_MARGIN = 72;
const FOOTER_RESERVE = 40;

function addFooter(doc) {
  const { x: savedX, y: savedY } = doc;
  const savedBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const bottomY = doc.page.height - 50;
  doc.fontSize(8).fillColor('#aaaaaa')
    .text('Exported from Notely', PDF_MARGIN, bottomY, {
      align: 'center',
      width: doc.page.width - PDF_MARGIN * 2,
      lineBreak: false,
    });

  doc.page.margins.bottom = savedBottomMargin;
  doc.x = savedX;
  doc.y = savedY;
}

function ensureSpace(doc, height) {
  const limit = doc.page.height - FOOTER_RESERVE;
  if (doc.y + height > limit) doc.addPage();
}

async function exportAsPdf(note, res) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.title)}.pdf"`);

  const doc = new PDFDocument({ margin: PDF_MARGIN, size: 'A4' });
  doc.pipe(res);

  doc.on('pageAdded', () => addFooter(doc));
  addFooter(doc);

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a1a1a')
    .text(note.title, { align: 'left' });

  doc.moveDown(0.4).font('Helvetica').fontSize(9).fillColor('#888888')
    .text(
      `Last updated ${new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` +
      (note.tags?.length ? '  ·  ' + note.tags.join(', ') : '')
    );

  doc.moveDown(0.6)
    .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y)
    .strokeColor('#dddddd').stroke();

  doc.moveDown(0.8).fillColor('#1a1a1a').font('Helvetica').fontSize(11)
    .text(stripMarkdown(note.content), { lineGap: 4, paragraphGap: 8 });

  if (note.attachments?.length > 0) {
    ensureSpace(doc, 60);
    doc.moveDown(1.5)
      .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y)
      .strokeColor('#dddddd').stroke()
      .moveDown(0.6)
      .font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a')
      .text(`Attachments (${note.attachments.length})`);

    const MAX_IMG_W = 440;

    for (const att of note.attachments) {
      doc.moveDown(0.8);
      const label = `${att.filename}  (${formatBytes(att.size)})`;

      if (IMAGE_MIMES.has(att.mimetype)) {
        try {
          const buf = await fetchBuffer(att.url);
          const dims = sizeOf(buf);
          const scale = dims.width > MAX_IMG_W ? MAX_IMG_W / dims.width : 1;
          const renderW = Math.round(dims.width * scale);
          const renderH = Math.round(dims.height * scale);

          ensureSpace(doc, 24 + renderH);

          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444').text(label, { indent: 8 });
          doc.moveDown(0.3);
          const imgY = doc.y;
          doc.image(buf, 72, imgY, { width: renderW, height: renderH });
          doc.link(72, imgY, renderW, renderH, att.url);
          doc.x = 72;
          doc.y = imgY + renderH;
        } catch {
          ensureSpace(doc, 30);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444').text(`[Image] ${label}`, { indent: 8 });
          doc.font('Helvetica').fontSize(8).fillColor('#2563eb').text(att.url, { indent: 8, link: att.url });
        }

      } else if (VIDEO_MIMES.has(att.mimetype)) {
        ensureSpace(doc, 30);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
          .text(`[Video] ${label}`, { indent: 8 });
        doc.font('Helvetica').fontSize(8).fillColor('#2563eb')
          .text(att.url, { indent: 8, link: att.url, underline: true });

      } else if (att.mimetype === 'application/pdf') {
        ensureSpace(doc, 30);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
          .text(`[PDF] ${label}`, { indent: 8 });
        doc.font('Helvetica').fontSize(8).fillColor('#2563eb')
          .text('Open file', { indent: 8, link: att.url, underline: true });

      } else {
        ensureSpace(doc, 30);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
          .text(`[File] ${label}`, { indent: 8 });
        doc.font('Helvetica').fontSize(8).fillColor('#2563eb')
          .text('Download file', { indent: 8, link: att.url, underline: true });
      }
    }
  }

  doc.end();
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function exportAsDocx(note, res) {
  const lines = (note.content || '').split('\n');
  const children = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const levels = [
        HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
      ];
      children.push(new Paragraph({
        text: headingMatch[2],
        heading: levels[headingMatch[1].length - 1],
        spacing: { before: 280, after: 160 },
      }));
      continue;
    }
    if (line.trim() === '') { children.push(new Paragraph({})); continue; }
    children.push(new Paragraph({
      children: [new TextRun({ text: stripMarkdown(line), size: 22 })],
      spacing: { line: 360, after: 120 },
    }));
  }

  const attachParagraphs = [];
  if (note.attachments?.length > 0) {
    attachParagraphs.push(new Paragraph({}));
    attachParagraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 200 },
      children: [new TextRun({ text: `Attachments (${note.attachments.length})`, bold: true })],
    }));

    for (const att of note.attachments) {
      const sizeLabel = formatBytes(att.size);
      const typeLabel = IMAGE_MIMES.has(att.mimetype) ? 'Image'
        : VIDEO_MIMES.has(att.mimetype) ? 'Video'
          : att.mimetype === 'application/pdf' ? 'PDF'
            : 'File';

      attachParagraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `[${typeLabel}]  ${att.filename}`, bold: true, size: 20 }),
          new TextRun({ text: `   ${sizeLabel}`, color: '888888', size: 18 }),
        ],
      }));

      let embedded = false;
      if (IMAGE_MIMES.has(att.mimetype)) {
        try {
          const buf = await fetchBuffer(att.url);
          const dims = sizeOf(buf);
          const MAX_W = 500;
          const scale = dims.width > MAX_W ? MAX_W / dims.width : 1;
          attachParagraphs.push(new Paragraph({
            spacing: { after: 160 },
            children: [
              new ImageRun({
                data: buf,
                transformation: {
                  width: Math.round(dims.width * scale),
                  height: Math.round(dims.height * scale),
                },
              }),
            ],
          }));
          embedded = true;
        } catch (err) {
          console.warn('[Export] Failed to embed image in docx, falling back to link:', err.message);
        }
      }

      if (!embedded) {
        attachParagraphs.push(new Paragraph({
          spacing: { after: 160 },
          children: [
            new ExternalHyperlink({
              link: att.url,
              children: [
                new TextRun({
                  text: IMAGE_MIMES.has(att.mimetype) ? 'View image'
                    : VIDEO_MIMES.has(att.mimetype) ? 'Watch video'
                      : att.mimetype === 'application/pdf' ? 'Open PDF'
                        : 'Download file',
                  style: 'Hyperlink',
                  size: 18,
                }),
              ],
            }),
          ],
        }));
      }

      attachParagraphs.push(new Paragraph({ spacing: { after: 120 } }));
    }
  }

  const docx = new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          spacing: { after: 120 },
          children: [new TextRun({ text: note.title, bold: true, size: 52 })],
        }),
        new Paragraph({
          spacing: { after: 320 },
          children: [new TextRun({
            text: `Last updated: ${new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            color: '888888', size: 18,
          })],
        }),
        ...children,
        ...attachParagraphs,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(docx);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.title)}.docx"`);
  res.send(buffer);
}

// ── Route handler ──────────────────────────────────────────────────────────────
async function exportNote(req, res, next) {
  try {
    const { format = 'pdf' } = req.query;
    if (!['pdf', 'docx'].includes(format)) return sendError(res, 'format must be "pdf" or "docx"', 400);

    const note = await Note.findById(req.params.id).populate('owner', 'username');
    if (!note) return sendError(res, 'Note not found', 404);
    if (!canAccess(note, req.user._id.toString())) return sendError(res, 'Access denied', 403);

    if (format === 'pdf') return exportAsPdf(note, res);
    if (format === 'docx') return exportAsDocx(note, res);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportNote };
