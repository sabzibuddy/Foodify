/* ============================================================
   HEADER SCROLL COLLAPSE — Zomato Android style (v4)
   ------------------------------------------------------------
   v4 CHANGE (reported bug: white header background and search
   bar "not locked together" / feels like two separate layers):

     ROOT CAUSE: the search bar's position (`lift`) was driven by
     raw linear `progress`, but the header's white background
     alpha/blur/shadow/border were driven by `easeOutCubic(progress)`
     — a curve that front-loads its motion (e.g. eased(0.5) ≈ 0.87).
     So at 50% of the actual scroll distance, the search bar had
     only moved halfway, while the white background was already
     ~87% opaque. The background visibly "arrived" ahead of the
     search bar finishing its rise — exactly what reads as an
     independently-moving layer instead of one physically attached
     surface.

     FIX: the glass background channels now read off the SAME raw
     `progress` value as `lift` (see apply()) — one identical linear
     clock driving both position and background solidity, so they
     are mathematically locked frame-for-frame with zero relative
     movement, matching the reference.

   v3 CHANGES (against a real 60fps Zomato screen recording,
   compared frame-by-frame with our own recording):

     A. COLLAPSE WAS TOO SHORT/FAST. v2 used a fixed
        COLLAPSE_RANGE = 150px. Against the reference, our
        collapse finished in ~0.3-0.4s (a "snap"), while
        Zomato's takes visibly longer and reads as gradual and
        premium. Fixed by driving the range off the ACTUAL
        measured row height instead of a guessed constant — see
        the collapseRange calculation inside measure(). This also
        keeps it proportionate automatically on devices with
        larger fonts/rows instead of needing a re-tuned magic
        number.

     B. HERO WAS FADING INSTEAD OF SLIDING UNDER. v2 applied a
        JS-driven opacity fade + extra parallax translate to
        .main-banner-wrap. In the reference, the hero banner has
        NO custom scroll motion at all — it is normal, non-fixed
        page content that scrolls at the same 1:1 rate as
        everything else, and simply gets covered/clipped by the
        header's opaque surface (already higher z-index, already
        going opaque via --hdr-bg-a) as it slides underneath.
        Fixed by removing the JS transform/opacity on the banner
        entirely — it now behaves exactly like the reference:
        real document scroll + z-index clipping, not a fade.

   Everything below this point that already matched the
   reference (single progress value, transform/opacity-only
   writes, rAF throttling, live re-measurement) is unchanged —
   see the original v2 notes, kept below since they're still
   accurate:
   ------------------------------------------------------------
   The old (v1) implementation already used the right primitives
   (single progress value, transform/opacity only, rAF-throttled
   scroll, cached measurements). What it was missing were the
   things that actually cause the "jump / flicker / shake" a user
   notices on a real device:

     1. STALE MEASUREMENTS. rowHeight / headerFullH / collapsedHeaderH
        were measured exactly once (on load + resize). Anything that
        changes the header's real height AFTER that — the delivery
        address swapping from "Fetching your location..." to a real
        address, the cart total pill appearing next to the cart icon,
        a font finishing its swap-in — silently desyncs the cached
        numbers from reality. The visual result is a lift distance
        that no longer matches the row's real height: a gap or an
        overlap right as the header finishes collapsing. Fixed below
        with a ResizeObserver on the row/header, so measurements are
        always kept current, re-measured invisibly (no flash — see
        measure()) whenever the content actually changes size.

     2. SCROLL ANCHORING. Browsers automatically try to keep the
        content under the user's finger/cursor from jumping when an
        offscreen element changes size. The header's real box height
        DOES change once, at progress===1 (see applyFinishedStyles).
        Without disabling this, that single legitimate layout change
        can make the browser silently add its own compensating scroll
        offset — which reads as an abrupt "snap". Fixed in
        header.css with `overflow-anchor: none` on the header and the
        sticky category bar.

     3. BFCACHE / BACK-NAVIGATION. Returning to the page via the
        back button can restore a mid-scroll position before this
        script's first frame runs, or restore stale cached heights
        from before a resize. Fixed with a `pageshow` listener that
        re-measures whenever the page is restored from bfcache.

   Everything else keeps the original's core (correct) idea:
     • ONE progress value (0 → 1), ONE scroll range, driving hero,
       location row, search bar and the glass surface together —
       so it reads as one continuous surface, not separate pieces
       animating on their own clocks.
     • Position (translate3d) is kept perfectly linear with scroll
       position — no easing on transforms — so motion never
       decouples from the user's actual scroll input.
     • The glass background (alpha/blur/shadow/border) is ALSO
       driven by that same raw linear progress (not eased) — see
       the v4 note in apply() — so it never arrives ahead of or
       behind the search bar/row transforms. Only the location
       row's own opacity fade keeps a soft ease-out, since that's
       a disappearing element, not part of the "one rigid surface"
       requirement.
     • Only transform / opacity / CSS custom properties are ever
       written per scroll frame. The one unavoidable layout change
       (removing the collapsed row's layout weight) still only ever
       happens once, at the very end, already fully invisible.
   ============================================================ */
(function () {
  'use strict';

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Gentle ease-out — used only for non-positional (opacity/glass)
  // channels so they settle a touch faster than raw scroll distance,
  // without ever breaking sync with it (still a pure function of
  // the same progress value, no time-based tweening involved).
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function init() {
    var headerEl   = document.querySelector('header');
    var headerRow  = document.querySelector('.header-row');
    var searchSec  = document.querySelector('.search-section');
    var bannerWrap = document.querySelector('.main-banner-wrap');
    var topCats    = document.getElementById('top-cats');

    // If the markup this script depends on isn't present, bail out
    // quietly rather than throwing — keeps other scripts unaffected.
    if (!headerEl || !headerRow || !searchSec || !bannerWrap || !topCats) return;

    /* ---------- single tunable driving the ENTIRE collapse ---------- */
    // Location row, search bar and glass background all read off
    // this one range — this is what makes it feel like one
    // collapsing surface instead of separate elements animating on
    // their own schedules.
    //
    // v3: this is no longer a fixed guess. Matched against the
    // Zomato reference frame-by-frame, its collapse consistently
    // takes a scroll distance of roughly 3x the collapsing row's
    // own height (not ~1x, which is what produced the "snap" in
    // v2). Deriving it from the real measured row height keeps
    // that ratio correct on any device/font-size instead of
    // needing a re-tuned magic number — see the collapseRange
    // calculation inside measure().
    var COLLAPSE_RANGE_MIN = 220; // px floor so tiny rows don't collapse too fast
    var COLLAPSE_RANGE_MULT = 3;  // x rowHeight, tuned against the reference
    var collapseRange = 240;      // computed in measure(), sane default before first measure

    /* ---------- cached (measure-once, re-measured on real change) ---------- */
    var rowHeight        = 0;  // rendered height of the location row
    var headerFullH      = 0;  // rendered height of <header> at rest (expanded)
    var collapsedHeaderH  = 0; // rendered height of <header> once fully finished

    // Applies (or reverts) the small set of styles that belong ONLY
    // to the fully-finished (progress === 1) resting state. Never
    // applied mid-animation for real user scrolling — see the
    // guarded calls inside apply(). measure() also uses it briefly,
    // but synchronously (no frame is ever painted in between), so
    // it never causes a visible flash.
    function applyFinishedStyles(on) {
      // NO transition here, on purpose: --catbar-top (the category
      // bar's position) is written instantly/synchronously every
      // frame with zero transition. If padding eased in on its own
      // timer instead of switching in the same synchronous step,
      // the category bar would already be at its final position
      // while the header's real bottom edge was still catching up —
      // a temporary gap that reveals scrolled content underneath.
      // Everything here must land in one frame, together.
      //
      // paddingBottom is deliberately left untouched (was previously
      // forced to '0px') so the breathing room below the search bar
      // stays the same constant distance whether the header is
      // expanded or fully collapsed — it should never shrink to 0.
      if (on) {
        headerRow.style.display      = 'none';
        // paddingTop ab har frame apply() me continuously set hoti hai
        // (upar lerp() wali lines) — progress===1 tak already 8px/0px
        // pe pahunch chuki hoti hai, isliye yahan dobara hard-set
        // karne ki zaroorat nahi (wahi discrete jump ka source tha).
        // IMPORTANT: once the row is removed from layout, the search
        // bar's own natural (static) position already shifts up to
        // fill the vacated space — so its translate must reset to 0
        // here. Leaving the old translateY(-rowHeight) in place would
        // shift it a SECOND time on top of the new layout position,
        // pushing it up and off-screen entirely (the "search bar
        // disappears into the top" bug).
        searchSec.style.transform    = 'translate3d(0,0,0)';
        // The per-frame clip below (see apply()) was clipping off
        // the bottom `rowHeight` px of the OLD, still-tall box. Now
        // that the box has actually shrunk to its real collapsed
        // height, that clip must be released — using an equivalent
        // zero-inset shape (rather than 'none') keeps it the same
        // clip-path function type as the animated frames, so the
        // transition above has a real value to ease FROM and TO
        // instead of snapping to a differently-typed 'none'.
        headerEl.style.clipPath = 'inset(0 0 0 0)';
        headerEl.style.webkitClipPath = 'inset(0 0 0 0)';
      } else {
        headerRow.style.display      = '';
        // Padding yahan bhi touch nahi karni — jo bhi apply() ne
        // current progress ke hisaab se already set kar rakha hai
        // wahi valid rahega, koi reset/jump nahi.
      }
    }

    var measuring = false; // re-entrancy guard for the ResizeObserver below

    function measure() {
      if (measuring) return;
      measuring = true;

      // Reset everything to the natural/expanded, unfinished state
      // first so measurements aren't taken mid-animation.
      applyFinishedStyles(false);
      headerRow.style.transform = 'none';
      searchSec.style.transform = 'none';
      headerEl.style.clipPath = 'none';
      headerEl.style.webkitClipPath = 'none';
      headerEl.style.setProperty('--hdr-bg-a', '0');
      headerEl.style.setProperty('--hdr-blur', '0px');
      headerEl.style.setProperty('--hdr-shadow-a', '0');
      headerEl.style.setProperty('--hdr-border-a', '0');

      rowHeight   = headerRow.getBoundingClientRect().height || 56;
      headerFullH = headerEl.getBoundingClientRect().height || (rowHeight + 90);

      // Reference-matched: collapse distance scales with the row's
      // own real height so the motion always reads as gradual,
      // never a snap, regardless of device font-size/DPI.
      collapseRange = Math.max(COLLAPSE_RANGE_MIN, rowHeight * COLLAPSE_RANGE_MULT);

      // Measure the real finished height by briefly applying the
      // exact same styles apply() uses at progress===1, then
      // reverting — keeps it byte-for-byte in sync with the actual
      // stylesheet/inline styles instead of a guessed number. This
      // happens synchronously with no yield to the browser's paint
      // step in between, so it is never visible.
      applyFinishedStyles(true);
      // Padding ab applyFinishedStyles() ke andar force nahi hoti —
      // apply() ke andar har frame continuously set hoti hai. Lekin
      // ye measurement scroll shuru hone se PEHLE chalti hai, isliye
      // paddingTop abhi bhi apne un-collapsed default pe ho sakti hai.
      // Isliye yahan sirf ISI measurement ke liye wahi final target
      // values force kar rahe hain, taaki collapsedHeaderH (jisse
      // --catbar-top banta hai) REAL final collapsed height ke
      // exactly barabar aaye — warna category bar 2-3px neeche stick
      // hota tha aur wahi gap se neeche ki tiles scroll ke time peek
      // karti thi.
      headerEl.style.paddingTop  = '8px';
      searchSec.style.paddingTop = '0px';
      collapsedHeaderH = headerEl.getBoundingClientRect().height || (headerFullH - rowHeight);
      applyFinishedStyles(false);

      finished     = false;
      lastProgress = -1;
      lastCatTop   = null;
      apply();

      measuring = false;
    }

    /* ---------- rAF-throttled scroll -> style application ---------- */
    var ticking      = false;
    var lastProgress = -1;
    var lastCatTop   = null;
    var finished     = false; // has the fully-collapsed cleanup been applied?

    function apply() {
      ticking = false;

      var scrollY  = window.scrollY || window.pageYOffset || 0;
      var progress = clamp01(scrollY / collapseRange);

      if (progress === lastProgress) return;
      lastProgress = progress;

      var eased = easeOutCubic(progress);
      var lift  = progress * rowHeight; // kept perfectly linear with scroll

      /* Padding ab continuously (same raw progress se) interpolate ho
         raha hai, taaki progress===1 pe exactly 8px/0px pe pahunche —
         wahi values jo applyFinishedStyles() pehle achanak set kar
         deta tha. Pehle jab scroll up pe progress 1 se thoda neeche
         aata tha, padding turant default (10px/15px) pe revert ho
         jaati thi jabki transform/lift abhi bhi ~collapsed values pe
         hota tha — ~17px ka mismatch ek hi frame me, wahi snap tha. */
      headerEl.style.paddingTop  = lerp(10, 8, progress).toFixed(2) + 'px';
      searchSec.style.paddingTop = lerp(15, 0, progress).toFixed(2) + 'px';

      /* -- Location row: slides up in lockstep with scroll (linear
            transform, so it never decouples from the finger/wheel),
            fades with a soft ease-out. Finishes (fully translated,
            fully transparent) exactly at progress === 1, in lockstep
            with everything else below. -- */
      headerRow.style.transform     = 'translate3d(0,' + (-lift) + 'px,0)';
      headerRow.style.opacity       = String(1 - eased);
      headerRow.style.pointerEvents = progress > 0.6 ? 'none' : 'auto';

      /* -- Search bar: rises together with the row (same `lift`,
            same progress — one shared driver, not independent
            motion), coming to rest flush with the top exactly when
            progress reaches 1. That's the moment it "becomes sticky"
            against the top edge. -- */
      searchSec.style.transform = 'translate3d(0,' + (-lift) + 'px,0)';

      /* -- Hero banner: DELIBERATELY untouched here. In the
            reference, the hero has no custom scroll motion of its
            own — it's normal, non-fixed page content scrolling at
            the same 1:1 rate as the rest of the page, and it reads
            as "sliding underneath the header" purely because the
            header sits at a higher z-index and is going opaque
            (via --hdr-bg-a, below) over the exact same scroll
            range. A JS-driven fade/parallax here (the v2 approach)
            made the banner visibly dissolve instead of being
            covered — the fix was to remove it, not add more. -- */

      /* -- Glass surface: alpha / blur / shadow-alpha / border-alpha
            interpolate continuously with the SAME RAW `progress`
            value used for `lift` (the search bar's own transform) —
            NOT the eased curve. This was the actual bug: eased
            curves front-load their motion (easeOutCubic(0.5) ≈ 0.87,
            not 0.5), so with the old `eased`-driven alpha the white
            background was reaching ~87% opacity while the search
            bar had only physically travelled half its distance —
            i.e. the background visibly "arrived" ahead of the
            search bar, reading as two independently-moving layers
            instead of one. Driving both off the identical linear
            `progress` value means they are now mathematically
            locked frame-for-frame: at any given scroll position the
            background is exactly as "solid" as the search bar is
            "risen" — one rigid, unified surface, same as the
            reference. -- */
      headerEl.style.setProperty('--hdr-bg-a',     (progress * 0.96).toFixed(3));
      headerEl.style.setProperty('--hdr-blur',     (progress * 20).toFixed(1) + 'px');
      headerEl.style.setProperty('--hdr-shadow-a', (progress * 0.05).toFixed(3));
      headerEl.style.setProperty('--hdr-border-a', (progress * 0.05).toFixed(3));

      /* -- THE ACTUAL FIX: <header>'s own box never resizes
            mid-scroll (only at the final progress===1 step). Its
            background fills that static box, while searchSec only
            visually rises inside it via transform — leaving a
            growing strip of static background below the search bar
            that never moved with it. Clipping the header's own
            bottom edge by the SAME `lift` used for the search bar's
            transform, every frame, makes the visible white surface's
            bottom edge rise in exact lockstep with the search bar —
            zero relative movement — without moving <header> itself
            (still pinned by sticky, layout untouched). -- */
      headerEl.style.clipPath       = 'inset(0 0 ' + lift + 'px 0)';
      headerEl.style.webkitClipPath = 'inset(0 0 ' + lift + 'px 0)';

      /* -- Category tiles: sticky `top` offset, linearly interpolated
            (raw progress, not eased — must land exactly on
            collapsedHeaderH the instant progress hits 1, in lockstep
            with the `finished` cleanup below) between the header's
            real expanded height and its real measured finished
            height — so they stay flush under the header for the
            entire range, with zero gap and zero jump. -- */
      var catTop = Math.round(lerp(headerFullH, collapsedHeaderH, progress));
      if (catTop !== lastCatTop) {
        document.documentElement.style.setProperty('--catbar-top', catTop + 'px');
        lastCatTop = catTop;
      }

      /* -- Only now, once progress has FULLY reached 1 (the row is
            already fully translated away and fully transparent),
            remove its now-invisible layout weight so the header's
            real box height matches its visual height. This never
            runs mid-animation, and reverts instantly the moment the
            user scrolls back up even slightly. -- */
      if (progress >= 1 && !finished) {
        applyFinishedStyles(true);
        finished = true;
      } else if (progress < 1 && finished) {
        applyFinishedStyles(false);
        finished = false;
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(apply);
      }
    }

    function onResize() {
      measure();
    }

    // Initial measure + first paint (covers page loads that start
    // mid-scroll, e.g. after a back-navigation).
    measure();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // Orientation changes on mobile can change row height (text wraps)
    window.addEventListener('orientationchange', onResize, { passive: true });

    // Restoring from bfcache (back/forward navigation) can bring back
    // a stale scroll position or stale cached heights before this
    // script would otherwise re-run — re-measure to be safe.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) measure();
    });

    // Keep measurements honest against real content changes that
    // happen AFTER first load — the delivery address resolving from
    // "Fetching your location..." to a real address, the cart total
    // pill appearing, locale/font swaps, etc. Debounced to one
    // rAF-scheduled remeasure so rapid-fire mutations (e.g. a
    // streaming address update) don't thrash layout.
    if (typeof ResizeObserver !== 'undefined') {
      var roScheduled = false;
      var ro = new ResizeObserver(function () {
        if (roScheduled) return;
        roScheduled = true;
        window.requestAnimationFrame(function () {
          roScheduled = false;
          measure();
        });
      });
      ro.observe(headerRow);
      ro.observe(headerEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();