/**
 * Screenshot lightbox: a larger pop-up card for the project carousels.
 * Prev/next buttons, arrow keys and swipe (touch or mouse drag) all navigate.
 */
export interface LightboxItem {
  src: string; // card thumbnail (used as a fallback)
  full: string; // large version shown in the pop-up
  alt: string;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const CHEVRON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEVRON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let root: HTMLElement | null = null;
let items: LightboxItem[] = [];
let index = 0;
let trigger: HTMLElement | null = null;
let loadToken = 0;
let closeTimer = 0;

let titleEl: HTMLElement;
let countEl: HTMLElement;
let imgEl: HTMLImageElement;
let captionEl: HTMLElement;
let dotsEl: HTMLElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;
let stage: HTMLElement;

function build() {
  root = document.createElement('div');
  root.className = 'lightbox';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Project screenshots');
  root.innerHTML = `
    <div class="lightbox-backdrop" data-lb-close></div>
    <div class="lightbox-card">
      <header class="lightbox-head">
        <h3 class="lightbox-title"></h3>
        <span class="lightbox-count" aria-live="polite"></span>
        <button class="lightbox-close" type="button" data-lb-close aria-label="Close preview">${CLOSE}</button>
      </header>
      <div class="lightbox-stage">
        <img class="lightbox-img" alt="" draggable="false" />
        <button class="lightbox-btn lightbox-prev" type="button" aria-label="Previous image">${CHEVRON_L}</button>
        <button class="lightbox-btn lightbox-next" type="button" aria-label="Next image">${CHEVRON_R}</button>
      </div>
      <p class="lightbox-caption"></p>
      <div class="lightbox-dots"></div>
    </div>`;
  document.body.append(root);

  titleEl = root.querySelector('.lightbox-title')!;
  countEl = root.querySelector('.lightbox-count')!;
  imgEl = root.querySelector('.lightbox-img')!;
  captionEl = root.querySelector('.lightbox-caption')!;
  dotsEl = root.querySelector('.lightbox-dots')!;
  prevBtn = root.querySelector('.lightbox-prev')!;
  nextBtn = root.querySelector('.lightbox-next')!;
  stage = root.querySelector('.lightbox-stage')!;

  root.querySelectorAll('[data-lb-close]').forEach((el) => el.addEventListener('click', close));
  prevBtn.addEventListener('click', () => go(index - 1, -1));
  nextBtn.addEventListener('click', () => go(index + 1, 1));
  root.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  imgEl.addEventListener('error', () => {
    const fallback = items[index]?.src;
    if (fallback && imgEl.getAttribute('src') !== fallback) imgEl.src = fallback;
  });

  // swipe / drag to navigate
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dragging = false;
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    dx = 0;
    stage.setPointerCapture(e.pointerId);
    imgEl.style.transition = 'none';
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && items.length > 1) imgEl.style.transform = `translateX(${dx}px)`;
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.clientY - sy;
    imgEl.style.transition = 'transform .25s cubic-bezier(.16,.84,.44,1)';
    imgEl.style.transform = '';
    if (!cancelled && items.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };
  stage.addEventListener('pointerup', (e) => end(e, false));
  stage.addEventListener('pointercancel', (e) => end(e, true));

  document.addEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent) {
  if (!root || root.hidden) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  } else if (e.key === 'ArrowLeft' && items.length > 1) {
    e.preventDefault();
    go(index - 1, -1);
  } else if (e.key === 'ArrowRight' && items.length > 1) {
    e.preventDefault();
    go(index + 1, 1);
  } else if (e.key === 'Tab') {
    const focusables = Array.from(root.querySelectorAll<HTMLElement>('button')).filter((b) => b.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function go(n: number, dir: number) {
  index = (n + items.length) % items.length;
  render(dir);
}

function render(dir: number) {
  const item = items[index];
  countEl.textContent = `${index + 1} / ${items.length}`;
  captionEl.textContent = item.alt;
  dotsEl.querySelectorAll('button').forEach((d, k) => d.setAttribute('aria-current', String(k === index)));

  const token = ++loadToken;
  const pre = new Image();
  pre.src = item.full;
  const show = () => {
    if (token !== loadToken) return;
    imgEl.src = item.full;
    imgEl.alt = item.alt;
    if (!reducedMotion.matches && dir !== 0) {
      imgEl.animate(
        [
          { opacity: 0, transform: `translateX(${dir * 48}px)` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        { duration: 240, easing: 'cubic-bezier(.16,.84,.44,1)' },
      );
    }
  };
  pre.decode().then(show, show);

  // warm the neighbours so next/prev feel instant
  [index + 1, index - 1].forEach((k) => {
    const nb = items[(k + items.length) % items.length];
    if (nb) new Image().src = nb.full;
  });
}

export function openLightbox(title: string, list: LightboxItem[], start: number, from: HTMLElement | null) {
  if (!list.length) return;
  if (!root) build();
  window.clearTimeout(closeTimer);

  items = list;
  index = start;
  trigger = from;
  titleEl.textContent = title;

  const multi = list.length > 1;
  prevBtn.hidden = !multi;
  nextBtn.hidden = !multi;
  countEl.hidden = !multi;
  dotsEl.hidden = !multi;
  dotsEl.replaceChildren(
    ...list.map((_, n) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show image ${n + 1} of ${list.length}`);
      dot.addEventListener('click', () => go(n, n > index ? 1 : -1));
      return dot;
    }),
  );

  root!.hidden = false;
  render(0);
  requestAnimationFrame(() => root!.classList.add('open'));
  root!.querySelector<HTMLElement>('.lightbox-close')!.focus({ preventScroll: true });
}

export function close() {
  if (!root || root.hidden) return;
  root.classList.remove('open');
  loadToken++;
  const done = () => {
    root!.hidden = true;
    imgEl.removeAttribute('src');
    trigger?.focus({ preventScroll: true });
    trigger = null;
  };
  if (reducedMotion.matches) done();
  else closeTimer = window.setTimeout(done, 220);
}
