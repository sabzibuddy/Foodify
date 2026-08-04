/* ════════════════════════════════════════
   modules/cart.js
   Cart panel + checkout page open/close/clear.
   Depends on: core/state.js, core/utils.js,
               ui/cart-ui.js, ui/toast.js,
               modules/products.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   CART OPEN / CLOSE / CLEAR
════════════════════════════════════════ */
function openCart() {
  const overlay = document.getElementById('cart-overlay');
  const panel   = document.getElementById('cart-panel');
  if (!overlay || !panel) return;

  overlay.style.zIndex = '9998';
  panel.style.zIndex   = '9999';
  overlay.classList.add('open');
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
  updateCartUI();
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.getElementById('cart-panel')?.classList.remove('open');

  // Overflow restore — product detail open hai toh band mat karo
  const pdOpen = document.getElementById('product-detail-page')?.classList.contains('open');
  if (!pdOpen) document.body.style.overflow = '';
}

function clearCart() {
  if (!Object.keys(cart).length) return;
  if (!confirm('Clear all items from cart?')) return;

  resetCart();        // core/state.js
  renderProducts();
  updateCartUI();
  showToast('Cart cleared!');
}

/* ════════════════════════════════════════
   CHECKOUT OPEN / CLOSE
════════════════════════════════════════ */
function openCheckout() {
  const itemCount = getCartCount();    // utils.js
  if (!itemCount) {
    showToast('Please add items to your cart first!', 'error');
    return;
  }

  // ── Auth Guard (Zepto-style) ──────────────
  if (!currentUser || !currentUser.otpVerified) {
    localStorage.setItem('sb_pending_checkout', '1');
    closeCart();
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    showToast('Login karke checkout karo 🔐', 'info');
    return;
  }
  // ─────────────────────────────────────────

  const page = document.getElementById('order-sec');
  if (page) {
    page.style.zIndex = '99999';
    page.classList.add('open');
  }
  document.body.style.overflow = 'hidden';
  // Initialize multi-step checkout address system
  if (typeof initCheckoutAddress === 'function') initCheckoutAddress();
  if (navigator.vibrate) navigator.vibrate([10]);
}

function closeCheckout() {
  const page = document.getElementById('order-sec');
  if (!page) return;
  page.style.transform = 'translateX(100%)';
  setTimeout(() => {
    page.classList.remove('open');
    page.style.zIndex = '';
    page.style.transform = '';
  }, 380);
  document.body.style.overflow = 'hidden'; // cart abhi bhi open hai
}

function closeThankyou() {
  document.getElementById('thankyou-overlay')?.classList.remove('open');
}

/* ── Checkout summary render ──────────── */
function _renderCheckoutSummary() {
  const subtotal   = getCartSubtotal();
  const fee        = subtotal >= FREE_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = Math.max(0, subtotal + fee - (couponDiscount || 0));

  const totalEl = document.getElementById('checkout-total-display');
  if (totalEl) totalEl.textContent = grandTotal;

  const list = document.getElementById('checkout-items-list');
  if (!list) return;

  list.innerHTML = Object.entries(cart).map(([name, { qty, price }]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:6px 0;border-bottom:1px solid var(--cream);font-size:13px;">
      <span style="font-weight:600;color:var(--td);">
        ${name} <span style="color:var(--tmut);font-weight:400;">×${qty}</span>
      </span>
      <span style="font-weight:700;color:var(--g2);">₹${qty * price}</span>
    </div>`).join('');
}
