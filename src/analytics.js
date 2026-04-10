/**
 * Loads GA4 only when <meta name="ga-measurement-id" content="G-..."> is set.
 * Set GA_MEASUREMENT_ID at deploy time (Netlify snippet, build step, or manual edit).
 * Optional: <html data-ga-purchase="1"> fires a purchase event after config (checkout success pages).
 */
(function () {
  var meta = document.querySelector('meta[name="ga-measurement-id"]');
  var id = meta && meta.getAttribute('content');
  if (!id) return;
  id = String(id).trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);

  gtag('js', new Date());
  gtag('config', id);

  if (document.documentElement.getAttribute('data-ga-purchase') === '1') {
    var q = new URLSearchParams(window.location.search);
    gtag('event', 'purchase', {
      transaction_id: q.get('session_id') || 'unknown',
      value: 49,
      currency: 'USD',
      items: [{ item_id: 'irs_audit_defense', item_name: 'IRS Audit Defense Pro' }],
    });
  }
})();
