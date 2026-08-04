/* ════════════════════════════════════════
   ui/auth-ui.js
   Auth DOM helpers — OTP boxes, timer, steps, errors.
   Profile icon + wishlist badge bhi yahan.
   Depends on: core/state.js, core/storage.js, modules/auth.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   PROFILE ICON
════════════════════════════════════════ */
function updateProfileIcon() {
  const btn = document.getElementById('profile-icon-btn');
  if (!btn) return;

  const nameVal = (currentUser?.name || '').trim()
               || document.getElementById('name')?.value?.trim()
               || '';

  if (nameVal) {
    const ini = nameVal.split(' ').filter(Boolean)
      .map(w => w[0]).join('').toUpperCase().slice(0, 2);

    btn.textContent = ini;
    btn.classList.add('logged-in');

    const av  = document.getElementById('profile-avatar');
    const sub = document.getElementById('profile-panel-subtitle');
    const hn  = document.getElementById('profile-header-name');

    if (av)  av.textContent  = ini;
    if (sub) sub.textContent = currentUser?.phone ? `+91 ${currentUser.phone}` : 'Your account';
    if (hn)  hn.textContent  = nameVal;
  } else {
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="#fff" stroke-width="2" stroke-linecap="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>`;
    btn.classList.remove('logged-in');
  }
}

/* ════════════════════════════════════════
   WISHLIST BADGE
════════════════════════════════════════ */
function updateWishBadge() {
  const badge = document.getElementById('wish-count-badge');
  if (badge) badge.textContent = wishlist.size;
}

function saveWishlist() {
  Storage.setWishlist([...wishlist]);
  updateWishBadge();
}

/* ════════════════════════════════════════
   PHONE INPUT HANDLER
════════════════════════════════════════ */
function onLoginPhoneInput(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 10);
  const btn     = document.getElementById('send-otp-btn');
  const isValid = input.value.length === 10;
  if (!btn) return;
  btn.style.background = isValid ? '#1C3829' : '#ccc';
  btn.style.cursor     = isValid ? 'pointer'  : 'default';
  hideOtpError('otp-phone-error');
}

/* ════════════════════════════════════════
   OTP BOX HELPERS
════════════════════════════════════════ */

/** Single digit input + auto-advance */
function otpBoxInput(input, idx) {
  // Paste detection — multiple digits at once
  if (input.value.length > 1) {
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    const boxes  = document.querySelectorAll('.otp-box');
    digits.split('').forEach((d, i) => { if (boxes[i]) boxes[i].value = d; });
    const lastIdx = Math.min(digits.length, 5);
    if (boxes[lastIdx]) boxes[lastIdx].focus();
    checkOtpComplete();
    if (getOtpFromBoxes().length === 6) setTimeout(verifyOTP, 300);
    return;
  }

  // Single digit
  input.value = input.value.replace(/\D/g, '').slice(-1);

  if (input.value) {
    input.style.borderColor = '#4A8B5C';
    const next = document.querySelectorAll('.otp-box')[idx + 1];
    if (next) next.focus();
  } else {
    input.style.borderColor = '#e0dbd2';
  }

  if (getOtpFromBoxes().length === 6) setTimeout(verifyOTP, 300);
}

/** Keyboard nav — backspace, arrows, enter */
function otpBoxKey(event, idx) {
  const boxes = document.querySelectorAll('.otp-box');

  switch (event.key) {
    case 'Backspace':
      if (!boxes[idx].value && idx > 0) {
        boxes[idx - 1].value             = '';
        boxes[idx - 1].style.borderColor = '#e0dbd2';
        boxes[idx - 1].focus();
      } else {
        boxes[idx].value             = '';
        boxes[idx].style.borderColor = '#e0dbd2';
      }
      checkOtpComplete();
      event.preventDefault();
      break;
    case 'ArrowLeft':  if (idx > 0) boxes[idx - 1].focus(); break;
    case 'ArrowRight': if (idx < 5) boxes[idx + 1].focus(); break;
    case 'Enter':      verifyOTP(); break;
  }
}

/** OTP string get karo + verify button state sync */
function getOtpFromBoxes() {
  const boxes = document.querySelectorAll('.otp-box');
  let otp = '';
  boxes.forEach(b => (otp += b.value));

  const btn = document.getElementById('verify-otp-btn');
  if (btn) {
    const ready          = otp.length === 6;
    btn.disabled         = !ready;
    btn.style.background = ready ? '#1C3829' : '#ccc';
    btn.style.cursor     = ready ? 'pointer'  : 'default';
  }
  return otp;
}

function checkOtpComplete() { getOtpFromBoxes(); }

/** Sab boxes clear karo */
function clearOtpBoxes() {
  document.querySelectorAll('.otp-box').forEach(b => {
    b.value             = '';
    b.style.borderColor = '#e0dbd2';
  });
  const btn = document.getElementById('verify-otp-btn');
  if (btn) { btn.style.background = '#ccc'; btn.style.cursor = 'default'; }
}

/** Pehle box pe focus */
function focusFirstOtpBox() {
  const first = document.querySelector('.otp-box');
  if (first) setTimeout(() => first.focus(), 100);
}

/** Galat OTP — shake animation + red borders */
function shakeOtpBoxes() {
  const container = document.getElementById('otp-boxes');
  if (!container) return;
  container.style.animation = 'none';
  void container.offsetHeight;          // force reflow for re-trigger
  container.style.animation = 'otpShake 0.4s ease';
  setTimeout(() => (container.style.animation = ''), 400);
  document.querySelectorAll('.otp-box').forEach(b => {
    b.style.borderColor = '#C8704A';
  });
}

/* ════════════════════════════════════════
   RESEND TIMER
════════════════════════════════════════ */
function startResendTimer(seconds) {
  clearInterval(resendTimerInterval);
  otpResendSeconds = seconds;

  const timerEl       = document.getElementById('resend-timer');
  const countdownText = document.getElementById('resend-countdown-text');
  const resendBtn     = document.getElementById('resend-btn');

  if (timerEl)       timerEl.style.display      = 'inline';
  if (countdownText) countdownText.style.display = 'inline';
  if (resendBtn)     resendBtn.style.display     = 'none';

  function tick() {
    if (timerEl) timerEl.textContent = otpResendSeconds + 's';
    if (otpResendSeconds <= 0) {
      clearInterval(resendTimerInterval);
      if (timerEl)       timerEl.style.display      = 'none';
      if (countdownText) countdownText.style.display = 'none';
      if (resendBtn) {
        resendBtn.classList.remove('hidden');
        resendBtn.style.display = 'inline';
        resendBtn.textContent   = 'Resend OTP';
      }
      return;
    }
    otpResendSeconds--;
  }

  tick();
  resendTimerInterval = setInterval(tick, 1000);
}

/* ════════════════════════════════════════
   STEP SWITCHER
════════════════════════════════════════ */
function showOtpStep(step) {
  const phoneStep  = document.getElementById('otp-step-phone');
  const verifyStep = document.getElementById('otp-step-verify');
  const loginScreen = document.getElementById('login-screen');
  if (phoneStep) {
    phoneStep.classList.remove('hidden');
    phoneStep.style.display  = step === 'phone'  ? 'block' : 'none';
  }
  if (verifyStep) {
    verifyStep.classList.remove('hidden');
    verifyStep.style.display = step === 'verify' ? 'block' : 'none';
  }
  if (loginScreen) {
    loginScreen.classList.toggle('otp-verify-active', step === 'verify');
  }
}

/* ════════════════════════════════════════
   OTP ERROR HELPERS
════════════════════════════════════════ */
function showOtpError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideOtpError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

/* ════════════════════════════════════════
   SMS AUTOFILL — PASTE HANDLER
════════════════════════════════════════ */
document.addEventListener('paste', function (e) {
  const verifyStep = document.getElementById('otp-step-verify');
  if (!verifyStep || verifyStep.style.display === 'none') return;

  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  const digits = pasted.replace(/\D/g, '').slice(0, 6);
  if (digits.length < 4) return;

  e.preventDefault();
  const boxes = document.querySelectorAll('.otp-box');
  digits.split('').forEach((d, i) => {
    if (boxes[i]) {
      boxes[i].value             = d;
      boxes[i].style.borderColor = '#4A8B5C';
    }
  });

  checkOtpComplete();
  if (digits.length === 6) setTimeout(verifyOTP, 300);
});