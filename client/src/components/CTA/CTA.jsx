import styles from './CTA.module.css';

export default function CTA() {
  return (
    <section className={styles.section} id="start">
      <p className={styles.bgText} aria-hidden="true">NOTELY</p>

      <div className={styles.inner}>
        <p className={styles.label}>Ready?</p>
        <h2 className={styles.heading}>
          Stop losing<br /><em>great ideas.</em>
        </h2>
        <p className={styles.body}>
          Sign up free, start writing in seconds. Your notes live in the
          cloud, safe and always accessible.
        </p>
        <a href="/register" className={styles.btn}>
          <span>Create Free Account →</span>
        </a>
      </div>
    </section>
  );
}
