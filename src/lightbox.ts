/**
 * Screenshot viewer: a deck of large cards that uses the same "push the front card back"
 * animation as the project cards. Drag/swipe the front card, use the arrow buttons or
 * keys, click a card peeking out behind, or tap a dot to bring another screenshot forward.
 */
import gsap from 'gsap';

export interface LightboxItem {
  src: string; // card thumbnail (used as a fallback)
  full: string; // large version shown in the viewer
  alt: string;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const CHEVRON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEVRON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let root: HTMLElement | null = null;
let deck: HTMLElement;
let titleEl: HTMLElement;
let countEl: HTMLElement;
let dotsEl: HTMLElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;

let items: LightboxItem[] = [];
let cards: HTMLElement[] = [];
let order: number[] = []; // order[0] is the card on top, order[1] sits right behind it, ...
let busy = false;
let trigger: HTMLElement | null = null;
let closeTimer = 0;

const DIM = [0, 0.45, 0.7];

function build() {
  root = document.createElement('div');
  root.className = 'lightbox';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Project screenshots');
  root.innerHTML = `
    <div class="lightbox-backdrop" data-lb-close></div>
    <div class="lightbox-wrap">
      <header class="lightbox-head">
        <h3 class="lightbox-title"></h3>
        <span class="lightbox-count" aria-live="polite"></span>
        <button class="lightbox-close" type="button" data-lb-close aria-label="Close preview">${CLOSE}</button>
      </header>
      <div class="lightbox-deck">
        <button class="lightbox-btn lightbox-prev" type="button" aria-label="Previous image">${CHEVRON_L}</button>
        <button class="lightbox-btn lightbox-next" type="button" aria-label="Next image">${CHEVRON_R}</button>
      </div>
      <div class="lightbox-dots"></div>
    </div>`;
  document.body.append(root);

  deck = root.querySelector('.lightbox-deck')!;
  titleEl = root.querySelector('.lightbox-title')!;
  countEl = root.querySelector('.lightbox-count')!;
  dotsEl = root.querySelector('.lightbox-dots')!;
  prevBtn = root.querySelector('.lightbox-prev')!;
  nextBtn = root.querySelector('.lightbox-next')!;

  root.querySelectorAll('[data-lb-close]').forEach((el) => el.addEventListener('click', close));
  // clicking the empty space around the deck closes the viewer
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  root.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  // clicking a card peeking out behind the front one brings it forward
  deck.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.lb-card');
    if (card && card.dataset.pos === 'back') goTo(cards.indexOf(card));
  });

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => {
    if (root && !root.hidden && !busy) applyRest();
  });
}

const peek = () => parseFloat(getComputedStyle(deck).getPropertyValue('--peek')) || 22;

/** x / y / dim of a card sitting `depth` places behind the front one. */
function pose(depth: number) {
  const k = Math.min(depth, 2);
  const p = peek();
  return { x: k * p, y: -k * p, rotateX: 0, rotateZ: 0, '--dim': DIM[k] };
}
const zFor = (depth: number) => cards.length - depth;

function ensureLoaded(i: number) {
  const img = cards[i]?.querySelector('img');
  if (img && !img.getAttribute('src')) img.src = items[i].full;
}

function applyRest() {
  order.forEach((ci, depth) => {
    const card = cards[ci];
    const isFront = depth === 0;
    card.dataset.pos = isFront ? 'front' : 'back';
    card.setAttribute('aria-hidden', String(!isFront));
    gsap.set(card, { ...pose(depth), zIndex: zFor(depth), transformPerspective: 1400 });
    if (depth <= 2) ensureLoaded(ci);
  });
  ensureLoaded(order[order.length - 1]); // so "previous" is ready too

  const front = order[0];
  countEl.textContent = `${front + 1} / ${cards.length}`;
  dotsEl.querySelectorAll('button').forEach((d, k) => d.setAttribute('aria-current', String(k === front)));
}

function step(dir: 1 | -1) {
  goTo(dir === 1 ? order[1] : order[order.length - 1]);
}

function goTo(target: number) {
  if (busy || cards.length < 2 || target === order[0]) return;
  const at = order.indexOf(target);
  const next = [...order.slice(at), ...order.slice(0, at)]; // rotate so `target` is on top
  const outIdx = order[0];
  const out = cards[outIdx];
  const inn = cards[target];

  busy = true;
  ensureLoaded(target);
  const finish = () => {
    order = next;
    applyRest();
    deck.classList.remove('swapping');
    busy = false;
  };
  if (reducedMotion.matches) {
    finish();
    return;
  }
  deck.classList.add('swapping');

  const p = peek();
  const lift = out.offsetHeight * 0.4;
  const tl = gsap.timeline({ onComplete: finish });
  // One continuous motion (same as the project cards): the front card lifts and tips back,
  // the order flips at the top of the roll, then it drops in behind while the next one rises.
  tl.to(out, { x: p * 0.5, y: -lift, rotateX: 26, rotateZ: 0, duration: 0.36, ease: 'power2.out' }, 0);
  tl.to(inn, { x: p * 0.4, y: -p * 0.4, '--dim': 0.25, duration: 0.36, ease: 'power1.out' }, 0);
  next.forEach((ci, depth) => {
    tl.set(cards[ci], { zIndex: zFor(depth) }, 0.32);
    if (ci === target) {
      tl.to(cards[ci], { ...pose(0), duration: 0.5, ease: 'back.out(1.5)' }, 0.32);
    } else if (ci === outIdx) {
      tl.to(cards[ci], { ...pose(depth), duration: 0.5, ease: 'power3.inOut' }, 0.32);
    } else {
      tl.to(cards[ci], { ...pose(depth), duration: 0.5, ease: 'power2.inOut' }, 0.32);
    }
  });
}

function attachDrag(card: HTMLElement) {
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dy = 0;
  let axis: '' | 'x' | 'y' = '';
  let tracking = false;
  let pid = -1;

  card.addEventListener('pointerdown', (e) => {
    if (busy || card.dataset.pos !== 'front') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    tracking = true;
    sx = e.clientX;
    sy = e.clientY;
    dx = dy = 0;
    axis = '';
    pid = e.pointerId;
  });
  card.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    dx = e.clientX - sx;
    dy = e.clientY - sy;
    if (!axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      card.classList.add('dragging');
      card.setPointerCapture(pid);
    }
    if (axis === 'x') gsap.set(card, { x: dx * 0.8, y: 0, rotateX: 0, rotateZ: dx * 0.015 });
    else gsap.set(card, { x: 0, y: dy * 0.55, rotateX: -dy * 0.04, rotateZ: 0 });
  });
  const release = (cancelled: boolean) => {
    if (!tracking) return;
    tracking = false;
    if (!card.classList.contains('dragging')) return;
    card.classList.remove('dragging');
    const d = axis === 'x' ? dx : dy;
    if (!cancelled && Math.abs(d) > 70 && cards.length > 1) {
      step(d < 0 ? 1 : -1); // drag left / up = next, right / down = previous
    } else {
      gsap.to(card, { ...pose(0), duration: 0.4, ease: 'back.out(1.6)' });
    }
  };
  card.addEventListener('pointerup', () => release(false));
  card.addEventListener('pointercancel', () => release(true));
}

function onKey(e: KeyboardEvent) {
  if (!root || root.hidden) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    step(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    step(1);
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

export function openLightbox(title: string, list: LightboxItem[], start: number, from: HTMLElement | null) {
  if (!list.length) return;
  if (!root) build();
  window.clearTimeout(closeTimer);
  gsap.killTweensOf(cards);

  items = list;
  trigger = from;
  busy = false;
  titleEl.textContent = title;
  deck.classList.remove('swapping');

  deck.querySelectorAll('.lb-card').forEach((c) => c.remove());
  cards = list.map((item) => {
    const card = document.createElement('figure');
    card.className = 'lb-card';
    card.innerHTML = `<div class="lb-media"><img alt="" draggable="false" decoding="async" /></div><figcaption></figcaption>`;
    const img = card.querySelector('img')!;
    img.alt = item.alt;
    img.addEventListener('load', () => img.classList.add('ready'));
    img.addEventListener('error', () => {
      if (img.getAttribute('src') !== item.src) img.src = item.src;
    });
    card.querySelector('figcaption')!.textContent = item.alt;
    attachDrag(card);
    deck.insertBefore(card, prevBtn);
    return card;
  });
  order = [...list.keys()];
  order = [...order.slice(start), ...order.slice(0, start)];

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
      dot.addEventListener('click', () => goTo(n));
      return dot;
    }),
  );

  root!.hidden = false;
  applyRest();
  if (!reducedMotion.matches) {
    // the stack fans out from underneath the front card
    const behind = order.slice(1, 3).map((ci) => cards[ci]);
    behind.forEach((card, k) => {
      gsap.from(card, { x: 0, y: 0, '--dim': 0.15, duration: 0.55, delay: 0.08 + k * 0.07, ease: 'back.out(1.4)' });
    });
  }
  requestAnimationFrame(() => root!.classList.add('open'));
  root!.querySelector<HTMLElement>('.lightbox-close')!.focus({ preventScroll: true });
}

export function close() {
  if (!root || root.hidden) return;
  root.classList.remove('open');
  const done = () => {
    root!.hidden = true;
    gsap.killTweensOf(cards);
    deck.querySelectorAll('.lb-card').forEach((c) => c.remove());
    cards = [];
    trigger?.focus({ preventScroll: true });
    trigger = null;
  };
  if (reducedMotion.matches) done();
  else closeTimer = window.setTimeout(done, 220);
}
