# SabziBuddy - Project Structure Guide
> Last Updated: 2026-05-12

## Overview

SabziBuddy ek **Firebase-based e-commerce platform** hai taazi sabzi aur groceries ke liye.

| Module | Technology | Purpose |
|--------|-----------|---------|
| Customer Website | HTML + CSS + JS (Vanilla) | User-facing shopping experience |
| Admin Panel | HTML + CSS + JS (Vanilla) | Owner/Manager/Delivery management |
| Coupon Manager | HTML + CSS + JS (Vanilla) | Coupon/Discount management |
| Database | Firebase Firestore | Real-time data storage |
| Auth | Firebase Auth (OTP + Email) | User authentication |
| Storage | Firebase Storage | Product images |
| Maps | Leaflet.js + OpenStreetMap | Location picker |

---

## Folder Structure

```
sabzibuddy/
|
|=== CUSTOMER (User-facing website)
|
|   customer/
|   |
|   |--- index.html                  Main entry point - pura customer website
|   |                               (Splash → Login → Home → Cart → Checkout)
|   |
|   |--- assets/                    Static files (images, icons, banners)
|   |   |
|   |   |--- splash_banners/        Login screen ke 4 onboarding slides
|   |   |       splash-1.webp      Slide 1: Fresh vegetables
|   |   |       splash-2.webp      Slide 2: Fast delivery
|   |   |       splash-3.webp      Slide 3: Best prices
|   |   |       splash-4.webp      Slide 4: Quality guarantee
|   |   |
|   |   |--- home_banners/          Homepage rotating banner images
|   |   |       banner-1.webp      Banner slide 1
|   |   |       banner-2.webp      Banner slide 2
|   |   |       banner-3.webp      Banner slide 3
|   |   |       banner-4.webp      Banner slide 4
|   |   |
|   |   |--- category_tiles/        Category tab icons (top navigation)
|   |   |       all.webp           "All" category icon
|   |   |       veggie.webp        Vegetables category
|   |   |       fruit.webp         Fruits category
|   |   |       dairy.webp         Dairy products
|   |   |       grocery.webp       Grocery items
|   |   |       food.webp          Food & drinks
|   |   |       electronics.webp   Electronics
|   |   |       home-kitchen.webp  Home & Kitchen
|   |   |       new.webp           New launches
|   |   |
|   |   |--- icons/                 PWA icons + favicon
|   |   |       icon-192.png       Android home screen icon (192x192)
|   |   |       icon-512.png       PWA splash icon (512x512)
|   |   |       favicon.ico        Browser tab icon
|   |   |
|   |   |--- products/              Local product images (backup/Firestore fallback)
|   |           (empty)            Sirf tabhi use hota hai jab Firestore URL fail ho
|   |
|   |--- css/                       All stylesheets
|   |   |
|   |   |--- variables.css          CSS custom properties (colors, shadows, radius)
|   |   |                          :root variables - sab files mein use hote hain
|   |   |
|   |   |--- base.css               CSS reset + body styles + utility classes
|   |   |                          Global typography, container styles
|   |   |
|   |   |--- animations.css         All @keyframes + animated elements
|   |   |                          Spinner, confetti, fade-in, slide-up
|   |   |
|   |   |--- header.css             Header, search bar, category tabs, bottom nav
|   |   |                          Location picker, cart badge, profile icon
|   |   |
|   |   |--- products.css           Product grid + cards + quantity controls
|   |   |                          Grid layout, card styles, +/- buttons
|   |   |
|   |   |--- product-detail.css     Product detail page styles
|   |   |                          Image slider, variant picker, sticky CTA
|   |   |
|   |   |--- cart.css               Cart panel + overlay + bill summary
|   |   |                          Slide-out panel, item list, free delivery bar
|   |   |
|   |   |--- order.css              Checkout form + delivery slots + FD bar
|   |   |                          Form inputs, slot selection, place order button
|   |   |
|   |   |--- profile.css            Profile panel + full pages + order cards
|   |   |                          Side drawer, profile page, orders list
|   |   |
|   |   |--- map.css                Map modal + controls + suggestions
|   |   |                          Leaflet map, search, center pin, location confirm
|   |   |
|   |   |--- modals.css             Legal sheets + thank you + coupon popup
|   |   |                          Terms, Privacy, About Us, Suggest Product
|   |   |
|   |   |--- footer.css             Footer + social buttons
|   |                                Instagram, FB, X, YouTube links
|   |
|   |--- js/                        All JavaScript (load order: core → ui → modules → handlers → services → init)
|       |
|       |--- core/                  Foundation layer - NO DOM, NO Firebase direct
|       |   |--- constants.js       App constants (limits, keys, defaults)
|       |   |                      MIN_ORDER, FREE_DELIVERY_THRESHOLD, etc.
|       |   |
|       |   |--- state.js           All mutable global state
|       |   |                      cart, user, wishlist, currentCategory, etc.
|       |   |
|       |   |--- storage.js         localStorage safe wrapper
|       |   |                      getItem/setItem with try-catch
|       |   |
|       |   |--- validators.js      Pure validation functions
|       |   |                      phone number, name, address validation
|       |   |
|       |   |--- utils.js           Pure utility helpers
|       |   |                      formatCurrency, debounce, throttle, etc.
|       |   |
|       |   |--- error.js           Error handling utilities
|       |   |                      handleError, safeAsync, error types
|       |   |
|       |   |--- config.js          Firebase initialization + Firestore listeners
|       |                            Firebase config, db/auth instances
|       |
|       |--- ui/                    DOM-only layer - visual feedback
|       |   |--- toast.js           showToast + toast.success/error/info
|       |   |
|       |   |--- validation.js      Form validation display
|       |   |                      showFieldError, validateName, validatePhone
|       |   |
|       |   |--- modal.js           Modal management
|       |   |                      openModal, closeModal, bottom sheets, loading
|       |   |
|       |   |--- auth-ui.js         OTP input UI
|       |   |                      OTP boxes, timer, paste handler, profile icon
|       |   |
|       |   |--- i18n.js            Multi-language support
|       |   |                      TRANSLATIONS, applyLanguage, language picker
|       |   |
|       |   |--- category.js        Category tab navigation
|       |   |                      Tab indicator, active state, scrolling
|       |   |
|       |   |--- cart-ui.js         Cart visual updates
|       |   |                      updateCartUI, bill summary, FD progress bar
|       |   |
|       |   |--- celebration.js     Celebration effects
|       |                            Confetti + emoji rain on order success
|       |
|       |--- modules/               Business logic layer
|       |   |--- auth.js            OTP Authentication
|       |   |                      sendOTP, verifyOTP, resendOTP, login/logout
|       |   |
|       |   |--- products.js        Product listing & search
|       |   |                      renderProducts, buildCard, changeQty, setQty
|       |   |
|       |   |--- product-detail.js  Product detail page
|       |   |                      openProductDetail, variants, image slider
|       |   |
|       |   |--- wishlist.js        Wishlist functionality
|       |   |                      toggleWish, wishlist page, wish badge
|       |   |
|       |   |--- cart.js            Cart management
|       |   |                      openCart, closeCart, clearCart, openCheckout
|       |   |
|       |   |--- coupon.js          Coupon/discount system
|       |   |                      applyCoupon, removeCoupon, fireworks
|       |   |
|       |   |--- slots.js           Delivery slot management
|       |   |                      getSlots, renderSlots, selectSlot
|       |   |
|       |   |--- map.js             Map location picker
|       |   |                      Leaflet map, geocode, search, confirmLocation
|       |   |
|       |   |--- order.js           Order placement (full 9-step flow)
|       |   |                      placeOrder, validation, WhatsApp integration
|       |   |
|       |   |--- order-history.js   Past orders display
|       |   |                      openOrdersPage, fetch + render orders
|       |   |
|       |   |--- profile.js         User profile management
|       |   |                      Profile panel, edit profile, save data
|       |   |
|       |   |--- address-book.js    Saved addresses
|       |   |                      openSavedAddress, render saved details
|       |   |
|       |   |--- share.js           Social sharing
|       |   |                      shareWebsite, About Us, Suggest Product
|       |   |
|       |   |--- search.js          Search functionality
|       |   |                      fuzzyMatch, suggestions, voice search, typewriter
|       |   |
|       |   |--- notifications.js   Push notifications
|       |   |                      notifyItem, out-of-stock subscribe
|       |   |
|       |   |--- ratings.js         Product ratings (placeholder - future)
|       |   |
|       |   |--- offers.js          Offers/deals (placeholder - future)
|       |   |
|       |   |--- tracking.js        Delivery tracking (placeholder - future)
|       |                            ETA, live location, delivery status
|       |
|       |--- handlers/              Event handlers layer
|       |   |--- backhandler.js     Android back button intercept
|       |   |                      Handle hardware back button
|       |   |
|       |   |--- network.js         Online/offline detection
|       |   |                      Network status, offline mode
|       |   |
|       |   |--- gesture.js         Touch gesture handlers (placeholder - future)
|       |   |                      Swipe, pinch, long-press
|       |   |
|       |   |--- keyboard.js        Keyboard shortcuts (placeholder - future)
|       |                            Hotkeys, shortcuts
|       |
|       |--- services/              Infrastructure layer
|       |   |--- api.js             Centralized API wrapper
|       |   |                      All Firebase calls through this layer
|       |   |
|       |   |--- sync.js            Offline cart sync (placeholder - future)
|       |   |                      Background sync, queue management
|       |   |
|       |   |--- performance.js     Performance optimization (placeholder - future)
|       |   |                      Lazy loading, image optimization, caching
|       |   |
|       |   |--- analytics.js       Usage analytics (placeholder - future)
|       |                            User behavior tracking, conversion funnels
|       |
|       |--- init.js                Application bootstrap (ALWAYS LOAD LAST)
|                                    App initialization, event listeners, startup sequence
|
|=== ADMIN (Management dashboard)
|
|   admin/
|   |
|   |--- index.html                 Main admin panel entry point
|   |                               Dashboard, Analytics, Products, Orders,
|   |                               Delivery Boys, Zone Manager, Settings
|   |
|   |--- coupons.html               Coupon management page (standalone)
|   |                               Create, edit, activate/deactivate coupons
|   |
|   |--- css/                       Admin stylesheets
|   |   |
|   |   |--- admin-variables.css    Admin color palette + design tokens
|   |   |                          Same green theme but darker for admin
|   |   |
|   |   |--- admin-base.css         Reset + layout + typography
|   |   |
|   |   |--- admin-components.css   All admin UI components
|   |   |                          Sidebar, cards, tables, forms, toggles, modals
|   |   |
|   |   |--- admin-responsive.css   Mobile/tablet breakpoints
|   |   |                          Sidebar collapse, mobile nav, form grids
|   |
|   |--- js/                        Admin JavaScript
|       |
|       |--- core/                  Admin foundation
|       |   |--- firebase-config.js Firebase init + auth setup
|       |   |                      Same config as customer but with role checks
|       |   |
|       |   |--- state.js           Admin state management
|       |   |                      Current user role, boyId, permissions
|       |   |
|       |   |--- utils.js           Admin utilities
|       |   |                      Date formatting, status badges, calculations
|       |   |
|       |   |--- constants.js       Admin constants
|       |   |                      Role types, status maps, slot groups
|       |   |
|       |   |--- image-upload.js    Firebase Storage image upload
|       |   |                      5-slot product images, bulk upload, delete
|       |
|       |--- ui/                    Admin visual layer
|       |   |--- toast.js           Toast notifications
|       |   |
|       |   |--- navigation.js      Sidebar + mobile nav + section switching
|       |   |                      goTo(), active states, mobile bottom nav
|       |   |
|       |   |--- modals.js          Product modal, Boy modal, Order modal, Zone modal
|       |   |                      Open/close, form population, validation
|       |   |
|       |   |--- charts.js          Bar charts rendering
|       |   |                      Weekly charts, analytics charts, revenue charts
|       |   |
|       |   |--- profile-panel.js   Delivery boy profile drawer
|       |                            Slide-out panel, quick actions
|       |
|       |--- modules/               Admin business logic
|           |--- auth.js            Email/password login + role-based access
|           |                      Owner/Manager/Delivery Boy - 3 roles
|           |
|           |--- dashboard.js       Dashboard stats + charts
|           |                      Today orders, delivery performance, 7-day chart
|           |
|           |--- analytics.js       Business analytics
|           |                      Period-based reports, revenue, boy collections
|           |                      Monthly calendar view
|           |
|           |--- products.js        Product CRUD + filtering + quick stock edit
|           |                      Add/Edit/Delete, search, category filter, stock bar
|           |
|           |--- zone.js            Rs.1 Zone management
|           |                      Zone price setting, max items, add/remove products
|           |
|           |--- orders.js          Order management + bulk actions
|           |                      Status filter, assign to boy, bulk print/WA/SMS
|           |
|           |--- order-map.js       Map view of orders
|           |                      Leaflet map, route markers, store location
|           |
|           |--- boys.js            Delivery boy management
|           |                      Add/Edit boys, phone, area, email
|           |
|           |--- attendance.js      Daily attendance tracking
|           |                      Present/Absent per boy per day, save/load
|           |
|           |--- settings.js        Site configuration
|           |                      Category ON/OFF, Free Delivery threshold,
|           |                      Delivery Fee, Min Order, Store Location,
|           |                      WhatsApp Number
|           |
|           |--- my-orders.js       Delivery boy's own orders (live listener)
|           |                      Real-time orders, collection tracker, slot grouping
|           |
|           |--- my-map.js          Delivery boy's route map
|           |                      Store → Assigned → Delivered route with numbers
|           |
|           |--- verify-pin.js      Customer PIN verification
|           |                      4-digit PIN verify, Cancel PIN, mark delivered
|           |
|           |--- coupons.js         Coupon management (standalone page)
|           |                      CRUD coupons, expiry, usage limits, stats
|           |
|           |--- collection-bar.js  Live collection tracker
|           |                      Today's total, collected, remaining, progress %
|           |
|           |--- image-slots.js     5-slot product image manager
|           |                      Meesho-style thumbnails, upload, replace, delete
|
|=== DOCUMENTATION
|
|   docs/
|   |
|   |--- STRUCTURE_GUIDE.md         Yeh file - full project documentation
|   |--- CUSTOMER_FEATURES.md       Customer website feature documentation
|   |--- ADMIN_FEATURES.md          Admin panel feature documentation
|   |--- DEVELOPER_GUIDE.md         Developer onboarding guide
|   |--- CHANGELOG.md               Version history + changes
|   |--- TROUBLESHOOTING.md         Common issues + solutions
|
|=== ROOT
|
|   SabziBuddy.svg                   App logo (About Us + splash mein use hota hai)
|   README.md                        Project overview (GitHub ke liye)
|   .firebaserc                      Firebase project config
|   firebase.json                    Hosting + redirect rules
```

---

## File Load Order (Customer Website)

HTML mein CSS aur JS files is order mein load hote hain:

### CSS Order:
1. `variables.css` - Sabse pehle (other files use these variables)
2. `base.css` - Reset aur base styles
3. `animations.css` - Animations available honi chahiye before use
4. `header.css` - Header, search, tabs
5. `products.css` - Product grid
6. `product-detail.css` - Detail page styles
7. `cart.css` - Cart panel
8. `order.css` - Checkout styles
9. `profile.css` - Profile styles
10. `map.css` - Map styles
11. `modals.css` - Modal overlays
12. `footer.css` - Footer styles

### JS Order:
1. **Core Layer** (no DOM dependency):
   - `constants.js`
   - `state.js`
   - `storage.js`
   - `validators.js`
   - `utils.js`
   - `error.js`
   - `config.js` (Firebase init)

2. **UI Layer** (depends on core):
   - `toast.js`
   - `validation.js`
   - `modal.js`
   - `auth-ui.js`
   - `i18n.js`
   - `category.js`
   - `cart-ui.js`
   - `celebration.js`

3. **Modules Layer** (depends on core + ui):
   - `auth.js`
   - `products.js`
   - `product-detail.js`
   - `wishlist.js`
   - `cart.js`
   - `coupon.js`
   - `slots.js`
   - `map.js`
   - `order.js`
   - `order-history.js`
   - `profile.js`
   - `address-book.js`
   - `share.js`
   - `search.js`
   - `notifications.js`

4. **Handlers Layer** (optional):
   - `backhandler.js`
   - `network.js`
   - `gesture.js`
   - `keyboard.js`

5. **Services Layer** (optional):
   - `api.js`
   - `sync.js`
   - `performance.js`
   - `analytics.js`

6. **Init** (ALWAYS LAST):
   - `init.js` - App bootstrapping

---

## File Load Order (Admin Panel)

### CSS Order:
1. `admin-variables.css` - Design tokens
2. `admin-base.css` - Layout + typography
3. `admin-components.css` - All UI components
4. `admin-responsive.css` - Mobile breakpoints

### JS Order:
1. **Core**:
   - `firebase-config.js`
   - `state.js`
   - `utils.js`
   - `constants.js`
   - `image-upload.js`

2. **UI**:
   - `toast.js`
   - `navigation.js`
   - `modals.js`
   - `charts.js`
   - `profile-panel.js`

3. **Modules**:
   - `auth.js`
   - `dashboard.js`
   - `analytics.js`
   - `products.js`
   - `zone.js`
   - `orders.js`
   - `order-map.js`
   - `boys.js`
   - `attendance.js`
   - `settings.js`
   - `my-orders.js`
   - `my-map.js`
   - `verify-pin.js`
   - `coupons.js`
   - `collection-bar.js`
   - `image-slots.js`

4. **Init**:
   - `init.js`

---

## Role-Based Access (Admin)

| Feature | Owner | Manager | Delivery Boy |
|---------|-------|---------|--------------|
| Dashboard | Yes | Yes | No |
| Analytics | Yes | Yes | No |
| Products CRUD | Yes | Yes | No |
| Zone Manager | Yes | Yes | No |
| All Orders | Yes | Yes | No |
| Order Map | Yes | Yes | No |
| Delivery Boys | Yes | Yes | No |
| Attendance | Yes | Yes | No |
| Site Settings | Yes | Yes | No |
| Coupons | Yes | Yes | No |
| My Orders | No | No | Yes |
| My Route Map | No | No | Yes |
| Verify PIN | No | No | Yes |

---

## Firebase Collections

| Collection | Purpose | Documents |
|------------|---------|-----------|
| `products` | Product catalog | Each product = one document |
| `orders` | All orders | Each order = one document with timestamp |
| `users` | Customer profiles | UID-based, phone, name, addresses |
| `userRoles` | Admin roles | UID-based, role: owner/manager/delivery |
| `deliveryBoys` | Boy profiles | boyId, name, phone, area, email |
| `attendance` | Daily attendance | date + boyName + status (present/absent) |
| `config/siteSettings` | Global settings | Free delivery threshold, delivery fee, categories ON/OFF |
| `config/zoneSettings` | Zone config | Price, max items per order |
| `coupons` | Discount codes | Code, discount amount, max uses, expiry |

---

## Naming Conventions

### Files:
- CSS: `kebab-case.css` (e.g., `product-detail.css`)
- JS: `kebab-case.js` (e.g., `order-history.js`)
- Images: `descriptive-name.webp` (e.g., `home-kitchen.webp`)

### CSS Classes:
- Components: `component-name` (e.g., `cart-panel`, `profile-header`)
- Modifiers: `component--modifier` (e.g., `page-back-btn--header`)
- States: `is-active`, `is-hidden`, `has-error`

### JS Functions:
- Actions: `verbNoun` (e.g., `openCart`, `saveProfile`)
- Handlers: `onEventName` (e.g., `onSearchInput`, `onLoginPhoneInput`)
- Getters: `getThing` (e.g., `getSlots`, `getStatus`)
- Renderers: `renderThing` (e.g., `renderProducts`, `renderSlots`)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2026-05-12 | Initial release |
