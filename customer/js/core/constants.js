/* ════════════════════════════════════════
   core/constants.js
   App-wide constants — never mutate these
════════════════════════════════════════ */

/* ── Math ─────────────────────────────── */
const CIRC = 2 * Math.PI * 15;          // SVG progress ring circumference

/* ── Delivery defaults (overridden by Firestore) ── */
const DEFAULT_FREE_THRESHOLD = 99;
const DEFAULT_MIN_ORDER      = 99;
const DEFAULT_DELIVERY_FEE   = 20;
const DEFAULT_HANDLING_FEE   = 10;
const DEFAULT_ZONE_PRICE     = 1;
const DEFAULT_ZONE_MAX_ITEMS = 1;

/* ── Limits ───────────────────────────── */
const MAX_OTP_ATTEMPTS  = 5;
const OTP_RESEND_DELAY  = 30;            // seconds
const TOAST_DURATION    = 4000;          // ms
const SEARCH_DEBOUNCE   = 300;           // ms
const GEOCODE_DEBOUNCE  = 600;           // ms
const PHOTON_DEBOUNCE   = 400;           // ms
const MAX_SEARCH_HISTORY = 10;           // max recent searches per user

/* ── LocalStorage Keys ────────────────── */
const LS_KEYS = Object.freeze({
  WISHLIST:   'sb_wishlist',
  NOTIFIED:   'sb_notified',
  USER:       'sb_user',
  LANG:       'sb_lang',
  LOCATION:   'sb_location',
  CART:       'sb_cart',
  SKIP_LOGIN: 'sb_skip_login',
});

/* ── Order Status Labels ──────────────── */
const ORDER_STATUS = Object.freeze({
  PENDING:         'pending',
  CONFIRMED:       'confirmed',
  OUT_FOR_DELIVERY:'out_for_delivery',
  DELIVERED:       'delivered',
  CANCELLED:       'cancelled',
});

/* ── Default Delivery Zone (Firozabad area fallback) ── */
const DEFAULT_DELIVERY_ZONE = [
  [27.10, 78.35],
  [27.20, 78.35],
  [27.20, 78.45],
  [27.10, 78.45],
];

/* ── Map defaults ─────────────────────── */
const MAP_DEFAULT_LAT  = 27.151513;
const MAP_DEFAULT_LNG  = 78.395793;
const MAP_DEFAULT_ZOOM = 16;
