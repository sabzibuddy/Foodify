/* ════════════════════════════════════════
   firebase-messaging-sw.js
   PHASE 5 — Background push notifications
   (jab app band ho ya tab background me ho,
   yehi file notification dikhati hai)

   IMPORTANT: Ye file hosting root pe honi
   chahiye (jahan firebase.json me "public": "customer"
   set hai — isliye ye file customer/ folder
   ke root me hai, admin/ me nahi).
════════════════════════════════════════ */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

/* Same config jo customer/js/core/config.js me hai —
   ye public config hai (Firebase web apiKey secret nahi hota) */
firebase.initializeApp({
  apiKey:            "AIzaSyC0pR1bytYruzPhfP9vKRz99i1SMYkuCXE",
  authDomain:        "sabzibuddy-website.firebaseapp.com",
  projectId:         "sabzibuddy-website",
  storageBucket:     "sabzibuddy-website.firebasestorage.app",
  messagingSenderId: "386650204024",
  appId:             "1:386650204024:web:d526329ffd463582c20a8d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'SabziBuddy';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon: '/logo.webp',
    data: payload.data || {},
  });
});

/* Notification pe tap karne se app khul jaaye */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
