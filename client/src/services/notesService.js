/**
 * notesService.js  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * New in Phase 3:
 *   - uploadAttachment / deleteAttachment
 *   - listVersions / getVersion / restoreVersion / deleteVersion / createSnapshot
 *   - exportNote
 *   - recordView
 */

import api from './api';

const notesService = {
  // ── Phase 1 / 2 — unchanged ───────────────────────────────────────────────

  async getNotes(params = {}) {
    const res = await api.get('/notes', { params });
    return res.data.data;
  },
  async getNoteById(id) {
    const res = await api.get(`/notes/${id}`);
    return res.data.data.note;
  },
  async createNote(data) {
    const res = await api.post('/notes', data);
    return res.data.data.note;
  },
  async updateNote(id, data) {
    const res = await api.put(`/notes/${id}`, data);
    return res.data.data.note;
  },
  async deleteNote(id) {
    await api.delete(`/notes/${id}`);
  },
  async manageShareToken(id, action) {
    const res = await api.post(`/notes/${id}/share`, { action });
    return res.data.data.note;
  },
  async getNoteByShareToken(token) {
    const res = await api.get(`/notes/shared/${token}`);
    return res.data.data.note;
  },
  async getPublicNotes(params = {}) {
    const res = await api.get('/notes/public', { params });
    return res.data.data;
  },
  async shareWithUser(noteId, email, permission = 'read') {
    const res = await api.post(`/notes/${noteId}/share-with`, { email, permission });
    return res.data;
  },
  async revokeAccess(noteId, userId) {
    const res = await api.delete(`/notes/${noteId}/share-with/${userId}`);
    return res.data;
  },
  async getCollaborators(noteId) {
    const res = await api.get(`/notes/${noteId}/share-with`);
    return res.data.data.collaborators;
  },

  // ── Phase 3: Attachments ──────────────────────────────────────────────────

  /**
   * Upload a file attachment to a note.
   * @param {string}   noteId
   * @param {File}     file         Browser File object
   * @param {Function} [onProgress] (percent: number) => void
   */
  async uploadAttachment(noteId, file, onProgress) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/notes/${noteId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
        : undefined,
    });
    return res.data.data.attachment;
  },

  /** Delete an attachment from a note. */
  async deleteAttachment(noteId, attId) {
    await api.delete(`/notes/${noteId}/attachments/${attId}`);
  },

  // ── Phase 3: Version history ──────────────────────────────────────────────

  /** List all versions for a note (newest first, no content). */
  async listVersions(noteId) {
    const res = await api.get(`/notes/${noteId}/versions`);
    return res.data.data.versions;
  },

  /** Manually snapshot the current state. */
  async createSnapshot(noteId) {
    const res = await api.post(`/notes/${noteId}/versions`);
    return res.data.data.version;
  },

  /** Fetch the full content of a specific version. */
  async getVersion(noteId, verId) {
    const res = await api.get(`/notes/${noteId}/versions/${verId}`);
    return res.data.data.version;
  },

  /** Restore a note to a previous version. */
  async restoreVersion(noteId, verId) {
    const res = await api.post(`/notes/${noteId}/versions/${verId}/restore`);
    return res.data.data.note;
  },

  /** Delete a single version entry. */
  async deleteVersion(noteId, verId) {
    await api.delete(`/notes/${noteId}/versions/${verId}`);
  },

  // ── Phase 3: Export ───────────────────────────────────────────────────────

  /**
   * Trigger a file download for a note export.
   * Uses a hidden <a> tag so the browser handles the file save dialog.
   * @param {string} noteId
   * @param {'pdf'|'docx'} format
   */
  async exportNote(noteId, format = 'pdf') {
    const token = localStorage.getItem('accessToken');
    const url   = `${api.defaults.baseURL}/notes/${noteId}/export?format=${format}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);

    const blob     = await res.blob();
    const blobUrl  = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const filename = res.headers.get('content-disposition')
      ?.match(/filename="?([^"]+)"?/)?.[1] ?? `note.${format}`;

    a.href     = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  },

  // ── Phase 3: Analytics ────────────────────────────────────────────────────

  /** Record a view for a public/shared note (fire-and-forget). */
  async recordView(noteId) {
    try {
      await api.post(`/analytics/notes/${noteId}/view`);
    } catch {
      // Non-fatal
    }
  },

  /** Fetch the analytics dashboard data for the current user. */
  async getAnalyticsDashboard() {
    const res = await api.get('/analytics/dashboard');
    return res.data.data;
  },
};

export default notesService;
