/* ════════════════════════════════════════════════════════════
   modules/location.js — SabziBuddy
   Zepto-style first-time location permission flow.

   Flow:
     App load → localStorage check
       → saved?  → silently restore → done
       → not saved? → show loc-modal
           → GPS button   → browser permission → Nominatim → save
           → Manual search → Photon suggestions → save
           → Skip          → default Firozabad  → save

   Also defines: setDlrCity(), setDlrAddr()  (used by map.js too)
   Depends on: constants.js (MAP_DEFAULT_LAT/LNG), ui/toast.js
════════════════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────────────── */
const LOC_KEY         = 'sb_user_location';
const LOC_EXPIRY_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days
const NOM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON_API_URL  = 'https://photon.komoot.io/api/';

/* ── Module state ───────────────────────────────────────── */
let _locSearchTimer   = null;
let _locGpsLoading    = false;
let _watchId          = null;   // watchPosition ID — cleanup ke liye

/* ════════════════════════════════════════════════════════════
   PUBLIC: setDlrCity / setDlrAddr
   Update header location text.
   Called here + by map.js on confirmLocation().
════════════════════════════════════════════════════════════ */
function setDlrCity(city) {
  const el = document.getElementById('dlr-city');
  if (el) el.textContent = city || 'Firozabad';
}

function setDlrAddr(addr) {
  const el = document.getElementById('dlr-addr-text');
  if (el) el.textContent = addr || 'Tap to set location';
}

/* ════════════════════════════════════════════════════════════
   INIT — called on DOMContentLoaded
════════════════════════════════════════════════════════════ */
function initLocationFlow() {
  const saved = _loadSavedLocation();

  if (saved) {
    /* ── Restore saved location silently ── */
    setDlrCity(saved.city);
    setDlrAddr(saved.area ? `${saved.area}, ${saved.city}` : saved.city);

    /* Expose for map.js / checkout */
    _exposeGlobals(saved.lat, saved.lng, saved.addr);
    return;
  }

  /* ── No saved location → show modal after splash ── */
  setTimeout(showLocModal, 2000);
}

/* ════════════════════════════════════════════════════════════
   SHOW / HIDE MODAL
════════════════════════════════════════════════════════════ */
function showLocModal() {
  const modal = document.getElementById('loc-permission-modal');
  if (!modal) return;

  _resetLocModal();
  modal.classList.add('loc-modal--visible');
  document.body.style.overflow = 'hidden';
}

function hideLocModal() {
  const modal = document.getElementById('loc-permission-modal');
  if (!modal) return;

  modal.classList.remove('loc-modal--visible');
  modal.classList.add('loc-modal--closing');

  setTimeout(() => {
    modal.classList.remove('loc-modal--closing');
    document.body.style.overflow = '';
  }, 380);
}

/* ════════════════════════════════════════════════════════════
   GPS FLOW — watchPosition strategy
   
   How it works:
   1. watchPosition start karo — multiple readings aati hain
   2. Har reading mein accuracy check karo
   3. Jab accuracy achi ho (≤50m) ya 12 sec ho jaayein → best reading use karo
   4. watchPosition stop karo (clearWatch) — battery drain nahi hoga
════════════════════════════════════════════════════════════ */
function locUseGPS() {
  if (_locGpsLoading) return;

  if (!navigator.geolocation) {
    _showLocError('GPS is aapke browser mein support nahi hai.');
    return;
  }

  _locGpsLoading = true;
  _setGpsBtn('loading');

  /* Best reading track karte hain */
  let _bestPos        = null;   // sabse accurate position abhi tak
  let _watchTimeout   = null;   // 12 sec baad force-finish

  /* ── Watch stop karne ka helper ── */
  function _stopWatch() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
    if (_watchTimeout) {
      clearTimeout(_watchTimeout);
      _watchTimeout = null;
    }
  }

  /* ── Best position milne ke baad address fetch karo ── */
  async function _processPosition(pos) {
    _stopWatch();
    _setGpsBtn('geocoding');

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    try {
      const res  = await fetch(
        `${NOM_REVERSE_URL}?format=json&lat=${lat}&lon=${lng}&accept-language=en`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      const addr = data?.address || {};

      const area = addr.suburb || addr.neighbourhood || addr.quarter
                || addr.city_district || addr.road || 'Your Location';
      const city = addr.city || addr.town || addr.village || 'Firozabad';
      const full = data?.display_name || `${area}, ${city}`;

      _finishLocationFlow(lat, lng, area, city, full, 'gps');

    } catch {
      /* Geocoding fail — coordinates toh mil gaye */
      _finishLocationFlow(lat, lng, 'Your Location', 'Firozabad', '', 'gps');
    }
  }

  /* ── watchPosition start ── */
  _watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const accuracy = pos.coords.accuracy; // metres

      /* Pehli reading aayi — update best if better */
      if (_bestPos === null || accuracy < _bestPos.coords.accuracy) {
        _bestPos = pos;
      }

      /* ✅ 50 meter se better mila → turant use karo, wait mat karo */
      if (accuracy <= 50) {
        _processPosition(_bestPos);
        return;
      }

      /* Accuracy abhi bhi kharab hai → watchPosition readings aati rahein */
      /* (12 sec timeout handle karega agar kabhi 50m nahi aaya) */
    },
    (err) => {
      _stopWatch();
      _locGpsLoading = false;
      _setGpsBtn('idle');

      if (err.code === 1) {
        _showLocError('Location permission deny ki. Manually apna area search karein.');
        _focusManualSearch();
      } else {
        _showLocError('GPS timeout. Manually search karein.');
        _focusManualSearch();
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,        // fresh reading chahiye, cache nahi
      timeout: 15000        // har individual reading ka timeout
    }
  );

  /* ── 12 sec baad jo bhi best reading hai, wahi use karo ── */
  /* Mobile pe GPS fix aane mein kabhi kabhi time lagta hai */
  _watchTimeout = setTimeout(() => {
    if (!_locGpsLoading) return; // already finish ho gaya

    if (_bestPos) {
      /* Koi na koi reading toh aayi — use it */
      _processPosition(_bestPos);
    } else {
      /* Koi reading hi nahi aayi — error */
      _stopWatch();
      _locGpsLoading = false;
      _setGpsBtn('idle');
      _showLocError('GPS signal nahi mila. Manually search karein.');
      _focusManualSearch();
    }
  }, 12000);
}

/* ════════════════════════════════════════════════════════════
   MANUAL SEARCH FLOW (Photon)
════════════════════════════════════════════════════════════ */
function locOnSearchInput() {
  const inp = document.getElementById('loc-search-input');
  if (!inp) return;

  const val = inp.value.trim();
  clearTimeout(_locSearchTimer);

  if (val.length < 2) {
    _hideSuggestions();
    return;
  }

  /* Debounce 350ms */
  _locSearchTimer = setTimeout(() => _fetchLocSuggestions(val), 350);
}

async function _fetchLocSuggestions(query) {
  const box = document.getElementById('loc-suggestions');
  if (!box) return;

  box.innerHTML = `<div class="loc-sugg-loading">🔍 Searching...</div>`;
  box.style.display = 'block';

  /* Bias search towards Firozabad if not already mentioned */
  const localQ = query.toLowerCase().includes('firozabad')
    ? query
    : `${query}, Firozabad, Uttar Pradesh, India`;

  try {
    const res  = await fetch(
      `${PHOTON_API_URL}?q=${encodeURIComponent(localQ)}&limit=6&countrycode=in`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();

    if (!data?.features?.length) {
      box.innerHTML = `<div class="loc-sugg-empty">Koi result nahi mila. Doosra naam try karein.</div>`;
      return;
    }

    box.innerHTML = '';
    data.features.forEach(place => {
      const p       = place.properties;
      const primary = p.name || p.city || p.town || p.village || 'Location';
      const parts   = [p.street, p.suburb, p.city || p.town, p.state].filter(Boolean);
      const sub     = parts.join(', ');
      const [lng, lat] = place.geometry.coordinates;

      const item = document.createElement('button');
      item.className = 'loc-sugg-item';
      item.innerHTML = `
        <svg class="loc-sugg-icon" width="14" height="14" viewBox="0 0 24 24">
          <path fill="var(--g2)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="white"/>
        </svg>
        <div class="loc-sugg-text">
          <span class="loc-sugg-primary">${primary}</span>
          <span class="loc-sugg-secondary">${sub}</span>
        </div>`;

      item.onclick = () => _selectSuggestion(lat, lng, primary, p.city || p.town || 'Firozabad', sub);
      box.appendChild(item);
    });

  } catch {
    box.innerHTML = `<div class="loc-sugg-empty">Network error. Dobara try karein.</div>`;
  }
}

function _selectSuggestion(lat, lng, area, city, addr) {
  _hideSuggestions();
  const inp = document.getElementById('loc-search-input');
  if (inp) inp.value = `${area}, ${city}`;

  const full = addr || `${area}, ${city}, Uttar Pradesh`;
  _finishLocationFlow(lat, lng, area, city, full, 'manual');
}

/* ════════════════════════════════════════════════════════════
   SKIP — use default Firozabad
════════════════════════════════════════════════════════════ */
function locSkip() {
  const lat  = MAP_DEFAULT_LAT;
  const lng  = MAP_DEFAULT_LNG;
  const area = 'Firozabad';
  const city = 'Firozabad';
  const addr = 'Firozabad, Uttar Pradesh';

  _finishLocationFlow(lat, lng, area, city, addr, 'skip');
}

/* ════════════════════════════════════════════════════════════
   FINISH — save + update header + close modal
════════════════════════════════════════════════════════════ */
function _finishLocationFlow(lat, lng, area, city, addr, source) {
  /* 1. Save to localStorage */
  _saveLocation({ lat, lng, area, city, addr, source });

  /* 2. Update header */
  setDlrCity(city);
  setDlrAddr(`${area}, ${city}`);

  /* 3. Expose globals for map.js / checkout-address.js */
  _exposeGlobals(lat, lng, addr);

  /* 4. Close modal */
  hideLocModal();
  _locGpsLoading = false;

  /* 5. Toast */
  if (source !== 'skip' && typeof showToast === 'function') {
    showToast(`📍 ${area} set as your location!`, 'success');
  }
}

/* ════════════════════════════════════════════════════════════
   LOCALSTORAGE HELPERS
════════════════════════════════════════════════════════════ */
function _saveLocation(data) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify({
      ...data,
      savedAt: Date.now()
    }));
  } catch { /* Storage full ya private mode */ }
}

function _loadSavedLocation() {
  try {
    const raw  = localStorage.getItem(LOC_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    /* Expiry check — 7 days baad dobara poochho */
    if (Date.now() - (data.savedAt || 0) > LOC_EXPIRY_MS) {
      localStorage.removeItem(LOC_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   EXPOSE GLOBALS (map.js + checkout use karta hai)
════════════════════════════════════════════════════════════ */
function _exposeGlobals(lat, lng, addr) {
  if (typeof confirmedLat !== 'undefined')  window.confirmedLat  = lat;
  if (typeof confirmedLng !== 'undefined')  window.confirmedLng  = lng;
  if (typeof confirmedAddr !== 'undefined') window.confirmedAddr = addr;
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════════════════ */
function _setGpsBtn(state) {
  const btn  = document.getElementById('loc-gps-btn');
  const icon = document.getElementById('loc-gps-icon');
  const text = document.getElementById('loc-gps-text');
  if (!btn) return;

  const states = {
    idle:      { icon: '📍', text: 'Use My Current Location',                      disabled: false, cls: '' },
    loading:   { icon: '⏳', text: 'Getting GPS...',                                disabled: true,  cls: 'loc-gps-btn--loading' },
    geocoding: { icon: '📌', text: 'Location mil gayi, address fetch ho raha hai...', disabled: true,  cls: 'loc-gps-btn--loading' },
  };
  const s = states[state] || states.idle;

  if (icon) icon.textContent = s.icon;
  if (text) text.textContent = s.text;
  btn.disabled = s.disabled;
  btn.className = `loc-gps-btn ${s.cls}`;
}

function _showLocError(msg) {
  const el = document.getElementById('loc-error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 4000);
  }
}

function _hideSuggestions() {
  const box = document.getElementById('loc-suggestions');
  if (box) box.style.display = 'none';
}

function _focusManualSearch() {
  setTimeout(() => {
    const inp = document.getElementById('loc-search-input');
    if (inp) inp.focus();
  }, 300);
}

function _resetLocModal() {
  _setGpsBtn('idle');
  _hideSuggestions();
  _locGpsLoading = false;

  const inp = document.getElementById('loc-search-input');
  if (inp) inp.value = '';

  const err = document.getElementById('loc-error-msg');
  if (err) err.style.display = 'none';
}

/* ════════════════════════════════════════════════════════════
   AUTO INIT on DOM ready
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initLocationFlow);
