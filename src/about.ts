import { initStackDecks } from './stack';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Counts the About-section stats up from 0 the first time they scroll into view. */
function initCounters() {
  const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (!counters.length || prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    return; // the final numbers are already in the HTML
  }

  const format = (n: number) => Math.round(n).toLocaleString('en-US');

  const animate = (el: HTMLElement) => {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix ?? '';
    const duration = 1100;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = format(target * eased) + (t === 1 ? suffix : '');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        animate(entry.target as HTMLElement);
      });
    },
    { threshold: 0.6 },
  );

  counters.forEach((el) => {
    el.textContent = '0';
    observer.observe(el);
  });
}

/** Splits About headings into masked words so they can rise in one by one (CSS does the motion). */
function splitHeadings() {
  document.querySelectorAll<HTMLElement>('.about-head h3, .about-banner h3').forEach((h) => {
    if (h.dataset.split) return;
    const text = (h.textContent ?? '').trim();
    if (!text) return;
    h.dataset.split = 'true';
    h.setAttribute('aria-label', text);
    h.replaceChildren();
    text.split(/\s+/).forEach((word, i, all) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'w-in';
      inner.style.setProperty('--i', String(i));
      inner.textContent = word;
      outer.append(inner);
      h.append(outer);
      if (i < all.length - 1) h.append(' ');
    });
  });
}

/** Cards get a soft lime spotlight that follows the pointer (set as CSS variables). */
function initSpotlight() {
  const section = document.querySelector<HTMLElement>('.about-section');
  if (!section || !window.matchMedia('(pointer: fine)').matches) return;

  section.addEventListener('pointermove', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('.about-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - r.left}px`);
    card.style.setProperty('--my', `${event.clientY - r.top}px`);
  });
}

/** The dashed timeline line draws itself downward when it scrolls into view. */
function initTimeline() {
  const timelines = Array.from(document.querySelectorAll<HTMLElement>('.timeline'));
  if (!timelines.length) return;
  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    timelines.forEach((t) => t.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );
  timelines.forEach((t) => io.observe(t));
}

export function initAbout() {
  splitHeadings();
  initCounters();
  initSpotlight();
  initTimeline();
  initStackDecks();
}
