/* ============================================================
   RATING BADGE — reusable animated component
   ------------------------------------------------------------
   Pairs with css/rating-badge.css and the `.rt-badge` markup
   emitted by buildCard() in js/modules/products.js.

   Every click:
     - flips which side (left/right) the white star-circle sits on
     - slides it across using translateX
     - rotates it exactly 360°
     - scales it 1 -> 1.08 -> 1
   Alternates direction forever: left->right, then right->left, etc.

   Implementation note: we never animate width/height/padding.
   We use the FLIP technique — flip the flex `order` of the circle
   and value instantly (no animation), measure the resulting
   position delta, then animate *only* transform (translateX +
   rotate + scale) via the Web Animations API so it stays on the
   GPU-accelerated compositor thread for a smooth 60fps result.
   ============================================================ */

(function () {
  'use strict';

  const DURATION_MS = 360;
  const EASING = 'cubic-bezier(0.42, 0, 0.2, 1)'; // ease-in-out

  /**
   * Animate one badge's circle+value swap on click.
   * @param {HTMLElement} badgeEl - the .rt-badge button element
   */
  function toggle(badgeEl) {
    if (!badgeEl || badgeEl.dataset.rtAnimating === '1') return;

    const circle = badgeEl.querySelector('.rt-badge__circle');
    const value = badgeEl.querySelector('.rt-badge__value');
    if (!circle || !value) return;

    // 1. Capture starting positions (FIRST)
    const circleStart = circle.getBoundingClientRect();
    const valueStart = value.getBoundingClientRect();

    // 2. Flip logical state -> CSS instantly reorders the flex children
    const wasRight = badgeEl.dataset.rtState === 'right';
    const goingRight = !wasRight;
    badgeEl.dataset.rtState = goingRight ? 'right' : 'left';

    // 3. Measure new (LAST) positions after the instant reorder
    const circleEnd = circle.getBoundingClientRect();
    const valueEnd = value.getBoundingClientRect();

    const dxCircle = circleStart.left - circleEnd.left;
    const dxValue = valueStart.left - valueEnd.left;

    // Nothing to animate (e.g. reduced motion / zero delta) — bail cleanly
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || (dxCircle === 0 && dxValue === 0)) {
      return;
    }

    badgeEl.dataset.rtAnimating = '1';

    // Spin direction mirrors the travel direction so a right->left swap
    // never looks like a re-run of the left->right animation: moving
    // right (dxCircle < 0, circle starts left of its target) spins
    // clockwise (+360); moving left (dxCircle > 0) spins counter-
    // clockwise (-360).
    const spin = goingRight ? 160 : -160;

    // 4. INVERT + PLAY: circle slides, spins a full turn (direction-aware),
    // and scales up mid-flight
    const circleAnim = circle.animate(
      [
        {
          transform: `translate3d(${dxCircle}px, 0, 0) rotate(0deg) scale(1)`,
        },
        {
          transform: `translate3d(${dxCircle * 0.5}px, 0, 0) rotate(${spin / 2}deg) scale(1.08)`,
          offset: 0.5,
        },
        {
          transform: `translate3d(0, 0, 0) rotate(${spin}deg) scale(1)`,
        },
      ],
      { duration: DURATION_MS, easing: EASING, fill: 'both' }
    );

    // Value slides the same distance, no rotation/scale, so the number
    // reads cleanly the whole time.
    value.animate(
      [
        { transform: `translate3d(${dxValue}px, 0, 0)` },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: DURATION_MS, easing: EASING, fill: 'both' }
    );

    // 5. Crossfade the sub-label: "By X+" while left, "For you" while right.
    const sub = badgeEl.parentElement
      ? badgeEl.parentElement.querySelector('.card-rating-sub')
      : null;
    if (sub) {
      sub.dataset.rtSub = goingRight ? 'foryou' : 'by';
    }

    circleAnim.onfinish = () => {
      badgeEl.dataset.rtAnimating = '';
    };
    // Safety net in case onfinish doesn't fire (e.g. tab backgrounded)
    setTimeout(() => {
      badgeEl.dataset.rtAnimating = '';
    }, DURATION_MS + 150);
  }

  /** Keyboard support: Enter/Space activate like a click on focused badges. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target;
    if (target && target.classList && target.classList.contains('rt-badge')) {
      e.preventDefault();
      toggle(target);
    }
  });

  window.RatingBadge = { toggle };
})();
