/* ═══════════════════════════════════════════
   SERVICES/performance.js - Performance
   ═══════════════════════════════════════════
   Placeholder for future: lazy loading, caching
   ═══════════════════════════════════════════ */

window.Performance = {
  observeImages: function() {
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) { var img = entry.target; img.src = img.dataset.src; obs.unobserve(img); }
        });
      });
      document.querySelectorAll('img[data-src]').forEach(function(img) { obs.observe(img); });
    }
  }
};
