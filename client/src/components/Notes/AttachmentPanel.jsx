/**
 * AttachmentPanel.jsx  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown inside NoteEditor. Lets the user upload and manage file attachments.
 */

import { useState, useRef } from 'react';
import notesService from '../../services/notesService';
import styles from './AttachmentPanel.module.css';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);

function fileIcon(mimetype) {
  if (IMAGE_TYPES.has(mimetype)) return '🖼';
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.startsWith('text/')) return '📝';
  return '📎';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function AttachmentPanel({ noteId, attachments = [], onAttachmentsChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';   // reset so same file can be re-uploaded

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const attachment = await notesService.uploadAttachment(noteId, file, (pct) => {
        // Once the browser has finished sending the file, the server still needs
        // to upload it to Cloudinary and save it — clamp visual progress to 99%
        // during that window so "100%" only ever appears right when it's truly done.
        setProgress(pct >= 100 ? 99 : pct);
      });
      setProgress(100);
      onAttachmentsChange([...attachments, attachment]);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete(attId, filename) {
    if (!window.confirm(`Remove "${filename}"?`)) return;
    try {
      await notesService.deleteAttachment(noteId, attId);
      onAttachmentsChange(attachments.filter((a) => a._id !== attId));
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Attachments</span>
        <span className={styles.count}>{attachments.length} / 20</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* File list */}
      {attachments.length > 0 && (
        <ul className={styles.list}>
          {attachments.map((att) => (
            <li key={att._id} className={styles.item}>
              {/* Preview thumbnail for images */}
              {IMAGE_TYPES.has(att.mimetype) ? (
                <img src={att.url} alt={att.filename} className={styles.thumb} />
              ) : (
                <span className={styles.icon}>{fileIcon(att.mimetype)}</span>
              )}
              <div className={styles.meta}>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.filename}
                >
                  {att.filename}
                </a>
                <span className={styles.size}>{formatBytes(att.size)}</span>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(att._id, att.filename)}
                aria-label={`Remove ${att.filename}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload area */}
      {attachments.length < 20 && (
        <>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? (progress >= 99 ? 'Processing…' : `Uploading… ${progress}%`)
              : '+ Attach file'}
          </button>
          {uploading && (
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${progress >= 99 ? styles.progressFillPulsing : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.doc,.docx"
            className={styles.hiddenInput}
            onChange={handleFileSelect}
          />
          <p className={styles.hint}>Images, PDF, TXT, MD, DOC — max 10 MB</p>
        </>
      )}
    </div>
  );
}