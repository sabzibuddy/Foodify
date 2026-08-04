/* ═══════════════════════════════════════════════════════════════════
   recently-viewed.js  —  SabziBuddy v5
   ─────────────────────────────────────────────────────────────────
   Kaam:
   • Jab customer koi product detail open kare → name save karo
   • Max 20 products, LIFO order (last dekha = pehle)
   • Home page par "🕒 Recently Viewed" section dikhao (>= 3 items)
   • localStorage mein store hota hai — no Firebase needed
   ═══════════════════════════════════════════════════════════════════ */

const RecentlyViewed = (function () {

  const LS_KEY  = 'sb_recently_viewed';
  const MAX     = 20;

  /* ── LocalStorage se list load karo ── */
  function _load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /* ── List save karo ── */
  function _save(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /* ── PUBLIC: product view track karo ── */
  function track(productName) {
    if (!productName) return;
    let list = _load();
    // Agar already hai toh pehle hata do (duplicate avoid)
    list = list.filter(n => n !== productName);
    // Sabse aage add karo (most recent first)
    list.unshift(productName);
    // Max limit
    if (list.length > MAX) list = list.slice(0, MAX);
    _save(list);
  }

  /* ── PUBLIC: list wapas do ── */
  function get() {
    return _load();
  }

  /* ── PUBLIC: clear karo ── */
  function clear() {
    localStorage.removeItem(LS_KEY);
  }

  return { track, get, clear };

})();
