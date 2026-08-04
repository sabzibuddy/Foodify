/* ============================================================
   API — SabziBuddy
   Centralized Firestore / Firebase wrapper
   services/api.js
   ============================================================ */

import { db } from '../core/config.js';
import { handleError } from '../core/error.js';
import {
  collection, doc,
  getDoc, getDocs,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ──────────────────────────────────────────────────────────
   PRODUCTS
   ────────────────────────────────────────────────────────── */

/**
 * Saari products fetch karo (category filter optional)
 * @param {string|null} category  - e.g. 'sabzi', 'fruit', null = all
 * @returns {Promise<Array>}
 */
export async function fetchProducts(category = null) {
  try {
    let q = collection(db, 'products');
    if (category) q = query(q, where('category', '==', category));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleError(err, 'api.fetchProducts');
    return [];
  }
}

/**
 * Single product by ID
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function fetchProductById(productId) {
  try {
    const snap = await getDoc(doc(db, 'products', productId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    handleError(err, 'api.fetchProductById');
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   ORDERS
   ────────────────────────────────────────────────────────── */

/**
 * Naya order place karo
 * @param {Object} orderData
 * @returns {Promise<string|null>}  - order ID on success
 */
export async function createOrder(orderData) {
  try {
    const ref = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
    return ref.id;
  } catch (err) {
    handleError(err, 'api.createOrder');
    return null;
  }
}

/**
 * User ke saare orders fetch karo
 * @param {string} phone  - user phone number (document ID)
 * @returns {Promise<Array>}
 */
export async function fetchOrdersByUser(phone) {
  try {
    const q = query(
      collection(db, 'orders'),
      where('phone', '==', phone),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleError(err, 'api.fetchOrdersByUser');
    return [];
  }
}

/* ──────────────────────────────────────────────────────────
   USER / PROFILE
   ────────────────────────────────────────────────────────── */

/**
 * User profile fetch karo
 * @param {string} phone
 * @returns {Promise<Object|null>}
 */
export async function fetchUserProfile(phone) {
  try {
    const snap = await getDoc(doc(db, 'users', phone));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    handleError(err, 'api.fetchUserProfile');
    return null;
  }
}

/**
 * User profile save / update karo
 * @param {string} phone
 * @param {Object} data
 * @returns {Promise<boolean>}
 */
export async function saveUserProfile(phone, data) {
  try {
    await setDoc(doc(db, 'users', phone), data, { merge: true });
    return true;
  } catch (err) {
    handleError(err, 'api.saveUserProfile');
    return false;
  }
}

/* ──────────────────────────────────────────────────────────
   COUPONS
   ────────────────────────────────────────────────────────── */

/**
 * Coupon code validate karo
 * @param {string} code
 * @returns {Promise<Object|null>}  - coupon data or null
 */
export async function fetchCoupon(code) {
  try {
    const snap = await getDoc(doc(db, 'coupons', code.toUpperCase()));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    handleError(err, 'api.fetchCoupon');
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   DELIVERY SLOTS
   ────────────────────────────────────────────────────────── */

/**
 * Available delivery slots fetch karo
 * @param {string} date  - 'YYYY-MM-DD'
 * @returns {Promise<Array>}
 */
export async function fetchSlots(date) {
  try {
    const q = query(
      collection(db, 'slots'),
      where('date', '==', date),
      where('available', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleError(err, 'api.fetchSlots');
    return [];
  }
}

/* ──────────────────────────────────────────────────────────
   NOTIFICATIONS / OOS SUBSCRIBE
   ────────────────────────────────────────────────────────── */

/**
 * Out-of-stock product ke liye notify request save karo
 * @param {string} productId
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
export async function subscribeOosNotify(productId, phone) {
  try {
    await setDoc(
      doc(db, 'oos_notify', `${productId}_${phone}`),
      { productId, phone, createdAt: serverTimestamp() }
    );
    return true;
  } catch (err) {
    handleError(err, 'api.subscribeOosNotify');
    return false;
  }
}
