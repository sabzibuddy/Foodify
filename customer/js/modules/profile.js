/* ════════════════════════════════════════
   modules/profile.js
   Profile side panel + full screen profile page.
   NOTE: loadUserProfile, applyUserToForm,
   updateProfileIcon, logoutUser → auth.js/auth-ui.js
   Depends on: core/state.js, core/storage.js,
               core/validators.js, core/error.js,
               ui/toast.js, ui/auth-ui.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   PROFILE PANEL (Side Drawer)
════════════════════════════════════════ */
function openProfile() {
  document.getElementById('profile-overlay')?.classList.add('open');
  document.getElementById('profile-panel')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  loadProfileFormValues();

  // Login state check: phone hai toh logged in, warna guest
  const isLoggedIn = !!(currentUser?.phone || firebase.auth().currentUser);
  const logoutBtn = document.getElementById('profile-logout-btn');
  const loginBtn  = document.getElementById('profile-login-btn');
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? '' : 'none';
  if (loginBtn)  loginBtn.style.display  = isLoggedIn ? 'none' : '';
}

function closeProfile() {
  document.getElementById('profile-overlay')?.classList.remove('open');
  document.getElementById('profile-panel')?.classList.remove('open');
  document.body.style.overflow = '';
}

function loadProfileFormValues() {
  const name  = currentUser?.name  || document.getElementById('name')?.value.trim()  || '';
  const phone = currentUser?.phone || document.getElementById('phone')?.value.trim() || '';
  const email = currentUser?.email || '';

  const nameEl  = document.getElementById('profile-name-input');
  const phoneEl = document.getElementById('profile-phone-input');
  const emailEl = document.getElementById('profile-email-input');

  if (nameEl)  nameEl.value  = name;
  if (emailEl) emailEl.value = email;
  if (phoneEl) {
    phoneEl.value = phone;
    if (phone) { phoneEl.readOnly = true; phoneEl.style.color = 'var(--tmut)'; }
  }
}

/* ════════════════════════════════════════
   FULL SCREEN PROFILE PAGE
════════════════════════════════════════ */
function openProfilePage() {
  const page = document.getElementById('profile-page');
  if (!page) return;
  page.classList.add('open');
  document.body.style.overflow = 'hidden';
  loadProfilePageData();
  if (navigator.vibrate) navigator.vibrate([10]);
}

function closeProfilePage() {
  document.getElementById('profile-page')?.classList.remove('open');
  document.body.style.overflow = '';
}

function loadProfilePageData() {
  // BUG FIX: raw JSON.parse(localStorage.getItem) → Storage.getUser()
  const user = Storage.getUser() || {};
  const name      = user.name      || currentUser?.name  || document.getElementById('name')?.value.trim()  || '';
  const phone     = user.phone     || currentUser?.phone || document.getElementById('phone')?.value.trim() || '';
  const email     = user.email     || currentUser?.email || '';
  const updatedAt = user.updatedAt || '';

  _ppSetVal('pp-name',  name);
  _ppSetVal('pp-phone', phone);
  _ppSetVal('pp-email', email);
  updatePPAvatar();

  const dispPhone = document.getElementById('pp-display-phone');
  if (dispPhone) dispPhone.textContent = phone ? `+91 ${phone}` : 'Phone not set';

  if (updatedAt) {
    const d  = new Date(updatedAt);
    const el = document.getElementById('pp-last-updated');
    if (el) el.textContent = '🕐 Last updated: ' + d.toLocaleDateString('en-IN', {
      day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
    });
  }
  const msg = document.getElementById('pp-form-msg');
  if (msg) { msg.textContent = ''; msg.style.color = ''; }
}

function updatePPAvatar() {
  const nameVal  = document.getElementById('pp-name')?.value.trim() || '';
  const avatarEl = document.getElementById('pp-avatar-circle');
  const dispName = document.getElementById('pp-display-name');
  if (avatarEl) avatarEl.textContent = nameVal
    ? nameVal.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '👤';
  if (dispName) dispName.textContent = nameVal || 'Your Name';
}

/* ── Save Profile ─────────────────────── */
async function saveProfileData() {
  const nameVal  = document.getElementById('pp-name')?.value.trim()  || '';
  const phoneVal = document.getElementById('pp-phone')?.value.trim() || '';
  const emailVal = document.getElementById('pp-email')?.value.trim() || '';
  const msgEl    = document.getElementById('pp-form-msg');
  const saveBtn  = document.getElementById('pp-save-btn');

  const nameErr = Validators.name(nameVal);
  if (nameErr) {
    _ppSetMsg(msgEl, `❌ ${nameErr}`, 'error');
    document.getElementById('pp-name')?.focus();
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    return;
  }
  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    _ppSetMsg(msgEl, '❌ Please enter a valid email', 'error'); return;
  }

  if (saveBtn) { saveBtn.style.opacity = '0.7'; saveBtn.style.pointerEvents = 'none'; saveBtn.textContent = '⏳ Saving...'; }
  _ppSetMsg(msgEl, 'Saving...', 'muted');

  const updatedUser = { ...currentUser, name: nameVal, phone: phoneVal, email: emailVal, updatedAt: new Date().toISOString() };
  Storage.setUser(updatedUser);
  currentUser = updatedUser;

  _ppSetVal('name',  nameVal);
  _ppSetVal('phone', phoneVal);
  updateProfileIcon();

    if (firebase.auth().currentUser?.uid) {
    const uid = firebase.auth().currentUser.uid;
    await safeAsync(() =>
      db.collection("users").doc(uid).set({
        name: nameVal, phone: phoneVal, email: emailVal || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      ERR.FIREBASE, true
    );
  }

  if (saveBtn) { saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'all'; saveBtn.textContent = '✅ Save Profile'; }
  _ppSetMsg(msgEl, '✅ Profile saved successfully!', 'success');
  updatePPAvatar();

  const dispPhone = document.getElementById('pp-display-phone');
  if (dispPhone) dispPhone.textContent = phoneVal ? `+91 ${phoneVal}` : '';
  const lastEl = document.getElementById('pp-last-updated');
  if (lastEl) lastEl.textContent = '🕐 Last updated: Just now';

  showToast('✅ Profile saved successfully!', 'success');
  if (navigator.vibrate) navigator.vibrate([15, 30, 15, 30, 60]);
  setTimeout(() => { if (msgEl?.textContent === '✅ Profile saved successfully!') msgEl.textContent = ''; }, 3500);
}

/* ════════════════════════════════════════
   RIPPLE EFFECT ON PROFILE BUTTONS
════════════════════════════════════════ */
/*(function () {
  function addRipple(btn, e) {
    const rect   = btn.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height);
    const x      = (e.clientX || rect.left + rect.width  / 2) - rect.left - size / 2;
    const y      = (e.clientY || rect.top  + rect.height / 2) - rect.top  - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-circle';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('profile-panel')?.addEventListener('click', e => {
      const btn = e.target.closest('.profile-link-btn, .profile-logout-btn');
      if (btn) addRipple(btn, e);
    });
  });
})();*/

/* ── Private helpers ──────────────────── */
function _ppSetVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function _ppSetMsg(el, text, type = '') {
  if (!el) return;
  el.style.color = { error:'var(--terra)', success:'var(--green-price)', muted:'var(--tmut)' }[type] || '';
  el.textContent = text;
}
