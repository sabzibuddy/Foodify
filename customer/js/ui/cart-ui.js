/* ════════════════════════════════════════
   ui/cart-ui.js
   Cart DOM rendering — items list, bill summary, FD bars.
   Depends on: core/state.js, core/utils.js,
               modules/products.js (getCatEmoji, changeQty)
════════════════════════════════════════ */

/* ════════════════════════════════════════
   MAIN CART UI UPDATE
════════════════════════════════════════ */
function updateCartUI() {
  const subtotal    = getCartSubtotal();
  const itemCount   = getCartCount();
  const origDelivery = DELIVERY_FEE;
  const discDelivery = (typeof deliveryFeeDiscounted !== 'undefined' && deliveryFeeDiscounted > 0 && deliveryFeeDiscounted < origDelivery)
    ? deliveryFeeDiscounted : origDelivery;
  const deliveryFee = itemCount > 0
    ? (subtotal >= FREE_THRESHOLD ? 0 : discDelivery)
    : 0;
  const grandTotal  = Math.max(0, subtotal + deliveryFee - (couponDiscount || 0));

  /* ── Total savings: sabhi components ── */
  const mrpSavings      = Object.entries(cart).reduce((sum, [name, { qty, price }]) => {
    const item = items.find(p => p.name === name);
    return sum + ((item?.mrp || price) - price) * qty;
  }, 0);
  const deliverySavings = deliveryFee === 0 && subtotal > 0 ? DELIVERY_FEE : 0;
  const handlingSavings = subtotal > 0 ? HANDLING_FEE : 0;
  const couponSavings   = couponDiscount || 0;
  const totalSaved      = mrpSavings + deliverySavings + handlingSavings + couponSavings;

  _updateBadge(itemCount);
  _updateHeaderTotal(itemCount, grandTotal);
  _updateFooterTotal(grandTotal);
  _updateMinOrderNotice(itemCount, subtotal);
  _updateBillSummary(itemCount, subtotal, deliveryFee, grandTotal);
  _updateItemsList(itemCount);
  _updateSavingsBanner(itemCount, totalSaved);   // ✅ ab sahi full amount jayega
  _persistCart();
  updateAllFD(subtotal);
}

/* ── Badge (header cart count) ─────────── */
function _updateBadge(count) {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  badge.textContent = count;
  if (count > 0) {
    badge.classList.add('animate');
    setTimeout(() => badge.classList.remove('animate'), 350);
  }
}

/* ── Header total pill ─────────────────── */
function _updateHeaderTotal(count, grand) {
  const hdr = document.getElementById('cart-total-header');
  if (!hdr) return;
  if (count > 0) { hdr.style.display = 'block'; hdr.textContent = `₹${grand}`; }
  else             hdr.style.display = 'none';
}

/* ── Footer "To Pay" ──────────────────── */
function _updateFooterTotal(grand) {
  const el = document.getElementById('cart-total');
  if (el) el.textContent = grand;
}

/* ── Min order notice ─────────────────── */
function _updateMinOrderNotice(count, subtotal) {
  const el  = document.getElementById('min-order-notice');
  const btn = document.getElementById('proceed-btn');
  const belowMin = count > 0 && subtotal < MIN_ORDER;

  if (el) el.style.display = belowMin ? 'block' : 'none';

  if (btn) {
    btn.disabled      = belowMin || count === 0;
    btn.style.opacity = (belowMin || count === 0) ? '0.5' : '1';
    btn.style.cursor  = (belowMin || count === 0) ? 'not-allowed' : 'pointer';
    btn.style.filter  = (belowMin || count === 0) ? 'grayscale(0.5)' : '';
  }
}

/* ── Bill Summary block ───────────────── */
function _updateBillSummary(count, subtotal, fee, grand) {
  const el = document.getElementById('cart-bill-summary');
  if (!el) return;

  if (!count) { el.style.display = 'none'; return; }

  const origDelivery = DELIVERY_FEE;                          // original full fee
const discDelivery = (typeof deliveryFeeDiscounted !== 'undefined' && deliveryFeeDiscounted > 0 && deliveryFeeDiscounted < origDelivery)
  ? deliveryFeeDiscounted : origDelivery;                   // admin-set discounted fee
const actualFee = subtotal >= FREE_THRESHOLD ? 0 : discDelivery;  // free threshold check

const deliveryHTML = actualFee === 0
  ? `<span class="bill-val"><s style="color:#bbb;font-size:11px">₹${origDelivery}</s><span class="bill-free">FREE</span></span>`
  : discDelivery < origDelivery
    ? `<span class="bill-val"><s style="color:#bbb;font-size:11px">₹${origDelivery}</s> <span class="bill-amount" style="color:var(--terra)">₹${discDelivery}</span></span>`
    : `<span class="bill-amount" style="color:var(--terra)">₹${origDelivery}</span>`;

  const remaining = Math.max(0, FREE_THRESHOLD - subtotal);
  const deliveryHintHTML = fee > 0
    ? `<div style="font-size:11px;color:#1565C0;margin-top:3px">Free above ₹${FREE_THRESHOLD} (Add ₹${remaining} more)</div>`
    : '';

  // Savings breakdown
  const mrpSavings = Object.entries(cart).reduce((sum, [name, { qty, price }]) => {
    const item = items.find(p => p.name === name);
    return sum + ((item?.mrp || price) - price) * qty;
  }, 0);
  const deliverySavings   = fee === 0 && subtotal > 0 ? DELIVERY_FEE : 0;
  const handlingSavings   = subtotal > 0 ? HANDLING_FEE : 0;
  const couponSavings     = couponDiscount || 0;
  const totalOrderSavings = mrpSavings + deliverySavings + handlingSavings + couponSavings;

  const savingsSection = totalOrderSavings > 0 ? `
    <div class="bill-summary-box" style="margin-top:10px;background:#f0faf0;border-color:#d4edda;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #d4edda;">
        <span style="font-size:13px;font-weight:700;color:var(--g2);">💰 Savings on this order</span>
        <span style="background:var(--green-price);color:#fff;font-size:13px;font-weight:700;padding:3px 10px;border-radius:6px;">₹${totalOrderSavings}</span>
      </div>
      ${mrpSavings > 0 ? `
      <div class="bill-row">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--td);">Discount on MRP</div>
          <div style="font-size:11px;color:var(--tmut);">Price vs MRP savings</div>
        </div>
        <span style="font-weight:700;color:var(--td);">₹${mrpSavings}</span>
      </div>` : ''}
      ${(deliverySavings > 0 || (discDelivery < origDelivery && actualFee > 0)) ? `
      <div class="bill-row" style="border-top:1px dashed #d4edda;margin-top:6px;padding-top:6px;">
        <span style="font-size:12px;font-weight:600;color:var(--td);">Savings on Delivery fee</span>
        <span style="font-weight:700;color:var(--td);">₹${deliverySavings + (discDelivery < origDelivery && actualFee > 0 ? origDelivery - discDelivery : 0)}</span>
      </div>` : ''}
      ${handlingSavings > 0 ? `
      <div class="bill-row" style="border-top:1px dashed #d4edda;margin-top:6px;padding-top:6px;">
        <span style="font-size:12px;font-weight:600;color:var(--td);">Savings on Handling fee</span>
        <span style="font-weight:700;color:var(--td);">₹${handlingSavings}</span>
      </div>` : ''}
      ${couponSavings > 0 ? `
      <div class="bill-row" style="border-top:1px dashed #d4edda;margin-top:6px;padding-top:6px;">
        <span style="font-size:12px;font-weight:600;color:var(--td);">🎟️ Coupon Savings</span>
        <span style="font-weight:700;color:var(--td);">₹${couponSavings}</span>
      </div>` : ''}
    </div>` : '';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="bill-summary-box">
      <div class="bill-summary-title">📋 Bill Summary</div>
      <div class="bill-row">
        <span class="bill-label">Item Total</span>
        <span class="bill-val">
          ${mrpSavings > 0 ? `<span class="bill-strike">₹${subtotal + mrpSavings}</span>` : ''}
          <span class="bill-amount">₹${subtotal}</span>
        </span>
      </div>
      ${couponDiscount > 0 ? `
      <div class="bill-row">
        <span class="bill-label" style="color:var(--green-price);">🎟️ Coupon Discount</span>
        <span class="bill-amount" style="color:var(--green-price);">−₹${couponDiscount}</span>
      </div>` : ''}
      <div class="bill-row">
        <div>
          <span class="bill-label">Delivery Fee</span>
          ${deliveryHintHTML}
        </div>
        <span class="bill-val">${deliveryHTML}</span>
      </div>
      <div class="bill-row">
        <span class="bill-label">Handling Fee</span>
        <span class="bill-val">
          <s style="color:#bbb;font-size:11px">₹${HANDLING_FEE}</s>
          <span class="bill-free">FREE</span>
        </span>
      </div>
      <div class="bill-row bill-total-row">
        <span class="bill-label-total">To Pay</span>
        <span class="bill-val">
          ${totalOrderSavings > 0
            ? `<s style="color:#bbb;font-size:13px;margin-right:4px">₹${grand + totalOrderSavings}</s>`
            : ''}
          <span class="bill-val-total">₹${grand}</span>
        </span>
      </div>
    </div>
    ${savingsSection}`;
}

/* ── Cart Items List ──────────────────── */
function _updateItemsList(count) {
  const list = document.getElementById('cart-items-list');
  if (!list) return;

  if (!count) {
    list.innerHTML = _emptyCartHTML();
    return;
  }

  list.innerHTML = Object.entries(cart).map(([name, { qty, price }]) => {
    const item   = items.find(i => i.name === name);
    const wt     = item?.weight || '';
    const imgSrc = item
      ? (item.images?.length > 0 ? item.images[0] : (item.image || ''))
      : '';
    const nameSafe = name.replace(/'/g, "\\'");

    return `
      <div class="cart-item">
        <div class="cart-item-thumb">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${name}" onerror="this.style.display='none'">`
            : `<span style="font-size:22px">${item ? getCatEmoji(item) : '🥦'}</span>`}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${name}</div>
          ${wt ? `<div class="cart-item-weight">${wt}</div>` : ''}
        </div>
        <div class="cart-qty-block">
          <div class="cart-qty">
            <button class="cart-qbtn"
              onclick="changeQty('${nameSafe}',${price},${item?.mrp || price},-1)">−</button>
            <div class="cart-qinput">${qty}</div>
            <button class="cart-qbtn"
              onclick="changeQty('${nameSafe}',${price},${item?.mrp || price},1)">+</button>
          </div>
          <div class="cart-item-price">
            ${item?.mrp > price ? `<s style="color:#bbb">₹${item.mrp}</s> ` : ''}
            <span style="color:var(--green-price);font-weight:700">₹${qty * price}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Wishlist shortcut row
  list.innerHTML += `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 10px;margin-top:6px;margin-bottom:14px;background:#fff;border-radius:12px;
      border:1.5px solid #f0ece4;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;background:#fff0f5;border-radius:10px;
          display:flex;align-items:center;justify-content:center;font-size:18px;">❤️</div>
        <span style="font-size:13px;font-weight:600;color:var(--td);">Add items from your wishlist</span>
      </div>
      <button onclick="openWishlistPage()" style="border:1.5px solid #ff2d6f;background:#fff;
        color:#ff2d6f;font-size:13px;font-weight:600;padding:6px 14px;
        border-radius:8px;cursor:pointer;font-family:'Outfit',sans-serif;">
        + Add
      </button>
    </div>`;

  // Apply Coupon card — click karo toh full-screen "Offers & Coupons" page open hoga
  list.innerHTML += `
    <div onclick="event.stopPropagation(); event.preventDefault(); setTimeout(openAllCoupons, 80);"
      style="display:flex;align-items:center;justify-content:space-between;
        padding:14px 16px;margin-bottom:14px;background:#fff;border-radius:12px;
        border:1.5px solid #e8f5e9;cursor:pointer;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;background:#e8f5e9;border-radius:10px;
          display:flex;align-items:center;justify-content:center;font-size:20px;">🎟️</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--td);">
            ${couponDiscount > 0 ? '🎉 Coupon Applied!' : 'Apply Coupon'}
          </div>
          ${couponDiscount > 0
            ? `<div style="font-size:11px;color:var(--green-price);font-weight:600;">You saved ₹${couponDiscount} with coupon</div>`
            : `<div style="font-size:11px;color:var(--tmut);">Save more with coupons &amp; offers</div>`
          }
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${couponDiscount > 0
          ? `<span style="background:#e8f5e9;color:var(--green-price);font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">−₹${couponDiscount}</span>`
          : ''
        }
        <span style="color:var(--g2);font-size:20px;">›</span>
      </div>
    </div>`;
}

/* ── Savings Banner ───────────────────── */
function _updateSavingsBanner(count, saved) {
  const banner = document.getElementById('cart-savings-banner');
  if (!banner) return;
  if (count > 0 && saved > 0) {
    banner.innerHTML = `
      🎉 Yay! You saved
      <strong style="color:var(--green-price);margin:0 4px">₹${saved}</strong>
      on this order
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round" style="margin-left:4px;vertical-align:middle;color:var(--green-price)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

/* ── Persist cart to localStorage ───────
   BUG FIX: pehle bare try-catch tha,
   ab Storage use karte hain             */
function _persistCart() {
  Storage.set(LS_KEYS.CART, cart);
}

/* ── Total saved calculation ─────────── */
function _calcTotalSaved() {
  return Object.entries(cart).reduce((sum, [name, { qty, price }]) => {
    const item = items.find(p => p.name === name);
    return sum + ((item?.mrp || price) - price) * qty;
  }, 0);
}

/* ── Empty cart HTML ─────────────────── */
function _emptyCartHTML() {
  return `
    <div class="cart-empty">
      <div class="cart-empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="80" height="80">
          <path fill="#c8c8c8" d="M24 48C10.7 48 0 58.7 0 72C0 85.3 10.7 96 24 96L69.3 96C73.2 96 76.5 98.8 77.2 102.6L129.3 388.9C135.5 423.1 165.3 448 200.1 448L456 448C469.3 448 480 437.3 480 424C480 410.7 469.3 400 456 400L200.1 400C188.5 400 178.6 391.7 176.5 380.3L171.4 352L475 352C505.8 352 532.2 330.1 537.9 299.8L568.9 133.9C572.6 114.2 557.5 96 537.4 96L124.7 96L124.3 94C119.5 67.4 96.3 48 69.2 48L24 48zM208 576C234.5 576 256 554.5 256 528C256 501.5 234.5 480 208 480C181.5 480 160 501.5 160 528C160 554.5 181.5 576 208 576zM432 576C458.5 576 480 554.5 480 528C480 501.5 458.5 480 432 480C405.5 480 384 501.5 384 528C384 554.5 405.5 576 432 576z"/>
        </svg>
      </div>
      <div style="font-weight:700;margin-bottom:6px;color:#9ca3af;font-size:20px;font-family:'Outfit',sans-serif;">Your cart is empty!</div>
      <div style="font-size:16px;color:#9ca3af;line-height:1.5;">Add some fresh vegetables to get started!</div>
    </div>`;
}

/* ════════════════════════════════════════
   FREE DELIVERY BARS
   3 locations — top header, cart panel, order page
════════════════════════════════════════ */
function updateAllFD(subtotal) {
  const pct  = Math.min((subtotal / FREE_THRESHOLD) * 100, 100);
  const rem  = Math.max(0, FREE_THRESHOLD - subtotal);
  const done = subtotal >= FREE_THRESHOLD;

  _updateTopFDBar(subtotal, pct, rem, done);
  _updateCartFDBar(subtotal, pct, rem, done);
  _updateOrderFDBar(subtotal, pct, rem, done);
}

function _updateTopFDBar(total, pct, rem, done) {
  const bar = document.getElementById('free-delivery-bar');
  if (!bar) return;
  if (total === 0) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  const fill  = document.getElementById('fd-fill');
  const emoji = document.getElementById('fd-emoji');
  const text  = document.getElementById('fd-text');

  if (fill) {
    fill.style.strokeDashoffset = (94.25 * (1 - pct / 100)).toFixed(2);
    fill.style.stroke = done ? '#6BBF7B' : '#1C3829';
  }
  if (emoji) emoji.textContent = done ? '✅' : '🚚';
  if (text)  text.innerHTML    = done
    ? '🎉 <strong>Free delivery unlocked!</strong>'
    : `Shop for <strong>₹${rem} more</strong> to unlock free delivery`;
}

function _updateCartFDBar(total, pct, rem, done) {
  const bar = document.getElementById('cart-fd-bar');
  if (!bar) return;
  if (total === 0) { bar.style.display = 'none'; return; }

  bar.style.display = 'block';
  const fill  = document.getElementById('cart-fd-fill');
  const truck = document.getElementById('cart-fd-truck');
  const text  = document.getElementById('cart-fd-text');

  if (fill)  { fill.style.width = pct + '%'; fill.style.background = done ? '#6BBF7B' : '#1C3829'; }
  if (truck) {
    if (done) {
      /* 100% done — truck RIGHT EDGE exactly bar ke right end par ho */
      truck.style.left  = 'auto';
      truck.style.right = '0px';
    } else {
      /* Progress me — truck ka RIGHT EDGE fill ke end par ho */
      truck.style.right = 'auto';
      truck.style.left  = `clamp(0px, calc(${pct}% - 26px), calc(100% - 26px))`;
    }
    truck.textContent     = '🚚';
    truck.style.transform = 'scaleX(-1)';
  }
  if (text)  text.innerHTML = done
    ? '🎉 <strong>Free delivery unlocked!</strong>'
    : `Add <strong>₹${rem} more</strong> for free delivery`;
}

function _updateOrderFDBar(total, pct, rem, done) {
  const bar = document.getElementById('order-fd-bar');
  if (!bar) return;
  if (total === 0) { bar.style.display = 'none'; return; }

  bar.style.display = 'block';
  const fill  = document.getElementById('order-fd-fill');
  const truck = document.getElementById('truck');
  const text  = document.getElementById('order-fd-text');

  if (fill)  { fill.style.width = pct + '%'; fill.style.background = done ? '#6BBF7B' : '#1C3829'; }
  if (truck) {
    if (done) {
      truck.style.left  = 'auto';
      truck.style.right = '0px';
    } else {
      truck.style.right = 'auto';
      truck.style.left  = `clamp(0px, calc(${pct}% - 26px), calc(100% - 26px))`;
    }
  }
  if (text)  text.innerHTML = done
    ? '🎉 <strong>Free delivery unlocked!</strong>'
    : `Add <strong>₹${rem} more</strong> for free delivery`;
}