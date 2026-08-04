/* ════════════════════════════════════════
   ui/category-page.js
   Split-view Category Page
   Left: vertical scrollable category tiles
   Right: 2-col product grid
   Depends on: core/state.js, modules/products.js, ui/category.js
════════════════════════════════════════ */

/* ── Category definitions (same as existing) ── */
const CP_CATS = [
  { key: 'all',           label: 'All',            emoji: '🛒',  img: '../assets/category_tiles/All.webp'           },
  { key: 'burger',        label: 'Burger',         emoji: '🍔',  img: '../assets/category_tiles/Burger.webp'        },
  { key: 'pizza',         label: 'Pizza',          emoji: '🍕',  img: '../assets/category_tiles/Pizza.webp'         },
  { key: 'thali',         label: 'Thali',          emoji: '🍛',  img: '../assets/category_tiles/Thali.webp'         },
  { key: 'poha',          label: 'Poha',           emoji: '🍚',  img: '../assets/category_tiles/Poha.webp'          },
  { key: 'drink',         label: 'Drink',          emoji: '🥤',  img: '../assets/category_tiles/Drink.webp'         },
  { key: 'chole-bhature', label: 'Chole Bhature',  emoji: '🫘',  img: '../assets/category_tiles/Chole_Bhature.webp' },
  { key: 'paratha',       label: 'Paratha',        emoji: '🫓',  img: '../assets/category_tiles/Paratha.webp'       },
  { key: 'paneer',        label: 'Paneer',         emoji: '🧀',  img: '../assets/category_tiles/Paneer.webp'        },
];

let cpActiveCat = 'all';

/* ════════════════════════════════════════
   OPEN / CLOSE
════════════════════════════════════════ */
function openCategoryPage() {
  const page = document.getElementById('category-page');
  if (!page) return;

  cpActiveCat = 'all';
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  _cpRenderLeftTiles();
  _cpRenderProducts();
}

function closeCategoryPage() {
  const page = document.getElementById('category-page');
  if (!page) return;

  page.classList.remove('active');
  document.body.style.overflow = '';
}

/* ════════════════════════════════════════
   SELECT CATEGORY (left tile click)
════════════════════════════════════════ */
function cpSelectCat(key) {
  cpActiveCat = key;

  /* Active tile highlight */
  document.querySelectorAll('.cp-cat-tile').forEach(t => {
    t.classList.toggle('active', t.dataset.key === key);
  });

  _cpRenderProducts();

  /* Right panel ko top pe scroll karo */
  const right = document.getElementById('cp-products');
  if (right) right.scrollTop = 0;
}

/* ════════════════════════════════════════
   RENDER LEFT TILES
════════════════════════════════════════ */
function _cpRenderLeftTiles() {
  const container = document.getElementById('cp-cats');
  if (!container) return;

  container.innerHTML = CP_CATS.map(c => `
    <button class="cp-cat-tile${c.key === cpActiveCat ? ' active' : ''}"
      data-key="${c.key}"
      onclick="cpSelectCat('${c.key}')">
      <div class="cp-cat-img-wrap">
        <img src="${c.img}" alt="${c.label}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="cp-cat-emoji" style="display:none">${c.emoji}</span>
      </div>
      <span class="cp-cat-label">${c.label}</span>
    </button>
  `).join('');
}

/* ════════════════════════════════════════
   RENDER RIGHT PRODUCTS
════════════════════════════════════════ */
function _cpRenderProducts() {
  const container = document.getElementById('cp-products');
  if (!container) return;

  /* Filter items same logic as main page */
  let pool;
  if (cpActiveCat === 'all') {
    pool = items.filter(i => !i.zone);
  } else {
    pool = items.filter(i => i.top === cpActiveCat && !i.zone);
  }

  const inStock  = pool.filter(i => !i.outOfStock);
  const outStock = pool.filter(i =>  i.outOfStock);
  const filtered = [...inStock, ...outStock];

  /* Update count in header */
  const countEl = document.getElementById('cp-count');
  if (countEl) countEl.textContent = `(${filtered.length})`;

  if (!filtered.length) {
    container.innerHTML =
      '<div class="cp-empty">No products in this category 😕</div>';
    return;
  }

  /* Reuse existing buildCard — same cards as main page */
  container.innerHTML = `<div class="cp-grid">${filtered.map(buildCard).join('')}</div>`;
}

/* ════════════════════════════════════════
   REFRESH (cart update ke baad call karo)
   Called after changeQty so qty shows correct
════════════════════════════════════════ */
function cpRefreshIfOpen() {
  const page = document.getElementById('category-page');
  if (page && page.classList.contains('active')) {
    _cpRenderProducts();
  }
}
