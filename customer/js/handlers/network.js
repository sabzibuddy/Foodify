/* ============================================================
   NETWORK — SabziBuddy
   Online / Offline detection + UI feedback
   handlers/network.js
   ============================================================ */

/* ── STATE ───────────────────────────────────────────────── */
let _isOnline = navigator.onLine;

function isOnline() {
  return _isOnline;
}

/* ── BANNER ──────────────────────────────────────────────── */
function _showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (banner) return;                        // already showing

  banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #e53935; color: #fff;
    text-align: center; font-size: 13px;
    padding: 8px 16px; font-family: 'Outfit', sans-serif;
  `;
  banner.textContent = '📶 No internet connection — offline mode';
  document.body.prepend(banner);
}

function _hideOfflineBanner() {
  document.getElementById('offline-banner')?.remove();
}

/* ── HANDLERS ────────────────────────────────────────────── */
function _onOnline() {
  _isOnline = true;
  _hideOfflineBanner();
  showToast('✅ You’re back online!', 'success');
  // TODO: trigger sync.js cart/wishlist sync here
}

function _onOffline() {
  _isOnline = false;
  _showOfflineBanner();
  showToast('📶 No internet connection', 'error');
}

/* ── INIT (call once from init.js) ──────────────────────── */
function initNetwork() {
  window.addEventListener('online',  _onOnline);
  window.addEventListener('offline', _onOffline);

  // Show banner immediately if already offline at boot
  if (!_isOnline) _showOfflineBanner();
}
