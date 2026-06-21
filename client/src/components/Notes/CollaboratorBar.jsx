/**
 * CollaboratorBar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a live list of users currently viewing/editing the note,
 * alongside a connection status pill.
 */

import styles from './CollaboratorBar.module.css';

function Avatar({ user, index }) {
  const initial = user.username?.[0]?.toUpperCase() ?? '?';
  return (
    <div
      className={styles.avatar}
      style={{ zIndex: 10 - index, '--hue': (user.userId?.charCodeAt(0) ?? 0) % 360 }}
      title={user.username}
    >
      {user.avatar
        ? <img src={user.avatar} alt={user.username} />
        : <span>{initial}</span>
      }
    </div>
  );
}

export default function CollaboratorBar({ collaborators = [], isConnected }) {
  return (
    <div className={styles.bar}>
      {/* Connection status */}
      <span className={`${styles.status} ${isConnected ? styles.connected : styles.disconnected}`}>
        {isConnected ? 'Live' : 'Offline'}
      </span>

      {/* Avatar stack */}
      {collaborators.length > 0 && (
        <div className={styles.avatars}>
          {collaborators.slice(0, 6).map((c, i) => (
            <Avatar key={c.userId} user={c} index={i} />
          ))}
          {collaborators.length > 6 && (
            <div className={`${styles.avatar} ${styles.overflow}`}>
              +{collaborators.length - 6}
            </div>
          )}
        </div>
      )}

      {collaborators.length === 0 && isConnected && (
        <span className={styles.alone}>Only you</span>
      )}
    </div>
  );
}
