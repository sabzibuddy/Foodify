/* ════════════════════════════════════════
   modules/coupon.js
   Coupon apply/remove + success popup + full-screen offers page.
   Depends on: core/state.js, core/error.js,
               ui/cart-ui.js, ui/toast.js
════════════════════════════════════════ */

let fwAnimId = null;   // fireworks animation frame ID

/* ════════════════════════════════════════
   APPLY COUPON
   (coupon-input & coupon-msg live inside
    the full-screen coupons-overlay page)
════════════════════════════════════════ */
async function applyCoupon() {
  const input    = document.getElementById('coupon-input');
  const msgEl    = document.getElementById('coupon-msg');
  const clearBtn = document.getElementById('coupon-clear-btn');
  if (!input || !msgEl) return;

  const code = input.value.trim().toUpperCase();

  // Toggle off if already applied
  if (appliedCoupon?.code === code) {
    removeCoupon(); return;
  }

  if (!code) { _setCouponMsg(msgEl, '❌ Please enter a coupon code', 'error'); return; }
  _setCouponMsg(msgEl, 'Checking...', 'muted');

  const result = await safeAsync(async () => {
    const snap = await db.collection('coupons').doc(code).get();
    if (!snap.exists) throw new Error('INVALID');
    return { snap, data: snap.data() };
  }, ERR.FIREBASE, true);

  if (!result) { _setCouponMsg(msgEl, '❌ Invalid coupon code', 'error'); return; }

  const { data } = result;
  const subtotal = getCartSubtotal();

  // Validation chain
  const err = _validateCoupon(data, code, subtotal);
  if (err) { _setCouponMsg(msgEl, err, 'error'); return; }

  // Apply
  const { discount } = _calcCouponDiscount(data, subtotal);
  appliedCoupon  = { ...data, code };
  couponDiscount = discount;

  let successText = `✅ ₹${discount} discount applied!`;
  if (data.category) successText += ` (${data.category} items pe)`;
  _setCouponMsg(msgEl, successText, 'success');
  clearBtn?.classList.add('visible');

  // Close the offers page and update cart
  setTimeout(() => closeAllCoupons(), 800);
  updateCartUI();
  if (navigator.vibrate) navigator.vibrate([15, 30, 15, 30, 60]);
  showCouponSuccess(code, discount);
}

/* ── Coupon validation (returns error string or null) ── */
function _validateCoupon(data, code, subtotal) {
  if (!data.active) return '❌ This coupon is invalid.';

  // Expiry
  const expiry = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (new Date() > expiry) {
    return `❌ Coupon expired (${expiry.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })})`;
  }

  // Max uses
  if ((data.usedCount || 0) >= (data.maxUses || Infinity))
    return '❌ Coupon usage limit reached';

  // Min order
  if (data.minOrder > 0 && subtotal < data.minOrder)
    return `❌ Min ₹${data.minOrder} order value required. Current total: ₹${subtotal}.`;

  // Category filter
  if (data.category) {
    const catItems = _getCategoryCartItems(data.category, data.subcategory);
    if (!catItems.length) {
      const catLabel = data.category + (data.subcategory ? '/' + data.subcategory : '');
      return `❌ Yeh coupon sirf "${catLabel}" category pe kaam karta hai.`;
    }
  }

  return null; // valid
}

/* ── Discount amount calc ── */
function _calcCouponDiscount(data, subtotal) {
  if (data.category) {
    const catItems      = _getCategoryCartItems(data.category, data.subcategory);
    const categoryTotal = catItems.reduce((s, name) => s + cart[name].qty * cart[name].price, 0);
    return { discount: Math.min(data.discount || 0, categoryTotal), categoryTotal };
  }
  return { discount: data.discount || 0, categoryTotal: subtotal };
}

/* ── Get cart items matching a category ── */
function _getCategoryCartItems(category, subcategory) {
  return Object.keys(cart).filter(name => {
    const item = items.find(i => i.name === name);
    if (!item) return false;
    if (item.top !== category) return false;
    if (subcategory && item.cat !== subcategory) return false;
    return true;
  });
}

/* ════════════════════════════════════════
   REMOVE COUPON
════════════════════════════════════════ */
function removeCoupon() {
  appliedCoupon  = null;
  couponDiscount = 0;

  const input    = document.getElementById('coupon-input');
  const clearBtn = document.getElementById('coupon-clear-btn');
  const msgEl    = document.getElementById('coupon-msg');

  if (input)    input.value = '';
  clearBtn?.classList.remove('visible');
  _setCouponMsg(msgEl, 'Coupon removed', 'muted');

  setTimeout(() => {
    if (msgEl?.textContent === 'Coupon removed') msgEl.textContent = '';
  }, 2000);

  updateCartUI();
  if (navigator.vibrate) navigator.vibrate([30, 50, 20]);
}

/* ════════════════════════════════════════
   COUPON SUCCESS POPUP
════════════════════════════════════════ */
function showCouponSuccess(code, discount) {
  document.getElementById('cs-code-text').textContent = code;
  document.getElementById('cs-big-num').textContent   = discount;
  const _cs = document.getElementById('coupon-success-overlay');
  if (_cs) _cs.style.zIndex = '999999';
  _cs?.classList.add('open');

  // Bounce animation re-trigger
  const num = document.getElementById('cs-big-num');
  if (num) { num.style.animation = 'none'; void num.offsetHeight; num.style.animation = ''; }

  setTimeout(startCouponFireworks, 80);
}

function closeCouponSuccess() {
  document.getElementById('coupon-success-overlay')?.classList.remove('open');
  if (fwAnimId) { cancelAnimationFrame(fwAnimId); fwAnimId = null; }
}

/* ════════════════════════════════════════
   COUPON FIREWORKS CANVAS
════════════════════════════════════════ */
const FW_COLORS = ['#6BBF7B','#FFD700','#FF6B6B','#4ECDC4','#FF8C42','#F7DC6F','#A8E6CF','#FFEAA7','#fff','#fd79a8'];

function startCouponFireworks() {
  const canvas = document.getElementById('cs-fw-canvas');
  if (!canvas) return;

  const zone    = canvas.parentElement;
  canvas.width  = zone.offsetWidth  || 340;
  canvas.height = zone.offsetHeight || 140;
  const ctx     = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const particles = [];
  let launchTimer = 0;
  let frameCount  = 0;
  const MAX_FRAMES = 300;

  function spawnBurst(x, y) {
    const count = 18 + Math.floor(Math.random() * 14);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
        size:  2 + Math.random() * 4,
        life:  1, decay: 0.018 + Math.random() * 0.018,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
        rot:   Math.random() * Math.PI * 2,
        spin:  (Math.random() - 0.5) * 0.3,
      });
    }
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: Math.random() * W, y: 0,
        vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2.5,
        color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
        size:  2 + Math.random() * 3,
        life:  1, decay: 0.012 + Math.random() * 0.012,
        shape: 'star', rot: 0, spin: 0.1,
      });
    }
  }

  function drawStar(c, x, y, r, color) {
    c.save(); c.fillStyle = color; c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const b = a + Math.PI / 5;
      if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else         c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      c.lineTo(x + Math.cos(b) * r * 0.4, y + Math.sin(b) * r * 0.4);
    }
    c.closePath(); c.fill(); c.restore();
  }

  function frame() {
    if (!document.getElementById('coupon-success-overlay')?.classList.contains('open')) {
      ctx.clearRect(0, 0, W, H); return;
    }
    ctx.clearRect(0, 0, W, H);
    frameCount++; launchTimer++;

    if (frameCount === 1) { spawnBurst(W * 0.3, H * 0.5); spawnBurst(W * 0.7, H * 0.35); }
    if (launchTimer % 28 === 0)
      spawnBurst(W * 0.2 + Math.random() * W * 0.6, H * 0.1 + Math.random() * H * 0.6);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.04;
      p.life -= p.decay; p.rot += p.spin;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);

      if      (p.shape === 'star') drawStar(ctx, 0, 0, p.size, p.color);
      else if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
      }
      ctx.restore();
    }

    if (frameCount < MAX_FRAMES || particles.length > 0)
      fwAnimId = requestAnimationFrame(frame);
    else
      ctx.clearRect(0, 0, W, H);
  }

  if (fwAnimId) cancelAnimationFrame(fwAnimId);
  spawnBurst(W * 0.5, H * 0.4);
  fwAnimId = requestAnimationFrame(frame);
}

/* ════════════════════════════════════════
   ALL COUPONS — FULL SCREEN PAGE
   coupons-overlay ko full-screen page
   ki tarah render karo:
   ┌─────────────────────────┐
   │ ← Offers and Coupons   │  ← header
   ├─────────────────────────┤
   │ [Type coupon code ] Apply│  ← input
   ├─────────────────────────┤
   │  AVAILABLE COUPONS      │
   │  [coupon card]          │
   │  [coupon card]          │
   └─────────────────────────┘
════════════════════════════════════════ */
async function openAllCoupons() {
  const _co = document.getElementById('coupons-overlay');
  if (!_co) return;

  // Full-screen page ki tarah style karo
  Object.assign(_co.style, {
    position:   'fixed',
    inset:      '0',
    zIndex:     '99999',
    background: '#f4f4f4',
    overflowY:  'auto',
    display:    'block',
    transform:  'translateX(100%)',
    transition: 'transform 0.35s ease',
    borderRadius: '0',
    maxHeight:  'none',
    padding:    '0',
  });
  _co.classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => { _co.style.transform = 'translateX(0)'; }));
  _co.onclick = (e) => e.stopPropagation();

  // Puri page content inject karo
  _co.innerHTML = `

    <!-- ── Header ── -->
    <div style="position:sticky;top:0;z-index:10;background:#fff;
      display:flex;align-items:center;gap:12px;
      padding:14px 16px;border-bottom:1px solid #eee;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <button onclick="closeAllCoupons()"
        style="background:none;border:none;cursor:pointer;padding:4px;
          display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--g2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span style="font-size:17px;font-weight:700;color:var(--g2);font-family:'Outfit',sans-serif;">
        🎟️ Offers and Coupons
      </span>
    </div>

    <!-- ── Coupon Input Section ── -->
    <div style="background:#fff;padding:16px;margin:12px;border-radius:12px;
      box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="coupon-input"
          placeholder="Type coupon code here"
          oninput="this.value=this.value.replace(/\\s/g,'').toUpperCase()"
          style="flex:1;padding:12px 14px;border:1.5px solid #e0e0e0;border-radius:10px;
            font-family:'Outfit',sans-serif;font-size:14px;outline:none;
            background:#f9f9f9;color:var(--td);">
        <button onclick="applyCoupon()"
          style="background:var(--g2);color:#fff;border:none;border-radius:10px;
            padding:12px 20px;font-family:'Outfit',sans-serif;font-size:14px;
            font-weight:700;cursor:pointer;white-space:nowrap;">Apply</button>
      </div>
      <div id="coupon-msg" style="font-size:12px;font-weight:600;margin-top:8px;min-height:18px;"></div>
      <button id="coupon-clear-btn" onclick="removeCoupon()" style="display:none;"></button>
    </div>

    <!-- ── Section Label ── -->
    <div style="padding:4px 16px 8px;font-size:11px;font-weight:700;
      color:var(--tmut);letter-spacing:0.8px;">AVAILABLE COUPONS</div>

    <!-- ── Coupon List ── -->
    <div id="all-coupons-body">
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:28px;margin-bottom:10px;">⏳</div>
        <div style="font-size:13px;color:var(--tmut);">Loading coupons...</div>
      </div>
    </div>`;

  // Pre-fill if coupon already applied
  if (appliedCoupon?.code) {
    const inp = document.getElementById('coupon-input');
    if (inp) inp.value = appliedCoupon.code;
  }

  // Fetch active coupons from Firestore
  const result = await safeAsync(async () => {
    return db.collection('coupons').where('active', '==', true).get();
  }, ERR.FIREBASE, true);

  const body = document.getElementById('all-coupons-body');
  if (!body) return;

  if (!result || result.empty) {
    body.innerHTML = _noCouponsHTML();
    return;
  }

  const subtotal = getCartSubtotal();
  const rows     = [];

  result.forEach(doc => {
    const d       = doc.data();
    const code    = doc.id;
    const used    = d.usedCount  || 0;
    const maxUses = d.maxUses    || null;
    if (maxUses !== null && used >= maxUses) return;

    const expAt = d.expiresAt?.toDate ? d.expiresAt.toDate()
      : (d.expiresAt ? new Date(d.expiresAt) : null);
    if (expAt && new Date() > expAt) return;

    rows.push(_buildCouponRow(d, code, subtotal, expAt));
  });

  body.innerHTML = rows.length
    ? rows.join('') + '<div style="height:24px;"></div>'
    : _noCouponsHTML();
}

/* ── Close full-screen coupons page ─── */
function closeAllCoupons() {
  const _co = document.getElementById('coupons-overlay');
  if (!_co) return;
  _co.style.transform = 'translateX(100%)';
  setTimeout(() => {
    _co.classList.remove('open');
    _co.style.display = '';
    _co.style.transform = '';
    _co.style.transition = '';
  }, 380);
}

/* ── Apply coupon from list card ─────── */
function applyCouponFromList(code) {
  const input = document.getElementById('coupon-input');
  if (input) {
    input.value = code;
    input.focus();
  }
  applyCoupon();
}

/* ── Build single coupon card HTML ──── */
function _buildCouponRow(d, code, subtotal, expAt) {
  const minOrder  = d.minOrder  || 0;
  const discount  = d.discount  || 0;
  const isApplied = appliedCoupon?.code === code;

  let canApply = true, disableReason = '';
  if (appliedCoupon && !isApplied) {
    canApply = false; disableReason = `Remove the applied coupon "${appliedCoupon.code}" first`;
  } else if (d.category) {
    const catItems = _getCategoryCartItems(d.category, d.subcategory);
    if (!catItems.length) {
      canApply = false;
      disableReason = `"${d.category}${d.subcategory ? '/' + d.subcategory : ''}" category items must be in your cart`;
    } else if (minOrder > 0 && subtotal < minOrder) {
      canApply = false; disableReason = `Min ₹${minOrder} order value required (current: ₹${subtotal})`;
    }
  } else if (minOrder > 0 && subtotal < minOrder) {
    canApply = false;
    const remaining = minOrder - subtotal;
    disableReason = `Add products worth ₹${remaining} more to avail this offer`;
  } else if (subtotal === 0 && !isApplied) {
    canApply = false; disableReason = 'Add at least one item to your cart first';
  }

  const borderColor = canApply ? '#e0e0e0' : '#e0e0e0';
  const bgColor     = '#fff';
  const titleColor  = canApply ? 'var(--g2)'  : '#aaa';
  const priceColor  = canApply ? 'var(--green-price)' : '#bbb';
  const warnColor   = '#E65100';

  const btnHtml = isApplied
    ? `<button onclick="applyCouponFromList('${code}')"
        style="width:100%;padding:10px;border:none;border-top:1.5px dashed #e0e0e0;
        background:none;font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;
        color:var(--green-price);cursor:pointer;margin-top:10px;">
        ✅ Applied — Tap to remove
      </button>`
    : canApply
      ? `<button onclick="applyCouponFromList('${code}')"
          style="width:100%;padding:10px;border:none;border-top:1.5px dashed #e0e0e0;
          background:none;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;
          color:var(--g2);cursor:pointer;margin-top:10px;">Apply</button>`
      : `<button disabled
          style="width:100%;padding:10px;border:none;border-top:1.5px dashed #e0e0e0;
          background:none;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;
          color:#bbb;cursor:not-allowed;margin-top:10px;">Apply</button>`;

  return `
    <div style="margin:0 12px 12px;border:1.5px solid ${borderColor};border-radius:12px;
      background:${bgColor};overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="padding:14px 16px 10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:16px;font-weight:800;letter-spacing:1.5px;
              color:${titleColor};font-family:'Outfit',sans-serif;">🎟️ ${code}</div>
            <div style="font-size:13px;font-weight:700;color:${priceColor};margin-top:3px;">
              ₹${discount} Off${d.category ? ` on ${d.category}` : ''}
            </div>
            ${minOrder ? `<div style="font-size:11px;color:var(--tmut);margin-top:3px;">
              Min. order: ₹${minOrder}
            </div>` : ''}
            ${d.description ? `<div style="font-size:11px;color:var(--tm);margin-top:3px;">
              ${d.description}
            </div>` : ''}
            ${!canApply && disableReason ? `
            <div style="display:flex;align-items:flex-start;gap:5px;margin-top:7px;">
              <span style="font-size:13px;margin-top:1px;">ℹ️</span>
              <span style="font-size:11px;color:${warnColor};font-weight:600;line-height:1.4;">
                ${disableReason}
              </span>
            </div>` : ''}
            ${expAt ? `<div style="font-size:10px;color:var(--tmut);margin-top:4px;">
              ⏰ Expires: ${expAt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </div>` : ''}
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="flex-shrink:0;margin-top:3px;">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      ${btnHtml}
    </div>`;
}

function _noCouponsHTML() {
  return `
    <div style="text-align:center;padding:50px 20px;color:var(--tmut);">
      <div style="font-size:40px;margin-bottom:12px;">😔</div>
      <div style="font-size:14px;font-weight:600;">No active coupons right now</div>
      <div style="font-size:12px;margin-top:6px;">Check back later!</div>
    </div>`;
}

/* ── Private: coupon msg helper ─────── */
function _setCouponMsg(el, text, type = '') {
  if (!el) return;
  const colors = { error: 'var(--terra)', success: 'var(--green-price)', muted: 'var(--tmut)' };
  el.style.color = colors[type] || 'var(--tmut)';
  el.innerText   = text;
}
