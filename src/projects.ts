import gsap from 'gsap';
import { openLightbox, type LightboxItem } from './lightbox';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ *
 * Image carousel (top of the main project card)
 * ------------------------------------------------------------------ */
function initCarousel(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('.carousel-track');
  const dotsWrap = root.querySelector<HTMLElement>('[data-dots]');
  const prev = root.querySelector<HTMLButtonElement>('[data-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  if (!track) return;

  const slides = Array.from(track.children) as HTMLElement[];
  let index = 0;
  let swiped = false;

  // --- click an image (or the expand button) to open the larger pop-up ----
  const title = (root.getAttribute('aria-label') ?? 'Project').replace(/ screenshots$/, '');
  const lightboxItems = (): LightboxItem[] =>
    slides.map((el) => {
      const img = el as HTMLImageElement;
      return { src: img.src, full: img.dataset.full || img.src, alt: img.alt };
    });

  const zoom = document.createElement('button');
  zoom.type = 'button';
  zoom.className = 'carousel-zoom';
  zoom.setAttribute('aria-label', `View ${title} screenshots larger`);
  zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  root.append(zoom);
  zoom.addEventListener('click', () => openLightbox(title, lightboxItems(), index, zoom));
  track.addEventListener('click', () => {
    if (swiped) {
      swiped = false;
      return;
    }
    openLightbox(title, lightboxItems(), index, zoom);
  });

  if (slides.length < 2) {
    prev?.remove();
    next?.remove();
    dotsWrap?.remove();
    return;
  }

  // --- swipe the card carousel (touch, pen or mouse drag) ------------------
  let sx = 0;
  let sy = 0;
  let tracking = false;
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    tracking = true;
    swiped = false;
    sx = e.clientX;
    sy = e.clientY;
  });
  root.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      go(index + (dx < 0 ? 1 : -1));
    }
  });
  root.addEventListener('pointercancel', () => (tracking = false));

  const dots = slides.map((_, n) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show image ${n + 1} of ${slides.length}`);
    dot.addEventListener('click', () => go(n));
    dotsWrap?.append(dot);
    return dot;
  });

  function go(n: number) {
    index = (n + slides.length) % slides.length; // loops around
    track!.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((dot, k) => dot.setAttribute('aria-current', String(k === index)));
    slides.forEach((slide, k) => slide.setAttribute('aria-hidden', String(k !== index)));
  }

  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));
  go(0);
}

/* ------------------------------------------------------------------ *
 * Deck of cards: main card on top, specs card behind it.
 * Pushing the front card back brings the other one forward (and loops).
 * ------------------------------------------------------------------ */
function initDeck(deck: HTMLElement) {
  const cards = Array.from(deck.querySelectorAll<HTMLElement>('[data-card]'));
  if (cards.length < 2) return;

  let front = 0;
  let busy = false;

  const peek = () => parseFloat(getComputedStyle(deck).getPropertyValue('--peek')) || 18;
  const frontPose = () => ({ x: 0, y: 0, rotateX: 0, '--dim': 0 });
  const backPose = () => ({ x: peek(), y: -peek(), rotateX: 0, '--dim': 0.5 });

  const setState = (card: HTMLElement, isFront: boolean) => {
    card.dataset.pos = isFront ? 'front' : 'back';
    card.setAttribute('aria-hidden', String(!isFront));
    // keep hidden-card controls out of the tab order
    card.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
      el.tabIndex = isFront ? 0 : -1;
    });
  };

  const applyRest = () => {
    cards.forEach((card, i) => {
      setState(card, i === front);
      gsap.set(card, {
        ...(i === front ? frontPose() : backPose()),
        zIndex: i === front ? 2 : 1,
        transformPerspective: 1400,
      });
    });
  };

  const swap = () => {
    if (busy) return;
    busy = true;

    const out = cards[front];
    const inn = cards[1 - front];
    const hadFocus = out.contains(document.activeElement);
    deck.classList.add('swapping');

    const finish = () => {
      front = 1 - front;
      applyRest();
      deck.classList.remove('swapping');
      busy = false;
      if (hadFocus) inn.querySelector<HTMLElement>('[data-push]')?.focus({ preventScroll: true });
    };

    if (prefersReducedMotion.matches) {
      front = 1 - front;
      applyRest();
      deck.classList.remove('swapping');
      busy = false;
      if (hadFocus) inn.querySelector<HTMLElement>('[data-push]')?.focus({ preventScroll: true });
      return;
    }

    const p = peek();
    const lift = out.offsetHeight * 0.5;

    // One continuous motion: the front card rolls up and over the top of the
    // deck and drops in behind, while the card that was behind rises into place.
    gsap
      .timeline({ onComplete: finish })
      // front card lifts upward and tips back...
      .to(out, { x: p * 0.5, y: -lift, rotateX: 26, duration: 0.36, ease: 'power2.out' }, 0)
      // ...the back card starts rising while it is still hidden behind it
      .to(inn, { x: p * 0.4, y: -p * 0.4, '--dim': 0.25, duration: 0.36, ease: 'power1.out' }, 0)
      // at the top of the roll the order flips
      .set(out, { zIndex: 1 }, 0.32)
      .set(inn, { zIndex: 2 }, 0.32)
      // front card drops down into the "behind" slot
      .to(out, { ...backPose(), duration: 0.5, ease: 'power3.inOut' }, 0.32)
      // back card settles into the front slot with a small overshoot
      .to(inn, { ...frontPose(), duration: 0.5, ease: 'back.out(1.5)' }, 0.32);
  };

  // --- controls ---------------------------------------------------------
  deck.querySelectorAll<HTMLElement>('[data-push]').forEach((btn) => {
    btn.addEventListener('click', () => swap());
  });

  // clicking the card peeking out behind also pushes the front one back
  deck.addEventListener('click', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (card && card.dataset.pos === 'back') swap();
  });

  // drag the front card up (or down) to push it back: anywhere on the card with a
  // mouse/pen, or from the handle on touch screens (so the page can still scroll).
  cards.forEach((card) => {
    let startY = 0;
    let dy = 0;
    let tracking = false;
    let pointerId = -1;

    card.addEventListener('pointerdown', (event) => {
      if (busy || card.dataset.pos !== 'front' || event.button > 0) return;
      const target = event.target as HTMLElement;
      // touch can only drag from the handle, so normal swipes keep scrolling the page
      if (event.pointerType === 'touch' && !target.closest('[data-handle]')) return;
      if (target.closest('a, button')) return;
      tracking = true;
      startY = event.clientY;
      dy = 0;
      pointerId = event.pointerId;
    });

    card.addEventListener('pointermove', (event) => {
      if (!tracking) return;
      dy = event.clientY - startY;
      if (!card.classList.contains('dragging')) {
        if (Math.abs(dy) < 8) return;
        card.classList.add('dragging');
        card.setPointerCapture(pointerId);
      }
      gsap.set(card, { y: dy * 0.55, rotateX: -dy * 0.04 });
    });

    const release = (cancelled: boolean) => {
      if (!tracking) return;
      tracking = false;
      if (!card.classList.contains('dragging')) return;
      card.classList.remove('dragging');
      if (!cancelled && Math.abs(dy) > 70) {
        swap();
      } else {
        gsap.to(card, { ...frontPose(), duration: 0.4, ease: 'back.out(1.6)' });
      }
    };
    card.addEventListener('pointerup', () => release(false));
    card.addEventListener('pointercancel', () => release(true));
  });

  window.addEventListener('resize', () => {
    if (!busy) applyRest();
  });

  applyRest();
}

export function initProjectDecks() {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(initCarousel);
  document.querySelectorAll<HTMLElement>('[data-deck]').forEach(initDeck);
}
