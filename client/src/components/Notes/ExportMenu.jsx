/**
 * ExportMenu.jsx  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * A small dropdown button that triggers note export as PDF or DOCX.
 * Used inside NoteEditor toolbar.
 */

import { useState, useRef, useEffect } from 'react';
import notesService from '../../services/notesService';
import styles       from './ExportMenu.module.css';

const FORMATS = [
  { id: 'pdf',  label: 'Export as PDF',  icon: '📄' },
  { id: 'docx', label: 'Export as DOCX', icon: '📝' },
];

export default function ExportMenu({ noteId, disabled }) {
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(null);   // 'pdf' | 'docx' | null
  const [error,    setError]    = useState('');
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleExport(format) {
    setOpen(false);
    setLoading(format);
    setError('');
    try {
      await notesService.exportNote(noteId, format);
    } catch {
      setError(`Export failed — try again`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || !!loading}
        title="Export note"
      >
        {loading ? `Exporting ${loading.toUpperCase()}…` : '↓ Export'}
      </button>

      {error && <span className={styles.error}>{error}</span>}

      {open && (
        <div className={styles.menu}>
          {FORMATS.map(({ id, label, icon }) => (
            <button
              key={id}
              className={styles.menuItem}
              onClick={() => handleExport(id)}
            >
              <span className={styles.menuIcon}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
