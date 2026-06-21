/**
 * ThemeToggle.jsx  (Phase 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sun / moon toggle button. Place it anywhere — currently used in the
 * DashboardLayout sidebar footer.
 */

import { useTheme } from '../../context/ThemeContext';
import styles        from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className={`${styles.icon} ${styles.sun}  ${!isDark ? styles.active : ''}`}>☀</span>
      <span className={styles.track}>
        <span className={`${styles.thumb} ${isDark ? styles.thumbDark : ''}`} />
      </span>
      <span className={`${styles.icon} ${styles.moon} ${isDark  ? styles.active : ''}`}>☽</span>
    </button>
  );
}
