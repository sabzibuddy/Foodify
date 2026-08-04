/* ════════════════════════════════════════
   modules/wishlist.js
   Wishlist add/remove + UI sync.
   Depends on: core/state.js, core/storage.js,
               ui/toast.js, ui/auth-ui.js
════════════════════════════════════════ */

/**
 * Wishlist toggle karo
 * @param {string} name   - product name
 * @param {Event}  [e]    - click event (stopPropagation ke liye)
 */
function toggleWish(name, e) {
  if (e) e.stopPropagation();

  if (wishlist.has(name)) {
    wishlist.delete(name);
    showToast('💔 Removed from wishlist');
  } else {
    wishlist.add(name);
    showToast('❤️ Added to wishlist!', 'success');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
  }

  // Persist + badge update
  saveWishlist();

  // Card ke heart button update karo (agar visible hai)
  _updateWishCardUI(name);
}

/* ── Card UI sync ─────────────────────── */
function _updateWishCardUI(name) {
  const id = 'c' + name.replace(/[^a-zA-Z0-9]/g, '');
  const isWished = wishlist.has(name);

  // Home page pe ek hi product multiple sections mein duplicate ho sakta hai
  // (Trending Now / Recently Viewed + apni category section) — getElementById
  // sirf PEHLA match deta hai, isliye querySelectorAll se SAARE matching
  // cards (duplicate IDs) ka heart icon ek saath live update karo
  document.querySelectorAll('[id="card-' + id + '"]').forEach(card => {
    const btn = card.querySelector('.wish-btn');
    if (!btn) return;
    btn.classList.toggle('wished', isWished);
  });
}

/* ── Product Detail page wish button sync */
function updatePDWishBtn(name) {
  const btn = document.getElementById('pd-wish-btn');
  if (!btn) return;
  const isWished = wishlist.has(name);
  btn.textContent = isWished ? '❤️' : '🤍';
  btn.title       = isWished ? 'Remove from wishlist' : 'Add to wishlist';
}

/* ── Wishlist page items render kar ──── */
function getWishlistItems() {
  return [...wishlist]
    .map(name => items.find(i => i.name === name))
    .filter(Boolean);
}

/* ════════════════════════════════════════
   MOVE ALL TO CART
════════════════════════════════════════ */
function moveAllToCart() {
  const wishItems = getWishlistItems();
  if (!wishItems.length) return;

  let added = 0;
  wishItems.forEach(item => {
    if (!cart[item.name] || cart[item.name].qty === 0) {
      changeQty(item.name, item.price, item.mrp || item.price, 1);
      added++;
    }
  });

  updateCartUI();
  renderWishlistPageBody();

  if (added > 0) {
    showToast(`🛒 ${added} item${added > 1 ? 's' : ''} added to cart!`, 'success');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
  } else {
    showToast('All items already in cart!');
  }
}

/* ════════════════════════════════════════
   WISHLIST PAGE
   (page open/close + render)
════════════════════════════════════════ */
function openWishlistPage() {
  const page = document.getElementById('wishlist-page');
  if (!page) return;
  document.body.appendChild(page);

  /*
   * ✅ FIX EXPLANATION:
   * CSS class `.profile-page` pe pehle se display:flex + flex-direction:column hai.
   * Inline cssText sirf position/transform/transition override karta hai.
   * Isliye display:flex yahan dobara likhna zaroori nahi — but explicit rakhna safe hai.
   */
  page.style.cssText = 'position:fixed;inset:0;z-index:99999;transform:translateX(100%);transition:transform 0.35s ease;display:flex;flex-direction:column;overflow:hidden;';

  requestAnimationFrame(() => { page.style.transform = 'translateX(0)'; });
  document.body.style.overflow = 'hidden';
  renderWishlistPageBody();
  if (navigator.vibrate) navigator.vibrate([10]);
}

function closeWishlistPage() {
  const page = document.getElementById('wishlist-page');
  if (!page) return;
  page.style.transform = 'translateX(100%)';
  const bar = document.getElementById('wish-cart-bar');
  if (bar) bar.style.display = 'none';
  setTimeout(() => { page.style.cssText = ''; }, 380);
  const cartOpen = document.getElementById('cart-panel')?.classList.contains('open');
  document.body.style.overflow = cartOpen ? 'hidden' : '';
  updateWishBadge();
}

function renderWishlistPageBody() {
  const body = document.getElementById('wishlist-page-body');
  if (!body) return;

  /*
   * ✅ STICKY FIX — ROOT CAUSE:
   * Pehle `.wish-action-bar` ko `#wishlist-page-body` ke ANDAR daala jata tha.
   * `#wishlist-page` pe `overflow:hidden` hone ki wajah se browser sticky ka
   * scroll container `#wishlist-page` ko maanta tha (jo khud scroll nahi karta)
   * — isliye `position:sticky` kaam nahi karta tha.
   *
   * SOLUTION:
   * Action bar ko `#wishlist-page-body` ke BAHAR, uske SIBLING ke roop mein
   * rakho. Ab page structure ban jaata hai:
   *
   *   #wishlist-page  (display:flex; flex-direction:column)
   *   ├── .pp-header           (flex-shrink:0  — green header, fixed)
   *   ├── #wish-action-bar-sticky  (flex-shrink:0  — NAHI scroll hoga)
   *   └── #wishlist-page-body  (flex:1; overflow-y:auto — SIRF yahi scroll karta hai)
   *
   * Action bar ab scroll container ke bahar hai, toh sticky CSS ki zaroorat
   * hi nahi — yeh naturally fixed rehta hai.
   */

  // ─── Sticky action bar div: ek baar create, phir sirf update ───────────
  let stickyBar = document.getElementById('wish-action-bar-sticky');
  if (!stickyBar) {
    stickyBar = document.createElement('div');
    stickyBar.id = 'wish-action-bar-sticky';
    // body ke THEEK PEHLE insert karo (header ke baad, body se pehle)
    body.parentNode.insertBefore(stickyBar, body);
  }

  // ─── Body scrollable area ───────────────────────────────────────────────
  body.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0;background:var(--cream);';

  // ─── Empty state ────────────────────────────────────────────────────────
  if (!wishlist.size) {
    // Action bar hide karo
    stickyBar.innerHTML = '';
    stickyBar.style.cssText = 'display:none;';

    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🤍</div>
        <div style="font-weight:700;margin-bottom:6px;color:#9ca3af;font-size:20px;font-family:'Outfit',sans-serif;">Wishlist is empty!</div>
        <div style="font-size:16px;color:#9ca3af;line-height:1.5;">Save products to your Wishlist.</div>
      </div>`;
    _updateWishCartBar();
    return;
  }

  // ─── Action bar (header ke neeche, scroll se bahar) ─────────────────────
  const inCartCount = [...wishlist].filter(name => cart[name]?.qty > 0).length;
  const allInCart   = inCartCount === wishlist.size;

  stickyBar.style.cssText = 'flex-shrink:0;background:#fff;border-bottom:1.5px solid var(--cream2);box-shadow:0 2px 8px rgba(0,0,0,0.06);';
  stickyBar.innerHTML = `
    <div class="wish-action-bar" style="position:static;">
      <div class="wish-count-label">
        ❤️ <strong>${wishlist.size}</strong> item${wishlist.size > 1 ? 's' : ''}
        ${inCartCount > 0
          ? `<span class="wish-in-cart-note">${inCartCount} already in cart</span>`
          : ''}
      </div>
      <button class="wish-move-all-btn ${allInCart ? 'all-in-cart' : ''}"
        onclick="moveAllToCart()"
        ${allInCart ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        ${allInCart ? 'All in Cart ✓' : 'Move All to Cart'}
      </button>
    </div>`;

  // ─── Product grid (sirf yahi scroll hoga) ─────────────────────────────
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 12px 160px;">
      ${[...wishlist].map(name => _wishCard(name)).join('')}
    </div>`;

  _updateWishCartBar();
}

function _wishCard(name) {
  const item = items.find(i => i.name === name);
  if (!item) return '';

  const safe   = name.replace(/'/g, "\\'");
  const imgSrc = item.images?.length > 0 ? item.images[0] : (item.image || '');
  const qty    = cart[name]?.qty || 0;
  const disc   = item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;

  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
    : `<span style="font-size:32px;">${getCatEmoji(item)}</span>`;

  const addBtn = qty > 0
    ? `<div class="card-qty-ctrl" onclick="event.stopPropagation()">
        <button class="card-qty-btn" onclick="event.stopPropagation();changeQty('${safe}',${item.price},${item.mrp||item.price},-1);updateCartUI();renderWishlistPageBody();">−</button>
        <span class="card-qty-num">${qty}</span>
        <button class="card-qty-btn" onclick="event.stopPropagation();changeQty('${safe}',${item.price},${item.mrp||item.price},1);updateCartUI();renderWishlistPageBody();">+</button>
      </div>`
    : `<button class="card-add-btn" onclick="event.stopPropagation();changeQty('${safe}',${item.price},${item.mrp||item.price},1);updateCartUI();renderWishlistPageBody();">+ Add</button>`;

  return `
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
      <div style="position:relative;">
        <div style="width:100%;aspect-ratio:1;background:var(--cream2);display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${imgHtml}
        </div>
        <button onclick="wishlist.delete('${safe}');saveWishlist();renderWishlistPageBody();"
          style="position:absolute;top:8px;left:8px;background:rgba(255,255,255,0.9);border:none;
          border-radius:50%;width:28px;height:28px;font-size:14px;cursor:pointer;display:flex;
          align-items:center;justify-content:center;">❤️</button>
        ${disc > 0 ? `<div style="position:absolute;bottom:8px;left:8px;background:#e8f5e9;
          color:var(--g2);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">${disc}% OFF</div>` : ''}
      </div>
      <div style="padding:8px 10px 10px;">
        ${item.weight ? `<div style="font-size:11px;color:var(--tmut);margin-bottom:2px;">${item.weight}</div>` : ''}
        <div style="font-size:12px;font-weight:600;color:var(--td);line-height:1.3;margin-bottom:6px;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:14px;font-weight:700;color:var(--td);">₹${item.price}</span>
            ${item.mrp > item.price
              ? `<span style="font-size:11px;color:var(--tmut);text-decoration:line-through;">₹${item.mrp}</span>`
              : ''}
          </div>
        </div>
        ${addBtn}
      </div>
    </div>`;
}

function _updateWishCartBar() {
  const page = document.getElementById('wishlist-page');
  if (!page) return;

  let bar = document.getElementById('wish-cart-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'wish-cart-bar';
    page.appendChild(bar);
  }

  const count = getCartCount();
  const saved = Object.entries(cart).reduce((sum, [n, { qty, price }]) => {
    const it = items.find(p => p.name === n);
    return sum + ((it?.mrp || price) - price) * qty;
  }, 0);

  if (!count) { bar.style.display = 'none'; return; }

  const allCartNames = Object.keys(cart);
  const cartNames    = allCartNames.slice(0, 3);
  const thumbHtml    = `
    <div style="position:relative;width:${40 + (cartNames.length - 1) * 18}px;height:40px;flex-shrink:0;">
      ${cartNames.map((n, i) => {
        const it  = items.find(p => p.name === n);
        const src = it?.images?.[0] || it?.image || '';
        return src
          ? `<img src="${src}" style="position:absolute;left:${i * 18}px;top:0;width:40px;height:40px;object-fit:cover;border-radius:8px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.15);" onerror="this.style.display='none'">`
          : `<span style="position:absolute;left:${i * 18}px;top:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--cream2);border-radius:8px;border:2px solid #fff;font-size:20px;">${it ? getCatEmoji(it) : '🛒'}</span>`;
      }).join('')}
    </div>`;

  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--cream2);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;z-index:100000;box-shadow:0 -4px 20px rgba(0,0,0,0.12);';

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:center;">
        ${thumbHtml}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--td);">
          ${count} item${count > 1 ? 's' : ''}
        </div>
        ${saved > 0
          ? `<div style="font-size:11px;color:var(--g2);font-weight:600;">You save ₹${saved}</div>`
          : ''}
      </div>
    </div>
    <button onclick="closeWishlistPage();setTimeout(openCart,350);"
      style="background:var(--g2);color:#fff;border:none;border-radius:50px;
      padding:12px 24px;font-family:'Outfit',sans-serif;
      font-size:14px;font-weight:700;cursor:pointer;">
      View Cart
    </button>`;
}