/* ════════════════════════════════════════
   core/utils.js
   Pure helper functions — no DOM, no Firebase.
   Import state.js before this file.
════════════════════════════════════════ */

/* ════════════════════════════════════════
   GEO HELPERS
════════════════════════════════════════ */

/**
 * Point-in-polygon check (Ray Casting algorithm)
 * @param {[number,number]} point  - [lat, lng]
 * @param {[number,number][]} vs   - polygon vertices [[lat,lng],...]
 * @returns {boolean}
 */
function pointInPolygon(point, vs) {
  let x = point[1], y = point[0], inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1], yi = vs[i][0];
    const xj = vs[j][1], yj = vs[j][0];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

/* ════════════════════════════════════════
   PRODUCT MAPPER
════════════════════════════════════════ */

/**
 * Image URL resolve karo (multiple field names handle karta hai)
 */
function resolveImageUrl(d) {
  return d.img || d.image || '';
}

/**
 * Firestore doc → clean product object
 * BUG FIX: zone recalc karta hai jab ZONE_PRICE change ho
 */
function mapProduct(doc) {
  const d            = doc.data ? doc.data() : doc;
  const top          = d.category  || d.top || 'burger';
  const cat          = d.subcategory || d.cat || 'basics';
  const weight       = d.weight || (d.qty && d.unit ? `${d.qty} ${d.unit}` : (d.unit || ''));
  const productPrice = d.price || 0;

  // BUG FIX: zone check me strict condition — sirf d.zone=true wala zone product hai
  // pehle price match se zone ban raha tha jo galat tha
  const isZone = !!d.zone;

  const stock = (d.stock !== undefined && d.stock !== null)
    ? parseInt(d.stock)
    : null;

  return {
    _id:         doc.id || '',
    name:        d.name  || '',
    hindi:       d.hindi || '',
    mrp:         d.mrp   || productPrice,
    price:       isZone ? ZONE_PRICE : productPrice,
    weight,
    image:       resolveImageUrl(d),
    images:      d.images   || [],
    top,
    cat,
    zone:        isZone,
    stock,
    outOfStock:  d.available === false || stock === 0,
    tag:         d.tag          || null,
    features:    Array.isArray(d.features)     ? d.features     : [],
    description: d.description  || '',
    storageTip:  d.storageTip   || '',
    information: Array.isArray(d.information)  ? d.information  : [],
    variants:    Array.isArray(d.variants)     ? d.variants     : [],  // ← future ready
  };
}

/* ════════════════════════════════════════
   CART HELPERS
════════════════════════════════════════ */

/** Cart ka total calculate karo (coupon ke bina) */
function getCartSubtotal() {
  return Object.values(cart).reduce((sum, i) => sum + i.price * i.qty, 0);
}

/** Cart item count */
function getCartCount() {
  return Object.values(cart).reduce((sum, i) => sum + i.qty, 0);
}

/** Cart mein ek item ka total */
function getItemTotal(name) {
  const item = cart[name];
  return item ? item.price * item.qty : 0;
}

/** Final payable amount (delivery fee + coupon) */
function getFinalAmount() {
  const sub = getCartSubtotal();
  const origDelivery = DELIVERY_FEE;
  const discDelivery = (typeof deliveryFeeDiscounted !== 'undefined' && deliveryFeeDiscounted > 0 && deliveryFeeDiscounted < origDelivery)
    ? deliveryFeeDiscounted : origDelivery;
  const fee = sub >= FREE_THRESHOLD ? 0 : discDelivery;
  return Math.max(0, sub + fee - couponDiscount);
}

/* ════════════════════════════════════════
   FORMAT HELPERS
════════════════════════════════════════ */

/** ₹ amount format karo */
function formatPrice(n) {
  return `₹${Number(n).toFixed(0)}`;
}

/** Phone number validate karo */
function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(String(phone).trim());
}

/** Name validate karo (letters + Hindi) */
function isValidName(name) {
  return /^[\u0900-\u097Fa-zA-Z\s]{2,50}$/.test(String(name).trim());
}

/** String ko normalize karo (search ke liye) */
function normalize(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^\u0900-\u097Fa-z0-9\s]/g, '');
}

/** Date string banao YYMMDD format */
function getDateString() {
  const d  = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Random 4-digit PIN */
function generatePIN() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Debounce factory */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ════════════════════════════════════════
   ORDER SEQUENCE (Firestore transaction)
════════════════════════════════════════ */

/**
 * Daily auto-increment order counter
 * @param {string} ds - date string YYMMDD
 * @returns {Promise<number>}
 */
async function getNextSequence(ds) {
  const ref = db.collection('meta').doc('orderCounter');
  let seq   = 1;
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().date !== ds) {
      seq = 1;
      tx.set(ref, { date: ds, count: 1 });
    } else {
      seq = s.data().count + 1;
      tx.update(ref, { count: seq });
    }
  });
  return seq;
}
