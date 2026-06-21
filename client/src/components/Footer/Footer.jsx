import styles from './Footer.module.css';

const LINKS = [
  { href: '#', label: 'GitHub' },
  { href: '#', label: 'Docs'   },
  { href: '#', label: 'API'    },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.logo}>Notely</span>
      <small className={styles.copy}>© 2025 — MERN Stack Project</small>
      <ul className={styles.links}>
        {LINKS.map(({ href, label }) => (
          <li key={label}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
