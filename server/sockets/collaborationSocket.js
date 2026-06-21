'use strict';

/**
 * collaborationSocket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages real-time collaboration rooms via Socket.io.
 *
 * Security fix: note:update now verifies the sender has at least read access
 * AND write permission before broadcasting content deltas. Previously any
 * authenticated socket could push content to a room regardless of whether
 * they still had access to the note.
 *
 * Protocol
 * ────────
 * • client joins a note room:      socket.emit('note:join', { noteId, token })
 * • server acks with collaborators: socket.emit('note:joined', { collaborators })
 * • client sends content delta:    socket.emit('note:update', { noteId, content, title })
 * • server broadcasts to room:     socket.to(room).emit('note:updated', { content, title, userId, username })
 * • client cursor moves:           socket.emit('note:cursor', { noteId, position })
 * • server broadcasts cursor:      socket.to(room).emit('note:cursor', { userId, username, position })
 * • client leaves / disconnects:   auto-cleaned up
 */

const { verifyAccessToken } = require('../utils/jwt');
const User                  = require('../models/User');
const Note                  = require('../models/Note');

// roomId → Set<{ socketId, userId, username, avatar }>
const rooms = new Map();

function getRoomId(noteId) {
  return `note:${noteId}`;
}

function getCollaborators(roomId) {
  const members = rooms.get(roomId);
  if (!members) return [];
  return [...members].map(({ userId, username, avatar }) => ({ userId, username, avatar }));
}

function addToRoom(roomId, socketId, userInfo) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add({ socketId, ...userInfo });
}

function removeFromRoom(socketId) {
  for (const [roomId, members] of rooms.entries()) {
    for (const member of members) {
      if (member.socketId === socketId) {
        members.delete(member);
        if (members.size === 0) rooms.delete(roomId);
        return roomId;
      }
    }
  }
  return null;
}

/**
 * Authenticate a socket connection using the JWT sent in the handshake auth.
 */
async function authenticateSocket(socket) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return null;

    const decoded = verifyAccessToken(token);
    const user    = await User.findById(decoded.sub).select('username avatar isActive');
    if (!user || !user.isActive) return null;

    return user;
  } catch {
    return null;
  }
}

/**
 * Verify the requesting user may access a given note.
 * Returns { note, canWrite } on success, null on denial.
 */
async function authoriseNoteAccess(noteId, userId) {
  const note = await Note.findById(noteId);
  if (!note) return null;

  const userIdStr = userId.toString();
  const isOwner   = note.owner.toString() === userIdStr;
  const shared    = note.sharedWith.find(
    (s) => s.user?.toString() === userIdStr || s.toString?.() === userIdStr
  );
  const isPublic  = note.isPublic;

  if (!isOwner && !shared && !isPublic) return null;

  const canWrite = isOwner || (shared?.permission === 'write');
  return { note, canWrite };
}

/**
 * Register all collaboration event handlers on the Socket.io server.
 */
function registerCollaborationHandlers(io) {

  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const user = await authenticateSocket(socket);
    if (!user) return next(new Error('Authentication failed'));
    socket.user = user;
    next();
  });

  // ── Connection ──────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { _id: userId, username, avatar } = socket.user;

    // ── note:join ─────────────────────────────────────────────────────────────
    socket.on('note:join', async ({ noteId } = {}) => {
      if (!noteId) return socket.emit('error', { message: 'noteId is required' });

      const result = await authoriseNoteAccess(noteId, userId);
      if (!result) return socket.emit('error', { message: 'Access denied or note not found' });

      const roomId = getRoomId(noteId);
      socket.join(roomId);

      // Store write permission in socket data so note:update can check it fast
      // without re-querying the DB on every keystroke.
      if (!socket.notePermissions) socket.notePermissions = {};
      socket.notePermissions[noteId] = result.canWrite;

      addToRoom(roomId, socket.id, {
        userId:   userId.toString(),
        username,
        avatar,
      });

      const collaborators = getCollaborators(roomId);

      socket.emit('note:joined', {
        collaborators,
        note: { content: result.note.content, title: result.note.title },
      });

      socket.to(roomId).emit('note:collaborator_joined', {
        userId: userId.toString(), username, avatar, collaborators,
      });
    });

    // ── note:update ───────────────────────────────────────────────────────────
    // Broadcast content deltas to all other room members.
    // Security fix: verify the sender has write access before broadcasting.
    socket.on('note:update', async ({ noteId, content, title } = {}) => {
      if (!noteId) return;

      // Fast path: use cached permission from note:join
      const cachedCanWrite = socket.notePermissions?.[noteId];

      if (cachedCanWrite === undefined) {
        // Socket joined without going through note:join for this note — re-verify
        const result = await authoriseNoteAccess(noteId, userId);
        if (!result || !result.canWrite) {
          return socket.emit('error', { message: 'Write permission required' });
        }
        if (!socket.notePermissions) socket.notePermissions = {};
        socket.notePermissions[noteId] = result.canWrite;
      } else if (!cachedCanWrite) {
        return socket.emit('error', { message: 'Write permission required' });
      }

      const roomId = getRoomId(noteId);
      socket.to(roomId).emit('note:updated', {
        content,
        title,
        userId:   userId.toString(),
        username,
      });
    });

    // ── note:save ─────────────────────────────────────────────────────────────
    socket.on('note:save', async ({ noteId, content, title } = {}) => {
      if (!noteId) return;

      try {
        const note = await Note.findOne({ _id: noteId, owner: userId });
        if (!note) return socket.emit('error', { message: 'Only the owner can save' });

        if (title   !== undefined) note.title   = title;
        if (content !== undefined) note.content = content;
        await note.save();

        const roomId = getRoomId(noteId);
        io.to(roomId).emit('note:saved', {
          noteId,
          title:   note.title,
          content: note.content,
          savedAt: note.updatedAt,
          savedBy: username,
        });
      } catch {
        socket.emit('error', { message: 'Save failed' });
      }
    });

    // ── note:cursor ───────────────────────────────────────────────────────────
    socket.on('note:cursor', ({ noteId, position } = {}) => {
      if (!noteId || position === undefined) return;
      const roomId = getRoomId(noteId);
      socket.to(roomId).emit('note:cursor', {
        userId: userId.toString(),
        username,
        position,
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = removeFromRoom(socket.id);
      if (roomId) {
        const collaborators = getCollaborators(roomId);
        socket.to(roomId).emit('note:collaborator_left', {
          userId: userId.toString(),
          username,
          collaborators,
        });
      }
    });
  });
}

module.exports = { registerCollaborationHandlers };
