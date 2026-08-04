/* ═══════════════════════════════════════════════════════════════════
   home-sections.js  —  SabziBuddy v5
   ─────────────────────────────────────────────────────────────────
   CHANGES (Phase 3 + Phase 4):
   ✅ Zone section HOME PAGE se hataya — sirf zone tab mein dikhega
   ✅ Section order logic:
        Normal days  : Flash Deal → Combo Deal → Trending Now → categories
        Festival days: Festival Deal → Flash Deal → Combo Deal → Trending Now → categories
   ✅ Festival Deal: auto-hide after endTime (admin se set hoga)
   ✅ Recently Viewed section (Phase 4)
   ✅ Trending Now section (orderedCount DESC, top 10) — Phase 1 ke baad
      puri tarah kaam karega; abhi bhi render hoga agar orderedCount ho
   ═══════════════════════════════════════════════════════════════════ */

(function () {

  /* ─── Private state ──────────────────────────────────────── */
  let _zoneTimerEnd    = null;
  let _zoneInterval    = null;
  let _firebaseSections = null;   // null = not loaded yet

  /* ─── Section keys jo hum khud handle karte hain ─────────── */
  const SPECIAL_KEYS = ['zone', 'flashDeals', 'comboDeals', 'festivalDeal', 'trendingNow', 'recentlyViewed'];

  /* ─── Fallback sections (Firebase load fail ho toh) ──────── */
  const FALLBACK_SECTIONS = [
    { key: 'flashDeals',    title: '🔥 Flash Deals',       order: 1,  enabled: true  },
    { key: 'comboDeals',    title: '🎁 Combo Deals',        order: 2,  enabled: false },
    { key: 'trendingNow',   title: '⭐ Trending Now',       order: 3,  enabled: true  },
    { key: 'recentlyViewed',title: '🕒 Recently Viewed',   order: 4,  enabled: true  },
    { key: 'burger',        title: '🍔 Tasty Burgers',      order: 5,  enabled: true, subtitle: 'Juicy & flame-grilled'      },
    { key: 'pizza',         title: '🍕 Cheesy Pizzas',      order: 6,  enabled: true, subtitle: 'Fresh from the oven'        },
    { key: 'thali',         title: '🍛 Delicious Thalis',   order: 7,  enabled: true, subtitle: 'Complete meal, every time'  },
    { key: 'poha',          title: '🍚 Piping Hot Poha',    order: 8,  enabled: true, subtitle: 'Daily breakfast favorite'   },
    { key: 'drink',         title: '🥤 Drinks & Refreshments', order: 9,  enabled: true, subtitle: 'Chilled & refreshing'  },
    { key: 'chole-bhature', title: '🫘 Chole Bhature Specials', order: 10, enabled: true, subtitle: 'A Delhi favorite'    },
    { key: 'paratha',       title: '🫓 Stuffed Parathas',   order: 11, enabled: true, subtitle: 'Hot off the tawa'          },
    { key: 'paneer',        title: '🧀 Paneer Delights',    order: 12, enabled: true, subtitle: 'Just arrived'              },
  ];

  /* ─── Load sections from Firebase ────────────────────────── */
  // Ab config.js ka listenToHomeSections() ye karta hai (zone ki tarah)
  // Ye function sirf fallback ke liye hai agar direct call ho
  function _loadFirebaseSections() {
    if (typeof db === 'undefined') { _firebaseSections = FALLBACK_SECTIONS; return; }
    if (_firebaseSections !== null) return;
    _firebaseSections = [];

    db.collection('config').doc('homeSections').onSnapshot(snap => {
      if (snap.exists && Array.isArray(snap.data().sections) && snap.data().sections.length > 0) {
        _firebaseSections = [...snap.data().sections].sort((a, b) => (a.order || 99) - (b.order || 99));
      } else {
        _firebaseSections = FALLBACK_SECTIONS;
      }
      if (typeof currentTopCat !== 'undefined' && currentTopCat === 'all') {
        window.renderHomeSections();
      }
    }, () => { _firebaseSections = FALLBACK_SECTIONS; });
  }

  /* ─── config.js ke liye Public hooks (zone pattern) ──────── */

  // config.js se sections inject karo (onSnapshot callback se)
  window._hsSetSections = function(sections) {
    _firebaseSections = sections || FALLBACK_SECTIONS;
  };

  // Festival deal auto-expire — config.js har snapshot pe call karta hai
  window._hsFestivalExpireCheck = function() {
    if (!_firebaseSections) return;
    const fest = _firebaseSections.find(s => s.key === 'festivalDeal');
    if (!fest || fest.enabled === false) return;
    const end = fest.endTime
      ? (fest.endTime.toDate ? fest.endTime.toDate() : new Date(fest.endTime))
      : null;
    // End time aa gayi — section hide karo bina admin ke
    if (end && new Date() > end) {
      const el = document.getElementById('hs-sec-festivaldeal');
      if (el) el.style.display = 'none';
    }
  };

  /* ═══════════════════════════════════════════════════════════
     FESTIVAL DEAL — active hai ya nahi check karo
     Firebase config/homeSections mein festivalDeal object:
     { key:'festivalDeal', enabled:true, title:'🎉 Holi Dhamaka',
       startTime: Timestamp, endTime: Timestamp }
     ═══════════════════════════════════════════════════════════ */
  function _isFestivalActive(sec) {
    if (!sec || sec.enabled === false) return false;
    const now = new Date();
    const start = sec.startTime
      ? (sec.startTime.toDate ? sec.startTime.toDate() : new Date(sec.startTime))
      : null;
    const end = sec.endTime
      ? (sec.endTime.toDate ? sec.endTime.toDate() : new Date(sec.endTime))
      : null;
    if (start && now < start) return false;   // abhi start nahi hua
    if (end   && now > end)   return false;   // khatam ho gaya
    return true;
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API — renderHomeSections
     ═══════════════════════════════════════════════════════════ */
  window.renderHomeSections = function () {
    const container = document.getElementById('home-sections');
    if (!container) return;

    // Sections abhi load nahi hue → fallback use karo, config.js baad mein inject karega
    if (_firebaseSections === null) _firebaseSections = FALLBACK_SECTIONS;

    const sections = (_firebaseSections && _firebaseSections.length > 0)
      ? _firebaseSections : FALLBACK_SECTIONS;

    const allItems = Array.isArray(items) ? items : [];
    let html = '';

    /* ── Festival Deal check (agar active hai toh SABSE PEHLE) ── */
    const festSec = sections.find(s => s.key === 'festivalDeal');
    const festActive = _isFestivalActive(festSec);

    if (festActive) {
      const festItems = allItems.filter(p => p.isFestivalDeal && !p.outOfStock);
      if (festItems.length > 0) {
        html += _buildSection({
          id: 'festivaldeal',
          title: festSec.title || '🎉 Festival Deal',
          subtitle: festSec.subtitle || '',
          cat: null,
          items: festItems
        });
      }
    }

    /* ── Baaki sections order se ── */
    for (const sec of sections) {
      if (sec.enabled === false) continue;
      if (sec.key === 'zone') continue;               // ✅ Zone home pe nahi dikhega
      if (sec.key === 'festivalDeal') continue;       // Already handled above

      /* Flash Deals */
      if (sec.key === 'flashDeals') {
        const flashItems = allItems.filter(p => p.isFlashDeal && !p.zone && !p.outOfStock);
        if (flashItems.length > 0) {
          html += _buildSection({
            id: 'flashdeals',
            title: sec.title || '🔥 Flash Deals',
            subtitle: sec.subtitle || 'Today only!',
            cat: null,
            items: flashItems,
            showTimer: sec.showTimer,
            timerEnd: sec.timerEnd
          });
        }
        continue;
      }

      /* Combo Deals */
      if (sec.key === 'comboDeals') {
        const comboItems = allItems.filter(p => p.isCombo && !p.zone && !p.outOfStock);
        if (comboItems.length > 0) {
          html += _buildSection({
            id: 'combodeals',
            title: sec.title || '🎁 Combo Deals',
            subtitle: sec.subtitle || 'Best value bundles',
            cat: null,
            items: comboItems
          });
        }
        continue;
      }

      /* Trending Now */
      if (sec.key === 'trendingNow') {
        html += _buildTrendingSection(allItems, sec);
        continue;
      }

      /* Recently Viewed */
      if (sec.key === 'recentlyViewed') {
        html += _buildRecentlyViewedSection(allItems);
        continue;
      }

      /* Regular category sections */
      const catItems = allItems.filter(p =>
        (p.top === sec.key || p.category === sec.key)
        && !p.zone && !p.isFlashDeal && !p.isCombo && !p.isFestivalDeal
        && !p.outOfStock
      );
      const oosItems = allItems.filter(p =>
        (p.top === sec.key || p.category === sec.key)
        && !p.zone && !p.isFlashDeal && !p.isCombo && !p.isFestivalDeal
        && p.outOfStock
      );
      const combined = [...catItems, ...oosItems];
      if (combined.length > 0) {
        html += _buildSection({
          id: sec.key,
          title: sec.title,
          subtitle: sec.subtitle || '',
          cat: sec.key,
          items: combined
        });
      }
    }

    if (!html) {
      html = '<p style="text-align:center;padding:40px;color:var(--tmut)">Products load ho rahe hain…</p>';
    }

    container.innerHTML = html;
    _startZoneTimer();
  };

  /* ─── Trending Now Section ───────────────────────────────── */
  function _buildTrendingSection(allItems, sec) {
    /* orderedCount DESC sort → top 10, zone/OOS nahi */
    const trending = allItems
      .filter(p => !p.zone && !p.outOfStock && (p.orderedCount || 0) >= 0)
      .sort((a, b) => (b.orderedCount || 0) - (a.orderedCount || 0))
      .slice(0, 10);

    if (!trending.length) return '';
    return _buildSection({
      id: 'trendingnow',
      title: sec.title || '⭐ Trending Now',
      subtitle: sec.subtitle || 'Most ordered by customers',
      cat: null,
      items: trending
    });
  }

  /* ─── Recently Viewed Section ───────────────────────────── */
  function _buildRecentlyViewedSection(allItems) {
    const recentNames = RecentlyViewed.get();
    if (recentNames.length < 3) return '';   // 3 se kam ho toh section mat dikhao

    /* Name ke order mein, sirf whi jo abhi bhi available hain */
    const recentItems = recentNames
      .map(name => allItems.find(p => p.name === name))
      .filter(Boolean);

    if (recentItems.length < 3) return '';

    return _buildSection({
      id: 'recentlyviewed',
      title: '🕒 Recently Viewed',
      subtitle: '',
      cat: null,
      items: recentItems
    });
  }

  /* ─── Generic Section Builder ───────────────────────────── */
  function _buildSection({ id, title, subtitle, cat, items: sItems }) {
    const cards = sItems.slice(0, 10).map(_buildCard).join('');
    const viewAllBtn = cat
      ? '<button class="hs-view-all-btn" onclick="hsViewAll(\'' + cat + '\')">View All</button>'
      : '';
    return `<div class="hs-section" id="hs-sec-${id}">
      <div class="hs-section-head">
        <span class="hs-section-title">${title}</span>
        ${viewAllBtn}
      </div>
      ${subtitle ? '<p class="hs-section-sub">' + subtitle + '</p>' : ''}
      <div class="hs-scroll-row">${cards}</div>
    </div>`;
  }

  /* ─── Card Builder ──────────────────────────────────────── */
  function _buildCard(item) {
    const inCart  = (cart && cart[item.name]) ? cart[item.name].qty : 0;
    const wished  = wishlist && wishlist.has && wishlist.has(item.name);
    const price   = item.price || 0;
    const mrp     = item.mrp   || 0;
    const discPct = (mrp > price && price > 0) ? Math.round((1 - price / mrp) * 100) : 0;
    const isOOS   = item.outOfStock;

    // card-id same format as products.js buildCard — so updateProductCard() & _updateWishCardUI() work
    const id = 'c' + item.name.replace(/[^a-zA-Z0-9]/g, '');

    const imgUrl = (Array.isArray(item.images) && item.images[0])
      ? item.images[0]
      : (item.image || '');

    const safeName     = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeNameAttr = item.name.replace(/"/g, '&quot;');

    return `<div class="hs-card${isOOS ? ' hs-oos' : ''}" id="card-${id}" data-hs-product="${safeNameAttr}" onclick="openProductDetail('${safeName}')">
      ${discPct > 0 ? '<span class="hs-disc-badge">' + discPct + '% OFF</span>' : ''}
      <button class="hs-wish-btn wish-btn${wished ? ' wished' : ''}" onclick="event.stopPropagation();toggleWish('${safeName}',event)" aria-label="Save to wishlist">
        <svg viewBox="-0.065 -0.065 2 2" class="bookmark-icon" aria-hidden="true">
          <path d="m1.4804166666666665 1.63625 -0.5454166666666667 -0.3895833333333333 -0.5454166666666667 0.3895833333333333V0.3895833333333333a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 -0.15583333333333332h0.7791666666666666a0.15583333333333332 0.15583333333333332 0 0 1 0.15583333333333332 0.15583333333333332z"/>
        </svg>
      </button>
      ${isOOS ? '<span class="hs-oos-badge">Out of Stock</span>' : ''}
      <div class="hs-card-img-wrap">
        ${imgUrl
          ? '<img src="' + imgUrl + '" alt="' + item.name + '" class="hs-card-img" loading="lazy" onerror="this.src=\'../assets/products/default.webp\'">'
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:36px">🥦</div>'
        }
      </div>
      <div class="hs-card-info">
        <p class="hs-card-name">${item.name}</p>
        <p class="hs-card-weight">${item.weight || ''}</p>
        ${typeof getLastOrderedBadgeHTML === 'function' ? getLastOrderedBadgeHTML(item.name) : ''}
        <div class="hs-card-price-row">
          <span class="hs-card-price">₹${price}</span>
          ${mrp > price ? '<span class="hs-card-mrp">₹' + mrp + '</span>' : ''}
        </div>
        <div class="hs-card-actions">
          <div id="ctrl-${id}">${isOOS ? '<button class="hs-add-btn" disabled style="opacity:.5;cursor:default">Out of Stock</button>' : _actionsHTML(item, inCart)}</div>
        </div>
      </div>
    </div>`;
  }

  /* _actionsHTML — products.js ke buildCard() jaisa SAME pattern:
     direct onclick="changeQty(...)" — no data-attributes / no event-delegation
     (delegation `.hs-card-actions` ke stopPropagation se block ho jaata tha) */
  function _actionsHTML(item, inCart) {
    const safeName = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const price = item.price;
    const mrp   = item.mrp || item.price;
    if (inCart > 0) {
      return '<div class="hs-qty-ctrl">'
        + '<button class="hs-qty-btn" onclick="event.stopPropagation();changeQty(\'' + safeName + '\',' + price + ',' + mrp + ',-1)">−</button>'
        + '<span class="hs-qty-num">' + inCart + '</span>'
        + '<button class="hs-qty-btn" onclick="event.stopPropagation();changeQty(\'' + safeName + '\',' + price + ',' + mrp + ',1)">+</button>'
        + '</div>';
    }
    return '<button class="hs-add-btn" onclick="event.stopPropagation();changeQty(\'' + safeName + '\',' + price + ',' + mrp + ',1)">+ Add</button>';
  }

  /* ─── View All ──────────────────────────────────────────── */
  window.hsViewAll = function (cat) {
    const btn = document.querySelector('.top-cat-btn[data-cat="' + cat + '"]');
    if (btn && window.switchTopCat) switchTopCat(cat, btn);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ─── Zone Countdown Timer ──────────────────────────────── */
  window.setZoneTimerEnd = function (ts) {
    if (!ts) { _zoneTimerEnd = null; return; }
    _zoneTimerEnd = ts.toDate ? ts.toDate() : new Date(ts);
    if (document.getElementById('hs-zone-countdown')) _startZoneTimer();
  };

  function _startZoneTimer() {
    if (_zoneInterval) clearInterval(_zoneInterval);
    const el = document.getElementById('hs-zone-countdown');
    if (!el) return;
    if (!_zoneTimerEnd) { el.textContent = '--:--:--'; return; }
    function tick() {
      const diff = _zoneTimerEnd - Date.now();
      if (diff <= 0) { el.textContent = '00:00:00'; clearInterval(_zoneInterval); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }
    tick();
    _zoneInterval = setInterval(tick, 1000);
  }

  /* ─── updateHSCard (cart update ke liye) ───────────────── */
  window.updateHSCard = function (name) {
    const item = (items || []).find(i => i.name === name);
    if (!item) return;
    const inCart = (cart && cart[name]) ? cart[name].qty : 0;
    const html = item.outOfStock
      ? '<button class="hs-add-btn" disabled style="opacity:.5;cursor:default">Out of Stock</button>'
      : _actionsHTML(item, inCart);
    document.querySelectorAll('.hs-card[data-hs-product="' + CSS.escape(name) + '"] .hs-card-actions')
      .forEach(el => { el.innerHTML = html; });
  };

// ✅ Buy Again cards bhi update karo
if (typeof window.updateBuyAgainCard === 'function') {
  window.updateBuyAgainCard(name);
}
  /* ─── renderZoneFlash — other tabs pe sirf flash strip ─── */
  /* Zone band, sirf flash deal strip dikhao (agar enabled hai) */
  window.renderZoneFlash = function () {
    const container = document.getElementById('home-sections');
    if (!container) return;

    const allItems = Array.isArray(items) ? items : [];
    const flashItems = allItems.filter(p => p.isFlashDeal && !p.zone && !p.outOfStock);

    if (!flashItems.length) {
      container.innerHTML = '';
      return;
    }

    const html = _buildSection({
      id: 'flashdeals',
      title: '🔥 Flash Deals',
      subtitle: 'Today only!',
      cat: null,
      items: flashItems
    });

    container.innerHTML = html;
  };

  /* ─── Init ──────────────────────────────────────────────── */
  // Note: Firebase loading ab config.js ka listenToHomeSections() karta hai
  // Fallback: agar sections abhi load nahi hue toh renderHomeSections() khud load karega
})();