/* ════════════════════════════════════════
   modules/order.js
   Full order placement flow — broken into clean steps.
   Depends on: core/state.js, core/utils.js,
               core/storage.js, core/validators.js,
               ui/validation.js, ui/toast.js,
               ui/celebration.js, ui/cart-ui.js,
               modules/cart.js, modules/coupon.js,
               modules/slots.js, modules/products.js

   PHASE 1 UPDATE: Stock check, price calc, coupon
   validation aur Firestore writes ab client yahan
   nahi karta — sab kuch functions/index.js ke
   `placeOrder` Cloud Function me hota hai (server-
   trusted). Ye file ab sirf:
     1. Fast local UX pre-checks karta hai (taaki
        obviously invalid order server tak na jaaye)
     2. Cloud Function ko call karta hai
     3. Response se thank-you screen dikhata hai
════════════════════════════════════════ */

/* ════════════════════════════════════════
   MAIN ENTRY POINT
════════════════════════════════════════ */
async function placeOrder() {
  /* 1. Client-side validation (fast UX feedback) */
  if (!_validateOrderClient()) return;

  /* 2. Button loading */
  const btn = document.getElementById('order-btn');
  _setBtnState(btn, true, '⏳ Checking cart...');

  /* 3. Fresh zone config (local UX pre-check only — server re-validates anyway) */
  await _refreshZoneConfig();

  /* 4. Local checks (fast, no network — server is the real gatekeeper) */
  if (!_localZoneCheck(btn)) return;
  if (!_localStockCheck(btn)) return;

  /* 5. Call server — placeOrder Cloud Function does the real validation + write */
  _setBtnState(btn, true, '⏳ Placing your order...');
  try {
    const orderData = await _callPlaceOrderFunction();
    _cacheUserProfileLocally();
    _showThankYou(orderData);
    await _postOrderCleanup(orderData);
  } catch (err) {
    console.error('[Order] placeOrder error:', err);
    showToast('Order failed: ' + _friendlyError(err), 'error');
  } finally {
    _setBtnState(btn, false, '🛒 Place Order');
  }
}

/* ════════════════════════════════════════
   STEP 1 — CLIENT VALIDATION (UX only —
   server (placeOrder Cloud Function) does
   the authoritative validation again)
════════════════════════════════════════ */
function _validateOrderClient() {
  let name    = document.getElementById('name')?.value.trim()    || '';
  let phone   = document.getElementById('phone')?.value.trim()   || '';

  // If visible fields are empty (hidden when using saved address), use hidden fields
  if (!name)  name  = document.getElementById('name-hidden')?.value.trim() || '';
  if (!phone) phone = document.getElementById('phone-hidden')?.value.trim() || '';

  const address = document.getElementById('address')?.value.trim() || '';

  const nameErr  = Validators.name(name);
  if (nameErr)  { showFieldError('name', nameErr);   return false; }

  const phoneErr = Validators.phone(phone);
  if (phoneErr) { showFieldError('phone', phoneErr); return false; }

  if (!address || address.length < 10) {
    showFieldError('address', 'Please enter your full delivery address (min 10 chars)');
    return false;
  }

  if (!confirmedLat && !locationLink) {
    showFieldError('location', 'Please select your location on the map first');
    return false;
  }

  if (!selectedSlot) { showFieldError('slot', 'Please select a delivery slot'); return false; }

  if (!Object.keys(cart).length) { showToast('Please add items to your cart first!'); return false; }

  if (!firebase.auth().currentUser) {
    showToast('Please login to place an order.', 'error');
    return false;
  }

  const orderTotal = Math.max(0, getCartSubtotal() - (couponDiscount || 0));
  if (orderTotal < MIN_ORDER) {
    showToast(`Minimum order is ₹${MIN_ORDER}. Your cart total is ₹${orderTotal}.`, 'error');
    return false;
  }

  return true;
}

/* ════════════════════════════════════════
   STEP 3 — REFRESH ZONE CONFIG (local UX)
════════════════════════════════════════ */
async function _refreshZoneConfig() {
  await safeAsync(async () => {
    const snap = await db.collection('config').doc('zoneSettings').get();
    if (snap.exists) applyZoneConfig(snap.data());
  }, ERR.FIREBASE, true);
}

/* ════════════════════════════════════════
   STEP 4A — LOCAL ZONE CHECK (UX)
════════════════════════════════════════ */
function _localZoneCheck(btn) {
  const zoneQty = _getZoneQtyTotal();
  if (zoneQty <= ZONE_MAX_ITEMS) return true;

  showToast(
    ZONE_MAX_ITEMS === 1
      ? '⭐ Zone se sirf 1 item allowed hai per order!'
      : `⭐ Zone se max ${ZONE_MAX_ITEMS} items allowed. Aapne ${zoneQty} add kiye.`,
    'error'
  );
  _setBtnState(btn, false, '🛒 Place Order');
  openCart();
  return false;
}

/* ════════════════════════════════════════
   STEP 4B — LOCAL STOCK CHECK (UX)
════════════════════════════════════════ */
function _localStockCheck(btn) {
  for (const name in cart) {
    const item = items.find(i => i.name === name);
    if (!item || item.stock === null || item.stock === undefined) continue;
    if (cart[name].qty > item.stock) {
      showToast(`⚠️ ${name} Only ${item.stock} units of ${name} available.`, 'error');
      _setBtnState(btn, false, '🛒 Place Order');
      openCart();
      return false;
    }
  }
  return true;
}

/* ════════════════════════════════════════
   STEP 5 — CALL SERVER (Cloud Function)
   Client sirf productId + qty bhejta hai —
   price/stock/coupon/zone check sab server
   fresh Firestore read karke khud karta hai.
════════════════════════════════════════ */
async function _callPlaceOrderFunction() {
  let name  = document.getElementById('name')?.value.trim() || '';
  if (!name) name = document.getElementById('name-hidden')?.value.trim() || '';
  const address  = document.getElementById('address').value.trim();
  const altPhone = document.getElementById('alt-phone')?.value?.trim() || null;

  const slotInfo = getSlots().find(s => s.id === selectedSlot);
  const slotText = slotInfo
    ? `${slotInfo.day} — ${slotInfo.label} (${slotInfo.time})`
    : selectedSlot;

  const cartItems = Object.keys(cart).map(n => {
    const idata = items.find(i => i.name === n);
    return { productId: idata?._id || '', qty: cart[n].qty };
  }).filter(it => it.productId);

  if (!cartItems.length) {
    throw new Error('Cart items ke IDs missing hain — page refresh karke dobara try karo.');
  }

  const callable = functionsInstance.httpsCallable('placeOrder');
  const res = await callable({
    name, address, altPhone,
    area: selectedArea || null,
    locationLink: locationLink || null,
    lat: confirmedLat || null,
    lng: confirmedLng || null,
    slotId: selectedSlot,
    slotText,
    couponCode: appliedCoupon?.code || null,
    items: cartItems,
  });

  const r = res.data; // { success, orderId, deliveryPin, cancelPin, total, rawTotal, couponDiscount, zoneItemCount, items }

  // UI ke liye phone form field se hi lete hain (display only — server ne auth phone use kiya hai)
  let phone = document.getElementById('phone')?.value.trim() || '';
  if (!phone) phone = document.getElementById('phone-hidden')?.value.trim() || '';

  return {
    orderId: r.orderId, deliveryPin: r.deliveryPin, cancelPin: r.cancelPin,
    name, phone, altPhone, address, slotText,
    orderItems: r.items, rawTotal: r.rawTotal, orderTotal: r.total, zoneQty: r.zoneItemCount,
  };
}

/* Firebase Functions error messages ko readable banate hain */
function _friendlyError(err) {
  if (err?.code && err.code.startsWith('functions/')) {
    return err.message || 'Please try again';
  }
  return err?.message || 'Please try again';
}

/* ════════════════════════════════════════
   Local cache update (form autofill ke liye)
   — Firestore write ab Cloud Function karta
   hai, ye sirf local UX ke liye hai.
════════════════════════════════════════ */
function _cacheUserProfileLocally() {
  const name    = document.getElementById('name')?.value.trim()    || '';
  const phone   = document.getElementById('phone')?.value.trim()   || '';
  const address = document.getElementById('address')?.value.trim() || '';

  const ud = { name, phone, address, updatedAt: new Date().toISOString() };
  Storage.setUser(ud);
  currentUser = ud;
  applyUserToForm();
  updateProfileIcon();
}

/* ════════════════════════════════════════
   SHOW THANK YOU SCREEN
════════════════════════════════════════ */
function _showThankYou({ orderId, deliveryPin }) {
  const idEl   = document.getElementById('thankyou-order-id');
  const pinEl  = document.getElementById('thankyou-pin-num');
  const pinBox = document.getElementById('thankyou-pin-box');
  if (idEl)   idEl.textContent    = orderId;
  if (pinEl)  pinEl.textContent   = deliveryPin;
  if (pinBox) pinBox.style.display = 'block';
  closeCheckout();
  document.getElementById('thankyou-overlay')?.classList.add('open');
  launchCelebration();
}

/* ════════════════════════════════════════
   POST-ORDER CLEANUP
════════════════════════════════════════ */
async function _postOrderCleanup(orderData) {
  // Reset all state
  resetCart();
  resetCheckoutState();
  Storage.remove(LS_KEYS.CART);
  selectedArea = ''; locationLink = ''; confirmedLat = null; confirmedLng = null;

  // Render
  renderProducts(); updateCartUI(); renderSlots();

  // Reset location picker UI
  const lpbTitle = document.getElementById('lpb-title');
  const lpbSub   = document.getElementById('lpb-sub');
  const lpbBtn   = document.getElementById('loc-picker-btn');
  if (lpbTitle) lpbTitle.textContent = 'Select Location on Map';
  if (lpbSub)   lpbSub.textContent   = 'Tap to open map & pin your exact address';
  if (lpbBtn)   lpbBtn.classList.remove('confirmed');
  setDlrAddr('Select your location');

  // Reset coupon UI
  const cInput = document.getElementById('coupon-input');
  const cMsg   = document.getElementById('coupon-msg');
  const cClear = document.getElementById('coupon-clear-btn');
  if (cInput) cInput.value   = '';
  if (cMsg)   cMsg.innerText = '';
  if (cClear) cClear.classList.remove('visible');

  // Reset address
  const addrEl = document.getElementById('address');
  if (addrEl) addrEl.value = '';
}

/* ════════════════════════════════════════
   WHATSAPP MESSAGE BUILDER
════════════════════════════════════════ */
function _buildWhatsAppMsg({ orderId, deliveryPin, name, phone, altPhone, address, slotText, orderItems, orderTotal, zoneQty }) {
  let msg = `*SabziBuddy Order* 🥦\n*Order ID:* \`${orderId}\`\n*Delivery PIN: ${deliveryPin}* 🔐\n─────────────────\n`;
  msg += `*Name:* ${name}\n*Phone:* +91 ${phone}\n`;
  if (altPhone) msg += `*Alt Number:* +91 ${altPhone}\n`;
  msg += `*Address:* ${address}\n`;
  if (selectedArea) msg += `*Area:* ${selectedArea}\n`;
  if (locationLink) msg += `*Location:* ${locationLink}\n`;
  msg += `*Slot:* ${slotText}\n\n*Items:*\n`;
  for (const n in orderItems) {
    const { qty, price, weight, zone } = orderItems[n];
    msg += ` • ${n}${zone ? ' ⭐' : ''} × ${qty}${weight ? ` (${weight})` : ''} = ₹${qty * price}\n`;
  }
  if (couponDiscount > 0) msg += `*Coupon (${appliedCoupon?.code}):* −₹${couponDiscount}\n`;
  msg += `*Total Amount: ₹${orderTotal}*\n`;
  if (zoneQty > 0) msg += `*Zone Items:* ${zoneQty} item(s) @ ₹${ZONE_PRICE} each\n`;
  msg += `\n_Thank You for choosing SabziBuddy!\nFresh Vegetables, Fast Delivery 🌿_`;
  return msg;
}

/* ════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════ */
function _getZoneQtyTotal() {
  return Object.keys(cart)
    .filter(n => items.find(i => i.name === n)?.zone)
    .reduce((sum, n) => sum + (cart[n]?.qty || 0), 0);
}

function _setBtnState(btn, disabled, text) {
  if (!btn) return;
  btn.disabled  = disabled;
  btn.innerHTML = text;
}
