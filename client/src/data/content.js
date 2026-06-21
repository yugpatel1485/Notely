export const NOTES = [
  {
    id: 0,
    tag: 'Research',
    tagVariant: 'default',
    tint: 'white',
    title: 'MERN Stack Architecture Notes',
    body: 'MongoDB + Express + React + Node. Full-stack JavaScript. REST APIs connected to a cloud database...',
    status: 'Private',
    statusVariant: 'default',
    date: 'Today',
  },
  {
    id: 1,
    tag: 'Ideas',
    tagVariant: 'default',
    tint: '#f0ede3',
    title: 'Feature brainstorm — v2',
    body: 'Real-time collab via Socket.io, AI summaries, version history, offline support...',
    status: 'Shared',
    statusVariant: 'default',
    date: 'Yesterday',
  },
  {
    id: 2,
    tag: 'Team',
    tagVariant: 'green',
    tint: '#e8f0ec',
    title: 'API Endpoints Reference',
    body: 'GET /api/notes · POST /api/notes · PUT /api/notes/:id · DELETE /api/notes/:id',
    status: 'Public',
    statusVariant: 'green',
    date: '3 days ago',
  },
];

export const MARQUEE_ITEMS = [
  'MongoDB Atlas',
  'Express.js REST APIs',
  'React + Vite',
  'Node.js Backend',
  'JWT Authentication',
  'Tailwind CSS',
  'Real-time Collaboration',
  'Vercel Deployment',
];

export const FEATURES = [
  { num: '01', icon: '🔐', name: 'Secure Auth',      desc: 'JWT-based login with bcrypt password hashing and token expiration. Your account, locked down.',              corner: 'Auth →'       },
  { num: '02', icon: '📝', name: 'Rich Notes',       desc: 'Create, edit, and delete notes with tags, markdown support, and a clean writing interface.',                  corner: 'Write →'      },
  { num: '03', icon: '🔗', name: 'Share Anywhere',   desc: 'Generate public or private links. Control exactly who sees what, anytime.',                                   corner: 'Share →'      },
  { num: '04', icon: '⚡', name: 'Real-time Collab', desc: 'Socket.io-powered live editing. Work together without stepping on each other\'s toes.',                        corner: 'Collab →'     },
  { num: '05', icon: '🔍', name: 'Search & Filter',  desc: 'Find any note instantly. Filter by tags, date, or sharing status — results in milliseconds.',                  corner: 'Search →'     },
  { num: '06', icon: '🤖', name: 'AI Summaries',     desc: 'Too much to read? Get a sharp, one-paragraph AI-generated summary of any note.',                              corner: 'Summarize →'  },
];

export const STACK_ITEMS = [
  { badge: 'default', label: 'Frontend',  name: 'React.js + Vite',   role: 'UI Layer'       },
  { badge: 'default', label: 'Styling',   name: 'Tailwind CSS',       role: 'Design System'  },
  { badge: 'alt',     label: 'Backend',   name: 'Node.js + Express',  role: 'API Server'     },
  { badge: 'alt',     label: 'Database',  name: 'MongoDB Atlas',      role: 'Cloud Storage'  },
  { badge: 'default', label: 'Auth',      name: 'JWT + bcryptjs',     role: 'Security'       },
  { badge: 'default', label: 'Deploy',    name: 'Vercel + Render',    role: 'Hosting'        },
];
