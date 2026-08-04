/* ═══════════════════════════════════════════════════════════════════
   modules/buy-again.js  —  SabziBuddy
   ─────────────────────────────────────────────────────────────────
   Smart Buy Again Engine
   ✅ Scoring: Frequency × 10 + Recency Bonus
   ✅ Recency: 0-7d=+50, 8-15d=+30, 16-30d=+15, older=+0
   ✅ Only delivered orders
   ✅ Product availability check (available==true, status==active)
   ✅ 12-hour localStorage cache
   ✅ Cache invalidation on new delivery
   ✅ Max 10 products
   ✅ Reuses home-sections.js card UI (no duplicate components)
   ✅ Reuses changeQty() — no new cart logic
   ✅ Zero extra Firebase collections
   ═══════════════════════════════════════════════════════════════════ */

(function () {

  /* ─── Constants ──────────────────────────────────────────── */
  const CACHE_KEY       = 'buyAgainCache';
  const CACHE_TIME_KEY  = 'buyAgainCacheTime';
  const CACHE_DURATION  = 12 * 60 * 60 * 1000;   // 12 hours in ms
  const MAX_PRODUCTS    = 10;
  const SECTION_ID      = 'hs-sec-buyagain';
  const CONTAINER_ID    = 'buy-again-section';

  /* ─── Recency bonus lookup ───────────────────────────────── */
  const _recencyBonus = (daysDiff) => {
    if (daysDiff <= 7)  return 50;
    if (daysDiff <= 15) return 30;
    if (daysDiff <= 30) return 15;
    return 0;
  };

  /* ════════════════════════════════════════════════════════════
     CACHE ENGINE
     ════════════════════════════════════════════════════════════ */

  function _isCacheValid() {
    try {
      const ts = localStorage.getItem(CACHE_TIME_KEY);
      if (!ts) return false;
      return (Date.now() - parseInt(ts, 10)) < CACHE_DURATION;
    } catch (_) { return false; }
  }

  function _getCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _setCache(rankedNames) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rankedNames));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch (_) { /* storage full — silently ignore */ }
  }

  /* Public: call this when order status changes to 'delivered' */
  window.invalidateBuyAgainCache = function () {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIME_KEY);
    } catch (_) {}
  };

  /* ════════════════════════════════════════════════════════════
     RANKING ENGINE
     score = (frequency × 10) + recencyBonus
     ════════════════════════════════════════════════════════════ */

  function _buildScoreMap(deliveredOrders) {
    /* scoreMap: { productName → { freq, lastOrderedMs } } */
    const scoreMap = {};
    const now = Date.now();

    deliveredOrders.forEach(order => {
      const items      = order.items || {};
      const orderTs    = order.timestamp?.seconds
        ? order.timestamp.seconds * 1000
        : (order.timestamp instanceof Date ? order.timestamp.getTime() : now);

      Object.keys(items).forEach(name => {
        if (!name) return;
        if (!scoreMap[name]) {
          scoreMap[name] = { freq: 0, lastOrderedMs: 0 };
        }
        scoreMap[name].freq += 1;
        if (orderTs > scoreMap[name].lastOrderedMs) {
          scoreMap[name].lastOrderedMs = orderTs;
        }
      });
    });

    /* Compute final score for each product */
    const results = [];
    Object.entries(scoreMap).forEach(([name, data]) => {
      const daysDiff   = Math.floor((now - data.lastOrderedMs) / (1000 * 60 * 60 * 24));
      const freqScore  = data.freq * 10;
      const recScore   = _recencyBonus(daysDiff);
      const finalScore = freqScore + recScore;
      results.push({ name, score: finalScore });
    });

    /* Sort DESC by score */
    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.name);  // return ordered product names
  }

  /* ════════════════════════════════════════════════════════════
     PRODUCT FILTERING
     Only available==true and status==active products
     ════════════════════════════════════════════════════════════ */

  function _filterAvailableProducts(rankedNames) {
    const allItems = Array.isArray(window.items) ? window.items : [];
    const result   = [];

    for (const name of rankedNames) {
      if (result.length >= MAX_PRODUCTS) break;

      const product = allItems.find(p => p.name === name);
      if (!product) continue;                               // product missing from catalog
      if (product.available === false) continue;            // explicitly unavailable
      if (product.status && product.status !== 'active') continue;  // inactive
      if (product.outOfStock) continue;                     // out of stock

      result.push(product);
    }
    return result;
  }

  /* ════════════════════════════════════════════════════════════
     FIRESTORE QUERY
     Fetch all delivered orders for current user (by phone)
     ════════════════════════════════════════════════════════════ */

  async function _fetchDeliveredOrders() {
    if (typeof db === 'undefined') return [];

    const phone = window.currentUser?.phone;
    if (!phone) return [];

    try {
      const snap = await db.collection('orders')
        .where('phone', '==', phone)
        .where('status', '==', 'delivered')
        .get();

      return snap.docs.map(d => d.data());
    } catch (err) {
      console.warn('[BuyAgain] Firestore fetch failed:', err);
      return [];
    }
  }

  /* ════════════════════════════════════════════════════════════
     RENDERER
     Reuses _buildCard / _actionsHTML pattern from home-sections.js
     No duplicate UI — same hs-card classes
     ════════════════════════════════════════════════════════════ */

  function _renderBuyAgain(products) {
    /* Find or create the section container */
    let section = document.getElementById(CONTAINER_ID);
    if (!section) return;  // Placeholder not found in HTML

    if (!products || products.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const cards = products.map(_buildBuyAgainCard).join('');

    section.innerHTML = `
      <div class="hs-section" id="${SECTION_ID}">
        <div class="hs-section-head">
          <span class="hs-section-title">🛒 Buy Again</span>
        </div>
        <p class="hs-section-sub">Your favourite products</p>
        <div class="hs-scroll-row">${cards}</div>
      </div>`;
  }

  /* ─── Card builder — mirrors home-sections.js _buildCard() ── */
  /* Reuses SAME hs-card classes, SAME changeQty(), SAME logic   */
  function _buildBuyAgainCard(item) {
    const inCart  = (window.cart && window.cart[item.name]) ? window.cart[item.name].qty : 0;
    const wished  = window.wishlist && window.wishlist.has && window.wishlist.has(item.name);
    const price   = item.price || 0;
    const mrp     = item.mrp   || 0;
    const discPct = (mrp > price && price > 0) ? Math.round((1 - price / mrp) * 100) : 0;

    const id         = 'c' + item.name.replace(/[^a-zA-Z0-9]/g, '');
    const imgUrl     = (Array.isArray(item.images) && item.images[0])
      ? item.images[0]
      : (item.image || '');
    const safeName     = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeNameAttr = item.name.replace(/"/g, '&quot;');

    return `<div class="hs-card" id="ba-card-${id}" data-hs-product="${safeNameAttr}" onclick="openProductDetail('${safeName}')">
      ${discPct > 0 ? `<span class="hs-disc-badge">${discPct}% OFF</span>` : ''}
      <button class="hs-wish-btn wish-btn${wished ? ' wished' : ''}" onclick="event.stopPropagation();toggleWish('${safeName}',event)" aria-label="Save to wishlist">
        <svg viewBox="-0.065 -0.065 2 2" class="bookmark-icon" aria-hidden="true">
          <path d="m1.4804166666666665 1.63625 -0.5454166666666667 -0.3895833333333333 -0.5454166666666667 0.3895833333333333V0.3895833333333333a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 -0.15583333333333332h0.7791666666666666a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 0.15583333333333332z"/>
        </svg>
      </button>
      <div class="hs-card-img-wrap">
        ${imgUrl
          ? `<img src="${imgUrl}" alt="${item.name}" class="hs-card-img" loading="lazy" onerror="this.src='../assets/products/default.webp'">`
          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:36px">🛒</div>`
        }
      </div>
      <div class="hs-card-info">
        <p class="hs-card-name">${item.name}</p>
        <p class="hs-card-weight">${item.weight || ''}</p>
        <div class="hs-card-price-row">
          <span class="hs-card-price">₹${price}</span>
          ${mrp > price ? `<span class="hs-card-mrp">₹${mrp}</span>` : ''}
        </div>
        <div class="hs-card-actions">
          <div id="ba-ctrl-${id}">${_buyAgainActionsHTML(item, inCart)}</div>
        </div>
      </div>
    </div>`;
  }

  /* Same pattern as home-sections.js _actionsHTML() */
  function _buyAgainActionsHTML(item, inCart) {
    const safeName = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const price    = item.price;
    const mrp      = item.mrp || item.price;
    if (inCart > 0) {
      return `<div class="hs-qty-ctrl">
        <button class="hs-qty-btn" onclick="event.stopPropagation();changeQty('${safeName}',${price},${mrp},-1)">−</button>
        <span class="hs-qty-num">${inCart}</span>
        <button class="hs-qty-btn" onclick="event.stopPropagation();changeQty('${safeName}',${price},${mrp},1)">+</button>
      </div>`;
    }
    return `<button class="hs-add-btn" onclick="event.stopPropagation();changeQty('${safeName}',${price},${mrp},1)">+ Add</button>`;
  }

  /* ════════════════════════════════════════════════════════════
     UPDATE CARD (called by changeQty via updateHSCard hook)
     ════════════════════════════════════════════════════════════ */

  window.updateBuyAgainCard = function (name) {
    const allItems  = Array.isArray(window.items) ? window.items : [];
    const item      = allItems.find(i => i.name === name);
    if (!item) return;

    const inCart = (window.cart && window.cart[name]) ? window.cart[name].qty : 0;
    const id     = 'c' + name.replace(/[^a-zA-Z0-9]/g, '');
    const ctrlEl = document.getElementById('ba-ctrl-' + id);
    if (ctrlEl) ctrlEl.innerHTML = _buyAgainActionsHTML(item, inCart);
  };

  /* ════════════════════════════════════════════════════════════
     MAIN INIT — called from home.js after items load
     ════════════════════════════════════════════════════════════ */

  window.initBuyAgain = async function () {
    /* Guard: user must be logged in */
    if (!window.currentUser?.phone) {
      const section = document.getElementById(CONTAINER_ID);
      if (section) section.style.display = 'none';
      return;
    }

    /* ── Cache check ── */
    if (_isCacheValid()) {
      const cachedNames = _getCache();
      if (cachedNames && cachedNames.length > 0) {
        const products = _filterAvailableProducts(cachedNames);
        _renderBuyAgain(products);
        return;
      }
    }

    /* ── Fresh fetch ── */
    const deliveredOrders = await _fetchDeliveredOrders();

    if (!deliveredOrders.length) {
      /* No delivered orders — hide section silently */
      const section = document.getElementById(CONTAINER_ID);
      if (section) section.style.display = 'none';
      return;
    }

    const rankedNames  = _buildScoreMap(deliveredOrders);
    const products     = _filterAvailableProducts(rankedNames);

    /* Cache ranked names (not full product objects — prices change) */
    _setCache(rankedNames);

    _renderBuyAgain(products);
  };

  /* ════════════════════════════════════════════════════════════
     REALTIME DELIVERY LISTENER
     Watches for status changes → 'delivered' → invalidate cache
     ════════════════════════════════════════════════════════════ */

  let _deliveryUnsubscribe = null;

  window.startBuyAgainDeliveryWatch = function () {
    if (typeof db === 'undefined') return;
    const phone = window.currentUser?.phone;
    if (!phone) return;

    /* Unsubscribe previous listener if exists */
    if (_deliveryUnsubscribe) { _deliveryUnsubscribe(); _deliveryUnsubscribe = null; }

    _deliveryUnsubscribe = db.collection('orders')
      .where('phone', '==', phone)
      .where('status', '==', 'delivered')
      .onSnapshot(snap => {
        /* On first call (isEqual check prevents duplicate invalidation) */
        if (snap.metadata.fromCache) return;  // ignore cache snapshots

        /* If any new delivery detected → invalidate cache */
        snap.docChanges().forEach(change => {
          if (change.type === 'added' || change.type === 'modified') {
            window.invalidateBuyAgainCache();
          }
        });
      }, err => {
        console.warn('[BuyAgain] Delivery watch error:', err);
      });
  };

  window.stopBuyAgainDeliveryWatch = function () {
    if (_deliveryUnsubscribe) {
      _deliveryUnsubscribe();
      _deliveryUnsubscribe = null;
    }
  };

})();
