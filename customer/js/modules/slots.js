/* ════════════════════════════════════════
   modules/slots.js
   Delivery slot generation, rendering, selection.
   Depends on: core/state.js, ui/toast.js, ui/validation.js
════════════════════════════════════════ */

/* ════════════════════════════════════════
   SLOT GENERATION
════════════════════════════════════════ */


// Admin-driven slot config (Firestore se override hoga)
let _slotsConfig = null;

async function loadSlotsFromFirestore() {
  try {
    const snap = await db.collection('config').doc('slots').get();
    if (snap.exists) _slotsConfig = snap.data();
  } catch(e) {}
}

/**
 * Aaj + kal ke 4 slots generate karo
 * @returns {Object[]}
 */
function getSlots() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();  // minutes since midnight

  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const fmt = d => d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  const todayLabel = `Today • ${fmt(today)}`;
  const tmrLabel   = `Tomorrow • ${fmt(tomorrow)}`;

  // Cutoff times in minutes (8:00 AM = 480, 3:00 PM = 900)
  return [
    {
      id:        'today-morning',
      day:       todayLabel,
      label:     'Morning Slot',
      time:      '10:30 AM – 12:30 PM',
      cutoff:    '8:00 AM',
      available: cur < 480,
    },
    {
      id:        'today-evening',
      day:       todayLabel,
      label:     'Evening Slot',
      time:      '5:00 PM – 8:00 PM',
      cutoff:    '3:00 PM',
      available: cur < 900,
    },
    {
      id:        'tmr-morning',
      day:       tmrLabel,
      label:     'Morning Slot',
      time:      '10:30 AM – 12:30 PM',
      cutoff:    '8:00 AM',
      available: true,
    },
    {
      id:        'tmr-evening',
      day:       tmrLabel,
      label:     'Evening Slot',
      time:      '5:00 PM – 8:00 PM',
      cutoff:    '3:00 PM',
      available: true,
    },
  ];
}

/* ════════════════════════════════════════
   RENDER SLOTS
════════════════════════════════════════ */

function renderSlots() {
  const grid = document.getElementById('slots-grid');
  if (!grid) return;

  grid.innerHTML = getSlots().map(s => {
    const isSelected  = selectedSlot === s.id;
    const cutoffLabel = s.available ? 'Order cutoff: ' : 'Cutoff missed: ';

    return `
      <button type="button"
        class="slot-card ${s.available ? '' : 'disabled'} ${isSelected ? 'selected' : ''}"
        onclick="selectSlot('${s.id}', ${s.available}, '${s.cutoff}')">
        <div class="slot-check">✓</div>
        <div class="slot-day">${s.day}</div>
        <div class="slot-label">${s.label}</div>
        <div class="slot-time">${s.time}</div>
        ${s.cutoff
          ? `<div class="slot-cutoff">${cutoffLabel}${s.cutoff}</div>`
          : ''}
      </button>`;
  }).join('');
}

/* ════════════════════════════════════════
   SELECT SLOT
════════════════════════════════════════ */

/**
 * Slot select karo
 * @param {string}  id         - slot id
 * @param {boolean} available  - slot available hai?
 * @param {string}  cutoff     - cutoff time string
 */
function selectSlot(id, available, cutoff) {
  if (!available) {
    showToast(`Slot closed! Orders are accepted only until ${cutoff}.`, 'error');
    return;
  }
  selectedSlot = id;
  clearFieldError('slot');
  renderSlots();
}

/* ── Helper: selected slot ka label return karo ── */
function getSelectedSlotLabel() {
  if (!selectedSlot) return '';
  const slot = getSlots().find(s => s.id === selectedSlot);
  return slot ? `${slot.day} • ${slot.label} (${slot.time})` : '';
}
