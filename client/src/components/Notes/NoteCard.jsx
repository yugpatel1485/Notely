import styles from './NoteCard.module.css';
import { toPreviewText } from '../../utils/textPreview';

/** Formats a MongoDB ISO date string to a human-readable relative time */
function formatDate(iso) {
  if (!iso) return '';
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

export default function NoteCard({ note, onClick, onDelete }) {
  const preview = note.content
    ? toPreviewText(note.content, 120)
    : 'No content yet…';

  function handleDeleteClick(e) {
    e.stopPropagation();
    onDelete?.(note._id);
  }

  return (
    <article
      className={styles.card}
      style={{ '--card-bg': note.color || '#ffffff' }}
      onClick={() => onClick?.(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(note)}
    >
      {/* Pin indicator */}
      {note.isPinned && <span className={styles.pin} title="Pinned">◈</span>}

      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.tagRow}>
          {note.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
        <span className={`${styles.badge} ${note.isPublic ? styles.badgePublic : styles.badgePrivate}`}>
          {note.isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      {/* Title */}
      <h3 className={styles.title}>{note.title}</h3>

      {/* Content preview */}
      <p className={styles.preview}>{preview}</p>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.date}>{formatDate(note.updatedAt)}</span>
        <div className={styles.footerRight}>
          {note.attachments?.length > 0 && (
            <span
              className={styles.attachBadge}
              title={note.attachments.map(a => a.filename).join(', ')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              {note.attachments.length} {note.attachments.length === 1 ? 'file' : 'files'}
            </span>
          )}
          <button
            className={styles.deleteBtn}
            onClick={handleDeleteClick}
            aria-label="Delete note"
            title="Delete note"
          >
            ✕
          </button>
        </div>
      </div>
    </article>
  );
}
