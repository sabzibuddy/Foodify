/* ════════════════════════════════════════
   core/config.js
   Firebase init + Firestore config listeners.
   Load order: constants → state → storage → utils → config
════════════════════════════════════════ */

/* ── Firebase Init ────────────────────── */
firebase.initializeApp({
  apiKey:            "AIzaSyC0pR1bytYruzPhfP9vKRz99i1SMYkuCXE",
  authDomain:        "sabzibuddy-website.firebaseapp.com",
  projectId:         "sabzibuddy-website",
  storageBucket:     "sabzibuddy-website.firebasestorage.app",
  messagingSenderId: "386650204024",
  appId:             "1:386650204024:web:d526329ffd463582c20a8d",
});

const db = firebase.firestore();
const functionsInstance = firebase.app().functions('asia-south1'); // region matches functions/index.js

/* ── PHASE 6: App Check — bots/scripts se Cloud Functions ko bachata hai ──
   SETUP REQUIRED (ek baar, manual):
   Firebase Console → App Check → apna web app register karo →
   reCAPTCHA v3 provider choose karo → site key yahan paste karo.
   Bina iske enforceAppCheck:true wale functions (placeOrder,
   assignUserRole, generateSearchKeywords) FAIL honge — isliye
   ye step deploy se PEHLE zaroor karo. */
const APP_CHECK_SITE_KEY = '6LdPDGstAAAAAGMhpgSVbZNeKj3s5r8T7E3EwQZt';

/* LOCAL TESTING FIX: reCAPTCHA v3 sirf registered production domain pe kaam
   karta hai — 127.0.0.1/localhost pe fail hoga (App Check errors, saari
   Cloud Function calls reject hongi). Isliye local pe debug-token mode
   auto-on ho jaata hai. Pehli baar chalane par console me ek debug token
   print hoga — usko copy karke Firebase Console → App Check → apna app →
   "Manage debug tokens" me ek baar add karo, uske baad local testing
   hamesha kaam karega. Production (real domain) pe ye code khud-ba-khud
   skip ho jaata hai — real reCAPTCHA use hota hai, kuch extra karne ki
   zaroorat nahi. */
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = '2999c56c-78f0-4654-acd1-9288410179e6';
}

if (firebase.appCheck) {
  firebase.appCheck().activate(
    new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
    true // auto-refresh token
  );
} else {
  console.warn('[AppCheck] Firebase App Check SDK not loaded.');
}

/* ── Auth State Listener ──────────────── */
let _authInitDone = false;

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    Storage.setUser({ uid: user.uid, phone: (user.phoneNumber || '').replace('+91', ''), otpVerified: true });
    currentUser = Storage.getUser();
    
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen && loginScreen.style.display !== 'none') {
      loginScreen.style.display = 'none';
      document.body.style.overflow = '';
    }
    
    // Only first time load karo — double call avoid
    if (!_authInitDone) {
  _authInitDone = true;
  loadUserProfile();
  if (typeof initForegroundPushListener === 'function') initForegroundPushListener();

  // ✅ Buy Again Engine
  if (typeof window.initBuyAgain === 'function') {
    window.initBuyAgain();
  }

  // ✅ Last Ordered Badge Map
  if (typeof window.initLastOrderedMap === 'function') {
    window.initLastOrderedMap();
  }
}
    Storage.remove(LS_KEYS.SKIP_LOGIN);
    
    // Pending checkout check (page reload case)
    const pendingCO = localStorage.getItem('sb_pending_checkout');
    if (pendingCO && typeof openCheckout === 'function') {
      localStorage.removeItem('sb_pending_checkout');
      setTimeout(() => openCheckout(), 600);
    }
  } else {
    _authInitDone = false;
    const _prevPhone = currentUser?.phone;
    Storage.removeUser();
    currentUser = null;
    window.invalidateBuyAgainCache?.();
    window.lastOrderedMap = {};
    if (_prevPhone) window.invalidateLastOrderedMapCache?.(_prevPhone);
    if (!Storage.get(LS_KEYS.SKIP_LOGIN)) {
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) {
        loginScreen.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    }
  }
});

/* ── Offline persistence (PWA ke liye) ── */
// db.enablePersistence().catch(() => {}); // zaroorat ho toh uncomment karo

/* ════════════════════════════════════════
   ONE-TIME CONFIG LOAD (startup mein)
════════════════════════════════════════ */
async function loadConfig() {
  try {
    // Zone settings
    const zSnap = await db.collection('config').doc('zoneSettings').get();
    if (zSnap.exists) {
      const d = zSnap.data();
      applyZoneConfig({ price: d.price, maxItems: d.maxItems });
      if (d.timerEnd) {
        const _te = d.timerEnd.toDate ? d.timerEnd.toDate() : new Date(d.timerEnd);
        if (_te > new Date()) {
          _startZoneCountdown(_te);
          if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(d.timerEnd);
        } else {
          _stopZoneCountdown();
          if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(null);
        }
      } else {
        _stopZoneCountdown();
        if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(null);
      }
      _updateZoneUI();
    }

    // Site settings
    const sSnap = await db.collection('config').doc('siteSettings').get();
    if (sSnap.exists) {
      applySiteConfig(sSnap.data());
      _updateMinOrderUI();
    }

    // Delivery zone polygon
    const dzSnap = await db.collection('config').doc('deliveryZone').get();
    if (dzSnap.exists) {
      const d = dzSnap.data();
      if (d.polygon?.length >= 3)
        deliveryZone = d.polygon.map(p => [p.lat, p.lng]);
    }

  } catch (e) {
    console.warn('[Config] loadConfig error:', e.message);
  }
}

/* ════════════════════════════════════════
   REALTIME LISTENERS
════════════════════════════════════════ */

/** Site settings + category visibility realtime */
function listenToCategorySettings() {
  db.collection('config').doc('siteSettings').onSnapshot(snap => {
    if (!snap.exists) return;
    const d = snap.data();

    applySiteConfig(d);
    _updateMinOrderUI();

    // Category visibility
    const cats = d.categories || {};
    document.querySelectorAll('.top-cat-btn[data-catkey]').forEach(btn => {
      const key = btn.dataset.catkey;

      if (key === 'zone') {
        btn.classList.toggle('hidden-cat', cats.zone === false);
        return;
      }

      const show = cats[key] !== false;
      btn.classList.toggle('hidden-cat', !show);

      // Active cat chhup gayi toh burger pe redirect karo
      if (!show && currentTopCat === key) {
        const vegBtn = document.querySelector('[data-catkey="burger"]');
        if (vegBtn && !vegBtn.classList.contains('hidden-cat'))
          switchTopCat('burger', vegBtn);
      }
    });

    // Cart UI bhi update karo (delivery fee change ho sakti hai)
    if (typeof updateCartUI === 'function') updateCartUI();
  });
}

/** Zone settings realtime */
let _zoneTimerInterval = null;

function _startZoneCountdown(endDate) {
  if (_zoneTimerInterval) clearInterval(_zoneTimerInterval);
  function tick() {
    const diff = endDate - new Date();
    const pill = document.getElementById('zone-timer-pill');
    const timeEl = document.getElementById('zone-timer-time');
    if (diff <= 0) {
      clearInterval(_zoneTimerInterval);
      if (pill) pill.style.display = 'none';
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const str = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (pill) pill.style.display = (typeof currentTopCat !== 'undefined' && currentTopCat === 'zone') ? 'inline-flex' : 'none';
    if (timeEl) timeEl.textContent = str;
  }
  tick();
  _zoneTimerInterval = setInterval(tick, 1000);
}

function _stopZoneCountdown() {
  if (_zoneTimerInterval) { clearInterval(_zoneTimerInterval); _zoneTimerInterval = null; }
  const pill = document.getElementById('zone-timer-pill');
  if (pill) pill.style.display = 'none';
}

function listenToZoneSettings() {
  db.collection('config').doc('zoneSettings').onSnapshot(snap => {
    if (!snap.exists) return;
    const d = snap.data();

    if (d.timerEnd) {
      const _te = d.timerEnd.toDate ? d.timerEnd.toDate() : new Date(d.timerEnd);
      if (_te > new Date()) {
        _startZoneCountdown(_te);
        if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(d.timerEnd);
      } else {
        _stopZoneCountdown();
        if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(null);
      }
    } else {
      _stopZoneCountdown();
      if (typeof setZoneTimerEnd === 'function') setZoneTimerEnd(null);
    }

    const newPrice = d.price    || DEFAULT_ZONE_PRICE;
    const newMax   = d.maxItems || DEFAULT_ZONE_MAX_ITEMS;

    // Sirf tab update karo jab change hua ho
    if (newPrice === ZONE_PRICE && newMax === ZONE_MAX_ITEMS) return;

    applyZoneConfig({ price: newPrice, maxItems: newMax });
    _updateZoneUI();

    // Zone items ka price live update karo
    items = items.map(item => ({
      ...item,
      price: item.zone ? ZONE_PRICE : item.price,
    }));

    if (typeof renderProducts === 'function') renderProducts();
    if (typeof updateCartUI   === 'function') updateCartUI();
  });
}

/** Products realtime listener */
function listenToProducts() {
  db.collection('products')
  .where('available', '==', true)   // sirf active products
  .orderBy('name')
  .onSnapshot(snap => {
    if (snap.empty) {
      items = [];
      const el = document.getElementById('products');
      if (el) el.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--tmut)">No products available.</div>';
      return;
    }

    items = snap.docs.map(doc => mapProduct(doc));

    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderHomeSections === 'function' &&
        typeof currentTopCat !== 'undefined' && currentTopCat === 'all') {
      renderHomeSections();
    }
    if (typeof updateCartUI === 'function') updateCartUI();

  }, err => {
    const el = document.getElementById('products');
    if (el) el.innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--terra)">
         Failed to load products: ${err.message}
       </div>`;
    console.error('[Config] listenToProducts error:', err);
  });
}

/** Home Sections realtime listener — Zone ki tarah */
function listenToHomeSections() {
  db.collection('config').doc('homeSections').onSnapshot(snap => {
    // home-sections.js ka internal cache clear karo
    if (typeof window._hsSetSections === 'function') {
      const sections = (snap.exists && Array.isArray(snap.data().sections))
        ? [...snap.data().sections].sort((a, b) => (a.order || 99) - (b.order || 99))
        : null;
      window._hsSetSections(sections);
    }

    // Festival deal auto-expire check — har snapshot pe
    if (typeof window._hsFestivalExpireCheck === 'function') {
      window._hsFestivalExpireCheck();
    }

    // Re-render if 'all' tab active hai
    if (typeof currentTopCat !== 'undefined' && currentTopCat === 'all') {
      if (typeof renderHomeSections === 'function') renderHomeSections();
    }
  }, err => {
    console.warn('[Config] listenToHomeSections error:', err.message);
  });
}

/* ════════════════════════════════════════
   PRIVATE UI HELPERS (sirf is file mein)
════════════════════════════════════════ */

function _updateZoneUI() {
  const pe = document.getElementById('zone-cat-price');
  const le = document.getElementById('zone-cat-label');
  if (pe) pe.textContent = ZONE_PRICE;
  if (le) le.textContent = ` Best Offers`;
}

function _updateMinOrderUI() {
  const mo = document.getElementById('min-order-amt');
  if (mo) mo.textContent = MIN_ORDER;
}