import useCursor from '../../hooks/useCursor';
import styles from './Cursor.module.css';

export default function Cursor() {
  useCursor();
  return <div id="cursor" className={styles.cursor} />;
}
