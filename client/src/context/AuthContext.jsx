import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import authService from '../services/authService';
import tokenStorage from '../utils/tokenStorage';

// ── State shape ───────────────────────────────────────────────────────────────
const initialState = {
  user:        null,
  isLoading:   true,    // true while we validate stored token on mount
  isAuthenticated: false,
  error:       null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload, error: null };
    case 'AUTH_FAILURE':
      return { ...state, isLoading: false, isAuthenticated: false, user: null, error: action.payload };
    case 'AUTH_LOGOUT':
      return { ...initialState, isLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Persist tokens via the shared sessionStorage-backed helper (per-tab session)
  const persistTokens = useCallback((accessToken, refreshToken) => {
    tokenStorage.setTokens(accessToken, refreshToken);
  }, []);

  const clearTokens = useCallback(() => {
    tokenStorage.clearTokens();
  }, []);

  // On mount — try to restore session from stored token
  useEffect(() => {
    async function restoreSession() {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        dispatch({ type: 'AUTH_FAILURE', payload: null });
        return;
      }
      try {
        const user = await authService.getProfile();
        dispatch({ type: 'AUTH_SUCCESS', payload: user });
      } catch {
        clearTokens();
        dispatch({ type: 'AUTH_FAILURE', payload: null });
      }
    }
    restoreSession();
  }, [clearTokens]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const register = useCallback(async (formData) => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const { user, accessToken, refreshToken } = await authService.register(formData);
      persistTokens(accessToken, refreshToken);
      dispatch({ type: 'AUTH_SUCCESS', payload: user });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      return { success: false, error: message };
    }
  }, [persistTokens]);

  const login = useCallback(async (credentials) => {
    dispatch({ type: 'AUTH_LOADING' });
    try {
      const { user, accessToken, refreshToken } = await authService.login(credentials);
      persistTokens(accessToken, refreshToken);
      dispatch({ type: 'AUTH_SUCCESS', payload: user });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      return { success: false, error: message };
    }
  }, [persistTokens]);

  const logout = useCallback(() => {
    clearTokens();
    dispatch({ type: 'AUTH_LOGOUT' });
  }, [clearTokens]);

  const updateUser = useCallback((updatedUser) => {
    dispatch({ type: 'AUTH_SUCCESS', payload: updatedUser });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, register, login, logout, updateUser, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Custom hook — throws if used outside AuthProvider */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
