/* ════════════════════════════════════════
   modules/product-carousel.js
   Swiggy/Zomato style auto-playing product image carousel.

   Scope note: this module ONLY drives elements matching
   `.pc-carousel` (the markup emitted for multi-image products by
   `_buildCardImageHtml()` in modules/products.js). It never touches
   header, search, banner, categories, filters, card layout, rating
   badge, bookmark button, or click-to-open-product behavior for
   single-image cards (those still render a plain <img>, untouched).

   How it hooks in:
   Product cards are (re)rendered in several places — the main grid
   (renderProducts), category page, search results, wishlist, etc. —
   all of which build markup via innerHTML and don't call a shared
   "after render" hook. Rather than editing every call site, this
   module watches the DOM with a single MutationObserver and wires up
   any `.pc-carousel` as soon as it appears, and tears it down
   (clearing timers, unobserving) as soon as it's removed — so
   switching tabs/filters/search repeatedly can't leak timers or
   observers.

   Depends on: nothing (vanilla JS, no external library).
════════════════════════════════════════ */

(function () {
  'use strict';

  const AUTOPLAY_DELAY_MS = 2500;   // spec: autoplay delay
  const TRANSITION_MS     = 250;    // spec: slide transition
  const SWIPE_THRESHOLD   = 0.18;   // fraction of card width to trigger a slide change

  /** el (.pc-carousel) -> internal state */
  const registry = new WeakMap();

  /** Single shared IntersectionObserver drives play/pause for every card. */
  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(onIntersect, { root: null, rootMargin: '0px', threshold: 1.0 })
    : null;

  function onIntersect(entries) {
    for (const entry of entries) {
      const state = registry.get(entry.target);
      if (!state) continue;
      if (entry.isIntersecting) play(state);
      else pause(state);
    }
  }

  /* ── Init / teardown ─────────────────────── */

  function init(el) {
    if (el.dataset.pcReady) return;
    el.dataset.pcReady = '1';

    const track  = el.querySelector('.pc-track');
    const slides = Array.from(el.querySelectorAll('.pc-slide'));
    const dots   = Array.from(el.querySelectorAll('.pc-dot'));
    if (!track || slides.length < 2) return; // nothing to slide

    const state = {
      el, track, slides, dots,
      index: 0,
      timer: null,
      visible: false,
      dragging: false,
      wasDragged: false,
      startX: 0,
      widthPx: 0,
    };
    registry.set(el, state);

    goTo(state, 0, false); // sets initial transform + loads first two images

    el.addEventListener('pointerdown', (e) => onPointerDown(state, e));
    el.addEventListener('pointermove', (e) => onPointerMove(state, e));
    el.addEventListener('pointerup',   (e) => onPointerUp(state, e));
    el.addEventListener('pointercancel', (e) => onPointerUp(state, e));
    el.addEventListener('pointerleave', (e) => { if (state.dragging) onPointerUp(state, e); });

    // Tap a dot to jump straight to that slide (stops the card's own onclick from firing).
    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        goTo(state, i, true);
        if (state.visible) restartTimer(state);
      });
    });

    // If a swipe just happened, swallow the resulting click so it doesn't
    // trigger the card's onclick="openProductDetail(...)".
    el.addEventListener('click', (e) => {
      if (state.wasDragged) {
        e.stopPropagation();
        e.preventDefault();
        state.wasDragged = false;
      }
    }, true);

    if (io) io.observe(el);
    else { state.visible = true; play(state); } // no IO support -> just autoplay
  }

  function teardown(el) {
    const state = registry.get(el);
    if (!state) return;
    clearTimeout(state.timer);
    if (io) io.unobserve(el);
    registry.delete(el);
  }

  /* ── Lazy image loading ── */

  function loadSlideImage(state, index) {
    const img = state.slides[index] && state.slides[index].querySelector('img[data-src]');
    if (img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  }

  function preloadAround(state) {
    const n = state.slides.length;
    loadSlideImage(state, state.index);
    loadSlideImage(state, (state.index + 1) % n); // pre-warm the next one so the swipe feels instant
  }

  /* ── Slide movement ── */

  function goTo(state, index, animate) {
    const n = state.slides.length;
    state.index = ((index % n) + n) % n; // loop
    preloadAround(state);
    state.track.style.transition = animate
      ? `transform ${TRANSITION_MS}ms cubic-bezier(.25,.1,.25,1)`
      : 'none';
    state.track.style.transform = `translate3d(${-state.index * 100}%,0,0)`;
    updateDots(state);
  }

  function updateDots(state) {
    state.dots.forEach((dot, i) => {
      if (i === state.index) {
        dot.classList.add('active');
        const fill = dot.querySelector('.pc-dot-fill');
        if (fill) {
          // Restart the CSS progress animation from zero.
          fill.style.animation = 'none';
          void fill.offsetWidth; // force reflow
          fill.style.animation = '';
        }
      } else {
        dot.classList.remove('active');
      }
    });
  }

  /* ── Autoplay (only while the card is in the viewport) ── */

  function restartTimer(state) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.visible || state.dragging) return;
      goTo(state, state.index + 1, true);
      restartTimer(state);
    }, AUTOPLAY_DELAY_MS);
  }

  function play(state) {
    state.visible = true;
    state.el.classList.remove('pc-paused');
    restartTimer(state);
  }

  function pause(state) {
    state.visible = false;
    state.el.classList.add('pc-paused');
    clearTimeout(state.timer);
    state.timer = null;
  }

  /* ── Swipe / drag ── */

  function onPointerDown(state, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.dragging   = true;
    state.wasDragged = false;
    state.startX     = e.clientX;
    state.widthPx    = state.el.getBoundingClientRect().width || 1;
    state.track.style.transition = 'none';
    clearTimeout(state.timer);
    try { state.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  }

  function onPointerMove(state, e) {
    if (!state.dragging) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 5) state.wasDragged = true;
    const base = -state.index * state.widthPx;
    state.track.style.transform = `translate3d(${base + dx}px,0,0)`;
  }

  function onPointerUp(state, e) {
    if (!state.dragging) return;
    state.dragging = false;
    const dx = e.clientX - state.startX;
    const threshold = state.widthPx * SWIPE_THRESHOLD;
    let target = state.index;
    if (dx <= -threshold) target = state.index + 1;
    else if (dx >= threshold) target = state.index - 1;
    goTo(state, target, true);
    if (state.visible) restartTimer(state);
  }

  /* ── Discover carousels as they're rendered ── */

  function scan(root) {
    const nodes = root.querySelectorAll ? root.querySelectorAll('.pc-carousel:not([data-pc-ready])') : [];
    nodes.forEach(init);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('.pc-carousel')) init(node);
        else if (node.querySelectorAll) scan(node);
      });
      m.removedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('.pc-carousel')) { teardown(node); return; }
        if (node.querySelectorAll) {
          node.querySelectorAll('.pc-carousel').forEach(teardown);
        }
      });
    }
  });

  function boot() {
    scan(document);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
