/* ════════════════════════════════════════
   modules/search.js
   Search input, suggestions dropdown, voice search.
   Depends on: core/state.js, core/utils.js,
               ui/toast.js, modules/products.js
════════════════════════════════════════ */

/* ── Typewriter placeholder words ─────── */
const SEARCH_PLACEHOLDERS = [
  'Aloo','Bhindi','Tomato','Capsicum','Mushroom',
  'Spinach','Coriander','Carrot','Lauki','Milk','Paneer',
];

/* ── Search debounce timer ────────────── */
let _searchTimer = null;

/* ── Touch flag (mobile suggestion tap) ─ */
let _suggTouching = false;

/* ════════════════════════════════════════
   TYPEWRITER PLACEHOLDER
════════════════════════════════════════ */
function initSearchTypewriter() {
  let idx = 0, charIdx = 0, deleting = false;
  const input = document.getElementById('search');
  if (!input) return;

  function tick() {
    if (document.activeElement === input) { setTimeout(tick, 300); return; }
    const word = SEARCH_PLACEHOLDERS[idx];
    if (!deleting) {
      charIdx++;
      input.placeholder = `Search for "${word.slice(0, charIdx)}"`;
      if (charIdx >= word.length) { deleting = true; setTimeout(tick, 1600); return; }
      setTimeout(tick, 90);
    } else {
      charIdx--;
      if (charIdx <= 0) {
        deleting = false;
        idx = (idx + 1) % SEARCH_PLACEHOLDERS.length;
        setTimeout(tick, 350); return;
      }
      input.placeholder = `Search for "${word.slice(0, charIdx)}"`;
      setTimeout(tick, 45);
    }
  }
  setTimeout(tick, 1500);
}

/* ════════════════════════════════════════
   SEARCH INPUT HANDLER
════════════════════════════════════════ */
function onSearchInput(val) {
  updateSearchClearButton(val);
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    const v = val.trim();
    if (v) showSearchSuggestions(v);
    else   { hideSearchSuggestions(); _resetProductView(); }
  }, SEARCH_DEBOUNCE);   // constants.js
}

function clearSearchInput() {
  const input = document.getElementById('search');
  if (!input) return;
  input.value = '';
  updateSearchClearButton('');
  hideSearchSuggestions();
  _resetProductView();
  input.focus();
}

function updateSearchClearButton(val) {
  const btn = document.getElementById('clear-search-btn');
  if (btn) btn.classList.toggle('visible', !!(val && val.trim()));
}

/* ════════════════════════════════════════
   FUZZY MATCH + NORMALIZE
   ✅ v3 UPDATE: searchTerms[] (AI-generated)
      ab bhi match hote hain.
      "tamatar" type karo → Tomato milega
      "टमाटर" type karo → Tomato milega
      "tamoto" (misspell) → Tomato milega
   Note: AI sirf admin save pe chalta hai.
         Yahan sirf pehle se saved terms use hote hain.
════════════════════════════════════════ */
function fuzzyMatch(q, item) {
  if (!q.trim()) return true;
  const nq = normalize(q.trim());   // utils.js

  /* Base targets: naam + hindi */
  const targets = [
    item.name.toLowerCase(),
    item.hindi || '',
    normalize(item.name),
  ];

  /* ✅ AI-generated searchTerms bhi add karo */
  if (Array.isArray(item.searchTerms)) {
    item.searchTerms.forEach(function (term) {
      if (term) targets.push(String(term).toLowerCase());
    });
  }

  return targets.some(function (t) {
    return normalize(t).includes(nq) || t.toLowerCase().includes(q.toLowerCase());
  });
}

/* ════════════════════════════════════════
   SUGGESTION STYLES (inject once)
════════════════════════════════════════ */
function _injectSuggStyles() {
  if (document.getElementById('_sb_sugg_css')) return;
  const s = document.createElement('style');
  s.id = '_sb_sugg_css';
  s.textContent = `
    .search-section { position: relative; }
    #search-suggestions {
      position: absolute; top: calc(100% - 8px);
      left: 12px; right: 12px;
      background: #fff; border-radius: 14px;
      box-shadow: 0 10px 40px rgba(28,56,41,0.18), 0 2px 8px rgba(0,0,0,0.08);
      z-index: 9999; overflow: hidden;
      border: 1.5px solid #d6eed8;
      max-height: 340px; overflow-y: auto;
      -webkit-overflow-scrolling: touch; display: none;
    }
    #search-suggestions::-webkit-scrollbar { width: 3px; }
    #search-suggestions::-webkit-scrollbar-thumb { background: #c5e8c9; border-radius: 3px; }
    .sugg-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid #f2efe8;
      cursor: pointer; transition: background 0.12s;
      -webkit-tap-highlight-color: rgba(107,191,123,0.12); user-select: none;
    }
    .sugg-row:last-child { border-bottom: none; }
    .sugg-row:hover  { background: #f3faf4; }
    .sugg-row:active { background: #e8f5ea; }
    .sugg-img-box {
      width: 44px; height: 44px; border-radius: 10px;
      overflow: hidden; background: #f5f1eb; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid #ede8df;
    }
    .sugg-img-box img { width: 44px; height: 44px; object-fit: cover; display: block; }
    .sugg-emoji-fb {
      font-size: 22px; display: flex;
      align-items: center; justify-content: center;
      width: 44px; height: 44px;
    }
    .sugg-mid { flex: 1; min-width: 0; }
    .sugg-row-name { font-size: 14px; font-weight: 700; color: #1a3326; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sugg-row-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    .sugg-hindi { font-size: 11px; color: #4A8B5C; font-weight: 600; }
    .sugg-wt { font-size: 10px; color: #888; background: #f0ece4; padding: 1px 6px; border-radius: 5px; }
    .sugg-end { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
    .sugg-price-tag { font-size: 14px; font-weight: 800; color: #2e7d32; white-space: nowrap; }
    .sugg-price-tag.oos { font-size: 11px; color: #bbb; font-weight: 600; }
    .sugg-disc { font-size: 10px; color: #d32f2f; font-weight: 700; background: #fdecea; padding: 1px 5px; border-radius: 5px; }
    .sugg-no-result { display: flex; align-items: center; gap: 10px; padding: 18px 16px; color: #888; font-size: 13px; }

    /* ── Search History ──────────────────── */
    .hist-header { display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 6px; border-bottom: 1px solid #f2efe8; }
    .hist-title { font-size: 12px; font-weight: 700; color: #4A8B5C; letter-spacing: 0.3px; }
    .hist-clear-btn { font-size: 11px; color: #d32f2f; background: #fdecea;
      border: none; border-radius: 6px; padding: 3px 8px; cursor: pointer;
      font-weight: 600; transition: background 0.12s; }
    .hist-clear-btn:hover { background: #f5c6c6; }
    .hist-row { justify-content: space-between; }
    .hist-icon { font-size: 14px; flex-shrink: 0; opacity: 0.55; }
    .hist-text { flex: 1; font-size: 13.5px; font-weight: 600; color: #1a3326;
      padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hist-del-btn { font-size: 16px; color: #bbb; background: none; border: none;
      cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
      transition: color 0.12s; }
    .hist-del-btn:hover { color: #d32f2f; }
  `;
  document.head.appendChild(s);
}
_injectSuggStyles();
document.addEventListener('DOMContentLoaded', _injectSuggStyles);

/* ════════════════════════════════════════
   SUGGESTION DROPDOWN
════════════════════════════════════════ */
function showSearchSuggestions(val) {
  const dropdown = document.getElementById('search-suggestions');
  if (!dropdown) return;
  const v = val.trim();
  if (!v) { dropdown.style.display = 'none'; return; }

  const matches = items.filter(i => fuzzyMatch(v, i)).slice(0, 7);
  dropdown.innerHTML = matches.length
    ? matches.map(_buildSuggRow).join('')
    : `<div class="sugg-no-result">
         <span style="font-size:24px">🔍</span>
         <span>"${v}" not found — try a different name</span>
       </div>`;
  dropdown.style.display = 'block';
}

function hideSearchSuggestions() {
  if (_suggTouching) return;
  setTimeout(() => {
    if (_suggTouching) return;
    const dropdown = document.getElementById('search-suggestions');
    if (dropdown) dropdown.style.display = 'none';
  }, 320);
}

/* ── Build one suggestion row ─────────── */
function _buildSuggRow(item) {
  const oos    = item.outOfStock === true;
  const disc   = (item.mrp || 0) - (item.price || 0);
  const imgSrc = item.images?.length > 0 ? item.images[0] : (item.image || '');
  const emoji  = getCatEmoji(item);   // modules/products.js
  const safe   = item.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');

  const imgInner = imgSrc
    ? `<img src="${imgSrc}" alt="${item.name}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="sugg-emoji-fb" style="display:none">${emoji}</div>`
    : `<div class="sugg-emoji-fb">${emoji}</div>`;

  return `
    <div class="sugg-row"
      ontouchstart="_suggTouch(event,'${safe}')"
      onmousedown="_suggMouseDown(event,'${safe}')">
      <div class="sugg-img-box">${imgInner}</div>
      <div class="sugg-mid">
        <div class="sugg-row-name">${item.name}</div>
        <div class="sugg-row-meta">
          ${item.hindi  ? `<span class="sugg-hindi">${item.hindi}</span>` : ''}
          ${item.weight ? `<span class="sugg-wt">${item.weight}</span>`   : ''}
        </div>
      </div>
      <div class="sugg-end">
        <span class="sugg-price-tag${oos ? ' oos' : ''}">
          ${oos ? 'Out of Stock' : '&#8377;' + item.price}
        </span>
        ${disc > 0 && !oos ? `<span class="sugg-disc">&#8377;${disc} off</span>` : ''}
      </div>
    </div>`;
}

/* ── Touch / mouse handlers ───────────── */
function _suggTouch(e, name) {
  e.preventDefault();
  _suggTouching = true;
  _applySuggestion(name);
  setTimeout(() => { _suggTouching = false; }, 400);
}

function _suggMouseDown(e, name) {
  e.preventDefault();
  _applySuggestion(name);
}

function _applySuggestion(name) {
  const input    = document.getElementById('search');
  const dropdown = document.getElementById('search-suggestions');
  if (input)    { input.value = name; updateSearchClearButton(name); }
  if (dropdown)   dropdown.style.display = 'none';
  renderSearchResults(name);
}

/* ════════════════════════════════════════
   RENDER SEARCH RESULTS (product grid)
════════════════════════════════════════ */
function renderSearchResults(query) {
  saveSearchHistory(query);    // ← user-specific history save karo
  const inStock  = items.filter(i => !i.outOfStock && fuzzyMatch(query, i));
  const outStock = items.filter(i =>  i.outOfStock && fuzzyMatch(query, i));
  const matched  = [...inStock, ...outStock];

  const titleEl = document.getElementById('section-title');
  const subEl   = document.getElementById('section-sub');
  const cntEl   = document.getElementById('section-count');
  const grid    = document.getElementById('products');

  if (titleEl) titleEl.textContent = '🔍 Search Results';
  if (subEl)   subEl.textContent   = `"${query}" — across all categories`;
  if (cntEl)   cntEl.textContent   = `(${matched.length} items)`;

  if (!grid) return;
  if (!matched.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:50px 20px;color:#888">
        <div style="font-size:44px;margin-bottom:12px">🔍</div>
        <div style="font-weight:700;font-size:16px;color:#444">"${query}" No results for</div>
        <div style="font-size:13px;margin-top:6px">Check the spelling or try a different name</div>
      </div>`;
    return;
  }
  grid.innerHTML = matched.map(buildCard).join('');
}

/* ════════════════════════════════════════
   VOICE SEARCH
════════════════════════════════════════ */
function startVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice search is not supported in this browser', 'error'); return; }

  const r   = new SR();
  r.lang    = 'hi-IN';
  r.continuous     = false;
  r.interimResults = false;
  r.maxAlternatives = 1;

  const btn = document.getElementById('voice-btn');
  r.onstart  = () => btn?.classList.add('recording');
  r.onend    = () => btn?.classList.remove('recording');
  r.onerror  = e => {
    btn?.classList.remove('recording');
    if (e.error === 'not-allowed')
      showToast('Please allow microphone permission in browser settings', 'error');
  };
  r.onresult = e => {
    const text  = e.results[0][0].transcript;
    const input = document.getElementById('search');
    if (input) input.value = text;
    updateSearchClearButton(text);
    showSearchSuggestions(text);
    renderSearchResults(text);   // saveSearchHistory already called inside
  };
  try { r.start(); } catch (_) {}
}

/* ════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════ */

/** Product view reset karo (search clear ke baad) */
function _resetProductView() {
  // BUG FIX: search.js mein random text tha "_getSectionTitle" ke andar
  // "Bas! Search karte waqt..." — delete kiya
  const titleEl = document.getElementById('section-title');
  const subEl   = document.getElementById('section-sub');
  const cntEl   = document.getElementById('section-count');

  if (titleEl) titleEl.textContent = _getSearchSectionTitle(currentTopCat);
  if (subEl)   subEl.textContent   = 'All prices per pack • Updated daily';
  if (cntEl)   cntEl.textContent   = '';

  if (typeof renderProducts === 'function') renderProducts();
}

function _getSearchSectionTitle(cat) {
  if (cat === 'zone') return `₹${ZONE_PRICE} Zone`;
  const map = {
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
  return map[cat] || 'Fresh Today';
}

/* ════════════════════════════════════════
   SEARCH HISTORY  (User-Specific)
   Key format: searchHistory_<uid>
   — Har user ki history alag alag
   — Logout pe delete NAHI hoti
   — Same user login kare toh phir dikhti hai
════════════════════════════════════════ */

/** Firebase Auth UID safely get karo */
function _getCurrentUID() {
  try {
    return (firebase.auth().currentUser && firebase.auth().currentUser.uid) || null;
  } catch (_) {
    return null;
  }
}

/** User-specific localStorage key */
function _histKey(uid) {
  return `searchHistory_${uid}`;
}

/**
 * saveSearchHistory(query)
 * — Sirf logged-in user ke liye save karo
 * — Duplicates remove (case-insensitive)
 * — Latest top pe, max MAX_SEARCH_HISTORY entries
 * — Empty / whitespace-only queries ignore
 */
function saveSearchHistory(query) {
  const uid = _getCurrentUID();
  if (!uid) return;                                // Guest — skip

  const q = (query || '').trim();
  if (!q) return;                                  // Empty query — ignore

  const key = _histKey(uid);
  let hist  = [];
  try { hist = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { hist = []; }

  // Duplicate hata do (case-insensitive)
  hist = hist.filter(h => h.toLowerCase() !== q.toLowerCase());

  // Sabse upar rakho
  hist.unshift(q);

  // Max limit
  if (hist.length > MAX_SEARCH_HISTORY) hist = hist.slice(0, MAX_SEARCH_HISTORY);

  localStorage.setItem(key, JSON.stringify(hist));
}

/**
 * loadSearchHistory()
 * — Input focus pe call hota hai
 * — Sirf tab dikhao jab input empty ho
 * — Sirf current user ki entries dikhao
 */
function loadSearchHistory() {
  const input = document.getElementById('search');
  if (!input || input.value.trim()) return;        // Kuch type kiya hai — mat dikhao

  const uid      = _getCurrentUID();
  const dropdown = document.getElementById('search-suggestions');
  if (!dropdown) return;

  if (!uid) { dropdown.style.display = 'none'; return; }

  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(_histKey(uid)) || '[]'); } catch (_) { hist = []; }

  if (!hist.length) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML =
    `<div class="hist-header">
       <span class="hist-title">🕐 Recent Searches</span>
       <button class="hist-clear-btn" onmousedown="event.preventDefault();clearSearchHistory();"
         ontouchstart="event.preventDefault();clearSearchHistory();">Clear All</button>
     </div>` +
    hist.map(h => {
      const safe = h.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `
        <div class="sugg-row hist-row"
          ontouchstart="_histTouch(event,'${safe}')"
          onmousedown="_histMouseDown(event,'${safe}')">
          <span class="hist-icon">🕐</span>
          <span class="hist-text">${h}</span>
          <button class="hist-del-btn"
            ontouchstart="event.stopPropagation();event.preventDefault();_delHistItem('${safe}');"
            onmousedown="event.stopPropagation();event.preventDefault();_delHistItem('${safe}');">×</button>
        </div>`;
    }).join('');

  dropdown.style.display = 'block';
}

/**
 * clearSearchHistory()
 * — SIRF current user ki history remove karo
 * — Doosre users ki history SAFE rehti hai
 */
function clearSearchHistory() {
  const uid = _getCurrentUID();
  if (!uid) return;
  localStorage.removeItem(_histKey(uid));
  const dropdown = document.getElementById('search-suggestions');
  if (dropdown) dropdown.style.display = 'none';
}

/** Ek item delete karo aur dropdown refresh karo */
function _delHistItem(query) {
  const uid = _getCurrentUID();
  if (!uid) return;

  const key = _histKey(uid);
  let hist  = [];
  try { hist = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { hist = []; }

  hist = hist.filter(h => h !== query);
  hist.length ? localStorage.setItem(key, JSON.stringify(hist))
              : localStorage.removeItem(key);

  loadSearchHistory();   // dropdown refresh
}

/* ── History touch / mouse handlers ─────────── */
function _histTouch(e, name) {
  e.preventDefault();
  _suggTouching = true;
  _applyHistory(name);
  setTimeout(() => { _suggTouching = false; }, 400);
}

function _histMouseDown(e, name) {
  e.preventDefault();
  _applyHistory(name);
}

function _applyHistory(name) {
  const input    = document.getElementById('search');
  const dropdown = document.getElementById('search-suggestions');
  if (input)    { input.value = name; updateSearchClearButton(name); }
  if (dropdown)   dropdown.style.display = 'none';
  renderSearchResults(name);   // saveSearchHistory bhi call hoga andar
}