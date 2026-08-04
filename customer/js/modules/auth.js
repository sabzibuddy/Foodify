/* ════════════════════════════════════════
   modules/auth.js
   Auth business logic — Firebase Phone Auth OTP flow.
   UI helpers → ui/auth-ui.js
   Depends on: core/constants.js, core/state.js,
               core/storage.js, core/error.js,
               ui/auth-ui.js, ui/toast.js, ui/validation.js
════════════════════════════════════════ */

/* ── Auth-specific state ──────────────── */
let otpPhone            = '';
let resendTimerInterval = null;
let otpResendSeconds    = OTP_RESEND_DELAY;   // from constants.js
let otpAttempts         = 0;

/* ── Firebase confirmationResult store ── */
let _confirmationResult = null;

/* ── reCAPTCHA verifier ───────────────── */
let _recaptchaVerifier  = null;

/* ════════════════════════════════════════
   RECAPTCHA INIT (invisible)
════════════════════════════════════════ */
function _initRecaptcha(buttonId = 'send-otp-btn') {
  if (_recaptchaVerifier) return;
  _recaptchaVerifier = new firebase.auth.RecaptchaVerifier(buttonId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      _recaptchaVerifier = null;
    }
  });
}

/* ════════════════════════════════════════
   SEND OTP
════════════════════════════════════════ */
async function sendOTP() {
  const phone = document.getElementById('login-phone')?.value.trim() || '';

  // Validation
  const phoneErr = Validators.phone(phone);
  if (phoneErr) { showOtpError('otp-phone-error', phoneErr); return; }

  otpPhone = phone;

  const btn = document.getElementById('send-otp-btn');
  _setBtnLoading(btn, 'Sending OTP...');
  hideOtpError('otp-phone-error');

  try {
    _initRecaptcha();

    const fullPhone = '+91' + phone;
    _confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhone, _recaptchaVerifier);

    // Success — OTP bhej diya
    showOtpStep('verify');
    _tryWebOTP(); // Android SMS autofill
    document.getElementById('otp-sent-to-label').textContent =
      '+91 ' + phone.slice(0, 2) + 'XXXXXX' + phone.slice(-2);
    startResendTimer(OTP_RESEND_DELAY);
    focusFirstOtpBox();
    _vibrate([15, 30, 15]);

  } catch (error) {
    console.error('SendOTP Error:', error);
    // reCAPTCHA reset karo next attempt ke liye
    _recaptchaVerifier = null;
    showOtpError('otp-phone-error', 'OTP could not be sent — please try again');
    _setBtnReady(btn, 'Send OTP', '#1C3829');
  }
}

/* ════════════════════════════════════════
   VERIFY OTP
════════════════════════════════════════ */
async function verifyOTP() {
  const otp = getOtpFromBoxes();
  hideOtpError('otp-verify-error');

  if (otp.length < 6) {
    showOtpError('otp-verify-error', 'Please enter the complete 6-digit OTP');
    shakeOtpBoxes(); return;
  }
  if (!_confirmationResult) {
    showOtpError('otp-verify-error', 'Session expired. Please request a new OTP.');
    shakeOtpBoxes(); return;
  }
  if (otpAttempts >= MAX_OTP_ATTEMPTS) {
    showOtpError('otp-verify-error', 'Too many failed attempts. Please request a new OTP.'); return;
  }

  const btn = document.getElementById('verify-otp-btn');
  _setBtnLoading(btn, 'Verifying...');
  otpAttempts++;

  try {
    await _confirmationResult.confirm(otp);

    // ✅ OTP sahi — login complete
    clearInterval(resendTimerInterval);
    onOTPVerified(otpPhone);

  } catch (error) {
    console.error('VerifyOTP Error:', error);
    const remaining = MAX_OTP_ATTEMPTS - otpAttempts;
    let errMsg;
    if (remaining <= 0)  errMsg = 'Too many failed attempts. Please request a new OTP.';
    else                 errMsg = `Galat OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} bacha hai.`;

    showOtpError('otp-verify-error', errMsg);
    shakeOtpBoxes(); clearOtpBoxes(); focusFirstOtpBox();
    _setBtnReady(btn, 'Verify & Continue', '#ccc');
  }
}

/* ════════════════════════════════════════
   RESEND OTP
════════════════════════════════════════ */
async function resendOTP() {
  otpAttempts = 0;
  clearOtpBoxes();
  hideOtpError('otp-verify-error');

  const resendBtn = document.getElementById('resend-btn');
  if (resendBtn) resendBtn.style.display = 'none';

  try {
    // reCAPTCHA reset karo
    if (_recaptchaVerifier) {
      try { _recaptchaVerifier.clear(); } catch(e) {}
      _recaptchaVerifier = null;
    }
    _initRecaptcha('recaptcha-container');

    const fullPhone = '+91' + otpPhone;
    _confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhone, _recaptchaVerifier);

    startResendTimer(60);
    focusFirstOtpBox();
    _vibrate([15, 30, 15]);

  } catch (error) {
    console.error('ResendOTP Error:', error);
    _recaptchaVerifier = null;
    showOtpError('otp-verify-error', 'Could not resend OTP. Please try again.');
    if (resendBtn) { resendBtn.style.display = 'inline'; resendBtn.textContent = 'Resend OTP'; }
  }
}

/* ════════════════════════════════════════
   ON OTP VERIFIED
════════════════════════════════════════ */
async function onOTPVerified(phone) {
  // Phone field lock karo
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    phoneEl.value    = phone;
    phoneEl.readOnly = true;
    phoneEl.style.cssText += 'background:#f0ece4;color:var(--tmut);cursor:not-allowed;';
  }

  const btn = document.getElementById('verify-otp-btn');
  if (btn) { btn.textContent = '✅ Verified!'; btn.style.background = '#329537'; }

  try {
    const uid     = firebase.auth().currentUser?.uid;
    const userRef = db.collection('users').doc(uid);
    const snap    = await userRef.get();
    const isNew   = !snap.exists;

    await userRef.set({
      phone,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      ...(isNew && { createdAt: firebase.firestore.FieldValue.serverTimestamp() }),
      uid: uid
    }, { merge: true });

    const userData = snap.exists ? snap.data() : { phone };
    Storage.setUser({ ...userData, uid, phone, otpVerified: true });
    currentUser = Storage.getUser();

    setTimeout(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.body.style.overflow = '';

      // ── Pending Checkout Check (Zepto-style) ──
      const _pendingCO = localStorage.getItem('sb_pending_checkout');
      if (_pendingCO) {
        localStorage.removeItem('sb_pending_checkout');
        loadUserProfile();
        _vibrate([20, 40, 20, 40, 80]);
        setTimeout(() => openCheckout(), 400);
        return;
      }
      // ─────────────────────────────────────────

      if (isNew || !currentUser?.name) {
        showNameCollectionScreen();
      } else {
        showLocationOnboarding();
        loadUserProfile();
      }
      _vibrate([20, 40, 20, 40, 80]);
    }, 700);

  } catch (err) {
    console.error('[Auth] onOTPVerified error:', err);
    Storage.setUser({ uid: firebase.auth().currentUser?.uid, phone, otpVerified: true });
    setTimeout(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.body.style.overflow = '';
      showLocationOnboarding();
    }, 700);
  }
}

/* ════════════════════════════════════════
   NAME COLLECTION SCREEN
════════════════════════════════════════ */
function showNameCollectionScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'name-collect-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
                display:flex;align-items:flex-end">
      <div style="background:#fff;width:100%;border-radius:20px 20px 0 0;padding:28px 20px">
        <h2 style="font-size:20px;color:#1C3829;margin:0 0 8px">Aapka naam kya hai? 👋</h2>
        <p style="color:#888;font-size:14px;margin:0 0 20px">SabziBuddy pe aapka swagat hai!</p>
        <input id="nc-name" type="text" placeholder="Full name" maxlength="40"
          style="width:100%;padding:14px;border:1.5px solid #e0dbd2;border-radius:10px;
                 font-size:16px;box-sizing:border-box;margin-bottom:12px">
        <button onclick="saveNameAndContinue()"
          style="width:100%;padding:14px;background:#1C3829;color:#fff;border:none;
                 border-radius:12px;font-size:16px;cursor:pointer;font-weight:600">
          Continue →
        </button>
        <p onclick="saveNameAndContinue()"
           style="text-align:center;color:#aaa;font-size:13px;margin:12px 0 0;cursor:pointer">
          Skip for now
        </p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('nc-name')?.focus(), 300);
}

async function saveNameAndContinue() {
  const name = document.getElementById('nc-name')?.value.trim() || '';
  if (name && firebase.auth().currentUser) {
    const uid = firebase.auth().currentUser.uid;
    await db.collection('users').doc(uid).set({ name }, { merge: true });
    const updated = { ...Storage.getUser(), name };
    Storage.setUser(updated);
    currentUser = updated;
    updateProfileIcon();
  }
  document.getElementById('name-collect-overlay')?.remove();
  showLocationOnboarding();
  loadUserProfile();
}

/* ════════════════════════════════════════
   SKIP / CHANGE PHONE
════════════════════════════════════════ */
function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.style.display = 'flex';
  const skipBtn = document.querySelector('.login-skip-btn');
  if (skipBtn) skipBtn.style.display = 'none';
}

function skipLogin() {
  Storage.set('sb_skip_login', '1');
  document.getElementById('login-screen').style.display = 'none';
  document.body.style.overflow = '';

  // Pending checkout tha toh bhi skip pe clear karo (guest mode)
  localStorage.removeItem('sb_pending_checkout');
  showLocationOnboarding();
}

function changePhoneNumber() {
  clearInterval(resendTimerInterval);
  clearOtpBoxes();
  hideOtpError('otp-verify-error');
  _confirmationResult = null;
  _recaptchaVerifier  = null;
  showOtpStep('phone');

  const btn      = document.getElementById('send-otp-btn');
  const phoneLen = document.getElementById('login-phone')?.value.length || 0;
  _setBtnReady(btn, 'Send OTP', phoneLen === 10 ? '#1C3829' : '#ccc');
}

/* ════════════════════════════════════════
   USER PROFILE LOAD / APPLY
════════════════════════════════════════ */
async function loadUserProfile() {
  const saved = Storage.getUser();
  if (!saved) return;

  try {
    currentUser = saved;
    updateProfileIcon();
    applyUserToForm();

    // Firestore se fresh data sync karo (agar logged in hai)
    const uid = firebase.auth().currentUser?.uid;
    if (uid) {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) {
        const fresh = snap.data();
        Storage.setUser({ ...saved, ...fresh, otpVerified: true });
        currentUser = Storage.getUser();
        updateProfileIcon();
        applyUserToForm();
      }
    }
  } catch (e) {
    handleError(e, ERR.UNKNOWN, true);
  }
}

function applyUserToForm() {
  if (!currentUser) return;

  const nameEl  = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const addrEl  = document.getElementById('address');

  if (nameEl  && currentUser.name)    nameEl.value  = currentUser.name;
  if (addrEl  && currentUser.address) addrEl.value  = currentUser.address;

  if (phoneEl && currentUser.phone) {
    phoneEl.value    = currentUser.phone;
    phoneEl.readOnly = true;
    phoneEl.style.cssText += 'background:#f0ece4;color:var(--tmut);cursor:not-allowed;';
  }
}

/* ════════════════════════════════════════
   LOGOUT
════════════════════════════════════════ */
function logoutUser() {
  if (!confirm('Logout karna chahte ho?')) return;
  firebase.auth().signOut().catch(() => {});
  Storage.clearAll();
  location.reload();
}

/* ════════════════════════════════════════
   LOCATION ONBOARDING (post-login)
   — Duplicate overlay hata diya.
   — Ab sirf loc-permission-modal use hota hai
     jo index.html mein already defined hai.
════════════════════════════════════════ */
function showLocationOnboarding() {
  // Agar location.js ka showLocModal available hai toh use karo
  if (typeof showLocModal === 'function') {
    showLocModal();
  }
}

/* ════════════════════════════════════════
   REQUEST PERMISSIONS (startup)
════════════════════════════════════════ */
function requestPermissions() {
  // Location flow ab initLocationFlow() handle karta hai (location.js)
  // Yahan sirf microphone permission silently request karo (future use)
  if (navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => stream.getTracks().forEach(t => t.stop()))
      .catch(() => {});
  }
}

/* ════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════ */
function _setBtnLoading(btn, text) {
  if (!btn) return;
  btn.disabled         = true;
  btn.textContent      = text;
  btn.style.background = '#4A8B5C';
  btn.style.cursor     = 'default';
}

function _setBtnReady(btn, text, bg = '#1C3829') {
  if (!btn) return;
  btn.disabled         = false;
  btn.textContent      = text;
  btn.style.background = bg;
  btn.style.cursor     = bg === '#ccc' ? 'default' : 'pointer';
}

function _vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

async function _tryWebOTP() {
  if (!('OTPCredential' in window)) return;
  try {
    const { code } = await navigator.credentials.get({ otp: { transport: ['sms'] } });
    const digits = code.replace(/\D/g, '').slice(0, 6);
    const boxes  = document.querySelectorAll('.otp-box');
    digits.split('').forEach((d, i) => { if (boxes[i]) boxes[i].value = d; });
    checkOtpComplete();
    if (digits.length === 6) setTimeout(verifyOTP, 300);
  } catch (e) { /* user cancelled ya timeout — ignore */ }
}