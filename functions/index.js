/* ═══════════════════════════════════════════════════════════════
   functions/index.js  —  SabziBuddy Cloud Functions
   AI Provider: Google Gemini (FREE tier)
   ═══════════════════════════════════════════════════════════════

   DEPLOY STEPS:
   1. npm install -g firebase-tools
   2. firebase login
   3. cd sabzibuddy_v2/functions && npm install && cd ..
   4. firebase functions:secrets:set GEMINI_API_KEY
      → aistudio.google.com/app/apikey se key lo, paste karo
   5. firebase deploy --only functions
   ═══════════════════════════════════════════════════════════════ */

const { onCall, HttpsError }        = require('firebase-functions/v2/https');
const { onDocumentUpdated }         = require('firebase-functions/v2/firestore');
const { defineSecret }              = require('firebase-functions/params');
const { initializeApp }             = require('firebase-admin/app');
const { getFirestore, FieldValue }  = require('firebase-admin/firestore');
const { getMessaging }              = require('firebase-admin/messaging');
const https                         = require('https');

initializeApp();
const db = getFirestore();

/* ── Secret: Firebase Secret Manager mein store hogi Gemini key */
const GEMINI_KEY = defineSecret('GEMINI_API_KEY');

/* ═══════════════════════════════════════════════════════════════
   generateSearchKeywords  —  Main Function
   Admin panel: AIKeywords.smartGenerate() → yeh call hoti hai
═══════════════════════════════════════════════════════════════ */
exports.generateSearchKeywords = onCall(
  {
    secrets        : [GEMINI_KEY],   // Gemini key inject hogi
    region         : 'asia-south1',  // Mumbai — India ke liye fast
    timeoutSeconds : 30,
    memory         : '256MiB',
    enforceAppCheck: true,  // PHASE 6: sirf real app se calls allow, bots/scripts block
  },
  async (request) => {

    /* ── 1. AUTH CHECK ──────────────────────────────────────── */
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }

    /* ── 2. INPUT VALIDATE ──────────────────────────────────── */
    const productName = (request.data?.productName || '').trim();

    if (!productName) {
      throw new HttpsError('invalid-argument', 'productName required');
    }
    if (productName.length > 100) {
      throw new HttpsError('invalid-argument', 'productName too long');
    }

    /* ── 3. GEMINI API CALL ─────────────────────────────────── */
    const apiKey = GEMINI_KEY.value();

    if (!apiKey || apiKey === 'undefined') {
      throw new HttpsError('internal', 'Gemini API key not configured');
    }

    let rawText = '';
    try {
      rawText = await callGemini(apiKey, productName);
    } catch (err) {
      console.error('[generateSearchKeywords] Gemini call failed:', err.message);
      throw new HttpsError('internal', 'AI service error: ' + err.message);
    }

    /* ── 4. PARSE + RETURN ──────────────────────────────────── */
    const keywords = parseKeywords(rawText);

    console.log(`[generateSearchKeywords] "${productName}" → ${keywords.length} keywords`);

    return {
      success     : true,
      productName : productName,
      searchTerms : keywords,
      generatedAt : new Date().toISOString(),
    };
  }
);

/* ═══════════════════════════════════════════════════════════════
   placeOrder  —  PHASE 1
   Poora order-placement business logic (stock check, price,
   coupon, zone check, delivery fee, order ID/PIN) ab yahan
   server-side, ek atomic Firestore transaction me hota hai.
   Client (order.js) ab sirf ye function call karta hai —
   khud stock/price calculate ya Firestore write nahi karta.
   Admin SDK rules bypass karta hai, isliye firestore.rules
   client-side abuse rokte hain aur ye function trusted path hai.
═══════════════════════════════════════════════════════════════ */
exports.placeOrder = onCall(
  {
    region         : 'asia-south1',
    timeoutSeconds : 30,
    memory         : '256MiB',
    enforceAppCheck: true,  // PHASE 6: sirf real app se calls allow, bots/scripts block
  },
  async (request) => {

    /* ── 1. AUTH CHECK — OTP-verified phone hi source of truth hai ── */
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }
    const authPhone = String(request.auth.token.phone_number || '').replace('+91', '');
    if (!authPhone) {
      throw new HttpsError('failed-precondition', 'Phone verification required');
    }
    const uid = request.auth.uid;

    /* ── 2. INPUT VALIDATE (light — ye sab sirf display/delivery info hai) ── */
    const d = request.data || {};
    const name         = String(d.name || '').trim();
    const address       = String(d.address || '').trim();
    const altPhone      = d.altPhone ? String(d.altPhone).trim().slice(0, 15) : null;
    const area           = d.area ? String(d.area).trim().slice(0, 100) : null;
    const locationLink   = d.locationLink ? String(d.locationLink).trim().slice(0, 500) : null;
    const lat             = typeof d.lat === 'number' ? d.lat : null;
    const lng             = typeof d.lng === 'number' ? d.lng : null;
    const slotId          = String(d.slotId || '').trim();
    const slotText        = String(d.slotText || '').trim().slice(0, 100);
    const couponCode      = d.couponCode ? String(d.couponCode).trim().toUpperCase().slice(0, 30) : null;
    const cartItems       = Array.isArray(d.items) ? d.items : [];

    if (name.length < 2)       throw new HttpsError('invalid-argument', 'Valid name required');
    if (address.length < 10)   throw new HttpsError('invalid-argument', 'Full address required (min 10 chars)');
    if (!slotId)                throw new HttpsError('invalid-argument', 'Delivery slot required');
    if (!cartItems.length)      throw new HttpsError('invalid-argument', 'Cart is empty');

    /* Cart items dedupe + sanity check (productId + qty client se, price/stock nahi) */
    const qtyByProductId = new Map();
    for (const it of cartItems) {
      const pid = String(it?.productId || '');
      const qty = parseInt(it?.qty, 10);
      if (!pid || !Number.isFinite(qty) || qty <= 0 || qty > 50) {
        throw new HttpsError('invalid-argument', 'Invalid cart item');
      }
      qtyByProductId.set(pid, (qtyByProductId.get(pid) || 0) + qty);
    }

    /* ── 3. CONFIG FETCH (fresh, server-trusted) ── */
    const [siteSnap, zoneSnap, dzSnap] = await Promise.all([
      db.collection('config').doc('siteSettings').get(),
      db.collection('config').doc('zoneSettings').get(),
      db.collection('config').doc('deliveryZone').get(),
    ]);
    const site   = siteSnap.exists ? siteSnap.data() : {};
    const zoneCfg = zoneSnap.exists ? zoneSnap.data() : {};
    const dz      = dzSnap.exists ? dzSnap.data() : null;

    const FREE_THRESHOLD = site.freeDeliveryThreshold ?? 99;
    const MIN_ORDER      = site.minOrderAmount ?? 99;
    const BASE_FEE        = site.deliveryFee ?? 20;
    const DELIVERY_FEE   = (site.deliveryFeeDiscounted > 0 && site.deliveryFeeDiscounted < BASE_FEE)
      ? site.deliveryFeeDiscounted : BASE_FEE;
    const ZONE_PRICE      = zoneCfg.price ?? 1;
    const ZONE_MAX_ITEMS = zoneCfg.maxItems ?? 1;
    const polygon         = (dz?.polygon?.length >= 3) ? dz.polygon.map(p => [p.lat, p.lng]) : null;

    /* ── 4. ZONE / DELIVERY-AREA CHECK ── */
    if (polygon && lat !== null && lng !== null) {
      if (!_pointInPolygon([lat, lng], polygon)) {
        throw new HttpsError('failed-precondition', 'Selected location delivery zone ke bahar hai.');
      }
    }

    const productRefs = [...qtyByProductId.keys()].map(id => db.collection('products').doc(id));
    const couponRef    = couponCode ? db.collection('coupons').doc(couponCode) : null;
    const counterRef    = db.collection('meta').doc('orderCounter');
    const orderRef       = db.collection('orders').doc();

    /* ── 4.1 ABUSE GUARD (PHASE 6): same user 20 second cooldown ──
       Double-click / bot-spam se bahut saare fake orders na ban jayein */
    const ORDER_COOLDOWN_MS = 20 * 1000;
    const recentOrdersSnap = await db.collection('orders')
      .where('uid', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (!recentOrdersSnap.empty) {
      const lastTs = recentOrdersSnap.docs[0].data().timestamp?.toMillis?.();
      if (lastTs && (Date.now() - lastTs) < ORDER_COOLDOWN_MS) {
        throw new HttpsError('resource-exhausted', 'Ek order abhi place hua hai — thoda ruk kar dobara try karo.');
      }
    }

    /* ── 5. ATOMIC TRANSACTION — read fresh data, validate, write everything ── */
    const result = await db.runTransaction(async (tx) => {

      const productSnaps = [];
      for (const ref of productRefs) productSnaps.push(await tx.get(ref));
      const couponSnap   = couponRef ? await tx.get(couponRef) : null;
      const counterSnap  = await tx.get(counterRef);

      let subtotal = 0;
      let zoneQty  = 0;
      const orderItems     = {};
      const productUpdates = [];

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        const pid  = productRefs[i].id;
        const qty  = qtyByProductId.get(pid);

        if (!snap.exists) throw new HttpsError('not-found', `Product not found (${pid})`);
        const p = snap.data();

        if (p.available === false) {
          throw new HttpsError('failed-precondition', `${p.name} abhi available nahi hai.`);
        }
        const stock = (p.stock === undefined || p.stock === null) ? null : parseInt(p.stock, 10);
        if (stock !== null && qty > stock) {
          throw new HttpsError('failed-precondition', `${p.name} ka sirf ${stock} stock available hai.`);
        }

        const isZone = !!p.zone;
        const price   = isZone ? ZONE_PRICE : (p.price || 0);
        if (isZone) zoneQty += qty;

        const lineSubtotal = qty * price;
        subtotal += lineSubtotal;

        orderItems[p.name] = {
          qty, price, weight: p.weight || '', subtotal: lineSubtotal, zone: isZone, productId: pid,
        };

        productUpdates.push({
          ref: productRefs[i], qty,
          newStock: stock !== null ? Math.max(0, stock - qty) : null,
        });
      }

      if (zoneQty > ZONE_MAX_ITEMS) {
        throw new HttpsError(
          'failed-precondition',
          ZONE_MAX_ITEMS === 1
            ? 'Zone se sirf 1 item allowed hai per order.'
            : `Zone se max ${ZONE_MAX_ITEMS} items allowed hain.`
        );
      }

      /* ── Coupon validation + discount (server-trusted) ── */
      let couponDiscount = 0;
      let couponApplied  = null;
      if (couponCode) {
        if (!couponSnap.exists) throw new HttpsError('invalid-argument', 'Invalid coupon code');
        const c = couponSnap.data();

        if (!c.active) throw new HttpsError('failed-precondition', 'Ye coupon invalid hai.');

        const expiry = c.expiresAt?.toDate ? c.expiresAt.toDate() : new Date(c.expiresAt);
        if (new Date() > expiry) throw new HttpsError('failed-precondition', 'Coupon expire ho chuka hai.');

        if ((c.usedCount || 0) >= (c.maxUses || Infinity)) {
          throw new HttpsError('failed-precondition', 'Coupon usage limit reached.');
        }
        if (c.minOrder > 0 && subtotal < c.minOrder) {
          throw new HttpsError('failed-precondition', `Min ₹${c.minOrder} order value required.`);
        }

        if (c.category) {
          let categoryTotal = 0;
          productSnaps.forEach((snap, i) => {
            const p   = snap.data();
            const top = p.category || p.top || 'burger';
            const cat = p.subcategory || p.cat || 'basics';
            if (top === c.category && (!c.subcategory || cat === c.subcategory)) {
              const pid   = productRefs[i].id;
              const qty   = qtyByProductId.get(pid);
              const price = p.zone ? ZONE_PRICE : (p.price || 0);
              categoryTotal += qty * price;
            }
          });
          if (categoryTotal === 0) {
            throw new HttpsError('failed-precondition', `Ye coupon sirf "${c.category}" category pe kaam karta hai.`);
          }
          couponDiscount = Math.min(c.discount || 0, categoryTotal);
        } else {
          couponDiscount = c.discount || 0;
        }
        couponApplied = couponCode;
      }

      /* ── Totals (same formula as pehle client me tha) ── */
      const minCheckTotal = Math.max(0, subtotal - couponDiscount);
      if (minCheckTotal < MIN_ORDER) {
        throw new HttpsError('failed-precondition', `Minimum order ₹${MIN_ORDER} hai. Aapka total ₹${minCheckTotal} hai.`);
      }
      const fee        = subtotal >= FREE_THRESHOLD ? 0 : DELIVERY_FEE;
      const orderTotal = Math.max(0, subtotal + fee - couponDiscount);

      /* ── Order ID / sequence / PINs (IST date, server-trusted) ── */
      const ds = _dateStringIST();
      let seq;
      if (!counterSnap.exists || counterSnap.data().date !== ds) {
        seq = 1;
        tx.set(counterRef, { date: ds, count: 1 });
      } else {
        seq = counterSnap.data().count + 1;
        tx.update(counterRef, { count: seq });
      }
      const { hh, min } = _hhmmIST();
      const orderId     = `${ds}${hh}${min}${String(seq).padStart(3, '0')}`;
      const deliveryPin = _generatePIN();
      const cancelPin   = _generatePIN();

      /* ── WRITES ── */
      tx.set(orderRef, {
        orderId, deliveryPin, cancelPin,
        uid, name, phone: authPhone, altPhone,
        address, area, locationLink, lat, lng,
        slot: slotText, slotId,
        items: orderItems,
        rawTotal: subtotal,
        couponCode: couponApplied,
        couponDiscount,
        total: orderTotal,
        zoneItemCount: zoneQty,
        status: 'pending',
        deliveryBoy: null,
        deliveryBoyPhone: null,
        customerPin: null,
        timestamp: FieldValue.serverTimestamp(),
      });

      for (const u of productUpdates) {
        if (u.newStock !== null) {
          tx.update(u.ref, {
            stock: u.newStock,
            available: u.newStock > 0,
            orderedCount: FieldValue.increment(u.qty),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(u.ref, { orderedCount: FieldValue.increment(u.qty) });
        }
      }

      if (couponApplied) {
        tx.update(couponRef, { usedCount: FieldValue.increment(1) });
      }

      tx.set(db.collection('users').doc(uid), {
        name, phone: authPhone, address, uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { orderId, deliveryPin, cancelPin, total: orderTotal, rawTotal: subtotal, couponDiscount, zoneItemCount: zoneQty, items: orderItems };
    });

    console.log(`[placeOrder] ${result.orderId} — uid:${uid} total:₹${result.total}`);
    return { success: true, ...result };
  }
);

/* ─────────────────────── Small helpers used by placeOrder ─────────────────────── */
function _pointInPolygon(point, vs) {
  let x = point[1], y = point[0], inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1], yi = vs[i][0];
    const xj = vs[j][1], yj = vs[j][0];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function _generatePIN() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
/* Server UTC me chalta hai — IST (+5:30) manually add karke date/time nikalte hain */
function _nowIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}
function _dateStringIST() {
  const d  = _nowIST();
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
function _hhmmIST() {
  const d = _nowIST();
  return { hh: String(d.getUTCHours()).padStart(2, '0'), min: String(d.getUTCMinutes()).padStart(2, '0') };
}

/* ═══════════════════════════════════════════════════════════════
   assignUserRole  —  PHASE 3
   Sirf 'owner' role wala user kisi bhi staff member (manager ya
   delivery) ka role set/update kar sakta hai. Ye function
   `userRoles/{targetUid}` doc likhta hai — jo firestore.rules
   RBAC lookup ke liye source of truth hai.

   NOTE: Sabse pehla 'owner' isse nahi ban sakta (chicken-egg
   problem — koi owner hi nahi hai jo grant kare). Pehla owner
   Firebase Console → Firestore me manually ek baar banao:
     Collection: userRoles   Doc ID: <owner ka Firebase Auth uid>
     Fields: { role: 'owner', name: '...', email: '...' }
   Uske baad se sab kuch is function se ho sakta hai.
═══════════════════════════════════════════════════════════════ */
exports.assignUserRole = onCall(
  { region: 'asia-south1', timeoutSeconds: 15, memory: '256MiB', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login required');
    }

    // Caller khud owner hai ya nahi — Firestore se fresh check
    const callerSnap = await db.collection('userRoles').doc(request.auth.uid).get();
    if (!callerSnap.exists || callerSnap.data().role !== 'owner') {
      throw new HttpsError('permission-denied', 'Sirf owner hi roles assign kar sakta hai.');
    }

    const d          = request.data || {};
    const targetUid   = String(d.targetUid || '').trim();
    const role         = String(d.role || '').trim();
    const name         = d.name ? String(d.name).trim().slice(0, 100) : null;
    const email         = d.email ? String(d.email).trim().slice(0, 100) : null;
    const phone           = d.phone ? String(d.phone).trim().slice(0, 20) : null;

    if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required');
    if (!['owner', 'manager', 'delivery'].includes(role)) {
      throw new HttpsError('invalid-argument', "role 'owner', 'manager', ya 'delivery' hona chahiye");
    }
    if (targetUid === request.auth.uid && role !== 'owner') {
      throw new HttpsError('failed-precondition', 'Khud ka owner access khud se hata nahi sakte — kisi doosre owner se karwao.');
    }

    await db.collection('userRoles').doc(targetUid).set({
      role, name, email, phone,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    }, { merge: true });

    console.log(`[assignUserRole] ${request.auth.uid} → ${targetUid} = ${role}`);
    return { success: true, targetUid, role };
  }
);

/* ═══════════════════════════════════════════════════════════════
   onOrderStatusChange  —  PHASE 5
   Jab bhi koi order ka 'status' badalta hai (admin panel se
   confirm/out_for_delivery/delivered/cancelled), ye trigger
   automatic customer ko push notification bhejta hai — koi
   manual WhatsApp/call nahi karna padta.

   Requires: customer ne app khol ke notification permission di
   ho (Phase 5 client-side setup — notifications.js). Agar token
   nahi hai ya expired hai, silently skip ho jaata hai (order
   flow kabhi block nahi hota).
═══════════════════════════════════════════════════════════════ */
const STATUS_MESSAGES = {
  confirmed:         { title: '✅ Order Confirmed',      body: 'Aapka order confirm ho gaya hai — jaldi hi pack hoga!' },
  out_for_delivery:   { title: '🚴 Out for Delivery',      body: 'Aapka order delivery ke liye nikal gaya hai!' },
  delivered:           { title: '📦 Order Delivered',        body: 'Aapka order deliver ho gaya. Thank you for shopping with SabziBuddy!' },
  cancelled:           { title: '❌ Order Cancelled',        body: 'Aapka order cancel kar diya gaya hai.' },
};

exports.onOrderStatusChange = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return; // sirf status-change pe hi chalega
    if (!after.uid) return; // purane orders jinme uid nahi hai (pre-Phase-1) — skip

    const msg = STATUS_MESSAGES[after.status];
    if (!msg) return; // 'pending' ya koi unknown status ke liye notification nahi

    const userSnap = await db.collection('users').doc(after.uid).get();
    const fcmToken  = userSnap.exists ? userSnap.data().fcmToken : null;
    if (!fcmToken) return; // user ne push permission nahi di / token save nahi hua

    try {
      await getMessaging().send({
        token: fcmToken,
        notification: { title: msg.title, body: `${msg.body} (Order #${after.orderId || event.params.orderId})` },
        data: { orderId: after.orderId || '', status: after.status },
        webpush: { fcmOptions: { link: '/' } },
      });
      console.log(`[onOrderStatusChange] ${event.params.orderId} → ${after.status} → notified uid:${after.uid}`);
    } catch (err) {
      console.error(`[onOrderStatusChange] send failed for uid:${after.uid}:`, err.message);
      // Token expired/invalid ho gaya to usko user doc se hata do (agli baar spam na ho)
      if (err.code === 'messaging/registration-token-not-registered') {
        await db.collection('users').doc(after.uid).update({ fcmToken: FieldValue.delete() }).catch(() => {});
      }
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   HELPER: Gemini API Call
   Model: gemini-2.0-flash (free tier mein available)
   Docs: ai.google.dev/api/generate-content
═══════════════════════════════════════════════════════════════ */
function callGemini(apiKey, productName) {
  return new Promise((resolve, reject) => {

    const prompt = buildPrompt(productName);

    const body = JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature     : 0.2,   // Low = consistent JSON output
        maxOutputTokens : 500,
      },
    });

    /* Gemini API key URL mein jaati hai (query param) */
    const safeKey = encodeURIComponent(apiKey);

console.log('API Key Start:', apiKey.substring(0, 10));

const path =
  `/v1beta/models/gemini-2.0-flash:generateContent?key=${safeKey}`;

    const options = {
      hostname : 'generativelanguage.googleapis.com',
      path     : path,
      method   : 'POST',
      headers  : {
        'Content-Type'   : 'application/json',
        'Content-Length' : Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Gemini HTTP ${res.statusCode}: ${data}`));
        }
        try {
          const parsed = JSON.parse(data);

          /* Gemini response structure:
             candidates[0].content.parts[0].text */
          const text = parsed
            ?.candidates?.[0]
            ?.content
            ?.parts?.[0]
            ?.text || '';

          if (!text) {
            return reject(new Error('Gemini returned empty response'));
          }
          resolve(text);
        } catch (e) {
          reject(new Error('Gemini JSON parse failed: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error('Gemini API timeout'));
    });

    req.write(body);
    req.end();
  });
}

/* ═══════════════════════════════════════════════════════════════
   HELPER: Prompt Builder
═══════════════════════════════════════════════════════════════ */
function buildPrompt(productName) {
  return [
    'You are a multilingual search keyword expert for SabziBuddy, an Indian grocery delivery app.',
    '',
    'Product: "' + productName + '"',
    '',
    'Return ONLY valid JSON — no explanation, no markdown, no code fences.',
    'Format: {"searchTerms":["word1","word2",...]}',
    '',
    'Include ALL of these:',
    '1. English name + common variations',
    '2. Hindi in Devanagari script (e.g. टमाटर, आलू)',
    '3. Roman Hindi transliterations (e.g. tamatar, aloo)',
    '4. Common Indian misspellings (e.g. tamoto, tomoto, potatoe)',
    '5. Regional / alternative Indian names',
    '6. Popular Indian search phrases (e.g. lal tamatar, hari sabzi)',
    '',
    'Rules: all lowercase, no duplicates, max 20 keywords.',
    '',
    'Return ONLY this JSON (nothing else):',
    '{"searchTerms":[...]}',
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   HELPER: Response Parser
═══════════════════════════════════════════════════════════════ */
function parseKeywords(rawText) {
  try {
    const clean = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const start = clean.indexOf('{');
    const end   = clean.lastIndexOf('}');
    if (start === -1 || end === -1) return [];

    const parsed = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(parsed.searchTerms)) return [];

    const seen   = new Set();
    const result = [];
    for (const term of parsed.searchTerms) {
      const t = String(term).trim().toLowerCase();
      if (t && !seen.has(t)) {
        seen.add(t);
        result.push(t);
        if (result.length >= 20) break;
      }
    }
    return result;
  } catch (_) {
    return [];
  }
}