'use strict';

/**
 * server.js  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 2:
 *   + /api/notes/:id/attachments  — file uploads
 *   + /api/notes/:id/versions     — version history
 *   + /api/notes/:id/export       — PDF / DOCX export
 *   + /api/analytics              — dashboard stats + view tracking
 *   + /uploads                    — static file serving (local disk)
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const notesRoutes = require('./routes/notesRoutes');
const shareRoutes = require('./routes/shareRoutes');
const aiRoutes = require('./routes/aiRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const versionRoutes = require('./routes/versionRoutes');
const exportRoutes = require('./routes/exportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const errorHandler = require('./middleware/errorHandler');
const { registerCollaborationHandlers } = require('./sockets/collaborationSocket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Render sits behind a single reverse-proxy hop. Without this,
// express-rate-limit can't read X-Forwarded-For correctly (every request
// looks like it comes from the proxy's own IP, so rate limiting either
// breaks or collapses everyone into one bucket).
app.set('trust proxy', 1);

// CLIENT_URL may be a single origin or a comma-separated list — useful for
// Vercel, where you typically have a stable production domain (your custom
// domain or *.vercel.app) plus per-PR preview deployments with their own
// generated subdomains.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (curl, server-to-server, health checks)
    // that send no Origin header at all.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${origin}" is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
};

// Local-disk attachment storage does not survive a Render redeploy or
// restart (ephemeral filesystem) — Cloudinary is required once we're
// actually live. Fail fast at boot rather than silently losing files later.
if (process.env.NODE_ENV === 'production' && !process.env.CLOUDINARY_URL) {
  console.error('[FATAL] CLOUDINARY_URL is not set. Local disk storage does not persist on Render — attachments would be lost on every deploy/restart.');
  process.exit(1);
}

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  // Allow serving local uploaded images inline
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 150,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests — slow down!' },
}));

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { success: false, message: 'Too many AI requests — try again shortly' },
});

// Export endpoint triggers heavy PDF/DOCX generation — throttle separately.
const exportLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { success: false, message: 'Too many export requests — try again shortly' },
});

// Allow larger bodies for file upload routes only
app.use('/api/notes', (req, res, next) => {
  if (req.path.includes('/attachments') && req.method === 'POST') {
    req.setTimeout(120000); // 2 min timeout for uploads
  }
  next();
});

// ── Static uploads (local disk) ───────────────────────────────────────────────
// In production, serve from CDN / S3 instead.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbOk = dbState === 1;
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    success: dbOk,
    message: dbOk ? 'Notely API is running' : 'Database not connected',
    db: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown',
    timestamp: new Date(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/notes/:id/share-with', shareRoutes);
app.use('/api/notes/:id/attachments', uploadRoutes);
app.use('/api/notes/:id/versions', versionRoutes);
app.use('/api/notes/:id/export', exportLimiter, exportRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── 404 + error ───────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  const err = new Error('Route not found');
  err.statusCode = 404;
  next(err);
}); app.use(errorHandler);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, { cors: corsOptions, transports: ['websocket', 'polling'] });
registerCollaborationHandlers(io);

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[Server] Notely API + WS running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
