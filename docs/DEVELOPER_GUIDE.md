# Developer Guide - SabziBuddy

> For developers working on the SabziBuddy codebase

---

## Quick Start

### Prerequisites
- Node.js (not required for vanilla JS, useful for local server)
- Any code editor (VS Code recommended)
- Live Server extension (or `npx serve`)

### Running Locally

```bash
# Customer website
cd customer
npx serve .           # Opens at localhost:3000

# Admin panel
cd admin
npx serve .           # Opens at localhost:3000

# Coupon manager (standalone)
cd admin
npx serve coupons.html
```

---

## Debugging Tips

### 1. Console Commands (Browser DevTools)

```javascript
// Check current user state
customerApp.state.user

// Check cart contents
customerApp.state.cart

// Check Firebase connection
firebase.apps.length  // Should be > 0

// Check admin role
adminApp.state.role

// View all orders (admin)
adminApp.allOrders

// View all products (admin)
adminApp.allProducts
```

### 2. Common Debug Patterns

```javascript
// Enable verbose Firebase logging
firebase.firestore.setLogLevel('debug');

// Check if Firestore listener is active
console.log('Listener active:', ordersUnsubscribe !== null);

// Force refresh a section (admin)
loadDashboard();    // Refresh dashboard
filterOrders();     // Refresh orders
loadProducts();     // Refresh products

// Check localStorage
customerApp.storage.getAll();
```

### 3. Network Tab Checks
- Firebase calls appear as `googleapis.com` requests
- Image uploads show as `POST` to `firebasestorage.googleapis.com`
- OTP requests via Firebase Auth

---

## Adding a New Feature

### Example: Adding a "Reviews" Feature

**Step 1: Create the module file**
```
customer/js/modules/reviews.js
```

**Step 2: Add to index.html (load order)**
```html
<!-- Before init.js -->
<script src="js/modules/reviews.js"></script>
```

**Step 3: Create CSS file**
```
customer/css/reviews.css
```

**Step 4: Link CSS in index.html**
```html
<link rel="stylesheet" href="css/reviews.css">
```

**Step 5: Module structure template**
```javascript
// js/modules/reviews.js
(function() {
  'use strict';

  // Private state
  let reviews = [];

  // Public API
  window.Reviews = {
    init: function() {
      // Initialize
    },
    load: function(productId) {
      // Load reviews from Firestore
    },
    render: function(containerId) {
      // Render to DOM
    },
    add: function(productId, rating, text) {
      // Add new review
    }
  };
})();
```

---

## Code Patterns

### Module Pattern (IIFE)
```javascript
(function() {
  'use strict';

  // Private variables
  let privateVar = 0;

  // Private function
  function privateFn() { }

  // Public API
  window.ModuleName = {
    publicFn: function() { }
  };
})();
```

### Async Pattern with Error Handling
```javascript
async function fetchData() {
  try {
    const snap = await db.collection('collection').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    handleError(error);
    return [];
  }
}
```

### Firestore Listener Pattern
```javascript
let unsubscribe = null;

function startListening() {
  if (unsubscribe) unsubscribe();

  unsubscribe = db.collection('orders')
    .onSnapshot(
      snapshot => {
        // Handle data
      },
      error => {
        // Handle error, fallback to manual fetch
        manualFetch();
      }
    );
}

function stopListening() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
```

---

## Testing Checklist

### Customer Website:
- [ ] Splash screen shows and auto-hides
- [ ] OTP login flow works
- [ ] Skip login allows browsing
- [ ] Products load from Firestore
- [ ] Category tabs switch correctly
- [ ] Add to cart updates badge
- [ ] Cart panel slides open
- [ ] Checkout form validates
- [ ] Map picker opens and selects location
- [ ] Order places and shows Thank You
- [ ] Profile panel opens
- [ ] Language switch works

### Admin Panel:
- [ ] Login with different roles
- [ ] Dashboard shows stats
- [ ] Products CRUD works
- [ ] Order assignment works
- [ ] Map shows order pins
- [ ] Zone settings save
- [ ] Category toggles update customer site
- [ ] Attendance saves
- [ ] Delivery boy login shows only My Orders
- [ ] PIN verification marks delivered

---

## Firebase Security Rules (Reference)

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products - public read
    match /products/{doc} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role in ['owner', 'manager'];
    }

    // Orders - authenticated users
    match /orders/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role in ['owner', 'manager', 'delivery'];
    }

    // User roles - admin only
    match /userRoles/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role == 'owner';
    }

    // Config - admin only
    match /config/{doc} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role in ['owner', 'manager'];
    }
  }
}
```

---

## Environment Variables

For different environments, create:

```javascript
// js/core/config.js - Development
const firebaseConfig = {
  apiKey: "DEV_API_KEY",
  authDomain: "sabzibuddy-dev.firebaseapp.com",
  projectId: "sabzibuddy-dev",
  // ...
};

// For production, use Firebase Hosting environment
// or replace before deployment
```

---

## Common Issues & Solutions

### Issue: Firebase "permission-denied" error
**Cause**: User not logged in or no role assigned
**Solution**: Check `userRoles` collection for user's UID

### Issue: Orders not loading
**Cause**: Firestore listener failed
**Solution**: Click "Force Refresh" button, check console for errors

### Issue: Map not showing
**Cause**: Leaflet CSS not loaded
**Solution**: Check network tab for leaflet.css 404

### Issue: OTP not sending
**Cause**: Firebase Auth quota exceeded or reCAPTCHA issue
**Solution**: Check Firebase console > Auth > Usage

### Issue: Images not uploading
**Cause**: Firebase Storage rules or auth expired
**Solution**: Check Storage rules, re-login if needed

---

## Future Roadmap

### Phase 1 (Current - v1.0.0)
- Basic e-commerce flow
- Admin panel with role-based access
- Coupon system

### Phase 2 (Planned)
- [ ] Push notifications
- [ ] Delivery tracking (live location)
- [ ] Product ratings & reviews
- [ ] Offers/deals section

### Phase 3 (Future)
- [ ] Multi-vendor support
- [ ] Subscription orders
- [ ] Wallet/cashback system
- [ ] Multi-language (regional languages)

---

## Contact

For questions or issues:
- WhatsApp: +91 7900684615
- Email: support.sabzibuddy@gmail.com
