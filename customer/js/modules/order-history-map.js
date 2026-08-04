/* ═══════════════════════════════════════════════════════════════════
   modules/order-history-map.js  —  SabziBuddy
   ─────────────────────────────────────────────────────────────────
   Last Ordered Badge Engine
   ✅ Fetches current user's DELIVERED orders only (orders collection)
   ✅ Builds map: productName -> lastOrderedTimestamp(ms)
   ✅ Badge text: "Last ordered today / yesterday / X days ago"
   ✅ Badge shows ONLY if product was previously ordered
   ✅ 12-hour localStorage cache (per logged-in phone)
   ✅ Zero new Firestore collections — reuses existing "orders" collection
   ✅ Customer can only see their OWN orders (query filtered by phone,
      same pattern already used by order-history.js / buy-again.js;
      real enforcement still lives in firestore.rules on the backend)
   ═══════════════════════════════════════════════════════════════════ */

(function () {

  /* ─── Constants ──────────────────────────────────────────── */
  const CACHE_PREFIX   = 'sb_lastOrderedMap_';   // + phone  => one cache slot per user
  const CACHE_DURATION = 12 * 60 * 60 * 1000;    // 12 hours in ms

  /* In-memory map, read synchronously by card renderers.
     Shape: { "Tomato": 1750000000000, "Onion": 1749000000000, ... } */
  window.lastOrderedMap = window.lastOrderedMap || {};

  /* ════════════════════════════════════════════════════════════
     CACHE ENGINE  (namespaced per phone — har user ka apna slot)
     ════════════════════════════════════════════════════════════ */

  function _cacheKey(phone) {
    return CACHE_PREFIX + phone;
  }

  function _getCache(phone) {
    try {
      const raw = localStorage.getItem(_cacheKey(phone));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _isCacheValid(cached) {
    return !!(cached && cached.ts && (Date.now() - cached.ts) < CACHE_DURATION);
  }

  function _setCache(phone, map) {
    try {
      localStorage.setItem(_cacheKey(phone), JSON.stringify({ ts: Date.now(), map }));
    } catch (_) { /* storage full — silently ignore */ }
  }

  /* Public: call this when an order moves to 'delivered' (or on logout)
     so stale data doesn't leak into the next session. */
  window.invalidateLastOrderedMapCache = function (phone) {
    try {
      const p = phone || window.currentUser?.phone;
      if (p) localStorage.removeItem(_cacheKey(p));
    } catch (_) {}
  };

  /* ════════════════════════════════════════════════════════════
     FIRESTORE QUERY
     Only delivered orders, only for the current logged-in phone.
     ════════════════════════════════════════════════════════════ */

  async function _fetchDeliveredOrders(phone) {
    if (typeof db === 'undefined' || !phone) return [];

    try {
      const snap = await db.collection('orders')
        .where('phone', '==', phone)
        .where('status', '==', 'delivered')
        .get();

      return snap.docs.map(d => d.data());
    } catch (err) {
      console.warn('[LastOrderedMap] Firestore fetch failed:', err);
      return [];
    }
  }

  /* ════════════════════════════════════════════════════════════
     MAP BUILDER
     productName -> latest delivered-order timestamp (ms)
     ════════════════════════════════════════════════════════════ */

  function _buildLastOrderedMap(deliveredOrders) {
    const map = {};

    deliveredOrders.forEach(order => {
      const items = order.items || {};
      const ts = order.timestamp?.seconds
        ? order.timestamp.seconds * 1000
        : (order.timestamp instanceof Date ? order.timestamp.getTime() : 0);

      if (!ts) return; // can't trust an order with no date

      Object.keys(items).forEach(name => {
        if (!name) return;
        if (!map[name] || ts > map[name]) map[name] = ts;
      });
    });

    return map;
  }

  /* ════════════════════════════════════════════════════════════
     DATE LABEL FORMATTER
     today / yesterday / X days ago  (calendar-day based, not 24hr-based,
     so "ordered at 11pm yesterday, now it's 1am" still says "yesterday")
     ════════════════════════════════════════════════════════════ */

  function _daysAgo(ms) {
    const o  = new Date(ms);
    const n  = new Date();
    const d1 = new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime();
    const d2 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return Math.max(0, Math.round((d2 - d1) / 86400000));
  }

  function _formatLastOrderedLabel(ms) {
    const days = _daysAgo(ms);
    if (days === 0) return 'Last ordered today';
    if (days === 1) return 'Last ordered yesterday';
    return `Last ordered ${days} days ago`;
  }
  window.formatLastOrderedLabel = _formatLastOrderedLabel; // exposed for product-detail page etc.

  /* ════════════════════════════════════════════════════════════
     BADGE RENDERER
     Returns '' when product was never ordered (badge stays hidden)
     ════════════════════════════════════════════════════════════ */

  window.getLastOrderedBadgeHTML = function (productName) {
    const ms = (window.lastOrderedMap || {})[productName];
    if (!ms) return '';
    return `<div class="last-ordered-badge">🔁 ${_formatLastOrderedLabel(ms)}</div>`;
  };

  /* One-time CSS injection so products.js / home-sections.js don't
     need a separate stylesheet edit just for this badge. */
  function _injectBadgeCSS() {
    if (document.getElementById('lo-badge-style')) return;
    const style = document.createElement('style');
    style.id = 'lo-badge-style';
    style.textContent = `
      .last-ordered-badge {
        font-size: 10px;
        font-weight: 600;
        color: var(--g4, #5a7d63);
        background: rgba(90,125,99,0.08);
        border-radius: 5px;
        padding: 2px 6px;
        margin: 2px 0 3px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        width: fit-content;
        white-space: nowrap;
      }`;
    document.head.appendChild(style);
  }
  _injectBadgeCSS();

  /* ════════════════════════════════════════════════════════════
     RE-RENDER HOOK
     Map fetch is async — if product cards already rendered before
     it resolves, re-render once data is ready so badges show up.
     ════════════════════════════════════════════════════════════ */

  function _refreshProductCardBadges() {
    if (typeof window.renderProducts === 'function') window.renderProducts();
    if (typeof window.renderHomeSections === 'function' &&
        typeof window.currentTopCat !== 'undefined' && window.currentTopCat === 'all') {
      window.renderHomeSections();
    }
  }

  /* ════════════════════════════════════════════════════════════
     MAIN INIT — called from config.js auth listener (login)
     ════════════════════════════════════════════════════════════ */

  window.initLastOrderedMap = async function (forceRefresh = false) {
    const phone = window.currentUser?.phone;
    if (!phone) { window.lastOrderedMap = {}; return; }

    /* ── Cache check (skip if forced) ── */
    if (!forceRefresh) {
      const cached = _getCache(phone);
      if (_isCacheValid(cached)) {
        window.lastOrderedMap = cached.map || {};
        _refreshProductCardBadges();
        return;
      }
    }

    /* ── Fresh fetch ── */
    const deliveredOrders = await _fetchDeliveredOrders(phone);
    const map = _buildLastOrderedMap(deliveredOrders);

    window.lastOrderedMap = map;
    _setCache(phone, map);
    _refreshProductCardBadges();
  };

})();
