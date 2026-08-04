/* ════════════════════════════════════════
   ui/validation.js
   DOM-level form validation + input sanitizers.
   Pure logic → core/validators.js
   Depends on: core/validators.js, ui/toast.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   FIELD ERROR SHOW / HIDE
════════════════════════════════════════ */

/**
 * Field pe red border + error message dikhao
 * @param {string} id   - input element id
 * @param {string} msg  - error message
 */
function showFieldError(id, msg) {
  const inp = document.getElementById(id);
  const err = document.getElementById(id + '-error');
  if (inp) { inp.classList.add('error'); inp.focus(); }
  if (err) { err.textContent = msg; err.style.display = 'block'; }

  // Auto-clear after 3.5s
  setTimeout(() => clearFieldError(id), 3500);
}

/**
 * Field error clear karo
 * @param {string} id
 */
function clearFieldError(id) {
  const inp = document.getElementById(id);
  const err = document.getElementById(id + '-error');
  if (inp) inp.classList.remove('error');
  if (err) err.style.display = 'none';
}

/**
 * Multiple fields ke errors ek saath clear karo
 * @param {string[]} ids
 */
function clearAllFieldErrors(ids = []) {
  ids.forEach(id => clearFieldError(id));
}

/* ════════════════════════════════════════
   INPUT SANITIZERS (oninput handlers)
   These sanitize as user types — not full validation
════════════════════════════════════════ */

/** Name input — sirf letters + Hindi + spaces */
function validateName(i) {
  i.value = i.value.replace(/[^a-zA-Z\u0900-\u097F\s.]/g, '');
  clearFieldError('name');
}

/** Phone input — sirf digits, max 10 */
function validatePhone(i) {
  i.value = i.value.replace(/\D/g, '').slice(0, 10);
  clearFieldError('phone');
}

/* ════════════════════════════════════════
   FORM VALIDATION (checkout form ke liye)
   Returns true agar valid, false agar errors hain
════════════════════════════════════════ */
function validateOrderForm() {
  let valid = true;

  const name  = document.getElementById('name')?.value?.trim()  || '';
  const phone = document.getElementById('phone')?.value?.trim() || '';
  const addr  = document.getElementById('address')?.value?.trim() || '';

  // Name
  const nameErr = Validators.name(name);
  if (nameErr) { showFieldError('name', nameErr); valid = false; }

  // Phone
  const phoneErr = Validators.phone(phone);
  if (phoneErr) { showFieldError('phone', phoneErr); valid = false; }

  // Address
  const addrErr = Validators.address(addr);
  if (addrErr) { showFieldError('address', addrErr); valid = false; }

  return valid;
}

/* ════════════════════════════════════════
   HEADER DISPLAY HELPERS
════════════════════════════════════════ */

/** Header mein delivery address dikhao */
function setDlrAddr(text) {
  const el = document.getElementById('dlr-addr-text');
  if (el) el.textContent = text;
}

/** Header mein city dikhao */
function setDlrCity(city) {
  const el = document.getElementById('dlr-city');
  if (el) el.textContent = city || 'Firozabad';
}
