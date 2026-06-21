/**
 * DashboardLayout.jsx  (Phase 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 3:
 *   + <ThemeToggle> added between user info and sign-out button in sidebar footer
 */

import { useState }          from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth }            from '../../context/AuthContext';
import ThemeToggle            from '../ThemeToggle/ThemeToggle';
import styles                 from './DashboardLayout.module.css';

const NAV_ITEMS = [
  { to: '/dashboard',           icon: '◈', label: 'My Notes',  end: true },
  { to: '/dashboard/explore',   icon: '◎', label: 'Explore'              },
  { to: '/dashboard/analytics', icon: '◉', label: 'Analytics'            },
  { to: '/dashboard/settings',  icon: '⊙', label: 'Settings'             },
];

export default function DashboardLayout() {
  const { user, logout }    = useAuth();
  const navigate            = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarTop}>
          <Link to="/" className={styles.logo}>Notely</Link>
          <button
            className={styles.closeMobile}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user?.avatar
                ? <img src={user.avatar} alt={user.username} />
                : <span>{user?.username?.[0]?.toUpperCase()}</span>
              }
            </div>
            <div className={styles.userMeta}>
              {user?.username && <span className={styles.username}>{user.username}</span>}
              <span className={styles.email}>{user?.email}</span>
            </div>
          </div>

          {/* Phase 4: theme toggle sits between user info and logout */}
          <div className={styles.footerActions}>
            <ThemeToggle />
            <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <Link to="/" className={styles.logoMobile}>Notely</Link>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
