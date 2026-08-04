# Customer Website - Feature Documentation

## Page Flow

```
[Splash Screen] → [Login/OTP] → [Home Page] → [Product Detail]
                                              ↓
                        [Checkout] ← [Cart] ← [Add to Cart]
                            ↓
                     [Thank You + Order ID]
                            ↓
                     [Continue Shopping]
```

---

## 1. Splash Screen
- **File**: `index.html` → `#splash-screen`
- **CSS**: `animations.css` → `.splash-logo-img`
- Logo animation with fade-out
- Auto-hide after 1.5 seconds

---

## 2. Login / OTP System
- **Module**: `js/modules/auth.js`
- **UI**: `js/ui/auth-ui.js`

### Flow:
1. Phone number input (10 digits)
2. Send OTP button
3. 6-box OTP input (auto-tab between boxes)
4. 30-second countdown for resend
5. Verify & Continue

### Features:
- Skip login option (browse without login)
- Input validation (numeric only)
- Auto-paste OTP support
- Terms & Privacy links

---

## 3. Home Page

### 3.1 Header
- **CSS**: `header.css`
- Location picker (opens map modal)
- Cart icon with badge count
- Profile icon
- Search bar with voice search

### 3.2 Banner Slider
- **CSS**: `header.css` → `.main-banner-wrap`
- Auto-rotating banners (4 slides)
- Dot indicators
- Swipe support on mobile

### 3.3 Category Tabs
- **CSS**: `header.css` → `.top-cats`
- **JS**: `js/ui/category.js`
- Categories: All, Veggies, Fruits, Dairy, Grocery, Food & Drink, Home & Kitchen, Electronics, New
- Sub-category filters per category
- Active tab indicator animation

### 3.4 Product Grid
- **CSS**: `products.css`
- **JS**: `js/modules/products.js`
- 2-column grid layout
- Product card: Image, Name (Hindi + English), MRP, Sale Price, Stock badge, Qty controls
- Real-time from Firestore

### 3.5 Quantity Controls
- **CSS**: `products.css` → qty buttons
- **JS**: `js/modules/products.js` → `changeQty()`, `setQty()`
- + / - buttons
- Direct number input
- Min: 0, Max: 99

### 3.6 Free Delivery Bar
- **CSS**: `header.css` → `#free-delivery-bar`
- Shows remaining amount for free delivery
- Circular progress indicator
- Dismissible (X button)

---

## 4. Product Detail Page
- **Module**: `js/modules/product-detail.js`
- **CSS**: `product-detail.css`
- Full-screen overlay
- Image slider (multiple images)
- Product info: Name, Hindi name, Price, MRP, Unit, Stock status
- Key highlights list
- Information table
- Variant selector (if available)
- Add to cart / Qty controls (sticky bottom bar)
- Wishlist toggle button

---

## 5. Cart Panel
- **Module**: `js/modules/cart.js`
- **UI**: `js/ui/cart-ui.js`
- **CSS**: `cart.css`

### Features:
- Slide-out panel from right
- Item list with qty controls
- Bill summary (MRP total, discount, delivery fee, savings)
- Free delivery progress bar with truck animation
- Savings banner ("You saved ₹X")
- Clear cart button
- Proceed to checkout button

---

## 6. Checkout / Order Page
- **Module**: `js/modules/order.js`
- **CSS**: `order.css`

### Form Fields:
1. Name (required)
2. Mobile Number (required, +91 prefix)
3. Alternative Number (optional)
4. Delivery Address (required, text input)
5. Map Location (required, opens map picker)
6. Delivery Slot (required, grid selection)

### Delivery Slots:
- Today Morning
- Today Evening
- Tomorrow Morning
- Tomorrow Evening

### Free Delivery Bar:
- Shows progress toward free delivery
- Truck animation

### Submit:
- Validates all fields
- Generates Order ID
- Creates WhatsApp message with order details
- Opens WhatsApp with pre-filled message
- Shows Thank You overlay with Order ID

---

## 7. Thank You Overlay
- **CSS**: `modals.css` → `.thankyou-overlay`
- Order ID display
- 4-digit Delivery PIN (for verification)
- "Continue Shopping" button
- Celebration effects (confetti + emoji)

---

## 8. Profile Panel (Side Drawer)
- **Module**: `js/modules/profile.js`
- **CSS**: `profile.css`

### Sections:
- User info row (avatar, name)
- My Orders → opens full page
- My Wishlist → opens full page
- My Saved Address → opens full page
- My Profile → opens full page

### Customer Support:
- WhatsApp chat
- Phone call
- Email support

### Extra Actions:
- Share website
- About Us
- Suggest a Product

### Quick Links:
- Language picker (Hindi/English)
- Privacy Policy
- Terms & Conditions

### Logout button

---

## 9. Profile Full Page
- **Module**: `js/modules/profile.js`
- Edit: Full Name, Email
- Read-only: Mobile number
- Avatar (first letter of name)
- Save profile button

---

## 10. Orders Page
- **Module**: `js/modules/order-history.js`
- **CSS**: `profile.css`
- List of past orders
- Order ID, items, total, status, date
- Status: Pending, Assigned, Delivered, Cancelled

---

## 11. Wishlist Page
- **Module**: `js/modules/wishlist.js`
- **CSS**: `profile.css`
- Grid of wishlisted products
- Add to cart from wishlist
- Remove from wishlist
- Wish count badge in profile panel

---

## 12. Saved Address Page
- **Module**: `js/modules/address-book.js`
- **CSS**: `profile.css`
- List of saved addresses
- Auto-filled at checkout

---

## 13. Map Picker
- **Module**: `js/modules/map.js`
- **CSS**: `map.css`
- Full-screen map modal
- Leaflet.js with OpenStreetMap
- Search by area/colony/landmark
- Voice search support
- Center pin (fixed, map moves underneath)
- Delivery radius indicator
- "Confirm Location" button
- Saves: lat, lng, address text

---

## 14. Search
- **Module**: `js/modules/search.js`
- **CSS**: `header.css` → `.search-section`
- Real-time search suggestions
- Fuzzy matching
- Voice search (Web Speech API)
- Typewriter effect in placeholder

---

## 15. Language / i18n
- **Module**: `js/ui/i18n.js`
- Hindi / English toggle
- Translates: UI labels, buttons, messages
- Stored in localStorage

---

## 16. Coupon System
- **Module**: `js/modules/coupon.js`
- **CSS**: `modals.css` → coupon styles
- Apply coupon in cart
- Validates: code, expiry, usage limit, min order
- Shows discount amount
- "Awesome!" celebration popup on success
- Fireworks animation

---

## 17. Notifications (placeholder)
- **Module**: `js/modules/notifications.js`
- Out-of-stock subscription
- Push notifications setup

---

## 18. Share
- **Module**: `js/modules/share.js`
- Web Share API (if supported)
- Fallback: copy link to clipboard
- About Us modal
- Suggest Product modal

---

## Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| Default | Mobile phones (320px - 480px) |
| `min-width: 480px` | Large phones |
| `min-width: 768px` | Tablets |
| `min-width: 1024px` | Desktop |

---

## PWA Features
- Service Worker (add to home screen)
- Icons: 192x192, 512x512
- Manifest.json
- Offline support (placeholder)
