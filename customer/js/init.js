/* ════════════════════════════════════════
   init.js  —  App Entry Point
   ALWAYS load this LAST in index.html.
   Depends on: everything else.
════════════════════════════════════════ */

/* ════════════════════════════════════════
   HAPTIC PATTERNS
════════════════════════════════════════ */
const HapticPatterns = {
  tap:       [12],
  doubleTap: [10, 40, 10],
  success:   [15, 30, 15, 30, 40],
  error:     [80, 60, 80],
  soft:      [8],
  clear:     [30, 50, 20],
  celebrate: [20, 30, 20, 30, 60, 30, 100],
};

function haptic(type = 'tap') {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(HapticPatterns[type] || HapticPatterns.tap); } catch (e) {}
}

/* ════════════════════════════════════════
   CORE INIT
════════════════════════════════════════ */
async function init() {
  /* 1. Config + listeners */
  await loadConfig();
  listenToCategorySettings();
  listenToZoneSettings();
  listenToHomeSections();   // ✅ Home sections realtime (zone ki tarah)
  listenToProducts();

  /* 2. Permissions — location.js handle karta hai ab */
  // requestPermissions(); // ← yeh commented out hona chahiye

  /* 3. Cart restore from localStorage
     BUG FIX: pehle raw JSON.parse tha — ab Storage use karte hain */
  const savedCart = Storage.get(LS_KEYS.CART);
  if (savedCart && typeof savedCart === 'object') cart = savedCart;

  /* 4. Profile + UI hydration — only if auth not already handled */
  if (currentUser) loadUserProfile();
  updateCartUI();
  renderSlots();

  /* 5. Category filter bar — default burger show karo */
  const veggieFilters = document.getElementById('burger-filters');
  if (veggieFilters) veggieFilters.style.display = 'flex';

  /* 6. Category indicator position set karo */
  setTimeout(() => {
    const activeBtn = document.querySelector('.top-cat-btn.active');
    if (activeBtn) updateCatIndicator(activeBtn);
  }, 120);

  /* 7. Search typewriter + language */
  initSearchTypewriter();
  applyLanguage(currentLang);   // i18n.js
  updateWishBadge();

  /* 8. Form autosave (name/phone/address) */
  _initFormAutosave();

  /* 9. Phone sanitizer */
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    phoneEl.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  /* 10. Coupon input sanitizer */
  const couponEl = document.getElementById('coupon-input');
  if (couponEl) {
    couponEl.addEventListener('input', function () {
      this.value = this.value.replace(/\s/g, '').toUpperCase();
    });
  }

  /* 11. Haptics */
  initHaptics();

  /* 12. Network — online/offline detection */
if (typeof initNetwork === 'function') initNetwork();
}

/* ════════════════════════════════════════
   HAPTIC WRAPPING (function monkey-patch)
════════════════════════════════════════ */
function initHaptics() {
  /* Cart qty */
  const _origChangeQty = window.changeQty;
  window.changeQty = async function (name, price, mrp, ch) {
    const prevQty = cart[name]?.qty || 0;
    await _origChangeQty.apply(this, arguments);
    const newQty  = cart[name]?.qty || 0;
    if      (ch > 0 && newQty === prevQty) haptic('error');
    else if (ch > 0)                        haptic('tap');
    else                                    haptic('doubleTap');
  };

  /* Slot select */
  const _origSelectSlot = window.selectSlot;
  window.selectSlot = function (id, av, co) {
    haptic(av ? 'success' : 'error');
    return _origSelectSlot.apply(this, arguments);
  };

  /* Confirm location */
  const _origConfirmLoc = window.confirmLocation;
  window.confirmLocation = function () {
    const inside = pointInPolygon([currentLat, currentLng], deliveryZone);
    haptic(inside ? 'success' : 'error');
    return _origConfirmLoc.apply(this, arguments);
  };

  /* Clear cart */
  const _origClearCart = window.clearCart;
  window.clearCart = function () {
    if (Object.keys(cart).length) haptic('clear');
    return _origClearCart.apply(this, arguments);
  };

  /* Cart panel */
  _wrapHaptic('openCart',    'tap');
  _wrapHaptic('closeCart',   'soft');

  /* Profile panel */
  _wrapHaptic('openProfile', 'tap');

  /* Map picker */
  _wrapHaptic('openMapPicker',  'soft');
  _wrapHaptic('closeMapPicker', 'soft');

  /* Category tabs */
  _wrapHaptic('switchTopCat', 'soft');
  _wrapHaptic('filterSub',    'soft');
  _wrapHaptic('goToZone',     'soft');

  /* Notify OOS */
  const _origNotify = window.notifyItem;
  window.notifyItem = async function (name) {
    haptic('success');
    return _origNotify.apply(this, arguments);
  };

  /* DOM-level tab/filter buttons (already rendered) */
  document.querySelectorAll('.top-cat-btn, .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => haptic('soft'), { capture: true });
  });
}

/* ── Haptic wrap helper ───────────────── */
function _wrapHaptic(fnName, type) {
  const orig = window[fnName];
  if (typeof orig !== 'function') return;
  window[fnName] = function () {
    haptic(type);
    return orig.apply(this, arguments);
  };
}

/* ════════════════════════════════════════
   FORM AUTOSAVE (name/phone/address)
   BUG FIX: pehle raw localStorage.setItem tha
════════════════════════════════════════ */
function _initFormAutosave() {
  ['name', 'phone', 'address'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      Storage.set('sb_form', {
        name:    document.getElementById('name')?.value    || '',
        phone:   document.getElementById('phone')?.value   || '',
        address: document.getElementById('address')?.value || '',
      });
    });
  });

  // Restore saved form (only phone if not logged in)
  const saved = Storage.get('sb_form');
  if (saved && !currentUser && saved.phone) {
    const phoneEl = document.getElementById('phone');
    if (phoneEl) phoneEl.value = saved.phone;
  }
}

/* ════════════════════════════════════════
   ONBOARDING + SPLASH
════════════════════════════════════════ */
function runOnboarding() {
  init().catch(e => console.error('[Init] Boot error:', e));

  // Splash screen hide logic
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    
    // Note: Login screen handling ab config.js ke 
    // global onAuthStateChanged listener se control hoti hai.
  }, 1500);
}


/* ════════════════════════════════════════
   BANNER SLIDERS (IIFE — no global leak)
════════════════════════════════════════ */

/* Splash / Onboarding banner */
(function () {
  const slides = document.getElementById('spl-slides');
  if (!slides || !slides.children.length) return;

  const dots  = [0,1,2,3].map(i => document.getElementById('dot' + i));
  const total = 4;

  slides.appendChild(slides.children[0].cloneNode(true));   // clone for infinite loop
  slides.style.width = '500%';
  Array.from(slides.children).forEach(s => s.style.width = '20%');

  let cur = 0;
  function goTo(idx, animate) {
    slides.style.transition = animate ? 'transform 0.6s ease-in-out' : 'none';
    slides.style.transform  = `translateX(-${idx * 20}%)`;
    dots.forEach((d, i) => { if (d) d.style.opacity = i === (idx % total) ? '1' : '0.35'; });
  }

  setInterval(() => {
    cur++;
    goTo(cur, true);
    if (cur === total) setTimeout(() => { cur = 0; goTo(0, false); }, 650);
  }, 3000);
})();

/* Main home banner */
(function () {
  const slides = document.getElementById('main-slides');
  if (!slides || !slides.children.length) return;

  const dots  = [0,1,2,3].map(i => document.getElementById('mb-dot' + i));
  const total = 4;

  slides.appendChild(slides.children[0].cloneNode(true));
  slides.style.width = '500%';
  Array.from(slides.children).forEach(s => s.style.width = '20%');

  let cur = 0;
  function goTo(idx, animate) {
    slides.style.transition = animate ? 'transform 0.8s ease-in-out' : 'none';
    slides.style.transform  = `translateX(-${idx * 20}%)`;
    dots.forEach((d, i) => { if (d) d.style.opacity = i === (idx % total) ? '1' : '0.4'; });
  }

  setInterval(() => {
    cur++;
    goTo(cur, true);
    if (cur === total) setTimeout(() => { cur = 0; goTo(0, false); }, 850);
  }, 5000);
})();

/* ════════════════════════════════════════
   BOOT — run everything
════════════════════════════════════════ */
runOnboarding();

