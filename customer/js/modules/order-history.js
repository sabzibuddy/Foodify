/* ════════════════════════════════════════
   modules/order-history.js
   Orders page — open/close + LIVE Firestore listener + render.
   Tab system: Ongoing / Completed / Cancelled
   Real-time: status changes instantly, no refresh needed.
   Depends on: core/state.js, core/error.js, ui/toast.js
════════════════════════════════════════ */

const ORDER_STATUS_CLASS = {
  pending:          'mos-pending',
  assigned:         'mos-assigned',
  out_for_delivery: 'mos-assigned',
  delivered:        'mos-delivered',
  cancelled:        'mos-cancelled',
};

const ORDER_STATUS_LABEL = {
  pending:          '⏳ Pending',
  assigned:         '🚚 Out for Delivery',
  out_for_delivery: '🚚 Out for Delivery',
  delivered:        '✅ Delivered',
  cancelled:        '❌ Cancelled',
};

/* Tab grouping — which statuses go in which tab */
const TAB_STATUSES = {
  ongoing:   ['pending', 'assigned', 'out_for_delivery'],
  completed: ['delivered'],
  cancelled: ['cancelled'],
};

/* ════════════════════════════════════════
   LIVE LISTENER STATE
   One active listener per open session.
════════════════════════════════════════ */
let _ordersUnsubscribe  = null;   // Firestore unsubscribe fn for full orders page
let _profileUnsubscribe = null;   // Firestore unsubscribe fn for profile mini-list
let _cachedOrders       = [];     // In-memory cache for tab switching
let _activeTab          = 'ongoing';

/* ════════════════════════════════════════
   ORDERS PAGE OPEN / CLOSE
════════════════════════════════════════ */
function openOrdersPage() {
  const page = document.getElementById('orders-page');
  if (!page) return;
  page.classList.add('open');
  document.body.style.overflow = 'hidden';

  const phone = currentUser?.phone || document.getElementById('phone')?.value.trim() || '';
  _activeTab = 'ongoing';
  _startOrdersLiveListener(phone);
  if (navigator.vibrate) navigator.vibrate([10]);
}

function closeOrdersPage() {
  document.getElementById('orders-page')?.classList.remove('open');
  document.body.style.overflow = '';
  _stopOrdersLiveListener();
}

/* ════════════════════════════════════════
   LIVE LISTENER — FULL ORDERS PAGE
════════════════════════════════════════ */
function _startOrdersLiveListener(phone) {
  const body = document.getElementById('orders-page-body');
  if (!body) return;

  // Stop any existing listener first
  _stopOrdersLiveListener();

  if (!phone || phone.length !== 10) {
    body.innerHTML = _noPhoneHTML();
    return;
  }

  // Show loading spinner once
  body.innerHTML = _loadingHTML('Loading your orders...');

  let firstLoad = true;

  _ordersUnsubscribe = db.collection('orders')
    .where('phone', '==', phone)
    .onSnapshot(snap => {
      if (snap.empty && firstLoad) {
        body.innerHTML = `
          <div style="padding:40px;text-align:center;color:var(--tmut);font-size:13px">
            <div style="font-size:40px;margin-bottom:10px">🌱</div>
            No orders yet. Start shopping!
          </div>`;
        firstLoad = false;
        return;
      }

      // Build sorted orders array
      _cachedOrders = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

      if (firstLoad) {
        // First load: build full tab shell
        body.innerHTML = _buildTabsHTML(_cachedOrders);
        firstLoad = false;
      }

      // Re-render current tab (works on first load AND every live update)
      _renderActiveTab();

      // Show toast on status change (not on first load)
      if (!firstLoad && snap.docChanges) {
        snap.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const newStatus = change.doc.data().status;
            const label = ORDER_STATUS_LABEL[newStatus] || newStatus;
            showToast(`📦 Order status updated: ${label}`, 'success');
          }
        });
      }

    }, err => {
      console.error('Orders listener error:', err);
      body.innerHTML = _errorHTML();
    });
}

function _stopOrdersLiveListener() {
  if (_ordersUnsubscribe) {
    _ordersUnsubscribe();
    _ordersUnsubscribe = null;
  }
  _cachedOrders = [];
}

/* ════════════════════════════════════════
   LIVE LISTENER — PROFILE MINI-LIST
   Used in profile panel (no tabs, just latest 8)
════════════════════════════════════════ */
async function loadMyOrdersInProfile(phone, containerId = 'profile-my-orders') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!phone || phone.length !== 10) {
    container.innerHTML = _noPhoneHTML('small');
    return;
  }

  // Stop previous profile listener
  if (_profileUnsubscribe) {
    _profileUnsubscribe();
    _profileUnsubscribe = null;
  }

  container.innerHTML = _loadingHTML('Loading...', 'small');

  _profileUnsubscribe = db.collection('orders')
    .where('phone', '==', phone)
    .onSnapshot(snap => {
      if (snap.empty) {
        container.innerHTML = `
          <div style="padding:20px;text-align:center;color:var(--tmut);font-size:13px">
            <div style="font-size:32px;margin-bottom:8px">🌱</div>No orders yet.
          </div>`;
        return;
      }

      const orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        .slice(0, 8);

      container.innerHTML = orders.map(_buildOrderCard).join('');
    }, err => {
      console.error('Profile orders listener error:', err);
      container.innerHTML = _errorHTML();
    });
}

/* ════════════════════════════════════════
   TAB SWITCHING  (called from HTML onclick)
════════════════════════════════════════ */
function switchOrderTab(tabName) {
  _activeTab = tabName;
  _renderActiveTab();
}

function _renderActiveTab() {
  const tabName = _activeTab;

  // Highlight active tab button
  document.querySelectorAll('.order-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update count badges
  const counts = _countByTab(_cachedOrders);
  ['ongoing', 'completed', 'cancelled'].forEach(t => {
    const badge = document.getElementById('tab-count-' + t);
    if (badge) {
      badge.textContent   = counts[t] > 0 ? counts[t] : '';
      badge.style.display = counts[t] > 0 ? 'inline-flex' : 'none';
    }
  });

  // Filter + render list
  const allowed  = TAB_STATUSES[tabName] || [];
  const filtered = _cachedOrders.filter(o => allowed.includes(o.status || 'pending'));

  const listEl = document.getElementById('orders-tab-list');
  if (!listEl) return;
  listEl.innerHTML = filtered.length
    ? filtered.map(_buildOrderCard).join('')
    : _emptyTabHTML(tabName);
}

function _countByTab(orders) {
  const c = { ongoing: 0, completed: 0, cancelled: 0 };
  orders.forEach(o => {
    const s = o.status || 'pending';
    if (TAB_STATUSES.ongoing.includes(s))   c.ongoing++;
    if (TAB_STATUSES.completed.includes(s)) c.completed++;
    if (TAB_STATUSES.cancelled.includes(s)) c.cancelled++;
  });
  return c;
}

/* ════════════════════════════════════════
   TAB SHELL HTML  (rendered once on first load)
════════════════════════════════════════ */
function _buildTabsHTML(orders) {
  const counts = _countByTab(orders);

  const tabBtn = (key, label, emoji) => `
    <button class="order-tab-btn" data-tab="${key}" onclick="switchOrderTab('${key}')">
      <span class="otb-emoji">${emoji}</span>
      <span class="otb-label">${label}</span>
      <span class="order-tab-count" id="tab-count-${key}"
        style="${counts[key] > 0 ? '' : 'display:none'}">${counts[key]}</span>
    </button>`;

  return `
    <div id="orders-tab-wrapper">
      <div class="order-tabs-bar">
        ${tabBtn('ongoing',   'Ongoing',   '🚚')}
        ${tabBtn('completed', 'Completed', '✅')}
        ${tabBtn('cancelled', 'Cancelled', '❌')}
      </div>
      <div id="orders-tab-list" class="orders-tab-list"></div>
    </div>`;
}

function _emptyTabHTML(tabName) {
  const map = {
    ongoing:   { icon: '🛵', msg: 'No active orders right now.' },
    completed: { icon: '🎉', msg: 'No completed orders yet.' },
    cancelled: { icon: '😔', msg: 'No cancelled orders.' },
  };
  const { icon, msg } = map[tabName] || { icon: '📦', msg: 'Nothing here.' };
  return `
    <div style="padding:48px 20px;text-align:center;color:var(--tmut);">
      <div style="font-size:44px;margin-bottom:12px">${icon}</div>
      <div style="font-size:13px;font-weight:600">${msg}</div>
    </div>`;
}

/* ════════════════════════════════════════
   ORDER CARD HTML
════════════════════════════════════════ */
function _buildOrderCard(o) {
  const statusClass = ORDER_STATUS_CLASS[o.status] || 'mos-pending';
  const statusLabel = ORDER_STATUS_LABEL[o.status] || o.status || 'Pending';
  const orderId     = o.orderId || o.id.slice(0, 12);

  const timeStr = o.timestamp?.seconds
    ? new Date(o.timestamp.seconds * 1000).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : 'Time unavailable';

  const itemsHTML = _buildOrderItemsHTML(o);

  const pinHTML = (o.deliveryPin && o.status !== 'delivered' && o.status !== 'cancelled')
    ? `<div style="margin-top:10px;background:rgba(28,56,41,0.05);border-radius:8px;padding:10px 12px;border:1px dashed var(--cream2)">
         <div class="my-order-pin-lbl">🔐 Delivery PIN</div>
         <div class="my-order-pin">${o.deliveryPin}</div>
         ${o.cancelPin ? `<div class="my-order-pin-lbl" style="margin-top:8px">❌ Cancel PIN</div>
         <div class="my-order-pin" style="color:#C8704A">${o.cancelPin}</div>
         <div style="font-size:11px;color:var(--tmut);margin-top:4px">Delivery boy cancel karne ke liye yeh PIN maangega</div>` : ''}
       </div>`
    : '';

  const deliveredHTML = o.status === 'delivered'
    ? '<div style="font-size:12px;color:#16a34a;margin-top:8px;font-weight:600">✅ Delivered successfully!</div>'
    : '';

  const waMsg  = `Hello SabziBuddy, I need help with this order:\nOrder ID: #${orderId}\nMy Name: ${o.name || ''}\nPhone: ${o.phone || ''}`;
  const waLink = `https://wa.me/917900684615?text=${encodeURIComponent(waMsg)}`;

  return `
    <div class="my-order-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div class="my-order-id">Order #${orderId}</div>
          <div style="font-size:11px;color:var(--tmut);margin-top:2px">${o.slot || ''}</div>
          <div style="font-size:11px;color:var(--g4);margin-top:3px;font-weight:600;">🕐 ${timeStr}</div>
        </div>
        <span class="my-order-status ${statusClass}">${statusLabel}</span>
      </div>
      ${itemsHTML}
      ${pinHTML}
      ${deliveredHTML}
      <a href="${waLink}" target="_blank"
        style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;
          background:#25D366;color:#fff;padding:7px 14px;border-radius:8px;
          font-size:12px;font-weight:700;text-decoration:none;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Help for this Order
      </a>
    </div>`;
}

function _buildOrderItemsHTML(o) {
  if (!o.items || !Object.keys(o.items).length) return '';

  const rows = Object.entries(o.items).map(([name, d]) => {
    const qty   = d.qty   || 1;
    const price = d.price || 0;
    const wt    = d.weight ? ` <span style="color:#bbb">(${d.weight})</span>` : '';
    const zone  = d.zone  ? ' ⭐' : '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
        <span style="font-size:12px;color:var(--td);font-weight:500;">${name}${zone}${wt}</span>
        <span style="font-size:12px;color:var(--tm);white-space:nowrap;margin-left:8px;">
          ×${qty} = <b style="color:var(--g2)">₹${qty * price}</b>
        </span>
      </div>`;
  }).join('');

  const couponRow = o.couponDiscount > 0
    ? `<div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;">
         <span style="font-size:11px;color:var(--green-price);font-weight:600;">🎟️ Coupon (${o.couponCode || ''})</span>
         <span style="font-size:11px;color:var(--green-price);font-weight:700;">−₹${o.couponDiscount}</span>
       </div>`
    : '';

  return `
    <div style="margin-top:10px;background:#fff;border-radius:8px;padding:10px 12px;border:1px solid var(--cream2);">
      <div style="font-size:10px;font-weight:700;color:var(--tmut);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">🛒 Order Items</div>
      ${rows}${couponRow}
      <div style="display:flex;justify-content:space-between;padding:7px 0 0;margin-top:4px;border-top:1.5px solid var(--cream2);">
        <span style="font-size:13px;font-weight:700;color:var(--g2);">Total Paid</span>
        <span style="font-size:13px;font-weight:800;color:var(--g2);">₹${o.total || 0}</span>
      </div>
    </div>`;
}

/* ── HTML snippets ────────────────────── */
function _noPhoneHTML(size = '') {
  const pad = size === 'small' ? '20px' : '40px';
  return `<div style="padding:${pad};text-align:center;color:var(--tmut);font-size:13px">
    <div style="font-size:40px;margin-bottom:10px">📦</div>
    Enter your phone number in the order form
  </div>`;
}

function _loadingHTML(msg, size = '') {
  const sz = size === 'small' ? '24px' : '32px';
  return `<div style="text-align:center;padding:40px;color:var(--tmut);">
    <div style="width:${sz};height:${sz};border:3px solid var(--cream2);border-top-color:var(--g2);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>
    ${msg}
  </div>`;
}

function _errorHTML() {
  return `<div style="padding:20px;text-align:center;color:var(--tmut)">Could not load orders.</div>`;
}
