/**
 * useAiSummary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches an AI-generated summary for a given note.
 */

import { useState, useCallback } from 'react';
import api from '../services/api';

export default function useAiSummary() {
  const [summary,     setSummary]     = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');

  const generate = useCallback(async (noteId) => {
    setIsLoading(true);
    setSummary('');
    setError('');
    try {
      const res = await api.post('/ai/summarise', { noteId });
      setSummary(res.data.data.summary);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSummary('');
    setError('');
  }, []);

  return { summary, isLoading, error, generate, clear };
}
