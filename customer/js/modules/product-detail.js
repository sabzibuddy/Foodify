/* ════════════════════════════════════════
   modules/product-detail.js
   Product detail page — render, slider,
   variants, cart controls, collapse sections.
   Depends on: core/state.js, core/utils.js,
               ui/toast.js, modules/products.js,
               modules/wishlist.js, modules/cart.js
════════════════════════════════════════ */

/* ── Page-level state ─────────────────── */
let pdCurrentItem    = null;
let pdSelectedVar    = null;
let pdSelectedVarIdx = 0;
let pdQty            = 1;
let _pdSlideIdx      = 0;

/* ════════════════════════════════════════
   OPEN / CLOSE
════════════════════════════════════════ */
function openProductDetail(itemName) {
  const item = items.find(i => i.name === itemName);
  if (!item) return;

  pdCurrentItem    = item;
  pdQty            = cart[item.name]?.qty || 1;
  pdSelectedVarIdx = 0;
  pdSelectedVar    = item.variants?.length ? item.variants[0] : null;

  /* ✅ Recently Viewed track karo */
  if (typeof RecentlyViewed !== 'undefined') RecentlyViewed.track(item.name);

  _renderPD(item);

  const page = document.getElementById('product-detail-page');
  if (!page) return;
  page.classList.add('open');
  document.body.style.overflow = 'hidden';
  page.querySelector('.pd-scroll')?.scrollTo(0, 0);

  setTimeout(_pdInitSlider, 50);
  if (navigator.vibrate) navigator.vibrate([8]);
}

function closeProductDetail() {
  document.getElementById('product-detail-page')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ════════════════════════════════════════
   RENDER — full HTML builder
════════════════════════════════════════ */
function _renderPD(item) {
  const price   = pdSelectedVar ? pdSelectedVar.price : item.price;
  const mrp     = pdSelectedVar ? (pdSelectedVar.mrp || price) : (item.mrp || item.price);
  const disc    = Math.max(0, mrp - price);
  const discPct = mrp > price ? Math.round((disc / mrp) * 100) : 0;

  const similar = items
    .filter(i => i.top === item.top && i.name !== item.name && !i.outOfStock)
    .slice(0, 4);

  const pdScroll = document.getElementById('pd-scroll');
  if (!pdScroll) return;

  pdScroll.innerHTML = `
    <!-- ── IMAGE SLIDER ── -->
    <div class="pd-img-block">
      <button class="page-back-btn page-back-btn--overlay"
  style="position:absolute;top:14px;left:14px;z-index:10;"
  onclick="closeProductDetail()" aria-label="Back">
  <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
</button>

      ${(item.badge || item.tag || item.label)
        ? `<div class="pd-badge-fresh" style="top:12px;right:12px;left:auto;">${item.badge || item.tag || item.label}</div>`
        : ''}

      <div class="pd-slider-wrap" id="pd-slider-wrap">
        <div class="pd-slides-track" id="pd-slides-track">
          ${_buildSlides(item)}
        </div>
        <div class="pd-slider-dots" id="pd-slider-dots">
          ${_buildDots(item)}
        </div>
      </div>
    </div>

    <!-- ── INFO ── -->
    <div class="pd-info-block">
      <div class="pd-breadcrumb">Home › Products › ${item.name}</div>
      <h1 class="pd-name">${item.name}</h1>
      <div class="pd-sub">${item.weight ? 'Net quantity: ' + item.weight : (item.hindi || '')}</div>

      ${item.rating ? `
      <div class="pd-rating-row">
        <span class="pd-stars">${'★'.repeat(Math.round(item.rating))}${'☆'.repeat(5 - Math.round(item.rating))}</span>
        <span class="pd-rating-num">${item.rating}</span>
        ${item.reviewCount ? `<span class="pd-review-cnt">(${item.reviewCount} reviews)</span>` : ''}
        <span class="pd-in-stock">✓ In Stock</span>
      </div>` : ''}

      <div class="pd-price-row">
        <span class="pd-price" id="pd-price">₹${price}</span>
        ${mrp > price ? `<span class="pd-mrp">₹${mrp}</span>` : ''}
        ${discPct > 0 ? `<span class="pd-off-pill">${discPct}% OFF</span>` : ''}
      </div>

      ${disc > 0 ? `
      <div class="pd-savings-banner">
        <span>You save <strong>₹<span id="pd-savings">${disc}</span></strong> on this order!</span>
      </div>` : ''}

      ${item.variants?.length ? `
      <div class="pd-variants-wrap">
        <div class="pd-variants-label">Quantity / Unit Chunein:</div>
        <div class="pd-variants-row" id="pd-variants-row">
          ${item.variants.map((v, i) => `
            <button class="pd-var-btn ${i === 0 ? 'pd-var-btn--active' : ''}"
              id="pd-var-${i}" onclick="selectPDVariant(${i})">${v.label}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- ── HIGHLIGHTS (open by default) ── -->
    <div class="pd-collapse-block">
      <div class="pd-collapse-header open" id="pd-hl-header"
        onclick="_pdToggleSection('pd-hl-body','pd-hl-header')">
        <span class="pd-collapse-title">Highlights</span>
        <span class="pd-collapse-arrow">${_chevronSVG()}</span>
      </div>
      <div class="pd-collapse-body" id="pd-hl-body">
        ${item.description ? `<p class="pd-desc-text">${item.description}</p>` : ''}
        ${(item.features?.length
            ? item.features
            : ['Farm fresh', '100% natural', 'No preservatives', 'Fresh stock daily']
          ).map(f => `
          <div class="pd-feature-row">
            <div class="pd-feature-tick">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" fill="none" stroke="#329537" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>${f}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- ── INFORMATION (closed by default) ── -->
    ${item.information?.length ? `
    <div class="pd-collapse-block">
      <div class="pd-collapse-header" id="pd-info-header"
        onclick="_pdToggleSection('pd-info-body','pd-info-header')">
        <span class="pd-collapse-title">Information</span>
        <span class="pd-collapse-arrow">${_chevronSVG()}</span>
      </div>
      <div class="pd-collapse-body pd-collapsed" id="pd-info-body">
        ${item.information.map((info, i) => `
          <div class="pd-info-row" style="${i >= 4 ? 'display:none' : ''}" data-info-idx="${i}">
            <span class="pd-info-key">${info.key}</span>
            <span class="pd-info-val">${info.value}</span>
          </div>`).join('')}
        ${item.information.length > 4 ? `
          <button class="pd-info-toggle" id="pd-info-toggle"
            data-expanded="false" onclick="_pdToggleInfo()">View more ▾</button>` : ''}
      </div>
    </div>` : ''}

    <!-- ── SIMILAR PRODUCTS ── -->
    ${similar.length ? `
    <div class="pd-similar-block">
      <div class="pd-similar-header">
        <span class="pd-similar-title">Similar Products</span>
        <button class="pd-similar-link" onclick="closeProductDetail()">View All →</button>
      </div>
      <div class="pd-similar-grid">${similar.map(_buildSimCard).join('')}</div>
    </div>` : ''}

    <div style="height:80px;"></div>`;

  _pdRenderBottomBar(item);
}

/* ════════════════════════════════════════
   BOTTOM BAR
════════════════════════════════════════ */
function _pdRenderBottomBar(item) {
  const bar = document.getElementById('pd-bottom-bar');
  if (!bar) return;

  const cartEntry = cart[item.name];
  const inCart    = cartEntry?.qty > 0;
  if (inCart) pdQty = cartEntry.qty;

  const safe = item.name.replace(/'/g, "\\'");

  bar.innerHTML = `
    <button class="pd-wish-btn" id="pd-wish-btn"
      onclick="toggleWish('${safe}',event);_pdUpdateWish()">
      ${wishlist.has(item.name) ? '❤️' : '🤍'}
    </button>
    <div class="pd-cart-zone" id="pd-cart-zone">
      <button class="pd-view-cart-btn" id="pd-view-cart-btn"
        style="opacity:${inCart ? 1 : 0};pointer-events:${inCart ? 'auto' : 'none'};"
        onclick="openCart()">
        <span class="pd-vc-badge" id="pd-vc-badge">${inCart ? cartEntry.qty : 1}</span>
        🛒 View Cart
      </button>
      <div class="pd-qty-ctrl pd-qty-ctrl--zepto" id="pd-qty-static"
        style="opacity:${inCart ? 1 : 0};pointer-events:${inCart ? 'auto' : 'none'};">
        <button class="pd-qty-btn" onclick="pdChangeQtyZ(-1)">−</button>
        <span class="pd-qty-num" id="pd-qty-num">${inCart ? cartEntry.qty : 1}</span>
        <button class="pd-qty-btn" onclick="pdChangeQtyZ(1)">+</button>
      </div>
      <button class="pd-add-full" id="pd-add-main-btn"
        style="display:${inCart ? 'none' : 'flex'};"
        onclick="pdAddToCartZepto()">🛒 Add to Cart</button>
    </div>`;
}

/* ════════════════════════════════════════
   VARIANTS
════════════════════════════════════════ */
function selectPDVariant(idx) {
  if (!pdCurrentItem?.variants) return;
  pdSelectedVarIdx = idx;
  pdSelectedVar    = pdCurrentItem.variants[idx];

  document.querySelectorAll('.pd-var-btn').forEach((btn, i) =>
    btn.classList.toggle('pd-var-btn--active', i === idx));

  _pdRefreshPrice();
  if (navigator.vibrate) navigator.vibrate([8]);
}

function _pdRefreshPrice() {
  if (!pdCurrentItem) return;
  const price = pdSelectedVar ? pdSelectedVar.price : pdCurrentItem.price;
  const mrp   = pdSelectedVar ? (pdSelectedVar.mrp || price) : (pdCurrentItem.mrp || price);
  const disc  = Math.max(0, mrp - price);

  const priceEl   = document.getElementById('pd-price');
  const savingsEl = document.getElementById('pd-savings');
  if (priceEl)   priceEl.textContent   = '₹' + price;
  if (savingsEl) savingsEl.textContent = disc;
}

/* ════════════════════════════════════════
   WISHLIST
════════════════════════════════════════ */
function _pdUpdateWish() {
  if (!pdCurrentItem) return;
  const btn = document.getElementById('pd-wish-btn');
  if (btn) btn.textContent = wishlist.has(pdCurrentItem.name) ? '❤️' : '🤍';
}

/* ════════════════════════════════════════
   SLIDER
════════════════════════════════════════ */
function _pdGoSlide(idx) {
  _pdSlideIdx = idx;
  const track = document.getElementById('pd-slides-track');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.querySelectorAll('.pd-sdot').forEach((d, i) =>
    d.classList.toggle('pd-sdot--active', i === idx));
}

function _pdInitSlider() {
  _pdSlideIdx = 0;
  const wrap = document.getElementById('pd-slider-wrap');
  if (!wrap) return;
  let startX = 0;
  wrap.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const diff  = startX - e.changedTouches[0].clientX;
    const total = document.querySelectorAll('.pd-slide').length;
    if (Math.abs(diff) > 40) {
      _pdSlideIdx = diff > 0
        ? Math.min(_pdSlideIdx + 1, total - 1)
        : Math.max(_pdSlideIdx - 1, 0);
      _pdGoSlide(_pdSlideIdx);
    }
  }, { passive: true });
}

/* ════════════════════════════════════════
   CART — Zepto-style add + qty
════════════════════════════════════════ */
function pdAddToCartZepto() {
  if (!pdCurrentItem) return;
  pdQty = 1;
  const price = pdSelectedVar ? pdSelectedVar.price : pdCurrentItem.price;
  const mrp   = pdSelectedVar ? (pdSelectedVar.mrp || price) : (pdCurrentItem.mrp || price);
  changeQty(pdCurrentItem.name, price, mrp, 1);

  const addBtn  = document.getElementById('pd-add-main-btn');
  const viewBtn = document.getElementById('pd-view-cart-btn');
  const qtyCtrl = document.getElementById('pd-qty-static');

  if (addBtn) {
    addBtn.style.left = 'calc(100% - 116px)';
    if (viewBtn) { viewBtn.style.opacity = '1'; viewBtn.style.pointerEvents = 'auto'; }
    setTimeout(() => {
      addBtn.style.display = 'none';
      if (qtyCtrl) { qtyCtrl.style.opacity = '1'; qtyCtrl.style.pointerEvents = 'auto'; }
    }, 420);
  }

  _pdUpdateBadge();
  showToast(`✅ ${pdCurrentItem.name} added to cart!`, 'success');
  if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
}

function pdChangeQtyZ(ch) {
  if (!pdCurrentItem) return;
  const price = pdSelectedVar ? pdSelectedVar.price : pdCurrentItem.price;
  const mrp   = pdSelectedVar ? (pdSelectedVar.mrp || price) : (pdCurrentItem.mrp || price);
  pdQty = Math.max(0, pdQty + ch);

  if (pdQty === 0) {
    const addBtn  = document.getElementById('pd-add-main-btn');
    const viewBtn = document.getElementById('pd-view-cart-btn');
    const qtyCtrl = document.getElementById('pd-qty-static');
    if (qtyCtrl) { qtyCtrl.style.opacity = '0'; qtyCtrl.style.pointerEvents = 'none'; }
    if (viewBtn) { viewBtn.style.opacity = '0'; viewBtn.style.pointerEvents = 'none'; }
    setTimeout(() => {
      if (addBtn) {
        addBtn.style.transition = 'none';
        addBtn.style.left       = 'calc(100% - 116px)';
        addBtn.style.display    = 'flex';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          addBtn.style.transition = 'left 0.42s cubic-bezier(0.4,0,0.2,1)';
          addBtn.style.left       = '0';
        }));
      }
    }, 150);
    changeQty(pdCurrentItem.name, price, mrp, -1);
    pdQty = 1;
    return;
  }

  changeQty(pdCurrentItem.name, price, mrp, ch);
  const numEl = document.getElementById('pd-qty-num');
  if (numEl) numEl.textContent = pdQty;
  _pdUpdateBadge();
  if (navigator.vibrate) navigator.vibrate([6]);
}

function _pdUpdateBadge() {
  const badge = document.getElementById('pd-vc-badge');
  if (badge) badge.textContent = pdQty;
}

/* ════════════════════════════════════════
   COLLAPSE SECTIONS
════════════════════════════════════════ */
function _pdToggleSection(bodyId, headerId) {
  const body   = document.getElementById(bodyId);
  const header = document.getElementById(headerId);
  if (!body || !header) return;

  const isCollapsed = body.classList.contains('pd-collapsed');
  body.classList.toggle('pd-collapsed', !isCollapsed);
  header.classList.toggle('open', isCollapsed);

  if (navigator.vibrate) navigator.vibrate([6]);
}

/* BUG FIX: pehle _pdInfoExpanded global variable tha config.js mein
   Ab properly data-attribute se track karta hai */
function _pdToggleInfo() {
  const btn  = document.getElementById('pd-info-toggle');
  if (!btn) return;
  const isExpanded = btn.dataset.expanded === 'true';

  document.querySelectorAll('[data-info-idx]').forEach(row => {
    const idx = parseInt(row.dataset.infoIdx);
    if (idx >= 4) row.style.display = isExpanded ? 'none' : 'flex';
  });

  btn.dataset.expanded = isExpanded ? 'false' : 'true';
  btn.textContent      = isExpanded ? 'View more ▾' : 'View less ▴';
}

/* ════════════════════════════════════════
   PRIVATE HTML BUILDERS
════════════════════════════════════════ */
function _buildSlides(item) {
  const imgs = item.images?.length ? item.images : (item.image ? [item.image] : []);
  if (!imgs.length) return `
    <div class="pd-slide">
      <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:90px;">
        ${getCatEmoji(item)}
      </div>
    </div>`;
  return imgs.map(src => `
    <div class="pd-slide">
      <img src="${src}" class="pd-main-img" alt="${item.name}" onerror="this.style.display='none'">
    </div>`).join('');
}

function _buildDots(item) {
  const count = item.images?.length || (item.image ? 1 : 0);
  if (count <= 1) return '';
  return Array.from({ length: count }, (_, i) => `
    <div class="pd-sdot ${i === 0 ? 'pd-sdot--active' : ''}"
      onclick="_pdGoSlide(${i})"></div>`).join('');
}

function _buildSimCard(si) {
  const sp    = si.price;
  const sm    = si.mrp || sp;
  const sdisc = sm > sp ? Math.round(((sm - sp) / sm) * 100) : 0;
  const safe  = si.name.replace(/'/g, "\\'");

  return `
    <div class="pd-sim-card" onclick="openProductDetail('${safe}')">
      <div class="pd-sim-img">
        ${sdisc > 0 ? `<div class="pd-sim-disc">-${sdisc}%</div>` : ''}
        ${si.image
          ? `<img src="${si.image}"
              style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div style="display:none;position:absolute;inset:0;font-size:40px;align-items:center;justify-content:center;">${getCatEmoji(si)}</div>`
          : `<div style="position:absolute;inset:0;font-size:40px;display:flex;align-items:center;justify-content:center;">${getCatEmoji(si)}</div>`}
      </div>
      <div class="pd-sim-body">
        <div class="pd-sim-name">${si.name}</div>
        <div class="pd-sim-wt">${si.weight || ''}</div>
        <div class="pd-sim-price-row">
          <span class="pd-sim-price">₹${sp}</span>
          ${sm > sp ? `<span class="pd-sim-mrp">₹${sm}</span>` : ''}
        </div>
        <button class="pd-sim-add"
          onclick="event.stopPropagation();changeQty('${safe}',${sp},${sm},1);showToast('${safe} added to cart! 🛒','success');">
          + Add
        </button>
      </div>
    </div>`;
}

function _chevronSVG() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#7A9186" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;
}
