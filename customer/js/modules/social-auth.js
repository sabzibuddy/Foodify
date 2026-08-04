/* ════════════════════════════════════════
   modules/social-auth.js
   Google Sign-In + Email/Password Sign-In
   — Phone OTP already handled in auth.js, isko touch nahi kiya.
   — Yeh file wahi "login complete hone ke baad" wala flow reuse
     karti hai (Firestore user doc, Storage, name-collection,
     location onboarding) jo auth.js mein hai.

   ⚠️ IMPORTANT — is file ko index.html me auth.js ke TURANT BAAD
   <script> tag se include karo:
       <script src="js/modules/auth.js"></script>
       <script src="js/modules/social-auth.js"></script>

   Depends on: firebase (auth-compat, firestore-compat),
               core/storage.js, functions already in auth.js
               (showNameCollectionScreen, showLocationOnboarding,
                loadUserProfile), checkout module (openCheckout).
════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   SHARED: login complete hone ke baad common flow
   (phone OTP flow auth.js mein already yeh sab karta hai,
    yahan Google/Email ke liye wahi cheez reuse ki hai)
══════════════════════════════════════════════════════ */
async function _finishSocialLogin(firebaseUser, extra = {}) {
  const uid     = firebaseUser.uid;
  const userRef = db.collection('users').doc(uid);
  const snap    = await userRef.get();
  const isNew   = !snap.exists;

  const baseData = {
    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    ...(isNew && { createdAt: firebase.firestore.FieldValue.serverTimestamp() }),
    uid,
    ...extra, // e.g. { name, email } ya { phone }
  };

  await userRef.set(baseData, { merge: true });

  const userData = snap.exists ? snap.data() : {};
  Storage.setUser({ ...userData, ...baseData, otpVerified: true });
  currentUser = Storage.getUser();

  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  document.body.style.overflow = '';

  // Pending checkout tha toh usi pe wapas bhejo (jaise phone-OTP flow me hai)
  const _pendingCO = localStorage.getItem('sb_pending_checkout');
  if (_pendingCO) {
    localStorage.removeItem('sb_pending_checkout');
    if (typeof loadUserProfile === 'function') loadUserProfile();
    setTimeout(() => { if (typeof openCheckout === 'function') openCheckout(); }, 400);
    return;
  }

  if (isNew || !currentUser?.name) {
    if (typeof showNameCollectionScreen === 'function') showNameCollectionScreen();
  } else {
    if (typeof showLocationOnboarding === 'function') showLocationOnboarding();
    if (typeof loadUserProfile === 'function') loadUserProfile();
  }
}

/* ══════════════════════════════════════════════════════
   GOOGLE SIGN-IN (popup based)
══════════════════════════════════════════════════════ */
async function signInWithGoogle() {
  const btn = document.querySelector('.login-social-btn[aria-label="Continue with Google"]');
  try {
    if (btn) btn.disabled = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await firebase.auth().signInWithPopup(provider);
    const user     = result.user;

    await _finishSocialLogin(user, {
      name:  user.displayName || '',
      email: user.email || '',
    });

  } catch (err) {
    console.error('[GoogleAuth] error:', err);

    if (err.code === 'auth/popup-blocked') {
      alert('Popup blocked ho gaya — is site ke liye popups allow karke dobara try karein.');
    } else if (err.code === 'auth/unauthorized-domain') {
      alert('Yeh domain Firebase console me authorized nahi hai.\nFirebase Console → Authentication → Settings → Authorized domains me isko add karo.');
    } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      alert('Google se login nahi ho paaya. Please try again.');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════
   EMAIL / PASSWORD SIGN-IN
   Ek chhota bottom-sheet modal — same field login aur
   signup dono ke liye kaam karta hai (agar account nahi
   milta toh automatically naya bana deta hai).
══════════════════════════════════════════════════════ */
function openEmailAuthModal() {
  if (document.getElementById('email-auth-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'email-auth-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
                display:flex;align-items:flex-end">
      <div style="background:#fff;width:100%;border-radius:20px 20px 0 0;padding:28px 20px">
        <h2 style="font-size:20px;color:#1C3829;margin:0 0 16px">Email se login karein</h2>

        <input id="email-auth-email" type="email" placeholder="Email address"
          style="width:100%;padding:14px;border:1.5px solid #e0dbd2;border-radius:10px;
                 font-size:16px;box-sizing:border-box;margin-bottom:12px">

        <input id="email-auth-password" type="password" placeholder="Password (min 6 characters)"
          style="width:100%;padding:14px;border:1.5px solid #e0dbd2;border-radius:10px;
                 font-size:16px;box-sizing:border-box;margin-bottom:8px">

        <div id="email-auth-error" style="color:#c0392b;font-size:13px;margin-bottom:12px;min-height:16px"></div>

        <button id="email-auth-submit-btn" onclick="_emailAuthSubmit()"
          style="width:100%;padding:14px;background:#1C3829;color:#fff;border:none;
                 border-radius:12px;font-size:16px;cursor:pointer;font-weight:600;margin-bottom:10px">
          Continue
        </button>

        <p style="text-align:center;color:#888;font-size:13px;margin:0">
          Naya account hai? Same form se try karo — agar account exist nahi karta
          toh automatically ban jayega.
        </p>

        <p onclick="document.getElementById('email-auth-overlay')?.remove()"
           style="text-align:center;color:#aaa;font-size:13px;margin:14px 0 0;cursor:pointer">
          Cancel
        </p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('email-auth-email')?.focus(), 300);
}

async function _emailAuthSubmit() {
  const email    = document.getElementById('email-auth-email')?.value.trim() || '';
  const password = document.getElementById('email-auth-password')?.value || '';
  const errEl    = document.getElementById('email-auth-error');
  const btn      = document.getElementById('email-auth-submit-btn');

  errEl.textContent = '';

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errEl.textContent = 'Valid email daaliye'; return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password kam se kam 6 characters ka hona chahiye'; return;
  }

  btn.disabled = true;
  btn.textContent = 'Please wait...';

  try {
    let result;
    try {
      // Pehle existing account se login try karo
      result = await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (loginErr) {
      // Account nahi mila toh naya bana do
      if (loginErr.code === 'auth/user-not-found') {
        result = await firebase.auth().createUserWithEmailAndPassword(email, password);
      } else {
        throw loginErr;
      }
    }

    document.getElementById('email-auth-overlay')?.remove();
    await _finishSocialLogin(result.user, { email: result.user.email });

  } catch (err) {
    console.error('[EmailAuth] error:', err);
    let msg = 'Login/signup fail ho gaya. Dobara try karein.';
    if (err.code === 'auth/wrong-password')       msg = 'Galat password.';
    if (err.code === 'auth/email-already-in-use') msg = 'Yeh email already registered hai (shayad password galat hai).';
    if (err.code === 'auth/invalid-email')        msg = 'Email format sahi nahi hai.';
    if (err.code === 'auth/weak-password')        msg = 'Password bahut weak hai — kam se kam 6 characters rakho.';
    errEl.textContent = msg;
    btn.disabled = false;
    btn.textContent = 'Continue';
  }
}
