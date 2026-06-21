import api from './api';

const noteService = {
  /** Get paginated notes for the current user */
  getNotes: async (params = {}) => {
    const { data } = await api.get('/notes', { params });
    return data;
  },

  /** Get a single note by ID */
  getNoteById: async (id) => {
    const { data } = await api.get(`/notes/${id}`);
    return data;
  },

  /** Get a publicly shared note by slug (no auth needed) */
  getNoteBySlug: async (slug) => {
    const { data } = await api.get(`/notes/shared/${slug}`);
    return data;
  },

  /** Create a new note */
  createNote: async (noteData) => {
    const { data } = await api.post('/notes', noteData);
    return data;
  },

  /** Update an existing note */
  updateNote: async (id, updates) => {
    const { data } = await api.put(`/notes/${id}`, updates);
    return data;
  },

  /** Delete a note */
  deleteNote: async (id) => {
    const { data } = await api.delete(`/notes/${id}`);
    return data;
  },

  /** Generate a public share link */
  generateShareLink: async (id) => {
    const { data } = await api.post(`/notes/${id}/share`);
    return data;
  },

  /** Share a note with a user by email */
  shareWithUser: async (id, email) => {
    const { data } = await api.post(`/notes/${id}/share-with`, { email });
    return data;
  },
};

export default noteService;
