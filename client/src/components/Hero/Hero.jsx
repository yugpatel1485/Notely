import NoteStack from '../NoteStack/NoteStack';
import styles from './Hero.module.css';

export default function Hero() {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.hero}>
      {/* ── Left column ── */}
      <div className={styles.left}>
        <p className={styles.eyebrow}>Note Sharing Platform</p>

        <h1 className={styles.heading}>
          Your thoughts,<br />
          <em>perfectly</em><br />
          organized.
        </h1>

        <p className={styles.desc}>
          Create, manage, and securely share notes — with real-time
          collaboration, JWT-powered auth, and a UI that doesn&apos;t get in
          your way.
        </p>

        <div className={styles.ctaGroup}>
          <a href="/register" className={styles.btnPrimary}>
            <span>Start Writing →</span>
          </a>
          <button className={styles.btnGhost} onClick={scrollToFeatures}>
            See features <span className={styles.arrow}>→</span>
          </button>
        </div>
      </div>

      {/* ── Right column ── */}
      <div className={styles.right}>
        <span className={styles.bgCircle}  aria-hidden="true" />
        <span className={styles.bgCircle2} aria-hidden="true" />
        <NoteStack />
      </div>
    </section>
  );
}
