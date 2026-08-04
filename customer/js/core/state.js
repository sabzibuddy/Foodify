/* ════════════════════════════════════════
   core/state.js
   Single source of truth — all mutable state lives here.
   Import constants.js before this file.
════════════════════════════════════════ */

/* ── Runtime config (Firestore se override hoga) ── */
let ZONE_PRICE     = DEFAULT_ZONE_PRICE;
let ZONE_MAX_ITEMS = DEFAULT_ZONE_MAX_ITEMS;
let FREE_THRESHOLD = DEFAULT_FREE_THRESHOLD;
let MIN_ORDER      = DEFAULT_MIN_ORDER;
let DELIVERY_FEE   = DEFAULT_DELIVERY_FEE;
let HANDLING_FEE   = DEFAULT_HANDLING_FEE;

/* ── Delivery Zone polygon ────────────── */
let deliveryZone = [...DEFAULT_DELIVERY_ZONE];

/* ── Products ─────────────────────────── */
let items = [];

/* ── Cart  { name: { qty, price, mrp } } */
let cart = {};

/* ── Category Navigation ──────────────── */
let currentTopCat = 'all';
let currentSubCat = 'all';

/* ── Checkout / Order ─────────────────── */
let selectedSlot  = null;
let selectedArea  = '';
let locationLink  = '';
let confirmedLat  = null;
let confirmedLng  = null;
let confirmedAddr = '';

/* ── Auth ─────────────────────────────── */
let currentUser = null;

/* ── Coupon ───────────────────────────── */
let appliedCoupon          = null;
let couponDiscount         = 0;
let deliveryFeeDiscounted  = 0;

/* ── Wishlist (Set) ───────────────────── */
let wishlist = new Set(
  JSON.parse(localStorage.getItem(LS_KEYS.WISHLIST) || '[]')
);

/* ── OOS Notify (Set) ─────────────────── */
const notifiedItems = new Set(
  JSON.parse(localStorage.getItem(LS_KEYS.NOTIFIED) || '[]')
);

/* ── UI Timers (refs only, not real state) */
let toastTimer = null;

/* ════════════════════════════════════════
   STATE RESET HELPERS
════════════════════════════════════════ */

/** Cart ko poora clear karo */
function resetCart() {
  cart = {};
}

/** Checkout state reset (order place ke baad) */
function resetCheckoutState() {
  selectedSlot  = null;
  appliedCoupon = null;
  couponDiscount = 0;
}

/** Config state update karo (Firestore se) */
function applyZoneConfig({ price, maxItems }) {
  if (price    !== undefined) ZONE_PRICE     = price;
  if (maxItems !== undefined) ZONE_MAX_ITEMS = maxItems;
}

function applySiteConfig({ freeDeliveryThreshold, minOrderAmount, deliveryFee, handlingFee, deliveryFeeDiscounted: dfd }) {
  if (freeDeliveryThreshold !== undefined) FREE_THRESHOLD        = freeDeliveryThreshold;
  if (minOrderAmount        !== undefined) MIN_ORDER              = minOrderAmount;
  if (deliveryFee           !== undefined) DELIVERY_FEE          = deliveryFee;
  if (handlingFee           !== undefined) HANDLING_FEE          = handlingFee;
  if (dfd                   !== undefined) deliveryFeeDiscounted = dfd;   // 0 = no discount
}
