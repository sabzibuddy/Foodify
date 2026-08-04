/* ════════════════════════════════════════
   modules/notifications.js
   Out-of-stock notifications + future push.
   Depends on: core/state.js, core/storage.js,
               core/error.js, ui/toast.js
════════════════════════════════════════ */

/**
 * OOS item ke liye notify register karo
 * @param {string} name - product name
 */
async function notifyItem(name) {
  // Already registered?
  if (notifiedItems.has(name)) {
    showToast(`Already on waitlist for ${name}!`);
    return;
  }

  // Phone check
  const phone = document.getElementById('phone')?.value?.trim() || '';
  const phoneErr = Validators.phone(phone);
  if (phoneErr) {
    showToast('Enter your 10-digit phone number below first', 'error');
    document.getElementById('phone')?.focus();
    return;
  }

  // Firestore save
  const saved = await safeAsync(async () => {
    await db.collection('notifications').add({
      name,
      phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  }, ERR.FIREBASE, true); // silent — fallback gracefully

  // Locally register even if Firestore fails (UX ke liye)
  notifiedItems.add(name);
  // BUG FIX: pehle raw localStorage.setItem tha, ab Storage use karte hain
  Storage.setNotified([...notifiedItems]);

  // Card UI update (notify → notified)
  renderProducts();
  showToast(`✅ We'll notify you when ${name} is back!`, 'success');
}

/* ════════════════════════════════════════
   PHASE 5 — Push notification subscription
   Order status change hone pe (confirmed/
   out_for_delivery/delivered/cancelled) —
   functions/index.js ka onOrderStatusChange
   trigger yahan register hue token pe push
   bhejta hai.

   ⚠️ SETUP REQUIRED (ek baar, manual):
   Firebase Console → Project Settings →
   Cloud Messaging → "Web Push certificates"
   → generate karo → VAPID_KEY neeche paste karo.
   Bina iske subscribePush() silently fail
   hoga (app kabhi crash nahi karega).
════════════════════════════════════════ */
const VAPID_KEY = 'PASTE_YOUR_VAPID_KEY_HERE'; // TODO: Firebase Console se generate karo

/**
 * User se notification permission maango, FCM token lo,
 * aur users/{uid} doc me save karo. Login ke baad ya
 * profile screen se call karo (button pe, silent auto-call nahi —
 * browsers permission-prompt spam pasand nahi karte).
 */
async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof firebase === 'undefined' || !firebase.messaging) {
    showToast('Push notifications is browser me supported nahi hain.', 'error');
    return false;
  }
  if (VAPID_KEY === 'PASTE_YOUR_VAPID_KEY_HERE') {
    console.warn('[Push] VAPID_KEY set nahi hai — Firebase Console se generate karke notifications.js me daalo.');
    return false;
  }
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) {
    showToast('Push notifications ke liye pehle login karo.', 'error');
    return false;
  }

  const result = await safeAsync(async () => {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) throw new Error('Token nahi mila — permission denied ho sakta hai');

    await db.collection('users').doc(uid).set(
      { fcmToken: token, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return true;
  }, ERR.FIREBASE, true);

  if (result) showToast('🔔 Order updates ke liye notifications on ho gaye!', 'success');
  return !!result;
}

/**
 * App khula ho (foreground) tab bhi notification aaye to
 * yahan handle hota hai — background wala firebase-messaging-sw.js
 * me hai.
 */
function initForegroundPushListener() {
  if (typeof firebase === 'undefined' || !firebase.messaging || !firebase.messaging.isSupported?.()) return;
  try {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
      const title = payload.notification?.title || 'Order Update';
      const body  = payload.notification?.body  || '';
      showToast(`${title} — ${body}`, 'success');
    });
  } catch (e) {
    console.warn('[Push] foreground listener init failed:', e.message);
  }
}
