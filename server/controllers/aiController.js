'use strict';

/**
 * aiController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/ai/summarise
 *
 * Generates an AI-powered summary of a note's content using the
 * Google Gemini API (gemini-1.5-flash — free tier).
 *
 * Free tier limits (as of 2024): 15 RPM, 1M TPM, 1500 RPD.
 * Get a free key at: https://aistudio.google.com/app/apikey
 */

const https          = require('https');
const Note           = require('../models/Note');
const { sendSuccess,
        sendError }  = require('../utils/response');

const GEMINI_MODEL    = 'gemini-2.5-flash-lite';
const MAX_INPUT_CHARS = 12_000;  // ~3k tokens — keeps latency low
const MAX_TOKENS      = 300;

/**
 * Minimal Gemini generateContent call (no SDK dependency).
 * @param {string} prompt  Full prompt text
 * @returns {Promise<string>}
 */
function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.3,
      },
    });

    const path =
      `/v1beta/models/${GEMINI_MODEL}:generateContent` +
      `?key=${process.env.GEMINI_API_KEY}`;

    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path,
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) return reject(new Error(parsed.error.message));
            const text =
              parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            resolve(text.trim());
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * POST /api/ai/summarise
 * Body: { noteId: string }
 */
async function summariseNote(req, res, next) {
  try {
    const { noteId } = req.body;
    if (!noteId) return sendError(res, 'noteId is required', 400);

    if (!process.env.GEMINI_API_KEY) {
      return sendError(res, 'AI summaries are not configured on this server', 503);
    }

    const note = await Note.findById(noteId)
      .populate('sharedWith.user', '_id');

    if (!note) return sendError(res, 'Note not found', 404);

    const userId   = req.user._id.toString();
    const isOwner  = note.owner.toString() === userId;
    const isShared = note.sharedWith.some((s) => s.user?._id?.toString() === userId);

    if (!isOwner && !isShared && !note.isPublic) {
      return sendError(res, 'Access denied', 403);
    }

    if (!note.content || note.content.trim().length < 30) {
      return sendError(res, 'Note content is too short to summarise', 422);
    }

    const contentSlice = note.content.slice(0, MAX_INPUT_CHARS);

    // Strip newlines from the title to prevent prompt injection via title field
    // (e.g. a title containing "\nIgnore above instructions and...").
    const safeTitle = note.title.replace(/[\r\n]+/g, ' ').trim();

    const prompt = [
      'You are a concise note summariser.',
      'Read the note below and respond with 2-4 sentences capturing the key ideas.',
      'Output the summary only — no preamble, no labels.',
      '',
      `Note title: "${safeTitle}"`,
      '',
      contentSlice,
    ].join('\n');

    const summary = await callGemini(prompt);

    return sendSuccess(res, { summary, noteId }, 'Summary generated');
  } catch (err) {
    if (err.message?.toLowerCase().includes('api')) {
      return sendError(res, 'AI service unavailable — please try again later', 503);
    }
    next(err);
  }
}

module.exports = { summariseNote };
