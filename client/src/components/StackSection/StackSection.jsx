import { STACK_ITEMS } from '../../data/content';
import useReveal from '../../hooks/useReveal';
import styles from './StackSection.module.css';

export default function StackSection() {
  useReveal();

  return (
    <section className={styles.section} id="stack">
      <div data-reveal className={styles.intro}>
        <p className={styles.label}>The tech</p>
        <h2 className={styles.title}>
          A stack that<br /><em>earns</em> its place.
        </h2>
        <p className={styles.body}>
          Every tool chosen for a reason — from MongoDB&apos;s flexible documents
          to React&apos;s reactive UI. No bloat, just what the project needs.
        </p>
      </div>

      <ul data-reveal className={styles.list}>
        {STACK_ITEMS.map((s) => (
          <li key={s.label} className={styles.item}>
            <span className={[styles.badge, s.badge === 'alt' ? styles.badgeAlt : ''].join(' ')}>
              {s.label}
            </span>
            <span className={styles.name}>{s.name}</span>
            <span className={styles.role}>{s.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
