/* ════════════════════════════════════════
   modules/map.js
   Leaflet map picker — open/close, geocode,
   search (Photon), GPS, confirm location.
   Depends on: core/state.js, core/constants.js,
               core/utils.js (pointInPolygon, debounce),
               ui/toast.js, ui/validation.js
════════════════════════════════════════ */

/* ── Map-local state ──────────────────── */
let map        = null;
let currentLat = MAP_DEFAULT_LAT;   // constants.js (Firozabad default)
let currentLng = MAP_DEFAULT_LNG;
let gpsObtained = false;

/* BUG FIX: pehle raw setTimeout refs the, ab debounce() from utils.js */
const _reverseGeocode = debounce(_doReverseGeocode, GEOCODE_DEBOUNCE);
const _photonSearch   = debounce(_fetchPhoton, PHOTON_DEBOUNCE);

/* ── Nominatim / Photon endpoints ─────── */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON_URL    = 'https://photon.komoot.io/api/';

/* ════════════════════════════════════════
   OPEN / CLOSE MAP PICKER
════════════════════════════════════════ */
function openMapPicker() {
  const modal = document.getElementById('map-modal');
  if (!modal) return;
  modal.style.cssText = 'display:flex;flex-direction:column;position:fixed;inset:0;z-index:100002;transform:translateX(100%);transition:transform 0.35s ease;';
  requestAnimationFrame(() => { modal.style.transform = 'translateX(0)'; });

  setTimeout(() => {
    if (!map) {
      initMap(currentLat, currentLng);
      setupMapSearch();
      // GPS auto-center disabled — location.js handle karta hai
      // Agar location.js ne already GPS set kiya hai toh wahi use karo
      if (!gpsObtained) {
        const saved = (() => {
          try { return JSON.parse(localStorage.getItem('sb_user_location')); } catch { return null; }
        })();
        if (saved?.lat && saved?.lng) {
          currentLat = saved.lat;
          currentLng = saved.lng;
          gpsObtained = true;
          map?.setView([currentLat, currentLng], 16);
          _reverseGeocode(currentLat, currentLng);
        }
      }
    } else {
      map.invalidateSize();
      if (confirmedLat) map.setView([confirmedLat, confirmedLng], 16);
    }

    const confirmBtn = document.getElementById('confirm-loc-btn');
    if (confirmBtn) confirmBtn.disabled = false;
  }, 200);
}

function closeMapPicker() {
  const modal = document.getElementById('map-modal');
  if (!modal) return;
  modal.style.transform = 'translateX(100%)';
  setTimeout(() => { modal.style.cssText = ''; modal.classList.remove('open'); }, 380);

  const sugg = document.getElementById('photon-suggestions');
  if (sugg) sugg.style.display = 'none';
}

/* ════════════════════════════════════════
   LEAFLET MAP INIT
════════════════════════════════════════ */
function initMap(lat, lng) {
  // Already init — just recenter
  if (map) { map.invalidateSize(); map.setView([lat, lng], 16); return; }

  map = L.map('leaflet-map', {
    zoomControl:      false,
    touchZoom:        true,
    tap:              true,
    tapTolerance:     15,
    scrollWheelZoom:  true,
    doubleClickZoom:  true,
  }).setView([lat, lng], MAP_DEFAULT_ZOOM);

  // Tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  // Delivery zone polygon
  L.polygon(deliveryZone, {
    color: '#1C3829', fillColor: '#6BBF7B', fillOpacity: 0.12, weight: 2,
  }).addTo(map);

  // On map move → reverse geocode
  map.on('moveend', () => {
    const c    = map.getCenter();
    currentLat = c.lat;
    currentLng = c.lng;

    const confirmBtn = document.getElementById('confirm-loc-btn');
    if (confirmBtn) confirmBtn.disabled = false;

    _reverseGeocode(currentLat, currentLng);
  });

  _reverseGeocode(lat, lng);
}

/* ════════════════════════════════════════
   REVERSE GEOCODE (Nominatim)
   BUG FIX: pehle raw setTimeout reverseDebounce tha
   Ab debounce() wrapper use karta hai
════════════════════════════════════════ */
async function _doReverseGeocode(lat, lng) {
  const result = await safeAsync(async () => {
    const res  = await fetch(`${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
    return res.json();
  }, ERR.NETWORK, true);

  const addr  = result?.address || {};
  const area  = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || 'Selected Location';
  const city  = addr.city   || addr.town          || addr.village || 'Firozabad';
  const full  = result?.display_name || '';

  _setMapBottomBar(area, full, lat, lng);
  setDlrCity(city);
  setDlrAddr([area, city, addr.state || ''].filter(Boolean).join(', '));
}

/* ════════════════════════════════════════
   CONFIRM LOCATION
   BUG FIX: pehle city parse weird tha —
   ab zone check ke baad clean set hota hai
════════════════════════════════════════ */
function confirmLocation() {
  // BUG FIX: pointInPolygon now from core/utils.js, not duplicate here
  const inside = pointInPolygon([currentLat, currentLng], deliveryZone);

  if (!inside) {
    const _ns = document.getElementById('no-service-overlay');
    if (_ns) _ns.style.zIndex = '100002';
    _ns?.classList.add('open');
    return;
  }

  confirmedLat  = currentLat;
  confirmedLng  = currentLng;

  const areaName = document.getElementById('map-area-name')?.innerText || 'Location Selected';
  const addrFull = document.getElementById('map-full-addr')?.innerText  || '';
  confirmedAddr  = addrFull;
  selectedArea   = areaName;
  locationLink   = `https://www.google.com/maps?q=${currentLat},${currentLng}`;

  // Update location picker button
  const lpbTitle = document.getElementById('lpb-title');
  const lpbSub   = document.getElementById('lpb-sub');
  const lpbBtn   = document.getElementById('loc-picker-btn');
  if (lpbTitle) lpbTitle.innerText = areaName || 'Location Selected ✓';
  if (lpbSub)   lpbSub.innerText   = addrFull
    ? addrFull.substring(0, 65)
    : `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
  if (lpbBtn)   lpbBtn.classList.add('confirmed');

  // Header update
  setDlrAddr(areaName || 'Location set');

  closeMapPicker();
  showToast('📍 Location confirmed!', 'success');

  // Checkout address mode hook — if set by checkout-address.js, call it
  if (typeof window._checkoutMapConfirm === 'function') {
    window._checkoutMapConfirm(confirmedLat, confirmedLng, areaName, addrFull);
  }
}

/* ════════════════════════════════════════
   MAP CONTROLS
════════════════════════════════════════ */
function mapZoom(v) {
  if (!map) return;
  if (v === 1) map.zoomIn(); else map.zoomOut();
}

function recenterGPS() {
  if (!navigator.geolocation) { showToast('GPS not supported'); return; }

  navigator.geolocation.getCurrentPosition(
    pos => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      map?.setView([currentLat, currentLng], 17);
      _reverseGeocode(currentLat, currentLng);
    },
    () => showToast('Location permission denied.', 'error'),
    { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
  );
}

/* ════════════════════════════════════════
   MAP SEARCH SETUP
════════════════════════════════════════ */
function setupMapSearch() {
  const inp = document.getElementById('map-search-input');
  const box = document.getElementById('photon-suggestions');
  if (!inp || !box) return;

  inp.addEventListener('input', () => {
    const val    = inp.value.trim();
    const clearBtn = document.getElementById('map-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('visible', val.length > 0);

    if (val.length < 2) { box.style.display = 'none'; return; }
    _photonSearch(val, false);
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); triggerMapSearch(); }
    if (e.key === 'Escape') box.style.display = 'none';
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!box.contains(e.target) && e.target !== inp) box.style.display = 'none';
  });
}

function triggerMapSearch() {
  const val = document.getElementById('map-search-input')?.value?.trim();
  if (!val || val.length < 2) return;
  _fetchPhoton(val, true);
}

function clearMapSearch() {
  const inp      = document.getElementById('map-search-input');
  const box      = document.getElementById('photon-suggestions');
  const clearBtn = document.getElementById('map-clear-btn');
  if (inp)      inp.value        = '';
  if (box)      box.style.display = 'none';
  if (clearBtn) clearBtn.classList.remove('visible');
  inp?.focus();
}

/* ════════════════════════════════════════
   PHOTON GEOCODER (search suggestions)
════════════════════════════════════════ */
async function _fetchPhoton(query, moveToFirst) {
  const box = document.getElementById('photon-suggestions');
  if (!box) return;

  box.innerHTML = '<div class="photon-item"><div class="photon-item-main" style="color:var(--tmut)">🔍 Searching...</div></div>';
  box.style.display = 'block';

  const localQ = query.toLowerCase().includes('firozabad')
    ? query
    : `${query}, Firozabad, Uttar Pradesh`;

  const data = await safeAsync(async () => {
    const res = await fetch(`${PHOTON_URL}?q=${encodeURIComponent(localQ)}&limit=7&countrycode=in`);
    return res.json();
  }, ERR.NETWORK, true);

  if (!data?.features?.length) {
    box.innerHTML = '<div class="photon-item"><div class="photon-item-main" style="color:var(--tmut)">No results found.</div></div>';
    box.style.display = 'block'; return;
  }

  box.innerHTML = '';
  data.features.forEach((place, idx) => {
    const props   = place.properties;
    const primary = props.name || props.city || props.town || props.village || 'Location';
    const parts   = [props.street, props.suburb, props.city || props.town, props.state, props.postcode].filter(Boolean);
    const secondary = parts.join(', ');
    const [lng, lat] = place.geometry.coordinates;

    const item = document.createElement('div');
    item.className = 'photon-item';
    item.innerHTML = `
      <div class="photon-item-main">
        <svg width="14" height="14" viewBox="0 0 24 24">
          <ellipse cx="12" cy="21" rx="4" ry="1.5" fill="rgba(0,0,0,0.1)"/>
          <path fill="#1C3829" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="white"/>
        </svg>
        ${primary}
      </div>
      <div class="photon-item-sub">${secondary}</div>`;

    item.addEventListener('click', () => {
      currentLat = lat; currentLng = lng;
      map?.setView([lat, lng], 17);

      const inp = document.getElementById('map-search-input');
      if (inp) inp.value = primary + (secondary ? ', ' + secondary.split(',')[0] : '');

      box.style.display = 'none';
      _reverseGeocode(lat, lng);

      const confirmBtn = document.getElementById('confirm-loc-btn');
      if (confirmBtn) confirmBtn.disabled = false;
    });

    box.appendChild(item);

    // Auto-center to first result
    if (moveToFirst && idx === 0 && map) {
      map.setView([lat, lng], 17);
      _reverseGeocode(lat, lng);
    }
  });

  box.style.display = 'block';
}

/* ════════════════════════════════════════
   VOICE SEARCH (map area)
════════════════════════════════════════ */
function startMapVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice not supported', 'error'); return; }

  const r   = new SR();
  r.lang    = 'hi-IN';
  r.interimResults = false;

  const btn = document.getElementById('map-voice-btn');

  r.onstart  = () => { btn?.classList.add('recording'); showToast('Listening... Say your area or colony name'); };
  r.onresult = e => {
    const text = e.results[0][0].transcript;
    const inp  = document.getElementById('map-search-input');
    if (inp) { inp.value = text; _fetchPhoton(text, true); }
  };
  r.onerror  = () => showToast('Voice search failed', 'error');
  r.onend    = () => btn?.classList.remove('recording');
  r.start();
}

/* ════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════ */

/** Map bottom bar update */
function _setMapBottomBar(area, full, lat, lng) {
  const areaEl   = document.getElementById('map-area-name');
  const fullEl   = document.getElementById('map-full-addr');
  const coordsEl = document.getElementById('map-coords');
  if (areaEl)   areaEl.innerText   = area;
  if (fullEl)   fullEl.innerText   = full;
  if (coordsEl) coordsEl.innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
