/**
 * useCollaboration.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages a Socket.io connection for real-time note collaboration.
 *
 * Usage:
 *   const { collaborators, remoteContent, remoteTitle, isConnected,
 *           broadcastUpdate, broadcastCursor, saveRemotely } = useCollaboration(noteId);
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import tokenStorage from '../utils/tokenStorage';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function useCollaboration(noteId) {
  const socketRef = useRef(null);
  const { user } = useAuth();
  const selfId = (user?.id ?? user?._id)?.toString();

  // The server's collaborator lists include the requesting socket itself —
  // strip that out so people don't see their own avatar as a "collaborator".
  const withoutSelf = useCallback(
    (list = []) => list.filter((c) => c.userId !== selfId),
    [selfId]
  );

  const [isConnected,    setIsConnected]    = useState(false);
  const [collaborators,  setCollaborators]  = useState([]);
  const [remoteContent,  setRemoteContent]  = useState(null);
  const [remoteTitle,    setRemoteTitle]    = useState(null);
  const [cursors,        setCursors]        = useState({});   // userId → { username, position }
  const [savedAt,        setSavedAt]        = useState(null);

  useEffect(() => {
    if (!noteId) return;

    const token = tokenStorage.getAccessToken();
    if (!token) return;

    // ── Create socket ────────────────────────────────────────────────────────
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // ── Connection lifecycle ─────────────────────────────────────────────────
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('note:join', { noteId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCollaborators([]);
    });

    // ── Room events ──────────────────────────────────────────────────────────
    socket.on('note:joined', ({ collaborators: c }) => {
      setCollaborators(withoutSelf(c));
    });

    socket.on('note:collaborator_joined', ({ collaborators: c }) => {
      setCollaborators(withoutSelf(c));
    });

    socket.on('note:collaborator_left', ({ collaborators: c }) => {
      setCollaborators(withoutSelf(c));
    });

    // ── Remote content changes ───────────────────────────────────────────────
    socket.on('note:updated', ({ content, title }) => {
      if (content !== undefined) setRemoteContent(content);
      if (title   !== undefined) setRemoteTitle(title);
    });

    socket.on('note:saved', ({ savedAt: at }) => {
      setSavedAt(new Date(at));
    });

    // ── Remote cursors ───────────────────────────────────────────────────────
    socket.on('note:cursor', ({ userId, username, position }) => {
      setCursors((prev) => ({ ...prev, [userId]: { username, position } }));
    });

    socket.on('error', ({ message }) => {
      console.warn('[Collab] Socket error:', message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [noteId]);

  // ── Outbound actions ───────────────────────────────────────────────────────

  const broadcastUpdate = useCallback((content, title) => {
    socketRef.current?.emit('note:update', { noteId, content, title });
  }, [noteId]);

  const broadcastCursor = useCallback((position) => {
    socketRef.current?.emit('note:cursor', { noteId, position });
  }, [noteId]);

  const saveRemotely = useCallback((content, title) => {
    socketRef.current?.emit('note:save', { noteId, content, title });
  }, [noteId]);

  return {
    isConnected,
    collaborators,
    remoteContent,
    remoteTitle,
    cursors,
    savedAt,
    broadcastUpdate,
    broadcastCursor,
    saveRemotely,
  };
}
