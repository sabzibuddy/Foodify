/* ════════════════════════════════════════
   ui/toast.js
   Toast notifications — single source.
   Depends on: core/constants.js, core/state.js
════════════════════════════════════════ */

/**
 * Toast dikhao
 * @param {string} msg
 * @param {'success'|'error'|''} type
 */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent   = msg;
  t.className     = 'toast' + (type ? ' ' + type : '');
  t.style.display = 'block';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => {
      t.style.display  = 'none';
      t.style.opacity  = '1';
    }, 300);
  }, TOAST_DURATION);
}

/* ── Shorthand helpers ─────────────────── */
const toast = {
  success: (msg) => showToast(msg, 'success'),
  error:   (msg) => showToast(msg, 'error'),
  info:    (msg) => showToast(msg, ''),
};
