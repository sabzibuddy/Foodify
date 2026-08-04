/* ════════════════════════════════════════
   ui/celebration.js
   Confetti canvas + emoji shower on order success.
   No external dependencies.
════════════════════════════════════════ */

const CELEBRATION_COLORS  = ['#6BBF7B','#FFD700','#E8335A','#4A8B5C','#FF8C42','#C8704A','#A8DADC','#F4D35E','#fff'];
const CELEBRATION_EMOJIS  = ['🎉','🎊','🥦','🛒','🌿','⭐','🎈','💚','✨','🎁'];
const CELEBRATION_SHAPES  = ['rect','circle','ribbon'];
const CONFETTI_COUNT      = 130;
const CONFETTI_FRAMES     = 220;
const CONFETTI_FADE_START = 150;
const EMOJI_COUNT         = 22;
const EMOJI_DURATION      = 5000;

/**
 * Order success celebration — confetti + emoji shower
 */
function launchCelebration() {
  _startConfetti();
  _startEmojiShower();
}

/* ── Confetti Canvas ──────────────────── */
function _startConfetti() {
  const canvas = document.getElementById('celebration-canvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Pieces generate karo
  const pieces = Array.from({ length: CONFETTI_COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height - canvas.height,
    w:     6  + Math.random() * 9,
    h:     4  + Math.random() * 6,
    color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
    shape: CELEBRATION_SHAPES[Math.floor(Math.random() * CELEBRATION_SHAPES.length)],
    vx:    (Math.random() - 0.5) * 3,
    vy:    2.5 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.18,
    opacity: 1,
  }));

  let frame = 0;

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    for (const p of pieces) {
      p.x     += p.vx;
      p.y     += p.vy;
      p.angle += p.spin;
      p.vy    += 0.06;                      // gravity
      if (frame > CONFETTI_FADE_START)
        p.opacity = Math.max(0, 1 - (frame - CONFETTI_FADE_START) / (CONFETTI_FRAMES - CONFETTI_FADE_START));

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;

      switch (p.shape) {
        case 'rect':
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ribbon':
          ctx.beginPath();
          ctx.moveTo(-p.w, 0);
          ctx.quadraticCurveTo(0, -p.h, p.w, 0);
          ctx.quadraticCurveTo(0,  p.h, -p.w, 0);
          ctx.fill();
          break;
      }
      ctx.restore();
    }

    if (frame < CONFETTI_FRAMES) {
      requestAnimationFrame(drawFrame);
    } else {
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(drawFrame);
}

/* ── Emoji Shower ─────────────────────── */
function _startEmojiShower() {
  const box = document.getElementById('celebration-emojis');
  if (!box) return;

  box.style.display = 'block';
  box.innerHTML     = '';

  for (let i = 0; i < EMOJI_COUNT; i++) {
    const el       = document.createElement('div');
    el.className   = 'cel-emoji';
    el.textContent = CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)];

    const left  = 5  + Math.random() * 90;
    const dur   = 2.2 + Math.random() * 2.2;
    const delay = Math.random() * 1.4;
    const rot   = (Math.random() - 0.5) * 720;
    const size  = 22 + Math.random() * 22;

    el.style.cssText = `left:${left}%;--dur:${dur}s;--rot:${rot}deg;animation-delay:${delay}s;font-size:${size}px;`;
    box.appendChild(el);
  }

  setTimeout(() => {
    box.style.display = 'none';
    box.innerHTML     = '';
  }, EMOJI_DURATION);
}
