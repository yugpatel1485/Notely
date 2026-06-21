import { Navigate } from 'react-router-dom';
import { useAuth }   from '../../context/AuthContext';

/**
 * Wraps auth pages (login, register) so already-logged-in
 * users are bounced to /dashboard instead.
 */
export default function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
