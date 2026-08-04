/* ════════════════════════════════════════
   core/error.js
   Centralized error handling & logging.
   Import constants → state → this
════════════════════════════════════════ */

/* ── Error types ──────────────────────── */
const ERR = Object.freeze({
  NETWORK:    'NETWORK',
  FIREBASE:   'FIREBASE',
  VALIDATION: 'VALIDATION',
  AUTH:       'AUTH',
  GEO:        'GEO',
  UNKNOWN:    'UNKNOWN',
});

/* ════════════════════════════════════════
   MAIN ERROR HANDLER
════════════════════════════════════════ */

/**
 * Centralized error handler — log + optional toast
 * @param {Error|string} err
 * @param {string} type  - ERR constant
 * @param {boolean} silent - toast dikhao ya nahi
 */
function handleError(err, type = ERR.UNKNOWN, silent = false) {
  const msg     = err?.message || String(err);
  const label   = `[${type}]`;

  // Console mein hamesha log karo
  console.error(label, msg);

  // Production mein Firebase Crashlytics ya similar bhej sakte ho yahan
  // _reportToServer(type, msg);

  if (silent) return;

  // User-friendly messages
  const userMsg = _getFriendlyMsg(type, msg);
  if (typeof showToast === 'function') showToast(userMsg, 'error');
}

/* ── Firebase error codes → friendly messages ── */
function _getFriendlyMsg(type, raw) {
  if (type === ERR.NETWORK || raw.includes('network'))
    return 'Please check your internet connection 📶';

  if (type === ERR.AUTH)
    return 'Login issue — please try again';

  if (type === ERR.GEO)
    return 'Location access denied — please select manually';

  if (type === ERR.FIREBASE) {
    if (raw.includes('permission')) return 'Access denied — please log in';
    if (raw.includes('quota'))     return 'Server is busy — please try again in a moment';
  }

  if (type === ERR.VALIDATION)
    return raw; // validation errors as-is dikhao

  return 'Something went wrong — please try again';
}

/* ════════════════════════════════════════
   ASYNC WRAPPER (try-catch boilerplate hatao)
════════════════════════════════════════ */

/**
 * Async function ko safe wrap karo
 * @param {Function} fn
 * @param {string} errType
 * @param {boolean} silent
 */
async function safeAsync(fn, errType = ERR.UNKNOWN, silent = false) {
  try {
    return await fn();
  } catch (e) {
    handleError(e, errType, silent);
    return null;
  }
}
