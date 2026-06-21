import { useEffect } from 'react';

/**
 * Attaches an IntersectionObserver to every element that carries the
 * `data-reveal` attribute.  When an element enters the viewport the
 * observer adds the `visible` class and then stops watching it.
 *
 * Usage
 * -----
 * 1. Call `useReveal()` once at the top of a parent component.
 * 2. Add  `data-reveal`  (and the `reveal` CSS class) to any element
 *    you want to animate in.
 */
export default function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}
