/**
 * useOffline.js  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks the browser's online/offline state and whether there are
 * pending mutations waiting to be synced.
 *
 * Returns:
 *   isOffline     boolean   true when navigator.onLine is false
 *   queuedCount   number    mutations sitting in the IndexedDB sync queue
 *   syncComplete  boolean   true for 3 s after a successful background sync flush
 *
 * Usage:
 *   const { isOffline, queuedCount, syncComplete } = useOffline();
 */

import { useState, useEffect, useCallback } from 'react';

const DB_NAME    = 'notely-sync';
const STORE_NAME = 'queue';

async function getQueueCount() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          return resolve(0);
        }
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const count = tx.objectStore(STORE_NAME).count();
        count.onsuccess = () => { db.close(); resolve(count.result); };
        count.onerror   = () => { db.close(); resolve(0); };
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export function useOffline() {
  const [isOffline,    setIsOffline]    = useState(!navigator.onLine);
  const [queuedCount,  setQueuedCount]  = useState(0);
  const [syncComplete, setSyncComplete] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getQueueCount();
    setQueuedCount(count);
  }, []);

  useEffect(() => {
    function handleOnline()  { setIsOffline(false); refreshCount(); }
    function handleOffline() { setIsOffline(true);  refreshCount(); }

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle sync-complete messages from the service worker
    function handleSwMessage(e) {
      if (e.detail?.type === 'SYNC_COMPLETE') {
        refreshCount();
        setSyncComplete(true);
        setTimeout(() => setSyncComplete(false), 3000);
      }
    }

    window.addEventListener('sw-message', handleSwMessage);

    // Initial count
    refreshCount();

    return () => {
      window.removeEventListener('online',     handleOnline);
      window.removeEventListener('offline',    handleOffline);
      window.removeEventListener('sw-message', handleSwMessage);
    };
  }, [refreshCount]);

  return { isOffline, queuedCount, syncComplete };
}
