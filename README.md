# Notely — Final Combined Project

A full-stack MERN note-sharing web application

## Features

### Phase 1 — Core Foundation
- User authentication (register / login / JWT)
- Create, edit, delete notes
- Landing page with animated UI (Hero, Marquee, Features, CTA)
- Protected dashboard with note editor

### Phase 2 — Collaboration & Sharing
- Real-time collaboration via Socket.io
- Share notes via public/private links (`/shared/:token`)
- AI-generated note summaries
- Markdown preview
- Share with specific users modal

### Phase 3 — Advanced Features
- File attachments (upload / download)
- Version history (view and restore previous note versions)
- Export notes to PDF or DOCX
- Analytics dashboard (note stats, view tracking)

### Phase 4 — Polish
- **Dark Mode** — system-aware + manual toggle, persisted in localStorage
- **Offline Support** — Service Worker caching, offline banner, API queue

---

## Project Structure

```
notely/
├── client/                   # React + Vite frontend
│   ├── public/
│   │   └── sw.js             # Service Worker (offline support)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/         # ProtectedRoute, GuestRoute
│   │   │   ├── Layout/       # DashboardLayout
│   │   │   ├── Notes/        # NoteEditor, NoteCard, AttachmentPanel,
│   │   │   │                 #   ExportMenu, VersionHistoryPanel,
│   │   │   │                 #   CollaboratorBar, MarkdownPreview, ShareWithUserModal
│   │   │   ├── OfflineBanner/# Offline indicator
│   │   │   ├── ThemeToggle/  # Dark/light mode toggle
│   │   │   └── ...           # Landing page components
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── NotesContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/
│   │   │   ├── useAiSummary.js
│   │   │   ├── useCollaboration.js
│   │   │   ├── useCursor.js
│   │   │   ├── useOffline.js
│   │   │   ├── useReveal.js
│   │   │   └── useTheme.js
│   │   ├── pages/
│   │   │   ├── auth/         # LoginPage, RegisterPage
│   │   │   ├── dashboard/    # DashboardPage, ExplorePage, AnalyticsPage, SettingsPage
│   │   │   └── shared/       # SharedNotePage (public share links)
│   │   ├── services/         # API service modules
│   │   ├── styles/           # globals.css (CSS variables, dark mode)
│   │   └── utils/
│   │       └── registerSW.js # Service Worker registration
│   ├── vite.config.js        # PWA plugin config
│   └── package.json
│
└── server/                   # Node.js + Express backend
    ├── config/db.js          # MongoDB Atlas connection
    ├── controllers/
    │   ├── authController.js
    │   ├── notesController.js
    │   ├── shareController.js
    │   ├── aiController.js
    │   ├── uploadController.js
    │   ├── versionController.js
    │   ├── exportController.js
    │   └── analyticsController.js
    ├── middleware/
    │   ├── auth.js
    │   ├── errorHandler.js
    │   └── validate.js
    ├── models/
    │   ├── User.js
    │   └── Note.js
    ├── routes/               # All API route files
    ├── sockets/
    │   └── collaborationSocket.js
    ├── utils/
    ├── server.js
    └── package.json
```

---

## Getting Started

### 1. Backend

```bash
cd server
npm install
npm run dev
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get profile |
| GET | `/api/notes` | List notes |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| POST | `/api/notes/:id/share-with` | Share with user |
| GET | `/api/notes/:id/versions` | Version history |
| POST | `/api/notes/:id/attachments` | Upload attachment |
| GET | `/api/notes/:id/export` | Export to PDF/DOCX |
| GET | `/api/analytics` | Analytics data |
| POST | `/api/ai/summarize` | AI summary |

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS / CSS Modules, Socket.io-client
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB Atlas + Mongoose
- **Auth**: JWT + bcryptjs
- **AI**: OpenAI API
- **PWA**: Service Worker, vite-plugin-pwa

## Deployment

- **Frontend**: Vercel / Netlify
- **Backend**: Render / Railway
- **Database**: MongoDB Atlas
