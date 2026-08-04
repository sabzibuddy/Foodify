/* ════════════════════════════════════════
   modules/products.js
   Product rendering + quantity controls.
   Depends on: core/state.js, core/utils.js,
               ui/toast.js, ui/cart-ui.js,
               modules/wishlist.js, modules/notifications.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   RENDER PRODUCTS
════════════════════════════════════════ */
function renderProducts() {
  const hsEl   = document.getElementById('home-sections');
  const prodEl = document.getElementById('products');

  /* Home-sections (per-category "View All" preview carousels) are no
     longer used on the 'All' tab — every tab now shows the full
     single-column listing directly, so this stays hidden. */
  if (hsEl) hsEl.style.display = 'none';

  if (prodEl) prodEl.style.display = '';
  if (typeof renderZoneFlash === 'function') renderZoneFlash();

  const filtered = _getFilteredItems();

  const countEl = document.getElementById('section-count');
  if (countEl) countEl.textContent = `(${filtered.length} items)`;

  if (!prodEl) return;

  if (!filtered.length) {
    prodEl.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--tmut)">No products in this category</div>';
    return;
  }

  prodEl.innerHTML = filtered.map(buildCard).join('');
}

/* ── Filter logic ─────────────────────── */
function _getFilteredItems() {
  if (currentTopCat === 'zone') {
    return items.filter(i => i.zone === true);
  }

  let pool;
  if (currentTopCat === 'all') {
    pool = items.filter(i => !i.zone);
  } else {
    pool = items.filter(i => i.top === currentTopCat && !i.zone);
    if (currentSubCat !== 'all') pool = pool.filter(i => i.cat === currentSubCat);
  }

  // In-stock pehle, out-of-stock baad mein
  const inStock  = pool.filter(i => !i.outOfStock);
  const outStock = pool.filter(i =>  i.outOfStock);
  return [...inStock, ...outStock];
}

/* ════════════════════════════════════════
   BUILD PRODUCT CARD
════════════════════════════════════════ */

/** Category emoji map */
function getCatEmoji(item) {
  const map = {
      leafy: '🥦', root: '🥕', gourds: '🥒', basics: '🧅',
      pizza: '🍕', paneer: '🧀', poha: '🍚', exotic: '🍄',
      thali: '🍛', paratha: '🫓',
      cleaning: '🧹', cookware: '🍳', storage: '🪣',
      detergent: '🧴', decor: '🛋️', pooja: '🪔',
      burger: '🍔', drink: '🥤', 'chole-bhature': '🫘',
    };
  return map[item.cat] || '🥦';
}

/** Safe card ID from product name */
function _cardId(name) {
  return 'c' + name.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Rating badge color tier — higher rating = darker green.
 *   3.0 – 3.9  -> light
 *   4.0 – 4.5  -> dark
 *   4.6 – 5.0  -> darkest
 * Anything below 3.0 still gets the lightest tier (nothing below it).
 */
function getRatingTier(ratingNum) {
  const r = Number.isFinite(ratingNum) ? ratingNum : 0;
  if (r >= 4.6) return 'rt-tier-darkest';
  if (r >= 4.0) return 'rt-tier-dark';
  return 'rt-tier-light';
}

/**
 * Build the product image markup for a card.
 *  - 0 images  -> '' (placeholder emoji shows instead, unchanged behavior)
 *  - 1 image   -> exact same plain <img class="sabzi-img"> as before
 *  - 2+ images -> Swiggy/Zomato style auto-playing carousel wrapper.
 *                 The actual slider behavior (autoplay, viewport pause/resume,
 *                 swipe, animated pagination) is wired up separately, after
 *                 render, by js/modules/product-carousel.js — this function
 *                 only emits the markup so nothing about card rendering
 *                 (grid, filters, search, category page) needs to change.
 */
function _buildCardImageHtml(imgList, id, name) {
  if (!imgList.length) return '';

  const errAttr = `onerror="this.style.display='none';var ph=document.getElementById('ph-${id}');if(ph)ph.style.display='flex';"`;

  if (imgList.length === 1) {
    return `<img class="sabzi-img" src="${imgList[0]}" alt="${name}" loading="lazy" ${errAttr}>`;
  }

  const slides = imgList.map((src, i) => `
      <div class="pc-slide">
        <img class="sabzi-img pc-slide-img"
          ${i === 0 ? `src="${src}"` : `data-src="${src}"`}
          alt="${name}" loading="${i === 0 ? 'eager' : 'lazy'}" ${errAttr}>
      </div>`).join('');

  const dots = imgList.map((_, i) => `
      <span class="pc-dot${i === 0 ? ' active' : ''}"><span class="pc-dot-fill"></span></span>`).join('');

  return `
    <div class="pc-carousel" aria-label="${name} image gallery">
      <div class="pc-track">${slides}</div>
      <div class="pc-pagination">${dots}</div>
    </div>`;
}

/** Build full card HTML */
function buildCard(item) {
  const id       = _cardId(item.name);
  const disc     = (item.mrp || 0) - (item.price || 0);
  const pct      = item.mrp > 0 ? Math.round((disc / item.mrp) * 100) : 0;
  const oos      = item.outOfStock === true;
  const isWished = wishlist.has(item.name);
  const isNew    = item.top === 'paneer';
  const nameSafe = item.name.replace(/'/g, "\\'");

  // Images — prefer images[] array (falls back to single item.image)
  const imgList = (item.images?.length > 0) ? item.images : (item.image ? [item.image] : []);
  const hasImg  = imgList.length > 0;

  // Stock label
  let stockStr = '';
  if (item.stock !== null && item.stock !== undefined) {
    if (item.stock <= 0)      stockStr = 'Out of Stock';
    else if (item.stock <= 5) stockStr = `Only ${item.stock} left!`;
  }

  /* ── Rating (UI only for now — placeholder values until backend wiring) ── */
  const rating      = item.rating != null ? Number(item.rating).toFixed(1) : '4.2';
  const ratingCount = item.ratingCount || '1K+';
  const ratingTier  = getRatingTier(Number(rating));

  /* ── ETA (UI only for now — placeholder value until backend wiring) ── */
  const eta = item.eta || '20-25 mins';

  /* ── Image / carousel with fallback ──
     Single image  -> same plain <img> as before (zero behavior change).
     2+ images     -> Swiggy/Zomato style auto-playing carousel
                      (see js/modules/product-carousel.js + css/product-carousel.css) */
  const imgHtml = _buildCardImageHtml(imgList, id, item.name);

  return `
  <div class="card${oos ? ' out-of-stock' : ''}" id="card-${id}"
    data-name="${item.name}" data-hindi="${item.hindi || ''}"
    data-top="${item.top}" data-cat="${item.cat}"
    onclick="openProductDetail('${nameSafe}')">

    <div class="card-img">
      ${oos ? '<div class="sold-out-label">Sold out</div>' : ''}

      ${!oos && item.mrp > item.price ? `
      <div class="card-img-strip">
        <svg viewBox="0 0 3387 3387" class="cis-veg" aria-hidden="true">
          <rect class="cis-veg-box" x="338" y="320" width="2739" height="2773"/>
          <circle class="cis-veg-dot" cx="1707" cy="1733" r="789"/>
        </svg>
        <span class="cis-name">${item.name}</span>
        <span class="cis-sep">·</span>
        <span class="cis-price">₹${item.price}</span>
        <span class="cis-mrp">₹${item.mrp}</span>
      </div>` : ''}

      <button class="wish-btn${isWished ? ' wished' : ''}"
        onclick="event.stopPropagation();toggleWish('${nameSafe}',event)"
        title="Wishlist" aria-label="Save to wishlist">
        <svg viewBox="-0.065 -0.065 2 2" class="bookmark-icon" aria-hidden="true">
          <path d="m1.4804166666666665 1.63625 -0.5454166666666667 -0.3895833333333333 -0.5454166666666667 0.3895833333333333V0.3895833333333333a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 -0.15583333333333332h0.7791666666666666a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 0.15583333333333332z"/>
        </svg>
      </button>
      ${imgHtml}
      <div class="sabzi-placeholder" id="ph-${id}" style="display:${hasImg ? 'none' : 'flex'}">
        <span style="font-size:30px">${getCatEmoji(item)}</span>
        <span style="font-size:11px">${item.name}</span>
      </div>
    </div>

    <div class="card-body">
      <div class="card-head-row">
        <div class="card-name" title="${item.name}">${item.name}</div>
        <div class="card-rating-col">
          <button type="button" class="rt-badge ${ratingTier}" data-rt-state="left"
            aria-label="Rating ${rating} out of 5, tap to animate"
            onclick="event.stopPropagation();window.RatingBadge&&window.RatingBadge.toggle(this)">
            <span class="rt-badge__track">
              <span class="rt-badge__circle">
                <svg viewBox="0 0 24 24" class="rt-badge__star" aria-hidden="true">
                  <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l7.1-1.01z"/>
                </svg>
              </span>
              <span class="rt-badge__value">${rating}</span>
            </span>
          </button>
          <div class="card-rating-sub" data-rt-sub="by">
            <span class="rt-sub__by">By ${ratingCount}</span>
            <span class="rt-sub__foryou">For you</span>
          </div>
        </div>
      </div>

      <div class="card-fast-row">
        <span class="cfr-item">
          <svg viewBox="0 0 16 16" class="cfr-bolt" aria-hidden="true">
            <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641L5.52.359z"/>
          </svg>
          Near &amp; Fast
        </span>
        <span class="cfr-sep">·</span>
        <span class="cfr-item">
          <svg viewBox="0 0 24 24" class="cfr-clock" aria-hidden="true">
            <path d="M12 4C17.523 4 22 8.477 22 14s-4.477 10-10 10S2 19.523 2 14 6.477 4 12 4zm-1 10a1 1 0 0 0 1 1h4v-2h-3V8h-2v6zM6.707 1.707l-5 5L.293 5.293l5-5 1.414 1.414zm17 3.586-1.414 1.414-5-5 1.414-1.414 5 5z"/>
          </svg>
          <span class="cfr-eta">${eta}</span>
        </span>
      </div>

      <div class="card-meta-row">
        <svg viewBox="0 0 24 24" class="meta-bolt"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>
        <span>${item.weight || ''}${item.weight && stockStr ? ' · ' : ''}${!oos ? stockStr : ''}</span>
      </div>

      ${!oos && pct > 0 ? `
      <div class="card-offer-row">
        <svg viewBox="0 0 14 14" class="cor-icon-svg" aria-hidden="true">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M5.514 0.61a2.395 2.395 0 0 1 3.023 0l.16.13.202-.033a2.395 2.395 0 0 1 2.618 1.512l.073.191.191.073a2.395 2.395 0 0 1 1.512 2.618l-.033.203.13.159a2.395 2.395 0 0 1 0 3.023l-.13.159.033.202a2.395 2.395 0 0 1-1.512 2.618l-.191.073-.073.192a2.395 2.395 0 0 1-2.618 1.511l-.203-.032-.159.129a2.395 2.395 0 0 1-3.023 0l-.159-.13-.202.033a2.395 2.395 0 0 1-2.618-1.511l-.073-.192-.192-.073A2.395 2.395 0 0 1 .76 8.847l.033-.202-.13-.16a2.395 2.395 0 0 1 0-3.022l.13-.16-.033-.202a2.395 2.395 0 0 1 1.51-2.618l.192-.073.073-.191A2.395 2.395 0 0 1 5.153.707l.202.033.16-.13Zm4.454 3.422a.625.625 0 0 0-.884 0l-5 5a.625.625 0 1 0 .884.884l5-5a.625.625 0 0 0 0-.884ZM5.026 3.974a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
        </svg>
        <span>${pct}% OFF · Save ₹${disc} on this item</span>
      </div>` : ''}

      ${!oos && item.tag ? `
      <div class="card-tags-row">
        <span class="card-tag-pill${isNew ? ' new-badge' : ''}">
          <svg viewBox="0 0 16 16" class="ctp-icon" aria-hidden="true">
            <path d="M11.4067 2.004a.667.667 0 0 1 .4907.3067c2.1333 3.378 1.8113 6.964.0293 9.2227-.89 1.1273-2.14 1.914-3.598 2.1467-1.272.202-2.662-.024-4.0627-.7573-.1287.406-.22.8-.2727 1.1713a.667.667 0 1 1-1.32-.188c.0833-.584.242-1.1973.468-1.812-1.0247-1.1267-1.3047-2.552-1.18-3.8253.1373-1.4047.778-2.752 1.612-3.4473 1.1147-.9287 2.2853-1.31 3.3013-1.4967.4913-.09.9527-.136 1.34-.174.3193-.032.6453-.0533.9573-.1307a4.553 4.553 0 0 0 1.308-.544c.2947-.184.546-.5147.9267-.472ZM4.7667 11.6787c.7413-1.5114 1.9533-2.96 3.5313-3.7494a.667.667 0 1 0-.596-1.1926c-1.7387.8693-3.0707 2.3726-3.9367 3.976.182.274.394.525.6333.75.1234.0773.2467.1486.3687.216Z"/>
          </svg>
          Pure Veg
        </span>
      </div>` : ''}
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   QUANTITY CONTROL
════════════════════════════════════════ */

function changeQty(name, price, mrp, ch) {
  const item = items.find(i => i.name === name);
  if (!item) return;

  const currentQty = cart[name]?.qty || 0;
  const newQty     = currentQty + ch;

  if (ch > 0) {
    // Stock check
    if (_isOverStock(item, newQty)) {
      showToast(`⚠️ Only ${item.stock} ${name} available!`, 'error'); return;
    }
    // Zone limit check
    if (item.zone && _isOverZoneLimit(name, ch)) return;
  }

  _applyQty(name, price, mrp, Math.max(0, newQty));
  updateProductCard(name, item);
  updateCartUI();
  // Home sections cards sync karo
  if (typeof window.updateHSCard === 'function') window.updateHSCard(name);
  // Category page open hai toh woh bhi refresh karo
  if (typeof cpRefreshIfOpen === 'function') cpRefreshIfOpen();
}

function setQty(name, price, mrp, newQtyStr) {
  const item = items.find(i => i.name === name);
  if (!item) return;

  let newQty   = Math.max(0, parseInt(newQtyStr) || 0);
  const oldQty = cart[name]?.qty || 0;
  const diff   = newQty - oldQty;
  const id     = _cardId(name);

  if (diff > 0) {
    // Stock check
    if (_isOverStock(item, newQty)) {
      showToast(`⚠️ Only ${item.stock} ${name} available!`, 'error');
      const inp = document.querySelector(`#ctrl-${id} .qo-input`);
      if (inp) inp.value = Math.min(oldQty, item.stock);
      return;
    }
    // Zone limit check
    if (item.zone) {
      const zoneInCart = _getZoneQtyInCart(name, oldQty);
      if (zoneInCart + diff > ZONE_MAX_ITEMS) {
        showToast(`⭐ Maximum ${ZONE_MAX_ITEMS} items allowed from Zone.`, 'error');
        newQty = Math.max(0, ZONE_MAX_ITEMS - zoneInCart);
        const inp = document.querySelector(`#ctrl-${id} .qo-input`);
        if (inp) inp.value = newQty;
        if (newQty === oldQty) return;
      }
    }
  }

  _applyQty(name, price, mrp, newQty);
  updateProductCard(name, item);
  updateCartUI();
}

/** Ctrl HTML ko product card mein update karo
 *  (querySelectorAll — same product Flash Deals strip + #products grid
 *   dono mein dikh sakta hai, duplicate id="ctrl-..." par bhi SAARE
 *   matching elements update honge, sirf pehla wala nahi) */
function updateProductCard(name, item) {
  if (item.outOfStock) return;

  const id  = _cardId(name);
  const els = document.querySelectorAll('[id="ctrl-' + id + '"]');
  if (!els.length) return;

  const q        = cart[name]?.qty || 0;
  const nameSafe = name.replace(/'/g, "\\'");

  const html = q === 0
    ? `<button class="card-add-btn"
        onclick="event.stopPropagation();changeQty('${nameSafe}',${item.price},${item.mrp || item.price},1)">+ Add</button>`
    : `<div class="card-qty-ctrl" onclick="event.stopPropagation()">
        <button class="card-qty-btn" onclick="event.stopPropagation();changeQty('${nameSafe}',${item.price},${item.mrp || item.price},-1)">−</button>
        <span class="card-qty-num">${q}</span>
        <button class="card-qty-btn" onclick="event.stopPropagation();changeQty('${nameSafe}',${item.price},${item.mrp || item.price},1)">+</button>
      </div>`;

  els.forEach(ctrl => { ctrl.innerHTML = html; });
}

/* ════════════════════════════════════════
   PRIVATE QTY HELPERS
════════════════════════════════════════ */

function _applyQty(name, price, mrp, qty) {
  if (qty === 0) { delete cart[name]; }
  else           { cart[name] = { qty, price, mrp }; }
}

function _isOverStock(item, newQty) {
  return item.stock !== null && item.stock !== undefined && newQty > item.stock;
}

/**
 * Zone qty in cart (current item ka old qty exclude karo)
 * @param {string} name    - current item name
 * @param {number} oldQty  - current item ka current qty
 */
function _getZoneQtyInCart(name, oldQty = cart[name]?.qty || 0) {
  return Object.keys(cart)
    .filter(n => items.find(i => i.name === n)?.zone)
    .reduce((sum, n) => sum + (n === name ? oldQty : (cart[n]?.qty || 0)), 0);
}

/**
 * Zone limit cross ho rahi hai?
 * @param {string} name - item being added
 * @param {number} ch   - change (+1)
 */
function _isOverZoneLimit(name, ch) {
  const currentZoneQty = _getZoneQtyInCart(name, cart[name]?.qty || 0);
  if (currentZoneQty + ch > ZONE_MAX_ITEMS) {
    showToast(
      ZONE_MAX_ITEMS === 1
        ? '⭐ Zone se sirf 1 item add ho sakta hai per order!'
        : `⭐ Zone se max ${ZONE_MAX_ITEMS} items allowed hain per order.`,
      'error'
    );
    return true;
  }
  return false;
}