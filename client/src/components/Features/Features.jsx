import { FEATURES } from '../../data/content';
import useReveal from '../../hooks/useReveal';
import styles from './Features.module.css';

export default function Features() {
  useReveal();

  return (
    <section className={styles.section} id="features">
      <div data-reveal className={styles.header}>
        <p className={styles.label}>What it does</p>
        <h2 className={styles.title}>
          Built for how<br /><em>you actually</em> think.
        </h2>
      </div>

      <div data-reveal className={styles.grid}>
        {FEATURES.map((f) => (
          <div key={f.num} className={styles.item}>
            <span className={styles.num}>{f.num}</span>
            <span className={styles.icon}>{f.icon}</span>
            <h3 className={styles.name}>{f.name}</h3>
            <p  className={styles.desc}>{f.desc}</p>
            <span className={styles.corner}>{f.corner}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
