/**
 * VersionHistoryPanel.jsx  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown inside NoteEditor. Lists saved versions and lets the owner
 * preview, restore, or delete them.
 */

import { useState, useEffect, useCallback } from 'react';
import notesService from '../../services/notesService';
import MarkdownPreview from './MarkdownPreview';
import styles       from './VersionHistoryPanel.module.css';

function timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'Just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function VersionHistoryPanel({ noteId, onRestored }) {
  const [versions,  setVersions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [preview,   setPreview]   = useState(null);   // { version object with full content }
  const [restoring, setRestoring] = useState(null);   // verId being restored

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await notesService.listVersions(noteId);
      setVersions(list);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => { load(); }, [load]);

  async function handlePreview(ver) {
    try {
      const full = await notesService.getVersion(noteId, ver._id);
      setPreview(full);
    } catch {
      setError('Could not load version content');
    }
  }

  async function handleRestore(verId) {
    if (!window.confirm('Restore this version? The current content will be saved as a new version first.')) return;
    setRestoring(verId);
    try {
      const note = await notesService.restoreVersion(noteId, verId);
      onRestored?.(note);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
  }

  async function handleDelete(verId) {
    if (!window.confirm('Delete this version entry? This cannot be undone.')) return;
    try {
      await notesService.deleteVersion(noteId, verId);
      setVersions((v) => v.filter((x) => x._id !== verId));
      if (preview?._id === verId) setPreview(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  }

  async function handleSnapshot() {
    try {
      await notesService.createSnapshot(noteId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Snapshot failed');
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Version History</span>
        <button className={styles.snapshotBtn} onClick={handleSnapshot} title="Save snapshot now">
          Save snapshot
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : versions.length === 0 ? (
        <p className={styles.muted}>No saved versions yet. Save a snapshot to begin tracking.</p>
      ) : (
        <ul className={styles.list}>
          {versions.map((ver) => (
            <li key={ver._id} className={`${styles.item} ${preview?._id === ver._id ? styles.itemActive : ''}`}>
              <div className={styles.itemInfo} onClick={() => handlePreview(ver)}>
                <span className={styles.label}>{ver.label}</span>
                <span className={styles.when}>{timeAgo(ver.savedAt)}</span>
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.restoreBtn}
                  onClick={() => handleRestore(ver._id)}
                  disabled={restoring === ver._id}
                  title="Restore this version"
                >
                  {restoring === ver._id ? '…' : 'Restore'}
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(ver._id)}
                  title="Delete this version"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview pane */}
      {preview && (
        <div className={styles.previewPane}>
          <div className={styles.previewHeader}>
            <span className={styles.previewLabel}>{preview.label}</span>
            <button className={styles.closePreview} onClick={() => setPreview(null)}>✕</button>
          </div>
          <h4 className={styles.previewTitle}>{preview.title}</h4>
          <MarkdownPreview content={preview.content} className={styles.previewContent} />
        </div>
      )}
    </div>
  );
}
