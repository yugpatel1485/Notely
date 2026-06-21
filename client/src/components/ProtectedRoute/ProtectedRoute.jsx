import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps routes that require authentication.
 * Redirects to /login with the intended destination stored in state.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loader" aria-label="Loading session…">
        <span className="auth-loader__dot" />
        <span className="auth-loader__dot" />
        <span className="auth-loader__dot" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
