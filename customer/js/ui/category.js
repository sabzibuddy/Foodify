/* ════════════════════════════════════════
   ui/category.js
   Category tab navigation + sliding indicator.
   Depends on: core/state.js, modules/products.js
════════════════════════════════════════ */

/* ── All top-level category keys ─────── */
const TOP_CATS = [
  'burger', 'pizza', 'thali', 'poha',
  'paratha', 'drink', 'chole-bhature',
];

const CAT_TITLES = {
  all:              'All Products',
  burger:           'Tasty Burgers',
  pizza:            'Cheesy Pizzas',
  thali:            'Delicious Thalis',
  paneer:           'Paneer Delights',
  paratha:          'Stuffed Parathas',
  poha:             'Piping Hot Poha',
  drink:            'Drinks & Refreshments',
  'chole-bhature':  'Chole Bhature Specials',
};

/* ════════════════════════════════════════
   CATEGORY INDICATOR (sliding underline)
════════════════════════════════════════ */
function updateCatIndicator(el) {
  const ind = document.getElementById('cat-indicator');
  if (!ind || !el) return;
  ind.style.left  = el.offsetLeft + 'px';
  ind.style.width = el.offsetWidth + 'px';
}

/* ════════════════════════════════════════
   GO TO ZONE (₹X Zone tab)
════════════════════════════════════════ */
function goToZone(el) {
  currentTopCat = 'zone';
  currentSubCat = 'all';

  _setActiveTab(el);
  _hideAllFilters();

  document.getElementById('section-title').textContent = `🔥 ₹${ZONE_PRICE} Zone`;
  document.getElementById('section-sub').textContent   =
    `Limited time offer · Max ${ZONE_MAX_ITEMS} per order`;

  document.body.classList.add('zone-active');
  renderProducts();
}

/* ════════════════════════════════════════
   SWITCH TOP CATEGORY
════════════════════════════════════════ */
function switchTopCat(cat, el) {
  currentTopCat = cat;
  currentSubCat = 'all';

  _setActiveTab(el);

  // BUG FIX: pehle duplicate forEach loop tha (show/hide alag, reset-active alag)
  // Ab ek hi loop mein dono kaam hote hain
  TOP_CATS.forEach(c => {
    const filterBar = document.getElementById(c + '-filters');
    if (!filterBar) return;

    if (c === cat) {
      filterBar.style.display = 'flex';
      // Pehla filter button active karo (subcategory reset)
      filterBar.querySelectorAll('.filter-btn')
        .forEach((b, i) => b.classList.toggle('active', i === 0));
    } else {
      filterBar.style.display = 'none';
    }
  });

  const titleEl = document.getElementById('section-title');
  const subEl   = document.getElementById('section-sub');
  if (titleEl) titleEl.textContent = CAT_TITLES[cat] || 'Fresh Today';
  if (subEl)   subEl.textContent   = 'All prices per pack • Updated daily';

  document.body.classList.remove('zone-active');
  renderProducts();
}

/* ════════════════════════════════════════
   FILTER SUBCATEGORY
════════════════════════════════════════ */
function filterSub(sub, el) {
  currentSubCat = sub;
  document.querySelectorAll(`#${currentTopCat}-filters .filter-btn`)
    .forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderProducts();
}

/* ════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════ */
function _setActiveTab(el) {
  document.querySelectorAll('.top-cat-btn').forEach(b => b.classList.remove('active'));
  if (el) { el.classList.add('active'); updateCatIndicator(el); }
}

function _hideAllFilters() {
  TOP_CATS.forEach(c => {
    const f = document.getElementById(c + '-filters');
    if (f) f.style.display = 'none';
  });
}
