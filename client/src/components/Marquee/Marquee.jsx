import { MARQUEE_ITEMS } from '../../data/content';
import styles from './Marquee.module.css';

// Duplicate items so the seamless loop never shows a gap
const ITEMS = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

export default function Marquee() {
  return (
    <div className={styles.wrapper} aria-hidden="true">
      <div className={styles.track}>
        {ITEMS.map((item, i) => (
          <span className={styles.item} key={i}>
            {item} <span className={styles.sep}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
