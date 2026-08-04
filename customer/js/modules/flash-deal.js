/* ════════════════════════════════════════════════════════════
   FLASH DEAL MODULE
   Firestore: config/flashDeal
   Renders: #flash-deal-section
════════════════════════════════════════════════════════════ */

let _fdCountdownInterval = null;
let _fdZoneCountdownInterval = null;
let _fdConfig = null;
let _fdProductsUnsubscribe = null;

/* ── Main init — called from init.js or DOMContentLoaded ── */
function initFlashDeal() {
  if (typeof db === 'undefined') return;
  db.collection('config').doc('flashDeal').onSnapshot(async snap => {
    try {
      if (!snap.exists || !snap.data().enabled) { hideFlashDeal(); return; }
      _fdConfig = snap.data();
      await renderFlashDeal(_fdConfig);
    } catch(e) {
      console.warn('Flash Deal init error:', e);
      hideFlashDeal();
    }
  }, e => {
    console.warn('Flash Deal listener error:', e);
    hideFlashDeal();
  });
}

function hideFlashDeal() {
  const el = document.getElementById('flash-deal-section');
  if (el) el.style.display = 'none';
  if (_fdCountdownInterval) { clearInterval(_fdCountdownInterval); _fdCountdownInterval = null; }
  if (_fdProductsUnsubscribe) { _fdProductsUnsubscribe(); _fdProductsUnsubscribe = null; }
}

/* ── Render the full Flash Deal section ── */
async function renderFlashDeal(cfg) {
  const container = document.getElementById('flash-deal-section');
  if (!container) return;

  const title    = cfg.title    || 'Flash Deal 🔥';
  const subtitle = cfg.subtitle || 'Limited time offer';
  const mode     = cfg.timerMode || 'timer';
  const timerText = cfg.timerText || '';
  const timerEnd  = cfg.timerEnd
    ? (cfg.timerEnd.toDate ? cfg.timerEnd.toDate() : new Date(cfg.timerEnd))
    : null;

  /* ── Agar timer expire ho gayi toh hide karo ── */
  if ((mode === 'timer' || mode === 'both') && timerEnd && timerEnd <= new Date()) {
    hideFlashDeal(); return;
  }

  container.style.display = 'block';

  /* ── Timer pill HTML ── */
  let timerPillHtml = '';
  if (mode === 'timer' || mode === 'both') {
    timerPillHtml = `
      <div class="fd-timer-pill" id="fd-timer-pill">
        <span class="fd-timer-dot"></span>
        <span class="fd-timer-label">Ends in:</span>
        <span class="fd-timer-count" id="fd-countdown">00:00:00</span>
      </div>`;
  }

  /* ── Text badge HTML ── */
  let textBadgeHtml = '';
  if ((mode === 'text' || mode === 'both') && timerText) {
    textBadgeHtml = `<div class="fd-text-badge">${timerText}</div>`;
  }

  container.innerHTML = `
    <div class="fd-section-wrap">
      <div class="fd-section-header">
        <div class="fd-section-title-wrap">
          <span class="fd-section-title">${title}</span>
          ${subtitle ? `<span class="fd-section-sub">${subtitle}</span>` : ''}
        </div>
        <div class="fd-header-right">
          ${timerPillHtml}
          ${textBadgeHtml}
        </div>
      </div>
      <div class="fd-products-scroll" id="fd-products-scroll">
        <div class="fd-loading">Loading...</div>
      </div>
    </div>
  `;

  /* ── Start countdown ── */
  if ((mode === 'timer' || mode === 'both') && timerEnd) {
    _startFDCountdown(timerEnd);
  }

  /* ── Load flash deal products — live ── */
  _loadFDProducts();
}

/* ── Countdown engine ── */
function _startFDCountdown(endDate) {
  if (_fdCountdownInterval) clearInterval(_fdCountdownInterval);
  const pad = n => String(n).padStart(2, '0');

  const tick = () => {
    const diff = endDate - new Date();
    const el = document.getElementById('fd-countdown');
    if (!el || diff <= 0) {
      clearInterval(_fdCountdownInterval);
      hideFlashDeal();
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  tick(); /* Immediately show value */
  _fdCountdownInterval = setInterval(tick, 1000);
}

/* ── Load Flash Deal products — LIVE onSnapshot ── */
function _loadFDProducts() {
  const container = document.getElementById('flash-deal-section');
  if (_fdProductsUnsubscribe) { _fdProductsUnsubscribe(); _fdProductsUnsubscribe = null; }

  _fdProductsUnsubscribe = db.collection('products')
    .where('isFlashDeal', '==', true)
    .where('available', '==', true)
    .onSnapshot(snap => {
      const products = [];
      snap.forEach(d => products.push({ id: d.id, ...d.data() }));

      if (!products.length) {
        if (container) container.style.display = 'none';
        return;
      }

      if (container) container.style.display = 'block';
      const scroll = document.getElementById('fd-products-scroll');
      if (scroll) scroll.innerHTML = products.map(p => _fdProductCard(p)).join('');
    }, () => {
      if (container) container.style.display = 'none';
    });
}
/* ── Single product card HTML ── */
function _fdProductCard(p) {
  const price  = p.price || 0;
  const mrp    = p.mrp   || 0;
  const off    = mrp > price && mrp > 0 ? Math.round((mrp - price) / mrp * 100) : 0;
  const img    = p.img || p.image || '';
  const name   = p.name || '';
  const weight = p.qty && p.unit ? `${p.qty} ${p.unit}` : (p.weight || '');

  return `
    <div class="fd-prod-card" onclick="openProductDetail && openProductDetail('${p.name}')">
      <div class="fd-prod-img-wrap">
        ${off > 0 ? `<div class="fd-off-badge">${off}% OFF</div>` : ''}
        <img class="fd-prod-img" src="${img}" alt="${name}"
          onerror="this.src='';this.style.background='rgba(255,255,255,0.15)'">
      </div>
      <div class="fd-prod-info">
        <div class="fd-prod-weight">${weight}</div>
        <div class="fd-prod-name">${name}</div>
        <div class="fd-prod-price-row">
          <span class="fd-prod-price">₹${price}</span>
          ${mrp > price ? `<span class="fd-prod-mrp">₹${mrp}</span>` : ''}
        </div>
      </div>
      <button class="fd-add-btn"
        onclick="event.stopPropagation();(function(){var _it=(items||[]).find(function(x){return x.name==='${p.name.replace(/'/g, "\\'")}'});if(_it&&typeof changeQty==='function')changeQty(_it.name,_it.price,_it.mrp,1)})()">
        + ADD
      </button>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   ZONE BANNER TIMER FIX
   Zone orange banner ke andar jo --:--:-- dikhta hai use fix karta hai
   Home-sections.js ke render hone ke baad ye chalega
════════════════════════════════════════════════════════════ */
function fixZoneBannerTimer() {
  if (typeof db === 'undefined') return;
  db.collection('config').doc('zoneSettings').onSnapshot(snap => {
    try {
      if (!snap.exists) return;
      const d = snap.data();

      const timerMode = d.timerMode || 'timer';
      const timerText = d.timerText || '';

      /* timerEnd check */
      let timerEnd = null;
      if (d.timerEnd && (timerMode === 'timer' || timerMode === 'both')) {
        timerEnd = d.timerEnd.toDate ? d.timerEnd.toDate() : new Date(d.timerEnd);
        if (timerEnd <= new Date()) timerEnd = null;
      }

      /* Retry until DOM elements appear */
      let attempts = 0;
      const tryFix = () => {
        attempts++;

        const bannerTimerEls = document.querySelectorAll(
          '.zone-section-timer, .zone-timer-val, [data-zone-timer], .hs-zone-timer-count'
        );
        const pill     = document.getElementById('zone-timer-pill');
        const pillTime = document.getElementById('zone-timer-time');

        if (timerEnd) {
          if (pill && pillTime) {
            pill.style.display = (typeof currentTopCat !== 'undefined' && currentTopCat === 'zone') ? 'inline-flex' : 'none';
            _startFDZoneCountdown(timerEnd, [pillTime, ...bannerTimerEls]);
          } else if (bannerTimerEls.length > 0) {
            _startFDZoneCountdown(timerEnd, [...bannerTimerEls]);
          } else if (attempts < 20) {
            setTimeout(tryFix, 400);
          }
        } else {
          /* Timer nahi hai ya expire ho gaya */
          if (pill) pill.style.display = 'none';
          if (_fdZoneCountdownInterval) { clearInterval(_fdZoneCountdownInterval); _fdZoneCountdownInterval = null; }
        }

        /* Text badge */
        if (timerMode === 'text' || timerMode === 'both') {
          document.querySelectorAll('.hs-zone-timer-text, [data-zone-timer-text]').forEach(el => {
            el.textContent = timerText;
            el.style.display = 'block';
          });
        }
      };

      setTimeout(tryFix, 300);
    } catch(e) { console.warn('Zone banner timer fix error:', e); }
  }, e => { console.warn('fixZoneBannerTimer listener error:', e); });
}

function _startFDZoneCountdown(endDate, elements) {
  if (_fdZoneCountdownInterval) clearInterval(_fdZoneCountdownInterval);
  const pad = n => String(n).padStart(2, '0');
  if (!Array.isArray(elements) || !elements.length) return;

  const tick = () => {
    const diff = endDate - new Date();
    if (diff <= 0) {
      clearInterval(_fdZoneCountdownInterval);
      elements.forEach(el => { if (el) el.textContent = '00:00:00'; });
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;
    elements.forEach(el => { if (el) el.textContent = timeStr; });
  };

  tick();
  _fdZoneCountdownInterval = setInterval(tick, 1000);
}

/* ── Auto-init ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { initFlashDeal(); fixZoneBannerTimer(); }, 800);
  });
} else {
  setTimeout(() => { initFlashDeal(); fixZoneBannerTimer(); }, 800);
}