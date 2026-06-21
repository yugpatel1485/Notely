# Notely

A full-stack MERN note-sharing application with real-time collaboration, AI summaries, version history, and offline support.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Security Model](#security-model)
- [Production Deployment](#production-deployment)
- [Pre-Launch Checklist](#pre-launch-checklist)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Features

- **Auth** — JWT access + refresh tokens, bcrypt password hashing, per-tab session (closing a tab ends the session; a new tab requires login)
- **Notes** — create, edit, delete, pin, color-tag, full-text search
- **Collaboration** — real-time co-editing via Socket.io, live cursors
- **Sharing** — public links, revocable share tokens, per-user read/write permissions
- **AI summaries** — note summarization via Google Gemini
- **Attachments** — file uploads to local disk (dev) or Cloudinary (prod)
- **Version history** — snapshot, view, and restore previous note versions
- **Export** — download notes as PDF or DOCX
- **Analytics** — per-note view tracking, dashboard stats
- **PWA** — offline banner, service-worker caching, queued mutations when offline
- **Dark mode** — system-aware with manual override

## Tech Stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | React 18, Vite, Tailwind CSS |
| Backend      | Node.js, Express 5, Socket.io |
| Database     | MongoDB (Atlas) + Mongoose |
| Auth         | JWT (`jsonwebtoken`) + `bcryptjs` |
| AI           | Google Gemini API |
| File storage | Cloudinary (prod) / local disk (dev) |
| Sanitization | DOMPurify (client-side markdown rendering) |

## Project Structure

```
notely/
├── client/                   # React + Vite frontend
│   ├── public/sw.js          # Service worker (offline support)
│   └── src/
│       ├── components/       # UI components (Notes, Auth, Layout, Landing, …)
│       ├── context/          # AuthContext, NotesContext, ThemeContext
│       ├── hooks/            # useAiSummary, useCollaboration, useOffline, …
│       ├── pages/            # auth/, dashboard/, shared/
│       ├── services/         # api.js, authService.js, notesService.js
│       ├── utils/            # tokenStorage.js, registerSW.js
│       └── styles/
└── server/                   # Node.js + Express backend
    ├── config/db.js          # MongoDB connection
    ├── controllers/          # auth, notes, share, ai, upload, version, export, analytics
    ├── middleware/            # auth (JWT), validate (express-validator), errorHandler
    ├── models/                # User, Note
    ├── routes/
    ├── sockets/               # collaborationSocket.js
    └── server.js
```

## Prerequisites

- Node.js 18+ and npm
- A MongoDB connection string (local `mongod` or [MongoDB Atlas](https://www.mongodb.com/atlas))
- (Optional) [Google Gemini API key](https://aistudio.google.com/app/apikey) for AI summaries
- (Optional) [Cloudinary](https://cloudinary.com/) account for production file storage

## Local Development

### 1. Backend

```bash
cd server
npm install
# create server/.env — see Environment Variables below
npm run dev          # nodemon, restarts on file change
```

The API runs at `http://localhost:5000` by default. Visit `http://localhost:5000/api/health` to confirm it's up and connected to MongoDB.

### 2. Frontend

```bash
cd client
npm install
# create client/.env — see Environment Variables below
npm run dev
```

The app runs at `http://localhost:5173` by default (Vite's default port).

## Environment Variables

Neither `.env` file is committed (see `.gitignore`) — create them locally. **Never commit real secrets.**

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Signing secret for access tokens. **Must be ≥32 random characters** — the server refuses to boot otherwise. Generate with `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | ✅ | Signing secret for refresh tokens. Must differ from `JWT_SECRET`, same length requirement |
| `JWT_EXPIRES_IN` | optional | Access token lifetime (default `7d`) |
| `JWT_REFRESH_EXPIRES_IN` | optional | Refresh token lifetime (default `30d`) |
| `CLIENT_URL` | ✅ in prod | Your deployed frontend origin, for CORS (e.g. `https://notely.app`). Defaults to `http://localhost:5173` |
| `PORT` | optional | API port (default `5000`) |
| `NODE_ENV` | ✅ in prod | Set to `production` — disables verbose logging and stack traces in error responses |
| `GEMINI_API_KEY` | optional | Enables `/api/ai/summarise`. Omitted → endpoint returns 503 |
| `CLOUDINARY_URL` | optional | Format `cloudinary://<key>:<secret>@<cloud_name>`. Present → attachments upload to Cloudinary. Absent → falls back to local disk storage (not suitable for most production hosts — see [Production Deployment](#production-deployment)) |
| `ATTACHMENT_ALLOWED_HOSTS` | optional | Comma-separated extra hostnames allowed when embedding attachment images in PDF exports (SSRF allowlist). Cloudinary and localhost are allowed by default |
| `EMAIL_HOST` | optional | SMTP host for share notifications (e.g. `smtp.gmail.com`). Omitted → email notifications are skipped silently |
| `EMAIL_PORT` | optional | SMTP port (default `587`) |
| `EMAIL_SECURE` | optional | Set `true` for port 465 TLS, leave unset for STARTTLS (port 587) |
| `EMAIL_USER` | optional | SMTP login / sender address (e.g. your Gmail address) |
| `EMAIL_PASS` | optional | SMTP password. **For Gmail: use an App Password**, not your account password — generate one at myaccount.google.com → Security → 2-Step Verification → App passwords |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Base URL of the backend API, e.g. `http://localhost:5000/api` (dev) or `https://api.notely.app/api` (prod) |

## API Reference

All responses follow `{ success: boolean, message: string, data?: any, errors?: any[] }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/refresh` | — | Exchange refresh token for new access token |
| GET | `/api/auth/profile` | ✅ | Current user profile |
| PUT | `/api/auth/profile` | ✅ | Update username/avatar |
| GET | `/api/notes` | ✅ | List own notes (paginated, searchable, filterable) |
| GET | `/api/notes/public` | — | Browse public notes |
| GET | `/api/notes/shared/:token` | — | View a note by its public share token |
| POST | `/api/notes` | ✅ | Create note |
| GET | `/api/notes/:id` | ✅ | Get note (owner, shared user, or public) |
| PUT | `/api/notes/:id` | ✅ | Update note (owner only) |
| DELETE | `/api/notes/:id` | ✅ | Delete note (owner only) |
| POST | `/api/notes/:id/share` | ✅ | Generate/revoke public share token |
| GET/POST | `/api/notes/:id/share-with` | ✅ | List/add collaborators by email |
| DELETE | `/api/notes/:id/share-with/:userId` | ✅ | Revoke a collaborator |
| POST/DELETE | `/api/notes/:id/attachments[/:attId]` | ✅ | Upload/delete attachment |
| GET/POST | `/api/notes/:id/versions` | ✅ | List/create version snapshot |
| POST | `/api/notes/:id/versions/:verId/restore` | ✅ | Restore a version |
| GET | `/api/notes/:id/export?format=pdf\|docx` | ✅ | Export note |
| POST | `/api/ai/summarise` | ✅ | AI summary of a note |
| GET | `/api/analytics/dashboard` | ✅ | Dashboard stats |
| POST | `/api/analytics/notes/:id/view` | — | Record a note view |
| GET | `/api/health` | — | Liveness + DB connection status |

## Security Model

- **Passwords** — bcrypt, 12 salt rounds, never returned from queries (`select: false`)
- **Tokens** — short-lived JWT access token + longer-lived refresh token, both signed with independently-validated secrets (server refuses to start with weak/missing secrets)
- **Session scope** — tokens are stored in `sessionStorage`, not `localStorage`: each browser tab has its own session, and closing a tab ends it. Refreshing or duplicating the same tab keeps the session (same storage context); a brand-new tab does not inherit it
- **Access control** — every note/attachment/version/share mutation re-checks ownership or collaborator permission server-side; nothing relies on client-supplied role/ownership claims
- **Rate limiting** — global limiter, tighter limits on `/auth`, `/ai`, and `/export`
- **SSRF protection** — PDF export only fetches attachment images from an explicit hostname allowlist, with private/link-local IP ranges always blocked regardless of allowlist
- **Path traversal protection** — local-disk attachment deletion validates the resolved path stays inside the uploads root before unlinking
- **Stored-content XSS** — markdown note content is HTML-escaped and run through DOMPurify before rendering; link targets are restricted to `http(s):`/`mailto:`
- **Upload restrictions** — `image/svg+xml` is intentionally excluded from allowed attachment types (SVGs can embed `<script>` and are served back without sandboxing)
- **Headers** — `helmet` is applied; CORS is locked to a single configured origin with credentials

This list reflects manual review of the code paths above — it is **not** a substitute for a dependency audit (`npm audit`) or a third-party penetration test before handling real user data.

## Production Deployment

A common low-cost split:

- **Frontend** → Vercel or Netlify (`npm run build` in `client/`, deploy the `dist/` output)
- **Backend** → Render or Railway (`npm start` in `server/`)
- **Database** → MongoDB Atlas

### Backend checklist

1. Set all required env vars from the table above on your host, with `NODE_ENV=production`.
2. Set `CLIENT_URL` to your real deployed frontend origin (exact scheme + domain, no trailing slash).
3. **Set `CLOUDINARY_URL`.** Without it, attachments are written to local disk on the server container — most PaaS hosts (Render, Railway, Heroku-style) use **ephemeral filesystems**, so uploaded files will be lost on every redeploy/restart. Cloudinary (or S3) is required for durable file storage in production.
4. Confirm the MongoDB Atlas cluster's network access list allows your backend host's IP (or `0.0.0.0/0` if your host uses dynamic egress IPs, in which case rely on the database user's credentials for security, not IP allowlisting).
5. **TLS validation** — the MongoDB connection in `server/config/db.js` uses standard TLS certificate validation (no `tlsAllowInvalidCertificates` override). This works out of the box against MongoDB Atlas; only revisit if you're connecting to a self-hosted MongoDB with a self-signed certificate.

### Frontend checklist

1. Set `VITE_API_URL` to your deployed backend's `/api` URL at build time (Vite env vars are baked in at build, not runtime).
2. Confirm the service worker (`public/sw.js`) caching strategy doesn't serve stale API responses for sensitive data — review before enabling aggressive caching in production.

## Pre-Launch Checklist

- [ ] Run `npm audit` in both `client/` and `server/` and resolve high/critical findings
- [ ] Set `CLOUDINARY_URL` (or equivalent durable storage) — do not rely on local disk in production
- [ ] Generate fresh, unique `JWT_SECRET` / `JWT_REFRESH_SECRET` for production (do not reuse dev secrets)
- [ ] Set `CLIENT_URL` / `VITE_API_URL` to real production domains
- [ ] Confirm MongoDB Atlas network access + database user credentials are production-grade
- [ ] Manually test: register/login, multi-tab session isolation, note sharing (public + per-user), upload/export, AI summary, offline queue
- [ ] Set up basic uptime/error monitoring on the backend (e.g. host's built-in logs/alerts, or a service like Sentry)

## Known Limitations

- No automated test suite yet — all verification above is manual.
- Refresh tokens are issued with a 30-day lifetime but, since access tokens now live in `sessionStorage`, the practical session lifetime is bounded by tab lifetime, not token expiry.
- Socket.io collaboration does not currently implement operational-transform/CRDT conflict resolution — concurrent edits to the same region of a note can race.

## License

Add a license of your choice (e.g. MIT) before publishing publicly, if you intend others to reuse this code.
