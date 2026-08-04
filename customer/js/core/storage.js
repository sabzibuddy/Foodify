/* ════════════════════════════════════════
   core/storage.js
   Safe localStorage wrapper — never throws.
   Import constants.js before this file.
════════════════════════════════════════ */

const Storage = {

  /** Value get karo (JSON parse safe) */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /** Value set karo (JSON stringify safe) */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Storage full ya private mode
      console.warn(`[Storage] set failed for "${key}":`, e.message);
      return false;
    }
  },

  /** Key remove karo */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  /** Multiple keys ek saath remove karo */
  removeAll(keys = []) {
    keys.forEach(k => this.remove(k));
  },

  /** Key exist karta hai? */
  has(key) {
    return localStorage.getItem(key) !== null;
  },

  /* ── Shorthand helpers (LS_KEYS use karte hain) ── */

  getUser()         { return this.get(LS_KEYS.USER, null); },
  setUser(data)     { return this.set(LS_KEYS.USER, data); },
  removeUser()      { return this.remove(LS_KEYS.USER); },

  getWishlist()     { return this.get(LS_KEYS.WISHLIST, []); },
  setWishlist(arr)  { return this.set(LS_KEYS.WISHLIST, arr); },

  getNotified()     { return this.get(LS_KEYS.NOTIFIED, []); },
  setNotified(arr)  { return this.set(LS_KEYS.NOTIFIED, arr); },

  getLang()         { return this.get(LS_KEYS.LANG, 'en'); },
  setLang(lang)     { return this.set(LS_KEYS.LANG, lang); },

  getLocation()     { return this.get(LS_KEYS.LOCATION, null); },
  setLocation(obj)  { return this.set(LS_KEYS.LOCATION, obj); },
  removeLocation()  { return this.remove(LS_KEYS.LOCATION); },

  /** Full logout — sabkuch clear */
  clearAll() {
    this.removeAll(Object.values(LS_KEYS));
  },
};
