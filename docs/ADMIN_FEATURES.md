# Admin Panel - Feature Documentation

## Architecture

Admin panel 3 role types support karta hai:

| Role | Access Level | Typical User |
|------|-------------|--------------|
| `owner` | Full access - everything | Business owner |
| `manager` | Almost full - can't add/remove boys | Store manager |
| `delivery` | Only their assigned orders + verify PIN | Delivery boy |

---

## 1. Login Screen
- **File**: `admin/index.html` → `#login-screen`
- Email + Password authentication (Firebase Auth)
- Role-based access control (Firestore `userRoles` collection)
- Login help box (setup instructions for new managers/delivery boys)

### Login Flow:
```
Email/Password → Firebase Auth → Check userRoles collection
→ If owner/manager: Show full admin
→ If delivery: Show delivery view only
→ If no role: Show error + logout
```

---

## 2. Dashboard Section (`sec-dashboard`)
- **Module**: `js/modules/dashboard.js`

### Stats Row (5 cards):
| Card | Color | What it shows |
|------|-------|---------------|
| Today Orders | Green (🟢) | Total orders in selected date range |
| Delivered | Amber (🟠) | Count of delivered orders |
| Pending | Blue (🔵) | Pending + assigned orders |
| Total Value | Teal (🩵) | Total value of all orders |
| Collected | Purple (🟣) | Amount collected from delivered orders |

### Features:
- Date range picker (From → To)
- "Today" quick button
- Refresh button
- Delivery boy performance table (assigned/delivered/pending/value/collected/attendance)
- 7-day bar chart

---

## 3. Analytics Section (`sec-analytics`)
- **Module**: `js/modules/analytics.js`

### Period Buttons: 7 Days / 30 Days / 3 Months

### Metric Cards (4):
- Total Orders
- Revenue (₹)
- Delivered count
- Average order value

### Charts:
- Orders Over Time (bar chart)
- Revenue Over Time (bar chart)
- Monthly Calendar (heat map style)

### Boy Collections Table:
- Per-boy: Orders, Delivered, Collection amount, Success %

---

## 4. Products Section (`sec-products`)
- **Module**: `js/modules/products.js`

### Product List:
- Search by name
- Category filter (dropdown)
- Status filter: All / Available / Out of Stock / Zone Items / Low Stock
- Product cards with:
  - Image thumbnail
  - Name + Hindi name
  - MRP + Sale price
  - Stock bar (green/amber/red)
  - Quick stock edit (type + Enter)
  - Edit button → opens product modal
  - Delete button

### Low Stock Banner:
- Shows OOS (Out of Stock) items
- Shows low stock items (≤5)

---

## 5. Product Modal (`prod-modal`)
- **Module**: `js/modules/products.js` + `js/ui/modals.js`

### Form Fields:
| Field | Type | Required |
|-------|------|----------|
| Name | Text | Yes |
| Hindi Name | Text | No |
| MRP | Number | Yes |
| Sale Price | Number | Yes |
| Qty | Number | No |
| Unit | Text (gm/kg/pcs) | No |
| Stock Qty | Number | No |
| Low Stock Alert | Number | No |
| Tag | Text | No |
| Category | Dropdown | Yes |
| Sub-category | Dropdown | Yes |
| Category Disabled Msg | Text | No |

### Image Upload (5 slots - Meesho style):
- Slot 1 = Main listing image
- Upload per slot (click → file picker)
- Bulk upload (multiple files)
- Delete from slot (removes from Firebase Storage too)
- Upload progress bar

### Key Highlights Section:
- Add/remove bullet points
- Saved as `features` array

### Information Section:
- Add/remove key-value pairs
- Saved as `information` array

### Toggles:
- Available (in stock) - ON/OFF
- Add to Zone - ON/OFF

---

## 6. Zone Manager (`sec-zone`)
- **Module**: `js/modules/zone.js`

### Zone Settings:
- Zone Price (₹) - default ₹1
- Max items per order - default 1
- Save button
- Preview text

### Zone Items List:
- Shows all products with `zone: true`
- Product info with zone price
- Remove from zone button
- "Add to Zone" button → opens selector modal

### Add to Zone Modal:
- Checkbox list of non-zone products
- Bulk add with batch update

---

## 7. All Orders Section (`sec-orders`)
- **Module**: `js/modules/orders.js`

### Features:
- **LIVE** badge (real-time Firestore listener)
- Force Refresh button (fallback)

### Quick Stats Cards:
- Pending count (orange)
- Out for Delivery count (blue)
- Delivered count (green)
- Cancelled count (red)

### Filters:
- Search: Order ID / Name / Phone
- Status dropdown
- Date picker
- Clear filters button

### Bulk Actions Bar (appears when orders selected):
- Select all pending checkbox
- Print selected orders
- WhatsApp all (max 10)
- SMS all
- Clear selection

### Order Table Columns:
- Checkbox (for bulk select)
- Order ID
- Customer name
- Area
- Delivery slot
- Amount
- Status badge
- Assign dropdown (select delivery boy)
- Actions (view details)

---

## 8. Order Map (`sec-map`)
- **Module**: `js/modules/order-map.js`

### Features:
- Leaflet map with order pins
- Color-coded markers:
  - 🟠 Orange = Pending
  - 🔵 Blue = Assigned
  - 🟢 Green = Delivered
  - 🟤 Dark green = Store location
- Date filter
- Status filter
- Legend
- Order list below map

---

## 9. Delivery Boys (`sec-boys`)
- **Module**: `js/modules/boys.js`

### Boy List:
- Avatar with initials
- Name + Phone + Area
- Email (for Firebase Auth login)
- Stats: Assigned orders, Delivered, Total value
- Edit button → Boy modal

### Boy Modal:
- Full Name
- Mobile Number
- Area/Zone
- Email (Firebase Auth)
- Save button

---

## 10. Attendance (`sec-attendance`)
- **Module**: `js/modules/attendance.js`

### Features:
- Date picker
- Load button
- Save All button

### Per-boy row:
- Boy name
- Present toggle (green = present)
- Absent toggle (red = absent)

### Data saved as:
```
{
  date: "2026-05-12",
  boyName: "Ramesh",
  status: "present" | "absent"
}
```

---

## 11. Site Settings (`sec-settings`)
- **Module**: `js/modules/settings.js`

### 11.1 Category ON/OFF Control
- Toggle switch for each category
- When OFF: Category hidden from customer website
- Products updated in batch (499 at a time)
- Shows product count per category

### 11.2 Free Delivery Threshold
- Minimum cart value for free delivery
- Default: ₹99

### 11.3 Delivery Fee
- Normal delivery charge
- Default: ₹20
- 0 = always free

### 11.4 Delivery Fee Discount
- Show strikethrough price (e.g., ~~₹20~~ ₹9)
- 0 = no discount shown

### 11.5 Minimum Order Amount
- Minimum order to checkout
- Default: ₹99

### 11.6 Store Location
- Latitude + Longitude
- Used for route optimization

### 11.7 WhatsApp Order Number
- Number for order confirmations
- Format: 917900684615 (with country code)

---

## 12. My Orders (Delivery Boy View) (`sec-myorders`)
- **Module**: `js/modules/my-orders.js`

### Live Collection Bar:
- **Real-time** Firestore listener
- Shows: Total orders value, Collected amount, Remaining amount
- Progress bar with percentage
- Order count (delivered/pending)

### Order Grouping by Slot:
- Today Morning
- Today Evening
- Tomorrow Morning
- Tomorrow Evening
- Other

### Per-order card:
- Order ID
- Customer name + phone
- Address
- Items list
- Total amount
- Status badge
- Delivery PIN
- Location link (opens Google Maps)
- Mark Delivered button

---

## 13. My Route Map (`sec-mymap`)
- **Module**: `js/modules/my-map.js`

### Features:
- Numbered route markers (1, 2, 3...)
- Store → Order 1 → Order 2 → ... route line
- Color coding:
  - Blue = Assigned
  - Green = Delivered
  - Orange = Pending

### Route Summary Bar:
- Assigned count
- Delivered count
- Total distance (km)
- Total stops

---

## 14. Verify PIN (`sec-verify`)
- **Module**: `js/modules/verify-pin.js`

### Customer PIN Verification:
- Order ID input
- 4-digit PIN input
- Verify button → marks order delivered

### Cancel PIN (if customer not home):
- Separate 4-digit cancel PIN (provided by owner)
- Verify + Cancel Order button

---

## 15. Coupon Manager (`coupons.html`)
- **Standalone page** - opens in new tab from admin
- **Module**: `js/modules/coupons.js`

### Stats Row:
- Total Coupons
- Active Coupons
- Total Uses
- Total Savings Given

### Create Coupon Form:
| Field | Description |
|-------|-------------|
| Coupon Code | Uppercase, letters+numbers only |
| Discount Amount (₹) | Fixed amount off |
| Max Uses | How many customers can use |
| Expiry Date | Auto-expires after this |
| Expiry Time | Specific time |
| Min Order Amount | Minimum cart value (0 = no limit) |
| Category | Restrict to specific category (optional) |
| Subcategory | Further restrict (optional) |

### Live Preview Box:
- Shows coupon code + details

### Coupon List:
- Filter tabs: All / Active / Expired / Inactive
- Per coupon: Code, discount, uses left, expiry, status pill
- Usage progress bar
- Actions per status:
  - **Active**: Edit (expiry), Deactivate, Delete
  - **Inactive**: Reactivate (checks expiry first), Delete
  - **Expired**: Extend (update expiry), Delete
  - **Full**: Extend, Delete

---

## 16. Image Slots System
- **Module**: `js/modules/image-slots.js`

### 5-Slot Product Images (Meesho Style):
- Slot 1 = Main image (shown in product listing)
- Slots 2-5 = Additional images (shown in product detail)
- Click slot → file picker
- Drag & drop bulk upload
- Delete removes from Firebase Storage
- Upload progress indicator

---

## 17. Mobile Navigation
- **File**: `admin/index.html` → `.mobile-bottom-nav`
- Visible below 900px width
- Icon + label tabs
- Active state highlighting
- Auto-switches based on role

---

## 18. Responsive Breakpoints

| Breakpoint | Changes |
|------------|---------|
| `max-width: 900px` | Sidebar becomes slide-out overlay, mobile bottom nav appears |
| `max-width: 720px` | Compact header, logout icon only |
| `max-width: 600px` | Stats grid 2 columns, compact tables |
| `max-width: 480px` | Single column forms, stacked filters |
| `max-width: 400px` | Smaller identity display |

---

## 19. Keyboard Shortcuts (Future)

| Key | Action |
|-----|--------|
| `Ctrl+K` | Focus search |
| `Escape` | Close modal |
| `Ctrl+R` | Refresh current section |

---

## 20. Real-time Listeners

| Listener | Purpose | Scope |
|----------|---------|-------|
| `orders` collection | Live order updates | Owner/Manager |
| `myOrders` query | Boy's assigned orders | Delivery Boy |
| `products` | Product changes | All |
| `coupons` | Coupon status | Admin |
