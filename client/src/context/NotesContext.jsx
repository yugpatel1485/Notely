import { createContext, useContext, useReducer, useCallback } from 'react';
import notesService from '../services/notesService';

// ── State ─────────────────────────────────────────────────────────────────────
const initialState = {
  notes:       [],
  pagination:  null,
  activeNote:  null,
  isLoading:   false,
  isSaving:    false,
  error:       null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function notesReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isSaving: false };

    case 'SET_NOTES':
      return {
        ...state,
        notes:      action.payload.notes,
        pagination: action.payload.pagination,
        isLoading:  false,
        error:      null,
      };

    case 'SET_ACTIVE_NOTE':
      return { ...state, activeNote: action.payload };

    case 'ADD_NOTE':
      return {
        ...state,
        notes:   [action.payload, ...state.notes],
        isSaving: false,
        error:   null,
      };

    case 'UPDATE_NOTE': {
      const updated = state.notes.map((n) =>
        n._id === action.payload._id ? action.payload : n
      );
      return {
        ...state,
        notes:      updated,
        activeNote: state.activeNote?._id === action.payload._id ? action.payload : state.activeNote,
        isSaving:   false,
        error:      null,
      };
    }

    case 'DELETE_NOTE':
      return {
        ...state,
        notes:      state.notes.filter((n) => n._id !== action.payload),
        activeNote: state.activeNote?._id === action.payload ? null : state.activeNote,
        isLoading:  false,
        error:      null,
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const NotesContext = createContext(null);

export function NotesProvider({ children }) {
  const [state, dispatch] = useReducer(notesReducer, initialState);

  const fetchNotes = useCallback(async (params = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await notesService.getNotes(params);
      dispatch({ type: 'SET_NOTES', payload: data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.message || 'Failed to fetch notes' });
    }
  }, []);

  const createNote = useCallback(async (data) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const note = await notesService.createNote(data);
      dispatch({ type: 'ADD_NOTE', payload: note });
      return { success: true, note };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create note';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    }
  }, []);

  const updateNote = useCallback(async (id, data) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const note = await notesService.updateNote(id, data);
      dispatch({ type: 'UPDATE_NOTE', payload: note });
      return { success: true, note };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update note';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    }
  }, []);

  const deleteNote = useCallback(async (id) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await notesService.deleteNote(id);
      dispatch({ type: 'DELETE_NOTE', payload: id });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete note';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    }
  }, []);

  const setActiveNote = useCallback((note) => {
    dispatch({ type: 'SET_ACTIVE_NOTE', payload: note });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <NotesContext.Provider value={{
      ...state,
      fetchNotes,
      createNote,
      updateNote,
      deleteNote,
      setActiveNote,
      clearError,
    }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error('useNotes must be used within a NotesProvider');
  return context;
}
