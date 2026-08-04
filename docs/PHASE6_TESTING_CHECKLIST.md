# Phase 6 — Testing & Monitoring Checklist

## Deploy se pehle (manual setup — sirf ek baar)
- [ ] **App Check**: Firebase Console → App Check → web app register → reCAPTCHA v3 provider → site key generate karo → `customer/js/core/config.js` me `APP_CHECK_SITE_KEY` set karo.
- [ ] **VAPID Key** (Phase 5): Firebase Console → Cloud Messaging → Web Push certificates → `customer/js/modules/notifications.js` me `VAPID_KEY` set karo.
- [ ] **Pehla owner**: Firestore Console me manually `userRoles/{owner-ka-uid}` doc bana lo (Phase 3 me detail hai).

## Deploy
```bash
firebase deploy --only functions,firestore:rules,firestore:indexes,hosting
```
Pehli baar `orders` collection pe composite index (uid + timestamp) automatically ban jaayega (`firestore.indexes.json` se) — thoda time (kuch minute) lag sakta hai, tab tak abuse-guard query fail ho sakti hai (order phir bhi ban jaayega, sirf warning).

## End-to-End Test Flow
1. **Login**: OTP se phone verify karo → `users/{uid}` doc Firestore me bane check karo.
2. **Normal order**: Cart me item daalo → checkout → order place karo → `orders` collection me naya doc, `products.stock` kam hua, check karo.
3. **Stock-limit order**: Ek product ka stock 1 kar do (Firestore se manually), 2 qty order karne ki koshish karo → error aana chahiye.
4. **Coupon**: Valid coupon apply karke order karo → `coupons.usedCount` +1 hua check karo. Expired/invalid coupon try karo → reject hona chahiye.
5. **Zone limit**: Zone item ka `ZONE_MAX_ITEMS` se zyada qty order karne ki koshish → reject hona chahiye.
6. **Double-click abuse guard**: Order place button 2 baar jaldi-jaldi click karo → dusra attempt "thoda ruk kar" error dena chahiye (20-second cooldown).
7. **RBAC**: 
   - Bina `userRoles` doc ke koi user `products` write karne ki koshish kare → Firestore permission-denied aana chahiye.
   - `manager` role wala staff order status update kare → allow.
   - `delivery` role wala staff kisi doosre delivery-boy ke assigned order ko update kare → deny.
8. **Notifications**: Order ka status Firestore Console se `pending` → `confirmed` badlo → customer ko push notification aana chahiye (agar `subscribePush()` already call ho chuka hai).
9. **App Check**: Browser console me kisi random script se seedha `placeOrder` Cloud Function call karne ki koshish karo (bina app load kiye) → `enforceAppCheck` ki wajah se reject hona chahiye.

## Monitoring (ongoing)
- Firebase Console → Functions → Logs: `[placeOrder]`, `[onOrderStatusChange]`, `[assignUserRole]` prefixed logs dekho — errors yahan dikhenge.
- Firebase Console → Firestore → Usage: reads/writes spike dekho (abuse ka signal ho sakta hai).
- Firebase Console → App Check → Metrics: kitne requests verified vs unverified aa rahe hain.

---

## Sab Phases — Final Status

| Phase | Status |
|---|---|
| 0 — Firestore Rules | ✅ Done |
| 1 — Order Cloud Function (server-side stock/price) | ✅ Done |
| 2 — Coupon/Price server-side | ✅ Merged into Phase 1 |
| 3 — RBAC (userRoles collection) | ✅ Done |
| 4 — Payment Gateway | ➖ Skipped (COD-only) |
| 5 — Automated Notifications (FCM push) | ✅ Done |
| 6 — Testing/Monitoring/Abuse Prevention | ✅ Done |

## Bacha hua kaam (project me hi missing tha, humne fix nahi kiya)
- **`admin/` folder** is upload me tha hi nahi — admin panel ka actual login/dashboard code kahin present nahi hai. Docs (`ADMIN_FEATURES.md`) me architecture likha hai lekin implementation missing hai. Ye sabse bada bacha hua kaam hai.
- Admin panel banate waqt order-assign UI me `deliveryBoyUid` field zaroor set karna (Phase 3 ki rules isी field pe depend karti hain).
