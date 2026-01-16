# AD SYSTEM — QUICK REFERENCE CARD

## 📁 FILES

```
src/
├── ads-config.js       ← Configuration (IDs, exclusions, caps)
├── ads-styles.css      ← All styles
└── ads-manager.js      ← Loading logic

Documentation/
├── AD-SYSTEM-README.md              ← Full documentation
├── AD-DEPLOYMENT-CHECKLIST.md       ← Deployment guide
├── AD-INTEGRATION-TEMPLATE.html     ← Copy-paste template
└── AD-IMPLEMENTATION-SUMMARY.md     ← This implementation
```

---

## 🚀 QUICK ADD ADS TO PAGE

### 1. In `<head>`:
```html
<link rel="stylesheet" href="/src/ads-styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
```

### 2. After main content, before CTA:
```html
<section class="native-ad post-content-ad">
  <p class="ad-label">Sponsored Resources</p>
  <div id="ad-post-content"></div>
</section>
```

### 3. After CTA, near bottom:
```html
<section class="native-ad exit-grid-ad desktop-only">
  <p class="ad-label">Additional Support Options</p>
  <div id="ad-exit-grid"></div>
</section>
```

### 4. Before `</body>`:
```html
<div class="native-ad mobile-footer-ad mobile-only" id="ad-mobile-footer"></div>
<script type="module" src="/src/ads-manager.js"></script>
```

---

## ⚙️ CONFIGURATION

Edit `src/ads-config.js`:

```javascript
const AD_CONFIG = {
  clientId: 'ca-pub-XXXXXXXXXXXXXXXX',  // ← Your AdSense ID
  
  slots: {
    postContent: 'POST_CONTENT_SLOT_ID_IRS',   // ← Your slot IDs
    exitGrid: 'EXIT_GRID_SLOT_ID_IRS',
    mobileFooter: 'MOBILE_FOOTER_SLOT_ID_IRS'
  },
  
  pageExclusions: ['/payment.html', '/login'],  // ← Pages with NO ads
  
  maxAdsDesktop: 3,      // ← Max ads on desktop
  maxAdsMobile: 2,       // ← Max ads on mobile
  sessionCap: 3,         // ← Max impressions per session
  scrollDepthTrigger: 75 // ← % scroll for exit ad
};
```

---

## 🎯 AD PLACEMENTS

| Ad Type | Location | Devices | Loading | Label |
|---------|----------|---------|---------|-------|
| **Post-Content** | After content, before CTA | Desktop + Mobile | Lazy (200px) | "Sponsored Resources" |
| **Exit Grid** | After CTA, near bottom | Desktop only | Scroll 75% | "Additional Support Options" |
| **Mobile Footer** | Fixed bottom | Mobile only | Immediate | (none) |

---

## ✅ RULES

**DO:**
- ✅ Place ads after main content
- ✅ Use approved labels only
- ✅ Test on desktop + mobile
- ✅ Verify excluded pages

**DON'T:**
- ❌ Put ads above the fold
- ❌ Put ads near CTAs
- ❌ Put ads on payment/login pages
- ❌ Use labels like "Deals" or "Offers"

---

## 📊 TESTING

```bash
# Desktop (should see 2 ads max):
1. Open SEO page
2. Scroll down → post-content ad loads
3. Scroll to 75% → exit ad loads
4. Mobile footer NOT visible

# Mobile (should see 2 ads max):
1. Open SEO page
2. Scroll down → post-content ad loads
3. Mobile footer visible at bottom
4. Exit ad NOT visible
5. Click X → footer dismisses

# Excluded pages (should see 0 ads):
1. Open payment.html → no ads
2. Open login.html → no ads
3. Open dashboard.html → no ads
```

---

## 🔧 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Ads not showing | Check console for errors, verify IDs |
| Ads on excluded pages | Check `pageExclusions` array |
| Too many ads | Check device detection, session cap |
| Ads above fold | Check placement in HTML |
| Mobile footer not dismissing | Check X button click handler |

---

## 📝 ALLOWED LABELS

✅ **Use these:**
- "Sponsored Resources"
- "Additional Support Options"
- "Related Services"

❌ **Never use:**
- "Deals" / "Offers" / "Recommended"
- Anything implying IRS endorsement

---

## 🚫 EXCLUDED PAGES

Ads NEVER appear on:
- `/payment.html`
- `/audit-payment.html`
- `/checkout`
- `/login`
- `/signup`
- `/dashboard`
- `/audit-upload.html`
- `/audit-response.html`
- `/upload.html`

---

## 📈 MONITORING

Check daily for first week:
- AdSense dashboard → impressions
- Browser console → errors
- Conversion rate → should NOT drop
- Page load time → should NOT increase

---

## 🆘 EMERGENCY DISABLE

If problems occur:

```javascript
// In src/ads-config.js:
const ADS_ENABLED = false;  // ← Set to false
```

Then redeploy immediately.

---

## 📞 SUPPORT

- **Full docs**: `AD-SYSTEM-README.md`
- **Deployment**: `AD-DEPLOYMENT-CHECKLIST.md`
- **Template**: `AD-INTEGRATION-TEMPLATE.html`
- **Summary**: `AD-IMPLEMENTATION-SUMMARY.md`

---

## ✅ STATUS

- [x] Core files created
- [x] 4 pages integrated
- [x] Documentation complete
- [x] Page exclusions verified
- [ ] AdSense IDs added (waiting on approval)
- [ ] 22 pages remaining (use template)
- [ ] Staging tests (after IDs added)
- [ ] Production deploy

---

**Last Updated**: 2026-01-15  
**Version**: 1.0  
**Status**: Ready for AdSense IDs
