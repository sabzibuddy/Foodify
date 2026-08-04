# Migration Guide - Existing Files to New Structure

> Is guide mein bataya gaya hai ki tumhari existing files is naye structure mein kahan jayengi

## Step 1: Copy Your Existing CSS Files

Tumhari customer website ki CSS files `customer/css/` folder mein rakho:

```
TUMHARI EXISTING FILE          →   NAYA LOCATION
─────────────────────────────────────────────────────────
css/variables.css               →   customer/css/variables.css
css/base.css                    →   customer/css/base.css
css/animations.css              →   customer/css/animations.css
css/header.css                  →   customer/css/header.css
css/products.css                →   customer/css/products.css
css/product-detail.css          →   customer/css/product-detail.css
css/cart.css                    →   customer/css/cart.css
css/order.css                   →   customer/css/order.css
css/profile.css                 →   customer/css/profile.css
css/map.css                     →   customer/css/map.css
css/modals.css                  →   customer/css/modals.css
css/footer.css                  →   customer/css/footer.css
```

## Step 2: Copy Your Existing JS Files

Tumhari customer website ki JS files `customer/js/` folder mein rakho:

### Core Layer:
```
customer/js/core/constants.js   →   customer/js/core/constants.js
customer/js/core/state.js       →   customer/js/core/state.js
customer/js/core/storage.js     →   customer/js/core/storage.js
customer/js/core/validators.js  →   customer/js/core/validators.js
customer/js/core/utils.js       →   customer/js/core/utils.js
customer/js/core/error.js       →   customer/js/core/error.js
customer/js/core/config.js      →   customer/js/core/config.js
```

### UI Layer:
```
customer/js/ui/toast.js         →   customer/js/ui/toast.js
customer/js/ui/validation.js    →   customer/js/ui/validation.js
customer/js/ui/modal.js         →   customer/js/ui/modal.js
customer/js/ui/auth-ui.js       →   customer/js/ui/auth-ui.js
customer/js/ui/i18n.js          →   customer/js/ui/i18n.js
customer/js/ui/category.js      →   customer/js/ui/category.js
customer/js/ui/cart-ui.js       →   customer/js/ui/cart-ui.js
customer/js/ui/celebration.js   →   customer/js/ui/celebration.js
```

### Modules Layer:
```
customer/js/modules/auth.js             →   customer/js/modules/auth.js
customer/js/modules/products.js         →   customer/js/modules/products.js
customer/js/modules/product-detail.js   →   customer/js/modules/product-detail.js
customer/js/modules/wishlist.js         →   customer/js/modules/wishlist.js
customer/js/modules/cart.js             →   customer/js/modules/cart.js
customer/js/modules/coupon.js           →   customer/js/modules/coupon.js
customer/js/modules/slots.js            →   customer/js/modules/slots.js
customer/js/modules/map.js              →   customer/js/modules/map.js
customer/js/modules/order.js            →   customer/js/modules/order.js
customer/js/modules/order-history.js    →   customer/js/modules/order-history.js
customer/js/modules/profile.js          →   customer/js/modules/profile.js
customer/js/modules/address-book.js     →   customer/js/modules/address-book.js
customer/js/modules/share.js            →   customer/js/modules/share.js
customer/js/modules/search.js           →   customer/js/modules/search.js
customer/js/modules/notifications.js    →   customer/js/modules/notifications.js
customer/js/modules/tracking.js         →   customer/js/modules/tracking.js
customer/js/modules/ratings.js          →   customer/js/modules/ratings.js
customer/js/modules/offers.js           →   customer/js/modules/offers.js
```

### Handlers Layer:
```
customer/js/handlers/backhandler.js     →   customer/js/handlers/backhandler.js
customer/js/handlers/network.js         →   customer/js/handlers/network.js
customer/js/handlers/gesture.js         →   customer/js/handlers/gesture.js
customer/js/handlers/keyboard.js        →   customer/js/handlers/keyboard.js
```

### Services Layer:
```
customer/js/services/api.js             →   customer/js/services/api.js
customer/js/services/sync.js            →   customer/js/services/sync.js
customer/js/services/performance.js     →   customer/js/services/performance.js
```

### Init:
```
customer/js/init.js                     →   customer/js/init.js
```

## Step 3: Copy Asset Files

```
assets/splash_banners/*     →   customer/assets/splash_banners/
assets/home_banners/*       →   customer/assets/home_banners/
assets/category_tiles/*     →   customer/assets/category_tiles/
assets/icons/*              →   customer/assets/icons/
SabziBuddy.svg              →   customer/SabziBuddy.svg (ya root mein rakho)
```

## Step 4: Admin Panel Files

Admin panel ki CSS/JS files `admin/css/` aur `admin/js/` folders mein rakho.

Tumhari existing admin CSS/JS files:
```
admin/css/*                 →   admin/css/
admin/js/*                  →   admin/js/
```

Naye structure ke hisaab se organize karo:

### Admin CSS:
```
admin/css/admin-variables.css       →   admin/css/admin-variables.css
admin/css/admin-base.css            →   admin/css/admin-base.css
admin/css/admin-components.css      →   admin/css/admin-components.css
admin/css/admin-responsive.css      →   admin/css/admin-responsive.css
```

### Admin JS:
```
admin/js/core/firebase-config.js    →   admin/js/core/firebase-config.js
admin/js/core/state.js              →   admin/js/core/state.js
admin/js/core/utils.js              →   admin/js/core/utils.js
admin/js/core/constants.js          →   admin/js/core/constants.js
admin/js/core/image-upload.js       →   admin/js/core/image-upload.js

admin/js/ui/toast.js                →   admin/js/ui/toast.js
admin/js/ui/navigation.js           →   admin/js/ui/navigation.js
admin/js/ui/modals.js               →   admin/js/ui/modals.js
admin/js/ui/charts.js               →   admin/js/ui/charts.js
admin/js/ui/profile-panel.js        →   admin/js/ui/profile-panel.js

admin/js/modules/auth.js            →   admin/js/modules/auth.js
admin/js/modules/dashboard.js       →   admin/js/modules/dashboard.js
admin/js/modules/analytics.js       →   admin/js/modules/analytics.js
admin/js/modules/products.js        →   admin/js/modules/products.js
admin/js/modules/zone.js            →   admin/js/modules/zone.js
admin/js/modules/orders.js          →   admin/js/modules/orders.js
admin/js/modules/order-map.js       →   admin/js/modules/order-map.js
admin/js/modules/boys.js            →   admin/js/modules/boys.js
admin/js/modules/attendance.js      →   admin/js/modules/attendance.js
admin/js/modules/settings.js        →   admin/js/modules/settings.js
admin/js/modules/my-orders.js       →   admin/js/modules/my-orders.js
admin/js/modules/my-map.js          →   admin/js/modules/my-map.js
admin/js/modules/verify-pin.js      →   admin/js/modules/verify-pin.js
admin/js/modules/coupons.js         →   admin/js/modules/coupons.js
admin/js/modules/collection-bar.js  →   admin/js/modules/collection-bar.js
admin/js/modules/image-slots.js     →   admin/js/modules/image-slots.js
```

## Step 5: Verify File Paths

Ensure kar lo ki HTML files mein paths sahi hain:

### Customer index.html:
```html
<!-- CSS paths (should already be correct) -->
<link rel="stylesheet" href="css/variables.css">
<link rel="stylesheet" href="css/base.css">
...

<!-- JS paths (ensure these match your files) -->
<script src="js/core/constants.js"></script>
<script src="js/core/state.js"></script>
...
<script src="js/init.js"></script>
```

### Admin index.html:
```html
<link rel="stylesheet" href="css/admin-variables.css">
<link rel="stylesheet" href="css/admin-base.css">
...
<script src="js/core/firebase-config.js"></script>
...
```

## Koi Problem?

Agar koi file missing hai ya path issue hai, toh Claude ya mujhe (Kimi) batao:
1. Kaunsa feature kaam nahi kar raha
2. Console mein kya error aa raha hai
3. Kaunsa file missing lag raha hai

Hum log exact bata denge ki problem kya hai aur solution kya hai.
