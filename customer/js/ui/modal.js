/* ════════════════════════════════════════
   ui/modal.js
   Generic modal manager + legal modals.
   Depends on: handlers/backhandler.js (navPush/navPop)
════════════════════════════════════════ */

/* ════════════════════════════════════════
   GENERIC MODAL HELPERS
════════════════════════════════════════ */

/**
 * Koi bhi overlay open karo (class-based)
 * @param {string} overlayId  - element id
 * @param {string} cls        - class to add (default 'open')
 */
function openModal(overlayId, cls = 'open') {
  const el = document.getElementById(overlayId);
  if (!el) return;
  el.classList.add(cls);
  document.body.style.overflow = 'hidden';    // background scroll band
}

/**
 * Koi bhi overlay close karo
 * @param {string} overlayId
 * @param {string} cls
 */
function closeModal(overlayId, cls = 'open') {
  const el = document.getElementById(overlayId);
  if (!el) return;
  el.classList.remove(cls);
  document.body.style.overflow = '';
}

/**
 * Outside click pe close karo
 * @param {string} overlayId  - backdrop id
 * @param {string} panelSel   - inner panel selector (jo click handle kare)
 * @param {Function} closeFn
 */
function bindOutsideClose(overlayId, panelSel, closeFn) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.addEventListener('click', e => {
    if (!e.target.closest(panelSel)) closeFn();
  });
}

/* ════════════════════════════════════════
   BOTTOM SHEET FACTORY
   Dynamic sheet banao + destroy karo
════════════════════════════════════════ */

/**
 * Generic bottom sheet banao
 * @param {Object} opts
 * @param {string} opts.id        - sheet id
 * @param {string} opts.title     - header title
 * @param {string} opts.bodyHTML  - inner content HTML
 * @param {string} [opts.size]    - '' | 'sm' | 'lg'
 * @returns {{ close: Function }}
 */
function createBottomSheet({ id, title, bodyHTML, size = '' }) {
  // Pehle se hai toh remove karo
  document.getElementById(id)?.remove();

  const overlay = document.createElement('div');
  overlay.id        = id;
  overlay.className = 'legal-overlay';
  overlay.innerHTML = `
    <div class="legal-sheet${size ? ' legal-sheet--' + size : ''}">
      <div class="legal-header">
        <span>${title}</span>
        <button class="close-btn" onclick="_closeSheet('${id}')">✕</button>
      </div>
      <div class="legal-body">${bodyHTML}</div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  document.body.style.overflow = 'hidden';

  // Outside click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) _closeSheet(id);
  });

  return { close: () => _closeSheet(id) };
}

function _closeSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el.remove(), 300);
}

/* ════════════════════════════════════════
   LOADING MODAL
════════════════════════════════════════ */

function showModalLoading(msg = 'Loading...') {
  let el = document.getElementById('_modal-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = '_modal-loading';
    el.className = 'modal-loading';
    el.innerHTML = `<div class="modal-spinner"></div><p>${msg}</p>`;
    document.body.appendChild(el);
  }
  el.querySelector('p').textContent = msg;
  el.style.display = 'flex';
}

function hideModalLoading() {
  const el = document.getElementById('_modal-loading');
  if (el) el.style.display = 'none';
}

/* ════════════════════════════════════════
   LEGAL MODALS (Privacy + Terms)
════════════════════════════════════════ */
function openPrivacy()  { openModal('privacy-overlay'); }
function closePrivacy() { closeModal('privacy-overlay'); }
function openTerms()    { openModal('terms-overlay'); }
function closeTerms()   { closeModal('terms-overlay'); }
