/**
 * NoteEditor.jsx  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 2:
 *   + Attachments tab (AttachmentPanel)
 *   + Version History tab (VersionHistoryPanel)
 *   + ExportMenu in the toolbar
 *   + Auto-snapshots the note before every owner save
 */

import { useState, useEffect, useRef } from 'react';
import { useNotes }          from '../../context/NotesContext';
import useCollaboration      from '../../hooks/useCollaboration';
import MarkdownPreview       from './MarkdownPreview';
import CollaboratorBar       from './CollaboratorBar';
import ShareWithUserModal    from './ShareWithUserModal';
import AttachmentPanel       from './AttachmentPanel';
import VersionHistoryPanel   from './VersionHistoryPanel';
import ExportMenu            from './ExportMenu';
import styles                from './NoteEditor.module.css';

const NOTE_COLORS = [
  '#ffffff', '#f0ede3', '#e8f0ec', '#fef3c7',
  '#fce7e7', '#e0eaff', '#f3e8ff', '#d1fae5',
];

function formatBytes(bytes) {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** Lightweight file picker for brand-new notes — no noteId exists yet to
 *  upload against, so we just hold the files and upload them right after
 *  the note is created (see handleSubmit). */
function PendingAttachments({ files, onFilesChange, uploading }) {
  const inputRef = useRef(null);

  function handleSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (files.length >= 20) return;
    onFilesChange([...files, file]);
  }

  function handleRemove(idx) {
    onFilesChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className={styles.pendingPanel}>
      <div className={styles.pendingHeader}>
        <span className={styles.pendingTitle}>Attachments</span>
        <span className={styles.pendingCount}>{files.length} / 20</span>
      </div>
      <p className={styles.pendingHint}>
        Files will be uploaded once you create the note.
      </p>
      {files.length > 0 && (
        <ul className={styles.pendingList}>
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className={styles.pendingItem}>
              <span className={styles.pendingIcon}>📎</span>
              <div className={styles.pendingMeta}>
                <span className={styles.pendingFilename}>{file.name}</span>
                <span className={styles.pendingSize}>{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                className={styles.pendingDeleteBtn}
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${file.name}`}
                disabled={uploading}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < 20 && (
        <button
          type="button"
          className={styles.pendingUploadBtn}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          + Attach file
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.doc,.docx"
        className={styles.hiddenInput}
        onChange={handleSelect}
      />
    </div>
  );
}

// Tabs for the bottom panel
const TABS = [
  { id: 'write',    label: 'Write' },
  { id: 'preview',  label: 'Preview' },
  { id: 'attach',   label: 'Attachments' },
  { id: 'versions', label: 'History' },
];

export default function NoteEditor({ note, onClose }) {
  const { createNote, updateNote, isSaving } = useNotes();
  const isEditing = Boolean(note?._id);

  const [form, setForm] = useState({
    title:    note?.title    || '',
    content:  note?.content  || '',
    tags:     note?.tags?.join(', ') || '',
    isPublic: note?.isPublic || false,
    color:    note?.color    || '#ffffff',
    isPinned: note?.isPinned || false,
  });

  // Local attachment state so panel changes are reflected immediately
  const [attachments, setAttachments] = useState(note?.attachments || []);
  // For brand-new (unsaved) notes we can't upload yet — there's no noteId —
  // so we hold picked files locally and upload them right after creation.
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingPending, setUploadingPending] = useState(false);

  const [activeTab,    setActiveTab]    = useState('write');
  const [showAiPanel,  setShowAiPanel]  = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [aiSummary,    setAiSummary]    = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [error,        setError]        = useState('');

  const titleRef = useRef(null);

  // Real-time collaboration status — only meaningful once the note exists server-side.
  const { isConnected, collaborators: liveCollaborators } = useCollaboration(isEditing ? note._id : null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    function handleEsc(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      titleRef.current?.focus();
      return;
    }

    const parsedTags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const payload = {
      title:    form.title.trim(),
      content:  form.content,
      tags:     parsedTags,
      isPublic: form.isPublic,
      color:    form.color,
      isPinned: form.isPinned,
    };

    // Auto-snapshot before saving (Phase 3) — only for edits, not new notes
    if (isEditing) {
      try {
        const { default: notesService } = await import('../../services/notesService');
        await notesService.createSnapshot(note._id);
      } catch {
        // Non-fatal — proceed with save regardless
      }
    }

    const result = isEditing
      ? await updateNote(note._id, payload)
      : await createNote(payload);

    if (result.success) {
      if (!isEditing && pendingFiles.length > 0) {
        setUploadingPending(true);
        try {
          const { default: notesService } = await import('../../services/notesService');
          for (const file of pendingFiles) {
            await notesService.uploadAttachment(result.note._id, file, () => {});
          }
        } catch {
          // Note was created fine even if an attachment upload fails — don't block close
        } finally {
          setUploadingPending(false);
        }
      }
      onClose();
    } else {
      setError(result.error || 'Something went wrong');
    }
  }

  // ── AI Summary ────────────────────────────────────────────────────────────
  async function handleAiSummary() {
    if (!isEditing) {
      setAiSummary('Save the note first, then generate a summary.');
      return;
    }
    if (!form.content.trim()) {
      setAiSummary('Add some content first!');
      return;
    }
    setAiLoading(true);
    setAiSummary('');
    try {
      const { default: api } = await import('../../services/api');
      // Backend looks the note up by id (so it can re-check ownership/sharing),
      // so we send noteId rather than the raw content.
      const res = await api.post('/ai/summarise', { noteId: note._id });
      setAiSummary(res.data.data.summary);
    } catch (err) {
      setAiSummary(err.response?.data?.message || 'AI summary failed — try again');
    } finally {
      setAiLoading(false);
    }
  }

  function handleVersionRestored(restoredNote) {
    setForm((f) => ({
      ...f,
      title:   restoredNote.title,
      content: restoredNote.content,
    }));
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ '--editor-bg': form.color }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className={styles.header}>
          <h2 className={styles.heading}>{isEditing ? 'Edit note' : 'New note'}</h2>
          <div className={styles.headerActions}>
            {isEditing && (
              <ExportMenu noteId={note._id} disabled={isSaving} />
            )}
            {isEditing && (
              <button className={styles.shareBtn} onClick={() => setShowShare(true)}>
                Share
              </button>
            )}
            <button
              className={`${styles.aiBtn} ${showAiPanel ? styles.aiBtnActive : ''}`}
              onClick={() => setShowAiPanel((s) => !s)}
              title="AI Summary"
            >
              ✦ AI
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* ── Collaborator bar (Phase 2) ──────────────────────────────── */}
        {isEditing && (
          <CollaboratorBar isConnected={isConnected} collaborators={liveCollaborators} />
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* ── AI panel ───────────────────────────────────────────────── */}
        {showAiPanel && (
          <div className={styles.aiPanel}>
            <div className={styles.aiHeader}>
              <span>✦ AI Summary</span>
              <button className={styles.aiGenBtn} onClick={handleAiSummary} disabled={aiLoading}>
                {aiLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {aiSummary && <p className={styles.aiResult}>{aiSummary}</p>}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            name="title"
            className={styles.titleInput}
            placeholder="Note title…"
            value={form.title}
            onChange={handleChange}
            maxLength={200}
            required
          />

          {/* Content tabs */}
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              // History needs a saved note (it reads real version snapshots);
              // Attachments now works for new notes too, via pending files.
              (!isEditing && tab.id === 'versions') ? null : (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            ))}
          </div>

          {activeTab === 'write' && (
            <textarea
              name="content"
              className={styles.contentArea}
              placeholder="Start writing… (Markdown supported)"
              value={form.content}
              onChange={handleChange}
              rows={10}
            />
          )}

          {activeTab === 'preview' && (
            <div className={styles.previewBox}>
              {form.content
                ? <MarkdownPreview content={form.content} />
                : <p className={styles.previewEmpty}>Nothing to preview yet.</p>
              }
            </div>
          )}

          {activeTab === 'attach' && (
            isEditing ? (
              <AttachmentPanel
                noteId={note._id}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            ) : (
              <PendingAttachments
                files={pendingFiles}
                onFilesChange={setPendingFiles}
                uploading={uploadingPending}
              />
            )
          )}

          {activeTab === 'versions' && isEditing && (
            <VersionHistoryPanel
              noteId={note._id}
              onRestored={handleVersionRestored}
            />
          )}

          {/* Tags */}
          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            <input
              type="text"
              name="tags"
              className={styles.input}
              placeholder="research, ideas, work"
              value={form.tags}
              onChange={handleChange}
            />
            <span className={styles.hint}>Comma-separated, max 10</span>
          </div>

          {/* Color picker */}
          <div className={styles.field}>
            <label className={styles.label}>Card color</label>
            <div className={styles.colorRow}>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${form.color === c ? styles.colorSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className={styles.toggleRow}>
            {[
              { name: 'isPublic', label: 'Make public' },
              { name: 'isPinned', label: 'Pin to top' },
            ].map(({ name, label }) => (
              <label key={name} className={styles.toggle}>
                <input
                  type="checkbox"
                  name={name}
                  checked={form[name]}
                  onChange={handleChange}
                />
                <span className={styles.toggleTrack} />
                <span className={styles.toggleLabel}>{label}</span>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={isSaving || uploadingPending}>
              {uploadingPending ? 'Uploading…' : isSaving ? 'Saving…' : isEditing ? 'Save changes →' : 'Create note →'}
            </button>
          </div>
        </form>

        {/* Share with user modal (Phase 2) */}
        {showShare && isEditing && (
          <ShareWithUserModal noteId={note._id} onClose={() => setShowShare(false)} />
        )}
      </div>
    </div>
  );
}
