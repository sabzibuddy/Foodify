/* ════════════════════════════════════════
   modules/checkout-address.js
   FreshCart-style checkout address flow:
     Step 1 → Address (mini-map + saved list + add new)
     Step 2 → Delivery Slot  (existing slots-grid)
     Step 3 → Order form + Place Order

   Depends on: core/state.js, core/constants.js,
               core/utils.js, ui/toast.js,
               modules/map.js (openMapPicker / confirmLocation)
               modules/slots.js (renderSlots)
════════════════════════════════════════ */

/* ── Module-level state ──────────────── */
let _coStep          = 1;        // 1=Address, 2=Slot, 3=Order
let _coSelectedAddrId = null;    // id of selected address
let _coAddresses     = [];       // saved addresses array
let _coMiniMap       = null;     // Leaflet mini-map instance
let _coMapMarker     = null;     // marker on mini map
let _coAddrMode      = false;    // are we in "add address" map mode?
let _coNewAddrPinLat  = null;
let _coNewAddrPinLng  = null;
let _coNewAddrArea    = '';
let _coNewAddrFull    = '';
let _coNewAddrCity    = '';   // parsed city from Nominatim
let _coNewAddrState   = '';   // parsed state from Nominatim
let _coNewAddrPincode = '';   // parsed pincode from Nominatim
let _coSheetOpen      = false;
let _coSelectedType   = 'home';   // home|work|other
let _coAddAddrMap     = null;     // Leaflet map on add-addr page
let _coAddAddrLat     = null;
let _coAddAddrLng     = null;

const CO_LS_KEY = 'sb_addresses';

/* ════════════════════════════════════════
   INIT — called from openCheckout() in cart.js
════════════════════════════════════════ */
function initCheckoutAddress() {
  _coStep = 1;
  _coSelectedAddrId = null;

  // Load addresses from localStorage
  _coAddresses = _coLoadAddresses();

  // Build the multi-step UI
  _coInjectHTML();

  // Show step 1
  _goToCoStep(1, true);

  // Init mini-map after DOM settles
  requestAnimationFrame(() => setTimeout(() => _coInitMiniMap(), 150));
}

/* ════════════════════════════════════════
   STEP NAVIGATION
════════════════════════════════════════ */
function goToCheckoutStep(n) {
  if (n === 2) {
    if (!_coSelectedAddrId) {
      showToast('Please select or add a delivery address first', 'error');
      return;
    }
    // Sync selected address into global state for order.js validation
    _coSyncSelectedAddr();
  }
  if (n === 3) {
    // Ensure a slot is selected
    if (!selectedSlot) {
      showToast('Please select a delivery slot', 'error');
      return;
    }
    // Refresh order summary
    _renderCoOrderSummary();
    // Pre-fill name/phone from currentUser
    _coPreFillProfile();
  }
  _goToCoStep(n);
}

function handleCheckoutBack() {
  if (_coStep > 1) {
    _goToCoStep(_coStep - 1);
  } else {
    closeCheckout();
  }
}

function _goToCoStep(n, instant) {
  _coStep = n;

  // Steps indicator
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`co-step-dot-${i}`);
    const sec = document.getElementById(`co-step-section-${i}`);
    if (!dot || !sec) continue;
    dot.parentElement.classList.toggle('active', i === n);
    dot.parentElement.classList.toggle('done',   i < n);
    sec.classList.toggle('hidden', i !== n);
  }

  // Step lines
  document.getElementById('co-line-1-2')?.classList.toggle('filled', n >= 2);
  document.getElementById('co-line-2-3')?.classList.toggle('filled', n >= 3);

  // Back button header title
  const title = document.querySelector('#order-sec .pp-header-title');
  if (title) {
    title.textContent = n === 1 ? '📦 Checkout' : n === 2 ? '🕒 Delivery Slot' : '📝 Place Order';
  }

  // When returning to step 1 — refresh list
  if (n === 1) {
    _coRenderAddressList();
    if (_coMiniMap) setTimeout(() => _coMiniMap.invalidateSize(), 200);
  }
  // When step 2 — render slots
  if (n === 2) {
    if (typeof renderSlots === 'function') renderSlots();
  }
}

/* ════════════════════════════════════════
   HTML INJECTION — replaces order-sec content
════════════════════════════════════════ */
function _coInjectHTML() {
  const scroll = document.querySelector('#order-sec .checkout-scroll');
  if (!scroll) return;

  // Insert steps indicator after header
  const header = document.querySelector('#order-sec .pp-header');
  let stepsEl = document.getElementById('co-steps-bar');
  if (!stepsEl) {
    stepsEl = document.createElement('div');
    stepsEl.id = 'co-steps-bar';
    stepsEl.className = 'co-steps';
    stepsEl.innerHTML = `
      <div class="co-step active" id="co-step-ind-1">
        <div class="co-step-dot" id="co-step-dot-1">1</div>
        <span>Address</span>
      </div>
      <div class="co-step-line" id="co-line-1-2"></div>
      <div class="co-step" id="co-step-ind-2">
        <div class="co-step-dot" id="co-step-dot-2">2</div>
        <span>Slot</span>
      </div>
      <div class="co-step-line" id="co-line-2-3"></div>
      <div class="co-step" id="co-step-ind-3">
        <div class="co-step-dot" id="co-step-dot-3">3</div>
        <span>Order</span>
      </div>`;
    header?.insertAdjacentElement('afterend', stepsEl);
  }

  // Build scroll contents
  scroll.innerHTML = `

    <!-- ═══ STEP 1: ADDRESS ═══ -->
    <div class="co-step-section" id="co-step-section-1">

      <!-- Mini Map (interactive: drag/zoom/pan + maximize) -->
      <div class="co-mini-map-wrap">
        <div id="co-mini-map"></div>
        <div class="co-mini-pin">
          <svg viewBox="0 0 24 24">
            <ellipse cx="12" cy="21" rx="4" ry="1.5" fill="rgba(0,0,0,0.18)"/>
            <path fill="url(#pinGrad)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="3" fill="white"/>
            <circle cx="10.5" cy="7.5" r="1" fill="rgba(255,255,255,0.65)"/>
          </svg>
        </div>
        <div class="co-map-live-chip" id="co-map-live-chip">
          <span class="co-loc-dot"></span>
          <span id="co-map-chip-text">Detecting location…</span>
        </div>
        <!-- GPS recenter -->
        <button class="co-gps-btn" onclick="_coRecenterGPS()" title="My Location">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
        </button>
        <!-- ✅ Maximize — opens full-screen map picker -->
        <button class="co-map-maximize-btn" onclick="_coOpenFullMap()" title="Open full map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
        <!-- ✅ Mini zoom buttons -->
        <div class="co-mini-zoom-btns">
          <button class="co-mini-zoom-btn" onclick="if(_coMiniMap)_coMiniMap.zoomIn()">+</button>
          <button class="co-mini-zoom-btn" onclick="if(_coMiniMap)_coMiniMap.zoomOut()">−</button>
        </div>
      </div>

      <!-- Address list -->
      <div class="co-section-card">
        <div class="co-section-header">
          <div class="co-section-title">Select Delivery Address</div>
        </div>
        <div id="co-addr-list"></div>
        <!-- ✅ Fixed: uses text + instead of Font Awesome fa-plus -->
        <button class="co-add-addr-btn" onclick="openAddNewAddress()">
          <span class="co-add-plus">+</span> Add New Address
        </button>
      </div>

      <button class="co-continue-btn" id="co-addr-continue-btn"
              onclick="goToCheckoutStep(2)" disabled>
        Continue to Delivery Slot <span class="btn-arrow">›</span>
      </button>

    </div><!-- /step 1 -->


    <!-- ═══ STEP 2: DELIVERY SLOT ═══ -->
    <div class="co-step-section hidden" id="co-step-section-2">
      <div class="co-section-card">
        <div class="co-slot-title">🕒 Choose Delivery Slot</div>
        <div class="co-slot-sub" style="color:var(--tmut);font-size:13px;margin-bottom:16px;">
          When should we deliver?
        </div>
        <div class="slots-grid" id="slots-grid"></div>
        <div class="field-error" id="slot-error"></div>
      </div>
      <button class="co-continue-btn" onclick="goToCheckoutStep(3)">
        Continue to Order <span class="btn-arrow">›</span>
      </button>
    </div><!-- /step 2 -->


    <!-- ═══ STEP 3: ORDER DETAILS ═══ -->
    <div class="co-step-section hidden" id="co-step-section-3">

      <!-- Order Summary Card -->
      <div class="checkout-summary-card">
        <div class="checkout-summary-title">🛒 Order Summary</div>
        <div id="checkout-items-list"></div>
        <div class="checkout-total-row">
          <span class="checkout-total-lbl">Total</span>
          <span class="checkout-total-amt">₹<span id="checkout-total-display">0</span></span>
        </div>
      </div>

      <!-- Delivery Slot Recap -->
      <div class="co-section-card" id="co-slot-recap-card" style="padding:12px 14px;margin-bottom:0;">
        <div class="co-section-title" style="margin-bottom:8px;">🕒 Delivery Slot</div>
        <div id="co-slot-recap-body" style="font-size:13px;color:var(--tm);line-height:1.6;font-weight:600;"></div>
        <button onclick="_goToCoStep(2)"
          style="font-size:12px;color:var(--g4);font-weight:700;background:none;border:none;
                 padding:6px 0 0;cursor:pointer;font-family:'Outfit',sans-serif;">
          ✏️ Change Slot
        </button>
      </div>

      <!-- Delivery Address Recap -->
      <div class="co-section-card" id="co-addr-recap-card" style="padding:12px 14px;">
        <div class="co-section-title" style="margin-bottom:8px;">📍 Delivering To</div>
        <div id="co-addr-recap-body" style="font-size:13px;color:var(--tm);line-height:1.6;"></div>
        <button onclick="_goToCoStep(1)"
          style="font-size:12px;color:var(--g4);font-weight:700;background:none;border:none;
                 padding:6px 0 0;cursor:pointer;font-family:'Outfit',sans-serif;">
          ✏️ Change Address
        </button>
      </div>

      <!-- Order Form Card -->
      <div class="order-form-card">

        <!-- Details section: hidden when saved address is selected -->
        <div id="co-details-section">
          <div class="order-title">📦 Your Details</div>
          <div class="order-sub">We'll confirm your order on WhatsApp</div>

          <div class="input-row">
            <div class="input-group">
              <label><span class="req-star">*</span> Your Name</label>
              <input type="text" id="name" placeholder="Enter Your Full Name"
                oninput="validateName(this)" autocomplete="name">
              <div class="field-error" id="name-error"></div>
            </div>
            <div class="input-group">
              <label><span class="req-star">*</span> Mobile Number</label>
              <div class="phone-field-wrap" id="phone-wrap"
                onfocusin="this.classList.add('focused')"
                onfocusout="this.classList.remove('focused')">
                <span class="phone-field-prefix">+91</span>
                <input type="tel" id="phone" placeholder="9800012345" maxlength="10"
                  oninput="validatePhone(this)" autocomplete="tel">
              </div>
              <div class="field-error" id="phone-error"></div>
            </div>
          </div>

          <div class="input-group">
            <label>Alternative Number <span class="optional-lbl">(Optional)</span></label>
            <div class="phone-field-wrap"
              onfocusin="this.classList.add('focused')"
              onfocusout="this.classList.remove('focused')">
              <span class="phone-field-prefix">+91</span>
              <input type="tel" id="alt-phone" placeholder="9800012345" maxlength="10"
                oninput="this.value=this.value.replace(/\D/g,'').slice(0,10);_coCheckFormValidity()" autocomplete="tel">
            </div>
          </div>
        </div><!-- /#co-details-section -->

        <!-- Hidden fields always present for order.js -->
        <input type="hidden" id="name-hidden">
        <input type="hidden" id="phone-hidden">

        <!-- Hidden address + location fields for order.js validation -->
        <input type="hidden" id="address">
        <div class="field-error" id="address-error"></div>
        <div class="field-error" id="location-error"></div>

        <!-- Free Delivery Bar -->
        <div class="order-fd-bar" id="order-fd-bar">
          <div class="order-fd-inner">
            <div class="order-fd-track-wrap">
              <div class="order-fd-wrap">
                <div class="order-fd-track">
                  <div class="order-fd-fill" id="order-fd-fill"></div>
                </div>
                <div class="truck" id="truck">🚚</div>
              </div>
              <div class="order-fd-text" id="order-fd-text">Add items to unlock free delivery</div>
            </div>
          </div>
        </div>

        <button class="order-btn" id="order-btn" onclick="placeOrder()">
          🛒 Place Order
        </button>
      </div><!-- /.order-form-card -->

    </div><!-- /step 3 -->

  `;

  // Render address list
  _coRenderAddressList();
}

/* ════════════════════════════════════════
   MINI MAP INIT
════════════════════════════════════════ */
function _coInitMiniMap() {
  const el = document.getElementById('co-mini-map');
  if (!el) return;
  if (_coMiniMap) { _coMiniMap.invalidateSize(); return; }

  const lat = confirmedLat || MAP_DEFAULT_LAT;
  const lng = confirmedLng || MAP_DEFAULT_LNG;

  _coMiniMap = L.map('co-mini-map', {
    zoomControl:     false,
    dragging:        true,      // ✅ interactive - drag to pan
    touchZoom:       true,      // ✅ pinch zoom on mobile
    doubleClickZoom: true,      // ✅ double-tap to zoom
    scrollWheelZoom: true,      // ✅ scroll wheel zoom
    tap:             true,
    tapTolerance:    15,
    keyboard:        false,
    attributionControl: false,
  }).setView([lat, lng], 15);

  // Sync mini-map movement with chip label
  _coMiniMap.on('moveend', () => {
    const c = _coMiniMap.getCenter();
    _coUpdateChip(c.lat, c.lng);
    if (_coMapMarker) _coMiniMap.removeLayer(_coMapMarker);
    _coMapMarker = L.circleMarker([c.lat, c.lng], {
      radius: 8, fillColor: '#1C3829', color: '#fff',
      weight: 2, fillOpacity: 0.95,
    }).addTo(_coMiniMap);
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(_coMiniMap);

  // Auto-detect GPS and pan + place marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const plat = pos.coords.latitude;
        const plng = pos.coords.longitude;
        // Always pan to real GPS location
        _coMiniMap?.setView([plat, plng], 15);
        _coUpdateChip(plat, plng);
        // If no saved address confirmed yet, also place the marker here
        if (!confirmedLat) {
          confirmedLat = plat;
          confirmedLng = plng;
          _coSetMiniMapMarker(plat, plng);
        }
      },
      () => {
        const chip = document.getElementById('co-map-chip-text');
        if (chip) chip.textContent = 'Location not available';
      },
      { timeout: 8000, maximumAge: 120000, enableHighAccuracy: true }
    );
  }

  // If there's already a confirmed location (saved addr / full map), show it
  if (confirmedLat) {
    _coSetMiniMapMarker(confirmedLat, confirmedLng);
    _coUpdateChip(confirmedLat, confirmedLng);
  }
}

function _coSetMiniMapMarker(lat, lng) {
  if (!_coMiniMap) return;
  if (_coMapMarker) _coMiniMap.removeLayer(_coMapMarker);
  _coMapMarker = L.circleMarker([lat, lng], {
    radius: 8, fillColor: '#1C3829', color: '#fff',
    weight: 2, fillOpacity: 0.95,
  }).addTo(_coMiniMap);
  _coMiniMap.setView([lat, lng], 15);
}

function _coUpdateChip(lat, lng) {
  // Reverse geocode for chip label
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
    .then(r => r.json())
    .then(data => {
      const addr = data?.address || {};
      const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.city || 'Your area';
      const chip = document.getElementById('co-map-chip-text');
      if (chip) chip.textContent = area;
    })
    .catch(() => {});
}

function _coRecenterGPS() {
  if (!navigator.geolocation) { showToast('GPS not supported', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      _coMiniMap?.setView([lat, lng], 15);
      _coUpdateChip(lat, lng);
    },
    () => showToast('Location permission denied', 'error'),
    { timeout: 6000, enableHighAccuracy: true }
  );
}

/* ════════════════════════════════════════
   MAXIMIZE MINI MAP → open full-screen map
   Sets hook so confirm updates the mini map
════════════════════════════════════════ */
function _coOpenFullMap() {
  // After user confirms in full map, update the mini-map view
  window._checkoutMapConfirm = (lat, lng, area, fullAddr) => {
    window._checkoutMapConfirm = null;
    if (_coMiniMap) {
      _coMiniMap.setView([lat, lng], 15);
      _coSetMiniMapMarker(lat, lng);
      const chip = document.getElementById('co-map-chip-text');
      if (chip) chip.textContent = area || 'Selected location';
    }
  };
  openMapPicker();
}

/* ════════════════════════════════════════
   ADDRESS LIST RENDER
════════════════════════════════════════ */
function _coRenderAddressList() {
  const list = document.getElementById('co-addr-list');
  if (!list) return;

  _coAddresses = _coLoadAddresses();

  if (!_coAddresses.length) {
    list.innerHTML = `
      <div class="co-addr-empty">
        <span class="empty-icon">🏠</span>
        No saved addresses yet.<br>Add one to continue.
      </div>`;
    _coSetContinueEnabled(false);
    return;
  }

  list.innerHTML = _coAddresses.map(addr => _coAddrCardHTML(addr)).join('');

  // Auto-select default or first
  if (!_coSelectedAddrId) {
    const def = _coAddresses.find(a => a.isDefault) || _coAddresses[0];
    if (def) _coSelectAddress(def.id, false);
  } else {
    _coSelectAddress(_coSelectedAddrId, false);
  }
}

function _coAddrCardHTML(addr) {
  const typeIcons = { home: 'fa-home', work: 'fa-briefcase', other: 'fa-map-pin' };
  const icon = typeIcons[addr.type] || 'fa-map-pin';
  const typeName = addr.type ? addr.type.charAt(0).toUpperCase() + addr.type.slice(1) : 'Other';
  const fullLine = [addr.houseNo, addr.building, addr.street, addr.landmark, addr.city, addr.pincode, addr.state]
    .filter(Boolean).join(', ');

  return `
    <div class="co-addr-card" id="co-card-${addr.id}" onclick="_coSelectAddress('${addr.id}')">
      <div class="co-addr-radio">
        <div class="co-addr-radio-dot"></div>
      </div>
      <div class="co-addr-body">
        <div class="co-addr-top">
          <span class="co-addr-type-tag"><i class="fas ${icon}"></i> ${typeName}</span>
          ${addr.isDefault ? '<span class="co-addr-default-badge">Default</span>' : ''}
        </div>
        <div class="co-addr-name">${_coEsc(addr.recipientName || '')}</div>
        <div class="co-addr-line">${_coEsc(fullLine)}</div>
        ${addr.mobile ? `<div class="co-addr-phone">📞 +91 ${_coEsc(addr.mobile)}</div>` : ''}
        <div class="co-addr-actions">
          <button class="co-addr-act-btn" onclick="event.stopPropagation();_coEditAddr('${addr.id}')">✏️ Edit</button>
          ${!addr.isDefault ? `<button class="co-addr-act-btn" onclick="event.stopPropagation();_coSetDefault('${addr.id}')">Set Default</button>` : ''}
          <button class="co-addr-act-btn danger" onclick="event.stopPropagation();_coDeleteAddr('${addr.id}')">Remove</button>
        </div>
      </div>
    </div>`;
}

function _coSelectAddress(id, doAnimate) {
  _coSelectedAddrId = id;

  // Update card styles
  document.querySelectorAll('.co-addr-card').forEach(card => {
    card.classList.remove('selected');
  });
  const card = document.getElementById(`co-card-${id}`);
  if (card) card.classList.add('selected');

  _coSetContinueEnabled(true);

  // Pan mini map to address coords if available
  const addr = _coAddresses.find(a => a.id === id);
  if (addr?.lat && _coMiniMap) {
    _coMiniMap.setView([addr.lat, addr.lng], 15);
    _coSetMiniMapMarker(addr.lat, addr.lng);
    const chip = document.getElementById('co-map-chip-text');
    if (chip) chip.textContent = addr.city || 'Selected location';
  }
}

function _coSetContinueEnabled(enabled) {
  const btn = document.getElementById('co-addr-continue-btn');
  if (btn) btn.disabled = !enabled;
}

function _coSetDefault(id) {
  _coAddresses = _coAddresses.map(a => ({ ...a, isDefault: a.id === id }));
  _coSaveAddresses(_coAddresses);
  _coRenderAddressList();
  showToast('Default address updated', 'success');
}

function _coEditAddr(id) {
  const addr = _coAddresses.find(a => a.id === id);
  if (!addr) return;
  _coAddAddrLat = addr.lat || null;
  _coAddAddrLng = addr.lng || null;
  _coOpenAddAddrPage(addr);
}

function _coDeleteAddr(id) {
  if (!confirm('Remove this address?')) return;
  _coAddresses = _coAddresses.filter(a => a.id !== id);
  _coSaveAddresses(_coAddresses);
  if (_coSelectedAddrId === id) _coSelectedAddrId = null;
  _coRenderAddressList();
  showToast('Address removed');
}

/* ════════════════════════════════════════
   ADD NEW ADDRESS FLOW
════════════════════════════════════════ */
function openAddNewAddress() {
  _coAddAddrLat = confirmedLat || null;
  _coAddAddrLng = confirmedLng || null;
  _coOpenAddAddrPage(null);
}

/* ════════════════════════════════════════
   ADD ADDRESS PAGE — Open / Close
════════════════════════════════════════ */
function _coOpenAddAddrPage(editAddr) {
  _coSelectedType = editAddr?.type || 'home';

  // Inject form HTML
  const formBody = document.getElementById('co-add-addr-form-body');
  if (formBody) { formBody.innerHTML = _coAddrFormHTML(editAddr); requestAnimationFrame(() => _coAttachFormValidation()); }

  // Show page
  const page = document.getElementById('co-add-addr-page');
  if (!page) return;
  page.style.zIndex = '100001';
  page.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Update header title for edit vs add
  const title = page.querySelector('.pp-header-title');
  if (title) title.textContent = editAddr ? 'Edit Address' : 'Add New Address';

  // Init map
  requestAnimationFrame(() => setTimeout(() => _coInitAddAddrMap(editAddr), 200));
}

function _coCloseAddAddrPage() {
  const page = document.getElementById('co-add-addr-page');
  if (!page) return;
  page.style.transform = 'translateX(100%)';
  setTimeout(() => {
    page.classList.remove('open');
    page.style.zIndex = '';
    page.style.transform = '';
  }, 350);
}

/* ════════════════════════════════════════
   ADD ADDRESS PAGE — Map Init
════════════════════════════════════════ */
function _coInitAddAddrMap(editAddr) {
  const el = document.getElementById('co-add-map');
  if (!el) return;

  const startLat = editAddr?.lat || confirmedLat || MAP_DEFAULT_LAT;
  const startLng = editAddr?.lng || confirmedLng || MAP_DEFAULT_LNG;

  if (_coAddAddrMap) {
    _coAddAddrMap.invalidateSize();
    _coAddAddrMap.setView([startLat, startLng], 15);
    return;
  }

  _coAddAddrMap = L.map('co-add-map', {
    zoomControl: false,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    scrollWheelZoom: false,
    tap: true,
    tapTolerance: 15,
    keyboard: false,
    attributionControl: false,
  }).setView([startLat, startLng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_coAddAddrMap);

  // On map move → update chip + auto-fill pincode/city/state
  _coAddAddrMap.on('moveend', () => {
    const c = _coAddAddrMap.getCenter();
    _coAddAddrLat = c.lat;
    _coAddAddrLng = c.lng;
    _coUpdateAddAddrChip(c.lat, c.lng);
  });

  // Auto GPS if new address
  if (!editAddr && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        _coAddAddrLat = pos.coords.latitude;
        _coAddAddrLng = pos.coords.longitude;
        _coAddAddrMap?.setView([_coAddAddrLat, _coAddAddrLng], 16);
        _coUpdateAddAddrChip(_coAddAddrLat, _coAddAddrLng);
      },
      () => {},
      { timeout: 8000, maximumAge: 120000, enableHighAccuracy: true }
    );
  } else if (editAddr?.lat) {
    _coAddAddrLat = editAddr.lat;
    _coAddAddrLng = editAddr.lng;
    _coUpdateAddAddrChip(editAddr.lat, editAddr.lng);
  }
}

function _coUpdateAddAddrChip(lat, lng) {
  const chip = document.getElementById('co-add-chip-text');
  if (chip) chip.textContent = 'Locating…';

  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
    .then(r => r.json())
    .then(data => {
      const a = data?.address || {};
      const area = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.city || 'Your area';
      if (chip) chip.textContent = area;

      // Auto-fill pincode → triggers city/state via existing _coOnPincodeInput
      const pincodeEl = document.getElementById('co-pincode');
      if (pincodeEl && !pincodeEl.value && a.postcode) {
        pincodeEl.value = a.postcode;
        _coOnPincodeInput(a.postcode);   // triggers India Post API for city/state
      }
      // Fallback: directly fill city/state if pincode API fails
      const cityEl  = document.getElementById('co-city');
      const stateEl = document.getElementById('co-state');
      if (cityEl  && !cityEl.value)  { cityEl.value  = a.city || a.town || a.village || ''; }
      if (stateEl && !stateEl.value) { stateEl.value = a.state || ''; }
      // ⚠️ Street/Area is NEVER auto-filled — customer types manually
    })
    .catch(() => { if (chip) chip.textContent = 'Location selected'; });
}

function _coAddAddrGPS() {
  if (!navigator.geolocation) { showToast('GPS not supported', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      _coAddAddrLat = pos.coords.latitude;
      _coAddAddrLng = pos.coords.longitude;
      _coAddAddrMap?.setView([_coAddAddrLat, _coAddAddrLng], 16);
      _coUpdateAddAddrChip(_coAddAddrLat, _coAddAddrLng);
    },
    () => showToast('Location permission denied', 'error'),
    { timeout: 6000, enableHighAccuracy: true }
  );
}

/* ════════════════════════════════════════
   ADD ADDRESS PAGE — Form HTML builder
════════════════════════════════════════ */
function _coAddrFormHTML(editAddr) {
  const ed = editAddr || {};
  return `
    <div class="co-form-row" style="margin-top:16px;">
      <div class="co-fg">
        <label>House / Flat No. <span class="co-req">*</span></label>
        <input type="text" id="co-house" placeholder="e.g., 101, Block A"
          value="${_coEsc(ed.houseNo || '')}">
        <div class="co-field-err" id="co-house-err"></div>
      </div>
      <div class="co-fg">
        <label>Building / Society <span class="co-opt">(Optional)</span></label>
        <input type="text" id="co-building" placeholder="e.g., Green Apartments"
          value="${_coEsc(ed.building || '')}">
      </div>
    </div>

    <div class="co-fg">
      <label>Street / Area <span class="co-req">*</span></label>
      <input type="text" id="co-street"
        placeholder="Type your street name manually (e.g., MG Road, Sector 12)"
        value="${_coEsc(ed.street || '')}">
      <div class="co-field-err" id="co-street-err"></div>
    </div>

    <div class="co-fg">
      <label>Landmark <span class="co-opt">(Optional)</span></label>
      <input type="text" id="co-landmark" placeholder="e.g., Near City Mall"
        value="${_coEsc(ed.landmark || '')}">
    </div>

    <div class="co-form-row">
      <div class="co-fg">
        <label>Pincode <span class="co-req">*</span></label>
        <div class="co-input-wrap" id="co-pincode-wrap">
          <input type="text" id="co-pincode" placeholder="6-digit" maxlength="6"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,6);_coOnPincodeInput(this.value);_coCheckFormValidity()"
            value="${_coEsc(ed.pincode || '')}">
          <span class="co-pincode-loader" id="co-pincode-loader" style="display:none">⟳</span>
        </div>
        <div class="co-pincode-autofill-tag" id="co-pincode-tag" style="display:none">✅ Auto-filled</div>
        <div class="co-field-err" id="co-pincode-err"></div>
      </div>
      <div class="co-fg">
        <label>City <span class="co-req">*</span></label>
        <input type="text" id="co-city" placeholder="City"
          value="${_coEsc(ed.city || '')}">
        <div class="co-field-err" id="co-city-err"></div>
      </div>
    </div>

    <div class="co-fg">
      <label>State <span class="co-req">*</span></label>
      <input type="text" id="co-state" placeholder="State"
        value="${_coEsc(ed.state || '')}">
      <div class="co-field-err" id="co-state-err"></div>
    </div>

    <div class="co-form-row">
      <div class="co-fg">
        <label>Full Name <span class="co-req">*</span></label>
        <input type="text" id="co-rname" placeholder="Recipient's full name"
          value="${_coEsc(ed.recipientName || currentUser?.name || '')}">
        <div class="co-field-err" id="co-rname-err"></div>
      </div>
      <div class="co-fg">
        <label>Mobile <span class="co-req">*</span></label>
        <div class="co-phone-wrap">
          <span class="co-phone-prefix">+91</span>
          <input type="tel" id="co-mobile" placeholder="10 digits" maxlength="10"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10);_coCheckFormValidity()"
            value="${_coEsc(ed.mobile || currentUser?.phone || '')}">
        </div>
        <div class="co-field-err" id="co-mobile-err"></div>
      </div>
    </div>

    <div class="co-fg">
      <label>Address Type</label>
      <div class="co-type-selector">
        <label class="co-type-option ${_coSelectedType==='home'?'active':''}" onclick="_coSetType('home',this)">
          <input type="radio" name="co-type" value="home" ${_coSelectedType==='home'?'checked':''}> 🏠 Home
        </label>
        <label class="co-type-option ${_coSelectedType==='work'?'active':''}" onclick="_coSetType('work',this)">
          <input type="radio" name="co-type" value="work" ${_coSelectedType==='work'?'checked':''}> 💼 Work
        </label>
        <label class="co-type-option ${_coSelectedType==='other'?'active':''}" onclick="_coSetType('other',this)">
          <input type="radio" name="co-type" value="other" ${_coSelectedType==='other'?'checked':''}> 📍 Other
        </label>
      </div>
    </div>

    <label class="co-default-check">
      <input type="checkbox" id="co-is-default"
        ${ed.isDefault || !_coAddresses.length ? 'checked' : ''}>
      <span>Set as default address</span>
    </label>

    <button class="co-save-addr-btn" id="co-save-addr-btn" disabled onclick="_coSaveAddress('${ed.id || ''}')">
      💾 Save Address
    </button>
  `;
}

/* ── Reverse geocode before opening sheet ─ */
function _coReverseGeocodeForSheet(lat, lng) {
  fetch(
    'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat +
    '&lon=' + lng + '&accept-language=en'
  )
    .then(r => r.json())
    .then(data => {
      const a          = data?.address || {};
      _coNewAddrCity    = a.city || a.town || a.village || a.county || '';
      _coNewAddrState   = a.state || '';
      _coNewAddrPincode = a.postcode || '';
      // Also update full if empty
      if (!_coNewAddrFull && data.display_name) _coNewAddrFull = data.display_name;
    })
    .catch(() => {})
    .finally(() => _coOpenAddrSheet(null));
}

/* ════════════════════════════════════════
   ADDRESS DETAIL SHEET
════════════════════════════════════════ */
function _coOpenAddrSheet(editAddr) {
  _coSheetOpen = true;
  _coSelectedType = editAddr?.type || 'home';

  // ✅ Use pre-fetched Nominatim data (set by _coReverseGeocodeForSheet)
  let prefillCity    = _coNewAddrCity    || '';
  let prefillState   = _coNewAddrState   || '';
  let prefillPincode = _coNewAddrPincode || '';

  // Fallback: try to parse from display_name if structured data missing
  if (!prefillPincode && _coNewAddrFull) {
    const m = _coNewAddrFull.match(/(\d{6})/);
    if (m) prefillPincode = m[1];
  }
  if (!prefillCity && _coNewAddrFull) {
    const parts = _coNewAddrFull.split(',').map(s => s.trim()).filter(Boolean);
    // Nominatim format: Suburb, City, State PinCode, Country
    if (parts.length >= 2) {
      const candidate = parts[1].replace(/\d{6}/, '').trim();
      if (candidate && candidate !== 'India') prefillCity = candidate;
    }
  }
  if (!prefillState && _coNewAddrFull) {
    const parts = _coNewAddrFull.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const candidate = parts[2].replace(/\d{6}/, '').trim();
      if (candidate && candidate !== 'India') prefillState = candidate;
    }
  }

  // Create overlay
  let overlay = document.getElementById('co-sheet-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'co-sheet-overlay';
    overlay.className = 'co-sheet-overlay';
    overlay.onclick = _coCloseAddrSheet;
    document.body.appendChild(overlay);
  }

  // Create sheet
  let sheet = document.getElementById('co-addr-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'co-addr-sheet';
    sheet.className = 'co-addr-sheet';
    document.body.appendChild(sheet);
  }

  const isEdit = !!editAddr;
  const ed = editAddr || {};

  sheet.innerHTML = `
    <div class="co-sheet-handle"></div>
    <div class="co-sheet-header">
      <div class="co-sheet-title">${isEdit ? 'Edit Address' : 'Add New Address'}</div>
      <button class="co-sheet-close" onclick="_coCloseAddrSheet()">×</button>
    </div>

    ${!isEdit && _coNewAddrFull ? `
    <div class="co-sheet-loc-chip">
      <svg viewBox="0 0 24 24">
        <path stroke-linecap="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="3" stroke="none" fill="#1C3829"/>
      </svg>
      <div class="co-sheet-loc-text">
        <div class="co-sheet-loc-name">📍 ${_coEsc(_coNewAddrArea || 'Pinned Location')}</div>
        <div class="co-sheet-loc-addr">${_coEsc(_coNewAddrFull.substring(0, 80))}</div>
      </div>
    </div>` : ''}

    <div class="co-sheet-body">

      <div class="co-form-row">
        <div class="co-fg">
          <label>House / Flat No. <span class="co-req">*</span></label>
          <input type="text" id="co-house" placeholder="e.g., 101, Block A"
            value="${_coEsc(ed.houseNo || '')}">
          <div class="co-field-err" id="co-house-err"></div>
        </div>
        <div class="co-fg">
          <label>Building / Society <span class="co-opt">(Optional)</span></label>
          <input type="text" id="co-building" placeholder="e.g., Green Apartments"
            value="${_coEsc(ed.building || '')}">
        </div>
      </div>

      <div class="co-fg">
        <label>Street / Area <span class="co-req">*</span></label>
        <input type="text" id="co-street" placeholder="e.g., MG Road, Sector 12"
          value="${_coEsc(ed.street || _coNewAddrArea || '')}">
        <div class="co-field-err" id="co-street-err"></div>
      </div>

      <div class="co-fg">
        <label>Landmark <span class="co-opt">(Optional)</span></label>
        <input type="text" id="co-landmark" placeholder="e.g., Near City Mall"
          value="${_coEsc(ed.landmark || '')}">
      </div>

      <div class="co-form-row">
        <div class="co-fg">
          <label>City <span class="co-req">*</span></label>
          <div class="co-input-wrap" id="co-city-wrap">
            <input type="text" id="co-city" placeholder="City"
              value="${_coEsc(ed.city || prefillCity || '')}">
          </div>
          <div class="co-field-err" id="co-city-err"></div>
        </div>
        <div class="co-fg">
          <label>Pincode <span class="co-req">*</span></label>
          <div class="co-input-wrap" id="co-pincode-wrap">
            <input type="text" id="co-pincode" placeholder="6-digit" maxlength="6"
              oninput="this.value=this.value.replace(/\\D/g,'').slice(0,6);_coOnPincodeInput(this.value);_coCheckFormValidity()"
              value="${_coEsc(ed.pincode || prefillPincode || '')}">
            <span class="co-pincode-loader" id="co-pincode-loader" style="display:none">⟳</span>
          </div>
          <div class="co-pincode-autofill-tag" id="co-pincode-tag" style="display:none">
            ✅ Auto-filled from pincode
          </div>
          <div class="co-field-err" id="co-pincode-err"></div>
        </div>
      </div>

      <div class="co-fg">
        <label>State <span class="co-req">*</span></label>
        <input type="text" id="co-state" placeholder="State"
          value="${_coEsc(ed.state || prefillState || 'Uttar Pradesh')}">
        <div class="co-field-err" id="co-state-err"></div>
      </div>

      <div class="co-form-row">
        <div class="co-fg">
          <label>Recipient Name <span class="co-req">*</span></label>
          <input type="text" id="co-rname" placeholder="Full Name"
            value="${_coEsc(ed.recipientName || currentUser?.name || '')}">
          <div class="co-field-err" id="co-rname-err"></div>
        </div>
        <div class="co-fg">
          <label>Mobile <span class="co-req">*</span></label>
          <div class="co-phone-wrap">
            <span class="co-phone-prefix">+91</span>
            <input type="tel" id="co-mobile" placeholder="10 digits" maxlength="10"
              oninput="this.value=this.value.replace(/\D/g,'').slice(0,10);_coCheckFormValidity()"
              value="${_coEsc(ed.mobile || currentUser?.phone || '')}">
          </div>
          <div class="co-field-err" id="co-mobile-err"></div>
        </div>
      </div>

      <div class="co-fg">
        <label>Address Type</label>
        <div class="co-type-selector">
          <label class="co-type-option ${_coSelectedType === 'home' ? 'active' : ''}" onclick="_coSetType('home',this)">
            <input type="radio" name="co-type" value="home" ${_coSelectedType === 'home' ? 'checked' : ''}>
            <i class="fas fa-home"></i> Home
          </label>
          <label class="co-type-option ${_coSelectedType === 'work' ? 'active' : ''}" onclick="_coSetType('work',this)">
            <input type="radio" name="co-type" value="work" ${_coSelectedType === 'work' ? 'checked' : ''}>
            <i class="fas fa-briefcase"></i> Work
          </label>
          <label class="co-type-option ${_coSelectedType === 'other' ? 'active' : ''}" onclick="_coSetType('other',this)">
            <input type="radio" name="co-type" value="other" ${_coSelectedType === 'other' ? 'checked' : ''}>
            <i class="fas fa-map-pin"></i> Other
          </label>
        </div>
      </div>

      <label class="co-default-check">
        <input type="checkbox" id="co-is-default" ${ed.isDefault || !_coAddresses.length ? 'checked' : ''}>
        <span>Set as default address</span>
      </label>

      <button class="co-save-addr-btn" id="co-save-addr-btn" disabled onclick="_coSaveAddress('${ed.id || ''}')">
        💾 Save Address
      </button>

    </div><!-- /.co-sheet-body -->
  `;

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    sheet.classList.add('open');
    _coAttachFormValidation();
  });
}

function _coCloseAddrSheet() {
  _coSheetOpen = false;
  const overlay = document.getElementById('co-sheet-overlay');
  const sheet   = document.getElementById('co-addr-sheet');
  overlay?.classList.remove('open');
  sheet?.classList.remove('open');
  // Reset pending map pin data
  _coNewAddrPinLat = null;
  _coNewAddrPinLng = null;
  _coNewAddrArea   = '';
  _coNewAddrFull   = '';
}

function _coSetType(type, el) {
  _coSelectedType = type;
  document.querySelectorAll('.co-type-option').forEach(o => o.classList.remove('active'));
  el?.classList.add('active');
}


/* ════════════════════════════════════════
   FORM VALIDATION — enable Save btn only when required fields filled
════════════════════════════════════════ */
function _coCheckFormValidity() {
  const house   = (document.getElementById('co-house')?.value   || '').trim();
  const street  = (document.getElementById('co-street')?.value  || '').trim();
  const pincode = (document.getElementById('co-pincode')?.value || '').trim();
  const city    = (document.getElementById('co-city')?.value    || '').trim();
  const state   = (document.getElementById('co-state')?.value   || '').trim();
  const rname   = (document.getElementById('co-rname')?.value   || '').trim();
  const mobile  = (document.getElementById('co-mobile')?.value  || '').trim();
  const valid = house && street && pincode.length === 6 && city && state && rname && mobile.length === 10;
  const btn = document.getElementById('co-save-addr-btn');
  if (btn) btn.disabled = !valid;
}

function _coAttachFormValidation() {
  const ids = ['co-house','co-street','co-pincode','co-city','co-state','co-rname','co-mobile'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _coCheckFormValidity);
  });
  _coCheckFormValidity();
}

/* ════════════════════════════════════════
   SAVE ADDRESS
════════════════════════════════════════ */
function _coSaveAddress(editId) {
  // Collect values
  const houseNo       = document.getElementById('co-house')?.value.trim()    || '';
  const building      = document.getElementById('co-building')?.value.trim() || '';
  const street        = document.getElementById('co-street')?.value.trim()   || '';
  const landmark      = document.getElementById('co-landmark')?.value.trim() || '';
  const city          = document.getElementById('co-city')?.value.trim()     || '';
  const pincode       = document.getElementById('co-pincode')?.value.trim()  || '';
  const state         = document.getElementById('co-state')?.value.trim()    || '';
  const recipientName = document.getElementById('co-rname')?.value.trim()    || '';
  const mobile        = document.getElementById('co-mobile')?.value.trim()   || '';
  const isDefault     = document.getElementById('co-is-default')?.checked    || false;
  const type          = _coSelectedType;

  // Validate
  let ok = true;
  const setErr = (id, msg) => {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    ok = false;
  };
  const clrErr = id => { const el = document.getElementById(id); if (el) el.textContent = ''; };

  clrErr('co-house-err'); clrErr('co-street-err'); clrErr('co-city-err');
  clrErr('co-pincode-err'); clrErr('co-state-err'); clrErr('co-rname-err'); clrErr('co-mobile-err');

  if (!houseNo)  setErr('co-house-err', 'House/Flat no. required');
  if (!street)   setErr('co-street-err', 'Street/Area required');
  if (!city)     setErr('co-city-err', 'City required');
  if (!pincode || pincode.length < 6) setErr('co-pincode-err', 'Valid 6-digit pincode required');
  if (!state)    setErr('co-state-err', 'State required');
  if (!recipientName) setErr('co-rname-err', 'Recipient name required');
  if (!mobile || mobile.length < 10)  setErr('co-mobile-err', 'Valid 10-digit mobile required');

  if (!ok) return;

  // Zone boundary check — out-of-area address save nahi hone dena
  const _saveLat = _coAddAddrLat || confirmedLat;
  const _saveLng = _coAddAddrLng || confirmedLng;
  if (_saveLat && _saveLng && !pointInPolygon([_saveLat, _saveLng], deliveryZone)) {
    const _ns = document.getElementById('no-service-overlay');
    if (_ns) { _ns.style.zIndex = '100002'; _ns.classList.add('open'); }
    return;
  }

  // Build full address string
  const fullAddress = [houseNo, building, street, landmark, city, pincode, state]
    .filter(Boolean).join(', ');

  const addrObj = {
    id:            editId || ('addr_' + Date.now()),
    houseNo, building, street, landmark, city, pincode, state,
    recipientName, mobile, type, isDefault, fullAddress,
    lat: _coAddAddrLat || (editId ? (_coAddresses.find(a => a.id === editId)?.lat) : confirmedLat) || null,
    lng: _coAddAddrLng || (editId ? (_coAddresses.find(a => a.id === editId)?.lng) : confirmedLng) || null,
  };

  if (isDefault) {
    _coAddresses = _coAddresses.map(a => ({ ...a, isDefault: false }));
  }

  if (editId) {
    _coAddresses = _coAddresses.map(a => a.id === editId ? addrObj : a);
  } else {
    _coAddresses = [..._coAddresses, addrObj];
  }

  _coSaveAddresses(_coAddresses);
  _coSelectedAddrId = addrObj.id;

  _coCloseAddAddrPage();
  setTimeout(() => {
    _coRenderAddressList();
    // Mini-map sync
    if (_coAddAddrLat && _coMiniMap) {
      _coMiniMap.setView([_coAddAddrLat, _coAddAddrLng], 15);
      _coSetMiniMapMarker(_coAddAddrLat, _coAddAddrLng);
    }
  }, 360);
  showToast('✅ Address saved!', 'success');
}

/* ════════════════════════════════════════
   SYNC SELECTED ADDR → order.js globals
════════════════════════════════════════ */
function _coSyncSelectedAddr() {
  const addr = _coAddresses.find(a => a.id === _coSelectedAddrId);
  if (!addr) return;

  // Set hidden address input for _validateOrderClient
  const addrInput = document.getElementById('address');
  if (addrInput) addrInput.value = addr.fullAddress;

  // Set global map location vars (used by order.js validation)
  if (addr.lat) {
    confirmedLat  = addr.lat;
    confirmedLng  = addr.lng;
    confirmedAddr = addr.fullAddress;
    locationLink  = addr.lat
      ? `https://www.google.com/maps?q=${addr.lat},${addr.lng}`
      : '';
    selectedArea  = addr.city || '';
  }

  // Render recap in step 3
  const recap = document.getElementById('co-addr-recap-body');
  if (recap) {
    const typeIcons = { home: '🏠', work: '🏢', other: '📍' };
    recap.innerHTML = `
      <strong>${_coEsc(addr.recipientName)}</strong> · +91 ${_coEsc(addr.mobile)}<br>
      ${_coEsc(addr.fullAddress)}`;
  }
}

/* ════════════════════════════════════════
   STEP 3 — ORDER SUMMARY + PRE-FILL
════════════════════════════════════════ */
function _renderCoOrderSummary() {
  const subtotal   = getCartSubtotal();
  const origDelivery = DELIVERY_FEE;
  const discDelivery = (typeof deliveryFeeDiscounted !== 'undefined' && deliveryFeeDiscounted > 0 && deliveryFeeDiscounted < origDelivery)
    ? deliveryFeeDiscounted : origDelivery;
  const fee        = subtotal >= FREE_THRESHOLD ? 0 : discDelivery;
  const grandTotal = Math.max(0, subtotal + fee - (couponDiscount || 0));

  const totalEl = document.getElementById('checkout-total-display');
  if (totalEl) totalEl.textContent = grandTotal;

  // ── Slot Recap ───────────────────────────────────────────
  const slotRecap = document.getElementById('co-slot-recap-body');
  if (slotRecap) {
    const slotLabel = (typeof getSelectedSlotLabel === 'function') ? getSelectedSlotLabel() : '';
    slotRecap.innerHTML = slotLabel
      ? `<span style="color:var(--g2);">📦 ${slotLabel}</span>`
      : `<span style="color:var(--tmut);font-weight:400;">No slot selected</span>`;
  }

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

function _coPreFillProfile() {
  const nameEl         = document.getElementById('name');
  const phoneEl        = document.getElementById('phone');
  const detailsSection = document.getElementById('co-details-section');
  if (!nameEl || !phoneEl) return;

  if (_coSelectedAddrId) {
    // Saved address selected: auto-fill name/phone from it, hide the details section
    const addr = _coAddresses.find(a => a.id === _coSelectedAddrId);
    if (addr) {
      nameEl.value  = addr.recipientName || currentUser?.name  || '';
      phoneEl.value = addr.mobile        || currentUser?.phone || '';
    } else {
      if (currentUser?.name)  nameEl.value  = currentUser.name;
      if (currentUser?.phone) phoneEl.value = currentUser.phone;
    }
    if (detailsSection) detailsSection.style.display = 'none';
    // Sync hidden inputs for order.js
    const nameHidden = document.getElementById('name-hidden');
    const phoneHidden = document.getElementById('phone-hidden');
    if (nameHidden) nameHidden.value = nameEl.value;
    if (phoneHidden) phoneHidden.value = phoneEl.value;
  } else {
    // No saved address: show details section, pre-fill from currentUser
    if (detailsSection) detailsSection.style.display = '';
    if (currentUser?.name  && !nameEl.value)  nameEl.value  = currentUser.name;
    if (currentUser?.phone && !phoneEl.value) phoneEl.value = currentUser.phone;
  }
}

/* ════════════════════════════════════════
   PINCODE AUTO-FILL (like Flipkart)
   Uses India Post API → fills city, district, state
════════════════════════════════════════ */
let _pincodeTimer = null;

function _coOnPincodeInput(val) {
  clearTimeout(_pincodeTimer);
  if (val.length < 6) return;
  _pincodeTimer = setTimeout(() => _coFetchPincode(val), 400);
}

async function _coFetchPincode(pincode) {
  const loader = document.getElementById('co-pincode-loader');
  const tag    = document.getElementById('co-pincode-tag');
  if (loader) { loader.style.display = 'inline-block'; loader.classList.add('spin'); }
  if (tag)    tag.style.display = 'none';

  try {
    const res  = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();

    const errEl2 = document.getElementById('co-pincode-err');
    if (errEl2) errEl2.textContent = '';
    if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length) {
      const po       = data[0].PostOffice[0];
      const city     = po.District  || po.Division || po.Block || '';
      const state    = po.State     || '';

      const cityEl   = document.getElementById('co-city');
      const stateEl  = document.getElementById('co-state');

      if (cityEl)  cityEl.value  = city;
      if (stateEl) stateEl.value = state;

      // Flash green border on auto-filled fields
      [cityEl, stateEl].forEach(el => {
        if (el && el.value) {
          el.classList.add('co-autofilled');
          setTimeout(() => el.classList.remove('co-autofilled'), 2000);
        }
      });

      if (tag) { tag.style.display = 'block'; }
      showToast(`📍 ${city}, ${state} — auto-filled!`, 'success');
    } else {
      const errEl = document.getElementById('co-pincode-err');
      if (errEl) errEl.textContent = 'Invalid pincode — no results found';
    }
  } catch (e) {
    // Silent fail — user can still fill manually
  } finally {
    if (loader) { loader.style.display = 'none'; loader.classList.remove('spin'); }
  }
}

/* ════════════════════════════════════════
   LOCALSTORAGE HELPERS
════════════════════════════════════════ */
function _coLoadAddresses() {
  try {
    return JSON.parse(localStorage.getItem(CO_LS_KEY) || '[]');
  } catch { return []; }
}

function _coSaveAddresses(arr) {
  try { localStorage.setItem(CO_LS_KEY, JSON.stringify(arr)); } catch {}
}

/* ── Util ──────────────────────────────── */
function _coEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
