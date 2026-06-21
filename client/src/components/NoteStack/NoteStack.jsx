import { useRef, useEffect } from 'react';
import styles from './NoteStack.module.css';

/* ─── Static data ───────────────────────────────────────────────── */

const NOTES = [
  {
    tag: 'Research', tagColor: '#c8502a', tagBg: '#fce8e2',
    tint: { light: '#ffffff',  dark: '#ffffff' },
    title: 'MERN Stack Architecture Notes',
    body: 'MongoDB + Express + React + Node. Full-stack JavaScript. REST APIs connected to a cloud database...',
    status: 'Private', dotColor: '#c8502a', date: 'Today',
  },
  {
    tag: 'Ideas', tagColor: '#c8502a', tagBg: '#fce8e2',
    tint: { light: '#f0ede3',  dark: '#f0ede3' },
    title: 'Feature brainstorm — v2',
    body: 'Real-time collab via Socket.io, AI summaries, version history, offline support...',
    status: 'Shared', dotColor: '#c8502a', date: 'Yesterday',
  },
  {
    tag: 'Team', tagColor: '#3a5c4e', tagBg: '#ddeee7',
    tint: { light: '#e8f0ec',  dark: '#e8f0ec' },
    title: 'API Endpoints Reference',
    body: 'GET /api/notes · POST /api/notes · PUT /api/notes/:id · DELETE /api/notes/:id',
    status: 'Public', dotColor: '#3a5c4e', date: '3 days ago',
  },
];

/*
 * Three named slot positions. Every card is always at exactly one slot.
 * zIndex is written separately so CSS transitions don't fight it.
 */
const SLOTS = [
  { top: 150, left: 50,  rotate: -1,   opacity: 1, zIndex: 3 }, // 0 = front
  { top: 70,  left: 10,  rotate: 1.5,  opacity: 1, zIndex: 2 }, // 1 = mid
  { top: 0,   left: 40,  rotate: -3,   opacity: 1, zIndex: 1 }, // 2 = back
];

/*
 * Transition per destination slot index.
 * Front gets a spring overshoot. Mid follows with a tiny delay.
 * Back yields last with an ease-in curve.
 *
 * We only transition top/left/transform/opacity — NOT z-index,
 * which must flip instantly so layering is always correct.
 */
const TRANSITIONS = [
  /* → front (0) */ 'top .58s cubic-bezier(.34,1.56,.64,1), left .58s cubic-bezier(.34,1.56,.64,1), transform .58s cubic-bezier(.34,1.56,.64,1), opacity .35s ease',
  /* → mid   (1) */ 'top .52s 40ms cubic-bezier(.22,1,.36,1), left .52s 40ms cubic-bezier(.22,1,.36,1), transform .52s 40ms cubic-bezier(.22,1,.36,1), opacity .4s 40ms ease',
  /* → back  (2) */ 'top .48s 80ms cubic-bezier(.55,0,1,.45), left .48s 80ms cubic-bezier(.55,0,1,.45), transform .48s 80ms cubic-bezier(.55,0,1,.45), opacity .4s 60ms ease',
];

/* ─── DOM helpers ───────────────────────────────────────────────── */

function buildCard(note) {
  const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
  const tint     = isDark ? note.tint.dark : note.tint.light;
  const titleClr = '#1a1a1a';
  const bodyClr  = '#888888';
  const el = document.createElement('article');
  el.className = styles.card;
  el.style.cssText = `background:${tint};position:absolute;`;
  el.innerHTML = `
    <span class="${styles.tag}" style="color:${note.tagColor};background:${note.tagBg}">${note.tag}</span>
    <h3 class="${styles.title}" style="color:${titleClr}">${note.title}</h3>
    <p class="${styles.body}" style="color:${bodyClr}">${note.body}</p>
    <hr class="${styles.divider}">
    <footer class="${styles.meta}" style="color:${bodyClr}">
      <span><span class="${styles.dot}" style="background:${note.dotColor}"></span>${note.status}</span>
      <span>${note.date}</span>
    </footer>`;
  return el;
}

/*
 * The only reliable way to guarantee the browser has committed a style
 * before you change it again is to force a synchronous layout reflow.
 * Reading any layout property (e.g. offsetTop) does exactly that.
 * This is the standard FLIP / Web Animations trick.
 */
function forceReflow(el) {
  void el.offsetTop; // eslint-disable-line no-unused-expressions
}

function snapToSlot(el, slotIdx) {
  const s = SLOTS[slotIdx];
  el.style.transition = 'none';
  el.style.top        = s.top     + 'px';
  el.style.left       = s.left    + 'px';
  el.style.transform  = `rotate(${s.rotate}deg)`;
  el.style.opacity    = s.opacity;
  el.style.zIndex     = s.zIndex;
}

function animateToSlot(el, slotIdx) {
  const s = SLOTS[slotIdx];
  el.style.transition = TRANSITIONS[slotIdx];
  el.style.zIndex     = s.zIndex;   // snap z instantly (not transitioned)
  el.style.top        = s.top     + 'px';
  el.style.left       = s.left    + 'px';
  el.style.transform  = `rotate(${s.rotate}deg)`;
  el.style.opacity    = s.opacity;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function NoteStack() {
  const wrapRef  = useRef(null);

  useEffect(() => {
    const wrap  = wrapRef.current;
    const cards = NOTES.map(buildCard);

    /*
     * order[slotIdx] = card index currently occupying that slot.
     * Starts as [0, 1, 2]: card-0 → front, card-1 → mid, card-2 → back.
     */
    let order = [0, 1, 2];
    let busy  = false;

    /* Place all cards at their initial slots instantly, then mount */
    cards.forEach((card, cardIdx) => {
      const slotIdx = order.indexOf(cardIdx);
      snapToSlot(card, slotIdx);
      wrap.appendChild(card);
    });

    /* Re-render cards if the user switches theme while on the page */
    const themeObserver = new MutationObserver(() => {
      // Tints are always light regardless of theme — nothing to update
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function handleClick(e) {
      const card = e.target.closest('article');
      if (!card || busy) return;

      /* Find which slot was clicked */
      const clickedSlot = cards.indexOf(card) === -1
        ? -1
        : order.indexOf(cards.indexOf(card));

      /* Remap: clickedSlot is the slot index of the clicked card */
      const cardIdx    = cards.indexOf(card);
      const slotOfCard = order.indexOf(cardIdx);

      if (slotOfCard === 0 || slotOfCard === -1) return;

      busy = true;

      /*
       * Build next order by rotating left by slotOfCard positions:
       *   click slot 1: [1,2,0]  →  card at mid → front, back → mid, front → back
       *   click slot 2: [2,0,1]  →  card at back → front, front → mid, mid → back
       */
      const next = [...order];
      for (let i = 0; i < slotOfCard; i++) next.push(next.shift());

      /*
       * SNAP all cards to their CURRENT positions with transition:none.
       * Then force a reflow so the browser commits those positions.
       * Then animate all cards to their NEW positions.
       *
       * This is the only race-condition-free approach:
       *   1. Snap (transition:none)  →  browser has a hard "from"
       *   2. forceReflow             →  layout is flushed synchronously
       *   3. Animate to new slots    →  browser interpolates all three
       */
      cards.forEach((c, ci) => snapToSlot(c, order.indexOf(ci)));
      forceReflow(wrap);
      cards.forEach((c, ci) => animateToSlot(c, next.indexOf(ci)));

      order = next;
      setTimeout(() => { busy = false; }, 700);
    }

    wrap.addEventListener('click', handleClick);
    return () => {
      wrap.removeEventListener('click', handleClick);
      themeObserver.disconnect();
      cards.forEach(c => c.remove());
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.stack} aria-label="Note stack — click to shuffle">
      <p className={styles.hint} aria-hidden="true">click a card to shuffle</p>
    </div>
  );
}
