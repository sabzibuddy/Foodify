/* ════════════════════════════════════════
   ui/i18n.js
   Translations + language switcher.
   Depends on: core/storage.js, ui/toast.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   TRANSLATIONS
════════════════════════════════════════ */
const TRANSLATIONS = {
  en: {
    searchPlaceholder:  'Search for "Bhindi"',
    deliverTo:          'Deliver to',
    orderTitle:         '📦 Place Your Order',
    orderSub:           'Fill in your details',
    namePlaceholder:    'Enter Your Full Name',
    phonePlaceholder:   '9800012345',
    addressPlaceholder: 'House no., Gali, Colony, City...',
    couponPlaceholder:  'Enter Coupon Code',
    orderBtn:           '🛒 Place Order',
    nameLabel:          'Your Name',
    phoneLabel:         'Mobile Number',
    addressLabel:       'Delivery Address',
    locationLabel:      'Delivery Location',
    slotLabel:          'Select Delivery Slot',
    couponLabel:        'Coupon Code',
    proceedBtn:         'Proceed to Order →',
    totalLabel:         'Total Amount',
    selectLocation:     'Select Location on Map',
    selectLocationSub:  'Tap to open map & pin your exact address',
  },
  hi: {
    searchPlaceholder:  '"भिंडी" खोजें',
    deliverTo:          'यहाँ डिलीवर करें',
    orderTitle:         '📦 अपना ऑर्डर दें',
    orderSub:           'अपनी जानकारी भरें, हम WhatsApp पर कन्फर्म करेंगे',
    namePlaceholder:    'रमेश कुमार',
    phonePlaceholder:   '9800012345',
    addressPlaceholder: 'मकान नं., गली, कॉलोनी, शहर...',
    couponPlaceholder:  'कूपन कोड डालें',
    orderBtn:           '🛒 ऑर्डर दें',
    nameLabel:          'आपका नाम',
    phoneLabel:         'मोबाइल नंबर',
    addressLabel:       'डिलीवरी पता',
    locationLabel:      'डिलीवरी लोकेशन',
    slotLabel:          'डिलीवरी स्लॉट चुनें',
    couponLabel:        'कूपन कोड',
    proceedBtn:         'ऑर्डर की तरफ जाएं →',
    totalLabel:         'कुल राशि',
    selectLocation:     'मैप पर लोकेशन चुनें',
    selectLocationSub:  'मैप खोलें और अपना पता पिन करें',
  },
};

/* ── Active language (state) ──────────── */
let currentLang = Storage.getLang();

/* ════════════════════════════════════════
   APPLY LANGUAGE
════════════════════════════════════════ */

/**
 * Language apply karo — placeholders, buttons, labels update karo
 * @param {'en'|'hi'} lang
 */
function applyLanguage(lang) {
  const t     = TRANSLATIONS[lang];
  if (!t) return;

  currentLang = lang;
  Storage.setLang(lang);

  // Lang badge update
  const badge = document.getElementById('current-lang-badge');
  if (badge) badge.textContent = lang === 'hi' ? 'हिं' : 'EN';

  // Active check toggle
  document.getElementById('lang-en-check')?.classList.toggle('hidden', lang !== 'en');
  document.getElementById('lang-hi-check')?.classList.toggle('hidden', lang !== 'hi');

  // Form placeholders
  _setAttr('search',       'placeholder', t.searchPlaceholder);
  _setAttr('name',         'placeholder', t.namePlaceholder);
  _setAttr('phone',        'placeholder', t.phonePlaceholder);
  _setAttr('address',      'placeholder', t.addressPlaceholder);
  _setAttr('coupon-input', 'placeholder', t.couponPlaceholder);

  // Location picker (sirf agar still default text hai)
  const lpbTitle = document.getElementById('lpb-title');
  const lpbSub   = document.getElementById('lpb-sub');
  if (lpbTitle && _isDefaultLocText(lpbTitle.textContent))
    lpbTitle.textContent = t.selectLocation;
  if (lpbSub && _isDefaultLocText(lpbSub.textContent))
    lpbSub.textContent = t.selectLocationSub;

  // Order button (sirf agar active state mein hai)
  const orderBtn = document.getElementById('order-btn');
  if (orderBtn && !orderBtn.disabled) orderBtn.innerHTML = t.orderBtn;

  // Cart total label
  const cartTotalLabel = document.querySelector('.cart-total-label');
  if (cartTotalLabel) cartTotalLabel.textContent = t.totalLabel;
}

/* ════════════════════════════════════════
   LANGUAGE PICKER
════════════════════════════════════════ */

/** Language set karo + picker close + toast */
function setLanguage(lang) {
  applyLanguage(lang);
  closeLanguagePicker();
  showToast(
    lang === 'hi' ? '🇮🇳 हिंदी भाषा चुनी गई!' : '🇬🇧 English selected!',
    'success'
  );
}

function openLanguagePicker() {
  document.getElementById('lang-overlay')?.classList.add('open');
}

function closeLanguagePicker() {
  document.getElementById('lang-overlay')?.classList.remove('open');
}

/* ── Private helpers ──────────────────── */
function _setAttr(id, attr, val) {
  const el = document.getElementById(id);
  if (el) el[attr] = val;
}

const _DEFAULT_LOC_TEXTS = [
  'Select Location on Map', 'Tap to open map & pin your exact address',
  'मैप पर लोकेशन चुनें',  'मैप खोलें और अपना पता पिन करें',
];
function _isDefaultLocText(text) {
  return _DEFAULT_LOC_TEXTS.some(d => text.trim() === d);
}
