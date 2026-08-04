/* ════════════════════════════════════════
   core/validators.js
   Pure validation functions — no DOM, no Firebase.
════════════════════════════════════════ */

const Validators = {

  /** Indian mobile number (10 digit, starts 6-9) */
  phone(val) {
    const cleaned = String(val || '').replace(/\D/g, '');
    if (cleaned.length !== 10)        return 'Phone number must be 10 digits';
    if (!/^[6-9]/.test(cleaned))      return 'Valid Indian mobile number dalo';
    return null; // null = valid
  },

  /** Name (letters + Hindi, 2–50 chars) */
  name(val) {
    const s = String(val || '').trim();
    if (!s)                            return 'Naam zaroori hai';
    if (s.length < 2)                  return 'Naam bahut chhota hai';
    if (s.length > 50)                 return 'Naam bahut lamba hai';
    if (!/^[\u0900-\u097Fa-zA-Z\s]+$/.test(s))
                                       return 'Name can only contain letters';
    return null;
  },

  /** Address (min 5 chars) */
  address(val) {
    const s = String(val || '').trim();
    if (!s)         return 'Address zaroori hai';
    if (s.length < 5) return 'Thoda aur detail dalo';
    return null;
  },

  /** OTP (6 digits) */
  otp(val) {
    const s = String(val || '').trim();
    if (!s)              return 'OTP dalo';
    if (!/^\d{6}$/.test(s)) return 'OTP must be 6 digits';
    return null;
  },

  /** Pincode (6 digits) */
  pincode(val) {
    const s = String(val || '').trim();
    if (!s)                  return 'Pincode dalo';
    if (!/^\d{6}$/.test(s)) return 'Valid 6-digit pincode dalo';
    return null;
  },

  /** Required field */
  required(val, label = 'Yeh field') {
    const s = String(val || '').trim();
    if (!s) return `${label} zaroori hai`;
    return null;
  },

  /**
   * Multiple validators ek saath run karo
   * @param {any} val
   * @param {Function[]} fns  - validator functions
   * @returns {string|null}   - pehla error ya null
   */
  run(val, fns = []) {
    for (const fn of fns) {
      const err = fn(val);
      if (err) return err;
    }
    return null;
  },
};
