/**
 * DeleteAccountModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Confirmation modal for permanently deleting the user's account.
 * Requires the user to re-enter their password before the destructive
 * action is allowed to proceed.
 */

import { useState } from 'react';
import authService   from '../../services/authService';
import styles         from './DeleteAccountModal.module.css';

export default function DeleteAccountModal({ onClose, onDeleted }) {
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm(e) {
    e.preventDefault();
    if (!password) return;

    setIsDeleting(true);
    setError('');
    try {
      await authService.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && !isDeleting && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Delete account">
        <div className={styles.header}>
          <h2 className={styles.title}>Delete your account?</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={isDeleting} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.warning}>
            This permanently deletes your account and cannot be undone. Specifically:
          </p>
          <ul className={styles.list}>
            <li><strong>Notes you own</strong> — deleted forever, including attachments and version history.</li>
            <li><strong>Notes shared with you</strong> by other people — left untouched; you're simply removed as a collaborator.</li>
            <li><strong>Public share links</strong> on your notes — stop working immediately.</li>
          </ul>

          <form className={styles.form} onSubmit={handleConfirm}>
            <label className={styles.label} htmlFor="confirmPassword">
              Enter your password to confirm
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              disabled={isDeleting}
            />

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.deleteBtn}
                disabled={isDeleting || !password}
              >
                {isDeleting ? 'Deleting…' : 'Permanently delete account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
