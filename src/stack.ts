import gsap from 'gsap';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* How dark each depth in the pile is (index = slot behind the front card). */
const DIM = [0, 0.45, 0.68];
const MAX_DEPTH = DIM.length - 1;

/* ------------------------------------------------------------------ *
 * Stack deck: the same "roll the front card up and over, drop it at the
 * back" motion as the project decks, generalised to any number of cards.
 * Markup: [data-stack] > [data-card] (+ [data-push] buttons, [data-handle]).
 * ------------------------------------------------------------------ */
function initStack(deck: HTMLElement) {
  let order = Array.from(deck.querySelectorAll<HTMLElement>('[data-card]'));
  const total = order.length;
  if (total < 2) return;

  deck.style.setProperty('--depth', String(Math.min(total - 1, MAX_DEPTH)));

  let busy = false;

  const peek = () => parseFloat(getComputedStyle(deck).getPropertyValue('--peek')) || 16;
  const slot = (i: number) => {
    const k = Math.min(i, MAX_DEPTH);
    const p = peek();
    return { x: k * p, y: -k * p, rotateX: 0, '--dim': DIM[k] };
  };

  const setState = (card: HTMLElement, isFront: boolean) => {
    card.dataset.pos = isFront ? 'front' : 'back';
    card.setAttribute('aria-hidden', String(!isFront));
    card.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
      el.tabIndex = isFront ? 0 : -1;
    });
  };

  const applyRest = () => {
    order.forEach((card, i) => {
      setState(card, i === 0);
      gsap.set(card, { ...slot(i), zIndex: total - i, transformPerspective: 1400 });
    });
  };

  const swap = () => {
    if (busy) return;
    busy = true;

    const out = order[0];
    const rest = order.slice(1);
    const next = [...rest, out];
    const hadFocus = out.contains(document.activeElement);
    deck.classList.add('swapping');

    const finish = () => {
      order = next;
      applyRest();
      deck.classList.remove('swapping');
      busy = false;
      if (hadFocus) order[0].querySelector<HTMLElement>('[data-push]')?.focus({ preventScroll: true });
    };

    if (prefersReducedMotion.matches) {
      order = next;
      applyRest();
      deck.classList.remove('swapping');
      busy = false;
      if (hadFocus) order[0].querySelector<HTMLElement>('[data-push]')?.focus({ preventScroll: true });
      return;
    }

    const lift = out.offsetHeight * 0.5;
    const p = peek();
    const tl = gsap.timeline({ onComplete: finish });

    // front card lifts upward and tips back...
    tl.to(out, { x: p * 0.5, y: -lift, rotateX: 26, duration: 0.36, ease: 'power2.out' }, 0);

    // ...the cards behind it start rising while it is still in the air
    rest.forEach((card, i) => {
      const from = slot(i + 1);
      const to = slot(i);
      tl.to(
        card,
        { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, '--dim': (from['--dim'] + to['--dim']) / 2, duration: 0.36, ease: 'power1.out' },
        0,
      );
    });

    // at the top of the roll the order flips
    tl.call(() => next.forEach((card, i) => gsap.set(card, { zIndex: total - i })), [], 0.32);

    // front card drops down to the very back of the pile
    tl.to(out, { ...slot(total - 1), duration: 0.5, ease: 'power3.inOut' }, 0.32);

    // everyone else steps forward one slot; the new front card settles with a small overshoot
    rest.forEach((card, i) => {
      tl.to(card, { ...slot(i), duration: 0.5, ease: i === 0 ? 'back.out(1.5)' : 'power3.inOut' }, 0.32);
    });
  };

  // --- controls ---------------------------------------------------------
  deck.querySelectorAll<HTMLElement>('[data-push]').forEach((btn) => btn.addEventListener('click', () => swap()));

  // clicking a card peeking out behind also rolls the front one back
  deck.addEventListener('click', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (card && card.dataset.pos === 'back') swap();
  });

  // drag the front card up (or down) to push it back: anywhere on the card with a
  // mouse/pen, or from the handle on touch screens (so the page can still scroll).
  order.forEach((card) => {
    let startY = 0;
    let dy = 0;
    let tracking = false;
    let pointerId = -1;

    card.addEventListener('pointerdown', (event) => {
      if (busy || card.dataset.pos !== 'front' || event.button > 0) return;
      const target = event.target as HTMLElement;
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
        gsap.to(card, { ...slot(0), duration: 0.4, ease: 'back.out(1.6)' });
      }
    };
    card.addEventListener('pointerup', () => release(false));
    card.addEventListener('pointercancel', () => release(true));
  });

  window.addEventListener('resize', () => {
    if (!busy) applyRest();
  });

  applyRest();

  // Entrance: the pile starts squared up, then fans out into its stacked slots once in view.
  if (!prefersReducedMotion.matches && 'IntersectionObserver' in window) {
    order.forEach((card) => gsap.set(card, { x: 0, y: 0, '--dim': 0 }));
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        order.forEach((card, i) => {
          gsap.to(card, { ...slot(i), duration: 0.7, delay: 0.25 + i * 0.09, ease: 'back.out(1.8)' });
        });
      },
      { threshold: 0.3 },
    );
    io.observe(deck);
  }
}

export function initStackDecks() {
  document.querySelectorAll<HTMLElement>('[data-stack]').forEach(initStack);
}
