/* ════════════════════════════════════════
   handlers/backhandler.js
   Intercepts Android / browser back button —
   closes topmost open panel instead of exiting.
   Load order: JUST BEFORE init.js (last two scripts)
════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Internal state ───────────────────── */
  const _stack = [];          // close-fn stack of currently open panels
  let _selfGoBack       = 0;  // our own history.go(-1) calls in flight
  let _backButtonActive = false;

  /* ════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════ */

  /**
   * navPush(closeFn)
   * Call when opening any panel/modal.
   * Pushes a history entry so back button has something to catch.
   */
  window.navPush = function (closeFn) {
    _stack.push(closeFn);
    history.pushState({ sbLevel: _stack.length }, '');
  };

  /**
   * navPop()
   * Called by every patched close-function automatically.
   * — UI close (× button): also calls history.go(-1) to sync.
   * — HW back button:       browser already went back, skip go(-1).
   */
  window.navPop = function () {
    if (!_stack.length) return;
    _stack.pop();
    if (!_backButtonActive) {
      _selfGoBack++;
      history.go(-1);
    }
  };

  /* ════════════════════════════════════════
     POPSTATE LISTENER
  ════════════════════════════════════════ */
  window.addEventListener('popstate', function () {
    // Our own go(-1)? Ignore.
    if (_selfGoBack > 0) { _selfGoBack--; return; }

    if (_stack.length > 0) {
      // HW back pressed with a panel open → close topmost
      _backButtonActive = true;
      _stack[_stack.length - 1]();   // patched close-fn → navPop + origClose
      _backButtonActive = false;
    } else {
      // No panel open — re-push baseline so next back also lands here
      // (prevents immediate WebView exit)
      history.pushState({ sbLevel: 0 }, '');
    }
  });

  /* ── Baseline history entry ───────────── */
  history.pushState({ sbLevel: 0 }, '');

  /* ════════════════════════════════════════
     AUTO-PATCH PAIRS
     Add new [openFnName, closeFnName] rows
     whenever a new panel/modal is added.
  ════════════════════════════════════════ */
  const PAIRS = [
    ['openCart',            'closeCart'],
    ['openProfile',         'closeProfile'],
    ['openMapPicker',       'closeMapPicker'],
    ['openCheckout',        'closeCheckout'],
    ['openProductDetail',   'closeProductDetail'],
    ['openProfilePage',     'closeProfilePage'],
    ['openOrdersPage',      'closeOrdersPage'],
    ['openWishlistPage',    'closeWishlistPage'],
    ['openSavedAddress',    'closeSavedAddrPage'],
    ['openAllCoupons',      'closeAllCoupons'],
    ['openPrivacy',         'closePrivacy'],
    ['openTerms',           'closeTerms'],
    ['openLanguagePicker',  'closeLanguagePicker'],
    ['openAboutUs',         'closeAboutUs'],
    ['openSuggestProduct',  'closeSuggestSheet'],   // BUG FIX: was 'closeSuggestProduct' (wrong name)
  ];

  document.addEventListener('DOMContentLoaded', function () {
    PAIRS.forEach(function (pair) {
      const openName  = pair[0];
      const closeName = pair[1];
      const origOpen  = window[openName];
      const origClose = window[closeName];

      // Skip if either function not yet defined
      if (typeof origOpen  !== 'function') { console.warn(`[BackHandler] ${openName} not found`);  return; }
      if (typeof origClose !== 'function') { console.warn(`[BackHandler] ${closeName} not found`); return; }

      // Wrap open → push to stack
      window[openName] = function () {
        origOpen.apply(this, arguments);
        navPush(window[closeName]);   // live reference — future patches chain
      };

      // Wrap close → pop from stack
      window[closeName] = function () {
        navPop();
        origClose.apply(this, arguments);
      };
    });

    console.log(`[BackHandler] ✅ ${PAIRS.length} pairs patched`);
  });

})();
