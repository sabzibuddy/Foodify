/* ════════════════════════════════════════
   modules/share.js
   Share website + About Us + Suggest a Product.
   Depends on: core/state.js, core/error.js, ui/toast.js
════════════════════════════════════════ */

/* ── Sheet overlay base styles ────────── */
const _SHEET_OVERLAY_CSS = [
  'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.5)',
  'z-index:800', 'display:flex', 'align-items:flex-end', 'justify-content:center',
].join(';');

const _SHEET_INNER_CSS = [
  'background:#fff', 'border-radius:20px 20px 0 0', 'width:100%',
  'max-width:500px', 'padding:24px 20px 36px', 'animation:slideUp 0.3s ease',
].join(';');

/* ════════════════════════════════════════
   SHARE WEBSITE
════════════════════════════════════════ */
function shareWebsite() {
  const url  = window.location.href;
  const text = '🥦 SabziBuddy — Fresh Produce, Delivered Fast!\nFresh veggies delivered to your door in Firozabad. Check it out:';

  if (navigator.share) {
    navigator.share({ title: 'SabziBuddy', text, url }).catch(() => {});
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied! Share it 🔗', 'success'))
      .catch(() => showToast(`Link: ${url}`));
  } else {
    showToast(`Link: ${url}`);
  }
}

/* ════════════════════════════════════════
   ABOUT US BOTTOM SHEET
════════════════════════════════════════ */
function openAboutUs() {
  document.getElementById('about-us-sheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id         = 'about-us-sheet';
  sheet.style.cssText = _SHEET_OVERLAY_CSS;
  sheet.innerHTML  = `
    <div style="${_SHEET_INNER_CSS};max-height:80vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:var(--g2);">
          🌿 About SabziBuddy
        </div>
        <button onclick="closeAboutUs()"
          style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--tmut);">✕</button>
      </div>
      <img src="../SabziBuddy.svg" style="height:56px;width:auto;margin-bottom:14px;" onerror="this.style.display='none'">
      <p style="font-size:14px;color:var(--tm);line-height:1.8;margin-bottom:10px;">
        <b style="color:var(--g2);">SabziBuddy</b> is your local fresh produce delivery platform in Firozabad.
        Hum seedha kisan se taazi sabzi aur grocery aapke ghar tak pahunchate hain — fast, fresh aur affordable.
      </p>
      <p style="font-size:13px;color:var(--tmut);line-height:1.7;margin-bottom:16px;">
        🌱 Farm se ghar tak ki hamari commitment hai ki aapko hamesha taaza aur quality products milein, without stepping out of your home.
      </p>
      <div style="background:var(--cream);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--g2);margin-bottom:6px;">📞 Contact Us</div>
        <div style="font-size:13px;color:var(--tm);">Phone: +91 7900684615</div>
        <div style="font-size:13px;color:var(--tm);">Email: support.sabzibuddy@gmail.com</div>
        <div style="font-size:13px;color:var(--tm);">City: Firozabad, Uttar Pradesh</div>
      </div>
      <button onclick="closeAboutUs()"
        style="width:100%;padding:13px;background:var(--g2);color:#fff;border:none;border-radius:10px;
          font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Close</button>
    </div>`;

  sheet.addEventListener('click', e => { if (e.target === sheet) closeAboutUs(); });
  document.body.appendChild(sheet);
}

function closeAboutUs() {
  document.getElementById('about-us-sheet')?.remove();
}

/* ════════════════════════════════════════
   SUGGEST A PRODUCT BOTTOM SHEET
════════════════════════════════════════ */
function openSuggestProduct() {
  document.getElementById('suggest-sheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id         = 'suggest-sheet';
  sheet.style.cssText = _SHEET_OVERLAY_CSS;
  sheet.innerHTML  = `
    <div style="${_SHEET_INNER_CSS}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:var(--g2);">
          💡 Suggest a Product
        </div>
        <button onclick="closeSuggestSheet()"
          style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--tmut);">✕</button>
      </div>
      <p style="font-size:13px;color:var(--tmut);margin-bottom:14px;line-height:1.6;">
        Can't find a product? Let us know and we'll try to add it! 🌿
      </p>
      <input type="text" id="suggest-input"
        placeholder="e.g. Arbi, Baby Corn, Amla..." maxlength="80"
        style="width:100%;padding:12px 14px;background:var(--cream);border:1.5px solid var(--cream2);
          border-radius:10px;font-family:'Outfit',sans-serif;font-size:14px;color:var(--td);
          outline:none;margin-bottom:10px;box-sizing:border-box;"
        onfocus="this.style.borderColor='var(--g4)'" onblur="this.style.borderColor='var(--cream2)'">
      <textarea id="suggest-note"
        placeholder="Any extra details? (Optional)" rows="3" maxlength="200"
        style="width:100%;padding:12px 14px;background:var(--cream);border:1.5px solid var(--cream2);
          border-radius:10px;font-family:'Outfit',sans-serif;font-size:13px;color:var(--td);
          outline:none;resize:none;margin-bottom:14px;box-sizing:border-box;"
        onfocus="this.style.borderColor='var(--g4)'" onblur="this.style.borderColor='var(--cream2)'"></textarea>
      <button onclick="submitSuggestion()"
        style="width:100%;padding:13px;background:var(--g2);color:#fff;border:none;border-radius:10px;
          font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">
        📨 Submit Suggestion
      </button>
    </div>`;

  sheet.addEventListener('click', e => { if (e.target === sheet) closeSuggestSheet(); });
  document.body.appendChild(sheet);
}

function closeSuggestSheet() {
  document.getElementById('suggest-sheet')?.remove();
}

async function submitSuggestion() {
  const product = document.getElementById('suggest-input')?.value.trim() || '';
  const note    = document.getElementById('suggest-note')?.value.trim()  || '';

  if (!product) { showToast('Please enter a product name', 'error'); return; }

  const phone = currentUser?.phone || document.getElementById('phone')?.value.trim() || '';
  const name  = currentUser?.name  || document.getElementById('name')?.value.trim()  || '';

  const saved = await safeAsync(() =>
    db.collection('suggestions').add({
      product, note, phone, name,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }),
    ERR.FIREBASE, true
  );

  if (saved) {
    closeSuggestSheet();
    showToast('✅ Suggestion sent! Thank you 🙏', 'success');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
  } else {
    showToast('Could not send suggestion. Please try again.', 'error');
  }
}
