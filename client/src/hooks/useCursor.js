import { useEffect } from 'react';

const HOVER_SELECTOR = 'a, button, .feature-item, .note-card';

/**
 * Tracks the mouse position and moves the `#cursor` element to follow it.
 * Adds the `expand` class when hovering over interactive elements.
 */
export default function useCursor() {
  useEffect(() => {
    const cursor = document.getElementById('cursor');
    if (!cursor) return;

    const onMove = (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top  = `${e.clientY}px`;
    };

    const onEnter = () => cursor.classList.add('expand');
    const onLeave = () => cursor.classList.remove('expand');

    document.addEventListener('mousemove', onMove);

    // Delegate hover detection so dynamically rendered elements are covered.
    document.addEventListener('mouseover', (e) => {
      if (e.target.matches(HOVER_SELECTOR)) onEnter();
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.matches(HOVER_SELECTOR)) onLeave();
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
    };
  }, []);
}
