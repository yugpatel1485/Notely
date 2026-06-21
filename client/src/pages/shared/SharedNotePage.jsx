/**
 * SharedNotePage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public page that renders a note by its shareToken.
 * No authentication required — accessible to anyone with the link.
 */

import { useEffect, useState }  from 'react';
import { useParams, Link }      from 'react-router-dom';
import notesService              from '../../services/notesService';
import MarkdownPreview           from '../../components/Notes/MarkdownPreview';
import styles                    from './SharedNotePage.module.css';

export default function SharedNotePage() {
  const { token }      = useParams();
  const [note,         setNote]      = useState(null);
  const [isLoading,    setIsLoading] = useState(true);
  const [error,        setError]     = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await notesService.getNoteByShareToken(token);
        setNote(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Note not found or no longer shared');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token]);

  if (isLoading) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>{error}</p>
        <Link to="/" className={styles.homeLink}>← Back to Notely</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>Notely</Link>
        <span className={styles.badge}>Shared note</span>
      </header>

      <article className={styles.article} style={{ '--note-color': note.color || '#ffffff' }}>
        {/* Tags */}
        {note.tags?.length > 0 && (
          <div className={styles.tags}>
            {note.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className={styles.title}>{note.title}</h1>

        {/* Meta */}
        <div className={styles.meta}>
          <span>By <strong>{note.owner?.username}</strong></span>
          <span>·</span>
          <span>{new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <MarkdownPreview content={note.content} />
        </div>
      </article>

      <footer className={styles.footer}>
        <Link to="/register" className={styles.cta}>
          Create your own notes on Notely →
        </Link>
      </footer>
    </div>
  );
}
