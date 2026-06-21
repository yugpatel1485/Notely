import styles from './NoteCard.module.css';

/**
 * Props
 * -----
 * note        – note data object
 * slotStyle   – { top, left, zIndex, opacity, transform } for this slot
 * slotName    – 'front' | 'mid' | 'back' (drives float animation class)
 * transition  – CSS transition string (set per-card by NoteStack)
 * isShuffling – pauses float animations while cards are moving
 * onClick     – click handler
 */
export default function NoteCard({
  note,
  slotStyle,
  slotName,
  transition,
  isShuffling,
  onClick,
}) {
  const floatClass = isShuffling ? '' : styles[`float_${slotName}`];

  return (
    <article
      className={[styles.card, floatClass].join(' ')}
      style={{
        ...slotStyle,
        transition,
        background: note.tint,
      }}
      onClick={onClick}
      aria-label={`Note: ${note.title}`}
    >
      <span
        className={[
          styles.tag,
          note.tagVariant === 'green' ? styles.tagGreen : '',
        ].join(' ')}
      >
        {note.tag}
      </span>

      <h3 className={styles.title}>{note.title}</h3>
      <p  className={styles.body}>{note.body}</p>

      <hr className={styles.divider} />

      <footer className={styles.meta}>
        <span>
          <span
            className={[
              styles.dot,
              note.statusVariant === 'green' ? styles.dotGreen : '',
            ].join(' ')}
          />
          {note.status}
        </span>
        <span>{note.date}</span>
      </footer>
    </article>
  );
}
