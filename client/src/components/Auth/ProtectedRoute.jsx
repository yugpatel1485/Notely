import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps a route so only authenticated users can access it.
 * Unauthenticated users are redirected to /login with a `from` state
 * so they can be sent back after logging in.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-splash">
        <span className="auth-splash__logo">Notely</span>
        <div className="auth-splash__spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
