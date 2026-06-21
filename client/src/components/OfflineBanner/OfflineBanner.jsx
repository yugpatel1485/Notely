/**
 * OfflineBanner.jsx  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Slim top-of-screen banner that:
 *   - Slides in when the device goes offline
 *   - Shows a count of queued (unsynced) mutations
 *   - Briefly shows "Changes synced ✓" when background sync flushes
 *   - Disappears when back online and queue is empty
 */

import { useOffline } from '../../hooks/useOffline';
import styles         from './OfflineBanner.module.css';

export default function OfflineBanner() {
  const { isOffline, queuedCount, syncComplete } = useOffline();

  // Nothing to show: online, no queued items, no recent sync
  if (!isOffline && queuedCount === 0 && !syncComplete) return null;

  let message;
  let variant = 'offline';

  if (syncComplete && !isOffline) {
    message = 'Changes synced ✓';
    variant = 'synced';
  } else if (isOffline && queuedCount > 0) {
    message = `You're offline — ${queuedCount} change${queuedCount !== 1 ? 's' : ''} queued`;
    variant = 'offline';
  } else if (isOffline) {
    message = "You're offline — changes will sync when reconnected";
    variant = 'offline';
  } else if (queuedCount > 0) {
    // Back online but sync not fired yet
    message = `Syncing ${queuedCount} queued change${queuedCount !== 1 ? 's' : ''}…`;
    variant = 'syncing';
  }

  return (
    <div
      className={`${styles.banner} ${styles[variant]}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
    </div>
  );
}
