/* ════════════════════════════════════════
   modules/address-book.js
   Saved address page — view current saved details.
   Depends on: core/state.js
════════════════════════════════════════ */

function openSavedAddress() {
  const page = document.getElementById('saved-addr-page');
  if (!page) return;
  page.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderSavedAddrPageBody();
  if (navigator.vibrate) navigator.vibrate([10]);
}

function closeSavedAddrPage() {
  document.getElementById('saved-addr-page')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderSavedAddrPageBody() {
  const body = document.getElementById('saved-addr-page-body');
  if (!body) return;

  const name  = currentUser?.name  || document.getElementById('name')?.value.trim()  || '';
  const phone = currentUser?.phone || document.getElementById('phone')?.value.trim() || '';
  const addr  = document.getElementById('address')?.value.trim() || currentUser?.address || '';
  const email = currentUser?.email || '';

  let html = '<div style="padding:20px 16px;">';

  const card = (icon, label, value) => `
    <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;
      border:1px solid var(--cream2);box-shadow:0 2px 8px rgba(28,56,41,0.05);">
      <div style="font-size:10px;font-weight:700;color:var(--g4);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:6px;">${icon} ${label}</div>
      <div style="font-size:15px;font-weight:600;color:var(--td);line-height:1.6;">${value}</div>
    </div>`;

  if (name)  html += card('👤', 'Full Name',       name);
  if (phone) html += card('📞', 'Mobile Number',   `+91 ${phone}`);
  if (email) html += card('📧', 'Email',           email);
  if (addr)  html += card('🏠', 'Delivery Address', addr);

  // Confirmed map location
  if (confirmedAddr) {
    html += `
      <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;
        border:1px solid var(--cream2);box-shadow:0 2px 8px rgba(28,56,41,0.05);">
        <div style="font-size:10px;font-weight:700;color:var(--g4);text-transform:uppercase;
          letter-spacing:1px;margin-bottom:6px;">📍 Confirmed Map Location</div>
        <div style="font-size:13px;font-weight:500;color:var(--td);line-height:1.5;">${confirmedAddr}</div>
        ${confirmedLat ? `<div style="font-size:11px;color:var(--g4);margin-top:4px;font-weight:600;">
          ${confirmedLat.toFixed(5)}, ${confirmedLng.toFixed(5)}</div>` : ''}
      </div>`;
  }

  if (!name && !phone && !addr) {
    html += `
      <div style="padding:60px 24px;text-align:center;color:var(--tmut);">
        <div style="font-size:48px;margin-bottom:12px;">📭</div>
        <div style="font-weight:600;margin-bottom:6px;">No saved details yet</div>
        <div style="font-size:13px;">Fill in your details in the order form — they'll be saved here</div>
      </div>`;
  }

  html += `
    <button onclick="closeSavedAddrPage();closeProfile();setTimeout(()=>{document.getElementById('name')?.scrollIntoView({behavior:'smooth'});},300);"
      style="width:100%;padding:14px;background:var(--g2);color:#fff;border:none;border-radius:12px;
        font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px;">
      ✏️ Update in Order Form
    </button>`;

  html += '</div>';
  body.innerHTML = html;
}
