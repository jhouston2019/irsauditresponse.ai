(function () {
  var DEFAULT_STRIPE_PRICE_ID = "price_49USD_single";
  function stripePriceId() {
    var m = document.querySelector('meta[name="stripe-price-id"]');
    var c = (m && m.getAttribute("content") || "").trim();
    if (c && c.indexOf("%%") === -1) return c;
    return DEFAULT_STRIPE_PRICE_ID;
  }
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("navReviewAnotherBtn");
    if (!btn) return;
    var errEl = document.getElementById("navReviewAnotherErr");
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      if (errEl) errEl.textContent = "";
      var priceId = stripePriceId();
      btn.disabled = true;
      btn.textContent = "Redirecting...";
      fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: priceId }),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, data: d };
          });
        })
        .then(function (x) {
          if (x.data && x.data.url) {
            window.location.href = x.data.url;
            return;
          }
          throw new Error();
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = label;
          if (errEl) errEl.textContent = "Something went wrong. Please try again.";
        });
    });
  });
})();
