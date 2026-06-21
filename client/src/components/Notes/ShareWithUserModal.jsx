/**
 * ShareWithUserModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets the note owner share a note with another Notely user by email.
 * Also shows existing collaborators and allows revoking access.
 */

import { useState, useEffect, useCallback } from 'react';
import api     from '../../services/api';
import styles  from './ShareWithUserModal.module.css';

export default function ShareWithUserModal({ noteId, onClose }) {
  const [email,          setEmail]          = useState('');
  const [permission,     setPermission]     = useState('read');
  const [collaborators,  setCollaborators]  = useState([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isFetching,     setIsFetching]     = useState(true);
  const [message,        setMessage]        = useState({ type: '', text: '' });

  // ── Fetch existing collaborators ──────────────────────────────────────────
  const loadCollaborators = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await api.get(`/notes/${noteId}/share-with`);
      setCollaborators(res.data.data.collaborators ?? []);
    } catch {
      // Non-critical — table can be empty
    } finally {
      setIsFetching(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  // ── Share ─────────────────────────────────────────────────────────────────
  async function handleShare(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post(`/notes/${noteId}/share-with`, {
        email: email.trim().toLowerCase(),
        permission,
      });
      setMessage({ type: 'success', text: res.data.message });
      setEmail('');
      loadCollaborators();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to share note' });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Revoke ────────────────────────────────────────────────────────────────
  async function handleRevoke(userId, username) {
    if (!window.confirm(`Remove ${username}'s access?`)) return;
    try {
      await api.delete(`/notes/${noteId}/share-with/${userId}`);
      setMessage({ type: 'success', text: `Access revoked for ${username}` });
      loadCollaborators();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to revoke access' });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Share note">
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Share this note</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Share form */}
        <form className={styles.form} onSubmit={handleShare}>
          <div className={styles.inputRow}>
            <input
              type="email"
              className={styles.emailInput}
              placeholder="Email address…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <select
              className={styles.permSelect}
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
            <button
              type="submit"
              className={styles.shareBtn}
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? '…' : 'Invite'}
            </button>
          </div>
        </form>

        {/* Feedback */}
        {message.text && (
          <p className={`${styles.message} ${message.type === 'error' ? styles.msgError : styles.msgSuccess}`}>
            {message.text}
          </p>
        )}

        {/* Collaborators list */}
        <div className={styles.listSection}>
          <h3 className={styles.listTitle}>People with access</h3>
          {isFetching ? (
            <p className={styles.muted}>Loading…</p>
          ) : collaborators.length === 0 ? (
            <p className={styles.muted}>No one yet — invite someone above.</p>
          ) : (
            <ul className={styles.list}>
              {collaborators.map(({ user, permission: perm }) => (
                <li key={user._id} className={styles.listItem}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      {user.avatar
                        ? <img src={user.avatar} alt={user.username} />
                        : <span>{user.username?.[0]?.toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <p className={styles.username}>{user.username}</p>
                      <p className={styles.userEmail}>{user.email}</p>
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.permBadge}>{perm}</span>
                    <button
                      className={styles.revokeBtn}
                      onClick={() => handleRevoke(user._id, user.username)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
