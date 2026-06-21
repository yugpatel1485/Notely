import { Link, useNavigate } from 'react-router-dom';
import { useAuth }           from '../../context/AuthContext';
import styles                from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/register',    label: 'Get Started' },
];

export default function Navbar() {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.logo}>Notely</Link>

      <ul className={styles.links}>
        {NAV_LINKS.map(({ href, label }) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>

      <div className={styles.authLinks}>
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className={styles.btnDash}>
              Dashboard →
            </Link>
            <button className={styles.btnGhost} onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className={styles.btnGhost}>Sign in</Link>
            <Link to="/register" className={styles.btnPrimary}>Get started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
