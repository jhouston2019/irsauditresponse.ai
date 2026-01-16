# IRS AUDIT RESPONSE — ADSENSE / NATIVE ADS SYSTEM

**Cloned from Tax Letter Help — Production Ready**

## OVERVIEW

This ad system is a monetization floor for IRS Audit Response. It generates revenue from non-buyers without interfering with paid conversions.

### Key Principles

- **Trust First**: Ads never appear above the fold or near CTAs
- **Compliance**: All ads are clearly labeled as sponsored
- **Performance**: Lazy loading, session caps, and scroll-depth triggers
- **Device Optimization**: Desktop gets 3 ads max, mobile gets 2 ads max
- **Page Exclusions**: Zero ads on checkout, payment, login, dashboard, or authenticated pages

---

## FILE STRUCTURE

```
src/
├── ads-config.js       # Global configuration (single source of truth)
├── ads-styles.css      # All ad container styles
└── ads-manager.js      # Ad loading logic, lazy load, session caps

scripts/
└── add-ads-to-pages.js # Helper script for bulk ad addition
```

---

## CONFIGURATION

### Global Config (`src/ads-config.js`)

```javascript
const ADS_ENABLED = true;

const AD_CONFIG = {
  provider: 'adsense',
  clientId: 'ca-pub-XXXXXXXXXXXXXXXX', // ⚠️ REPLACE WITH ACTUAL ID
  
  pageExclusions: [
    '/checkout',
    '/payment.html',
    '/audit-payment.html',
    '/login',
    '/signup',
    '/dashboard',
    '/audit-upload.html',
    '/audit-response.html',
    '/upload.html'
  ],
  
  maxAdsDesktop: 3,
  maxAdsMobile: 2,
  
  slots: {
    postContent: 'POST_CONTENT_SLOT_ID_IRS',    // ⚠️ REPLACE
    exitGrid: 'EXIT_GRID_SLOT_ID_IRS',          // ⚠️ REPLACE
    mobileFooter: 'MOBILE_FOOTER_SLOT_ID_IRS'   // ⚠️ REPLACE
  },
  
  sessionCap: 3,
  scrollDepthTrigger: 75 // percentage
};
```

---

## AD PLACEMENTS

### 1. Post-Content Ad (Primary)
- **Location**: After main content, before CTAs
- **Devices**: Desktop + Mobile
- **Loading**: Lazy (Intersection Observer, 200px margin)
- **Label**: "Sponsored Resources"

```html
<section class="native-ad post-content-ad">
  <p class="ad-label">Sponsored Resources</p>
  <div id="ad-post-content"></div>
</section>
```

### 2. Exit / Scroll-End Ad
- **Location**: Near bottom of content
- **Devices**: Desktop only
- **Loading**: Scroll-depth trigger (75%)
- **Label**: "Additional Support Options"

```html
<section class="native-ad exit-grid-ad desktop-only">
  <p class="ad-label">Additional Support Options</p>
  <div id="ad-exit-grid"></div>
</section>
```

### 3. Mobile Footer Sticky
- **Location**: Fixed bottom of viewport
- **Devices**: Mobile only
- **Loading**: Immediate on mobile
- **Dismissible**: Yes (X button)

```html
<div class="native-ad mobile-footer-ad mobile-only" id="ad-mobile-footer"></div>
```

---

## PAGE INTEGRATION

### Required in `<head>`:

```html
<!-- Ad Styles -->
<link rel="stylesheet" href="/src/ads-styles.css">

<!-- AdSense Script -->
<script async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
  crossorigin="anonymous">
</script>
```

### Required before `</body>`:

```html
<!-- MOBILE FOOTER STICKY AD -->
<div class="native-ad mobile-footer-ad mobile-only" id="ad-mobile-footer"></div>

<!-- Ad Manager Script -->
<script type="module" src="/src/ads-manager.js"></script>
```

---

## PAGES WITH ADS (SEO/INFORMATIONAL ONLY)

✅ **Ads Enabled:**
- `irs-examination-notice.html` ✓
- `how-to-respond-to-irs-audit.html` ✓
- `irs-audit-help.html` ✓
- `irs-cp2000-audit-response.html` ✓
- `irs-audit-letter.html`
- `irs-audit-letter-what-to-do.html`
- `irs-audit-response-help.html`
- `irs-audit-written-response.html`
- `irs-audit-explanation-letter.html`
- `irs-audit-supporting-documents.html`
- `irs-audit-document-request.html`
- `irs-audit-additional-information-requested.html`
- `irs-audit-adjustment-dispute.html`
- `irs-audit-appeal-response.html`
- `irs-audit-certified-mail-response.html`
- `irs-audit-deadline-missed.html`
- `irs-audit-notice-confusing.html`
- `irs-audit-penalties-help.html`
- `irs-correspondence-audit-response.html`
- `irs-field-audit-response.html`
- `irs-office-audit-response.html`
- `irs-office-field-audit.html`
- `irs-random-audit-response.html`
- `correspondence-audit.html`
- `resources.html`
- `resource.html`

❌ **Ads Disabled (Excluded):**
- `payment.html` ✓
- `audit-payment.html` ✓
- `checkout.html`
- `login.html` ✓
- `signup.html`
- `dashboard.html` ✓
- `audit-upload.html`
- `audit-response.html`
- `upload.html`
- Any authenticated workspace pages

---

## AD LABELS (IRS-APPROPRIATE)

✅ **Allowed:**
- "Sponsored Resources"
- "Additional Support Options"
- "Related Services"

❌ **Forbidden:**
- "Deals"
- "Offers"
- "Recommended"
- Anything implying IRS endorsement

---

## SESSION MANAGEMENT

- **Session Cap**: 3 ad impressions per session
- **Storage**: `sessionStorage` (key: `irs_audit_ad_count`)
- **Behavior**: After 3 impressions, all ads hidden until new session

---

## LAZY LOADING

### Post-Content Ad
- Uses Intersection Observer
- 200px margin (loads before entering viewport)
- Single load per page

### Exit Ad
- Scroll-depth trigger at 75%
- Desktop only
- Loads once when threshold reached

### Mobile Footer
- Immediate load on mobile devices
- User can dismiss with X button

---

## VALIDATION CHECKLIST

Before deploying:

- [ ] Replace `ca-pub-XXXXXXXXXXXXXXXX` with actual AdSense publisher ID
- [ ] Replace slot IDs in `ads-config.js`:
  - `POST_CONTENT_SLOT_ID_IRS`
  - `EXIT_GRID_SLOT_ID_IRS`
  - `MOBILE_FOOTER_SLOT_ID_IRS`
- [ ] Test on desktop: max 3 ads (post-content + exit grid)
- [ ] Test on mobile: max 2 ads (post-content + footer sticky)
- [ ] Verify no ads on payment/checkout pages
- [ ] Verify no ads on login/dashboard pages
- [ ] Verify no ads above the fold
- [ ] Verify no ads near CTAs
- [ ] Verify session cap works (3 impressions max)
- [ ] Verify mobile footer dismiss button works
- [ ] Check console for errors
- [ ] Verify AdSense approval and compliance

---

## MAINTENANCE

### To Add Ads to New SEO Page:

1. Add `<head>` elements (styles + AdSense script)
2. Insert post-content ad container after main content
3. Insert exit ad container near bottom (desktop only)
4. Add mobile footer ad before `</body>`
5. Add ad manager script before `</body>`

### To Exclude New Page:

Add path to `pageExclusions` array in `src/ads-config.js`:

```javascript
pageExclusions: [
  '/checkout',
  '/payment.html',
  '/new-excluded-page.html'  // Add here
]
```

---

## PERFORMANCE

- **No blocking**: All scripts are async/deferred
- **Lazy loading**: Ads load only when needed
- **Session caps**: Prevents ad fatigue
- **Mobile optimized**: Sticky footer with dismiss
- **Zero impact on conversions**: Excluded from all conversion paths

---

## COMPLIANCE

- All ads clearly labeled as "Sponsored"
- No misleading labels
- No ads implying IRS endorsement
- Follows Google AdSense policies
- User can dismiss mobile sticky ad

---

## TROUBLESHOOTING

### Ads Not Showing

1. Check browser console for errors
2. Verify AdSense publisher ID is correct
3. Verify slot IDs are correct
4. Check if page is in exclusion list
5. Check session cap (clear sessionStorage)
6. Verify AdSense account is approved

### Ads Showing on Excluded Pages

1. Check `pageExclusions` array in `ads-config.js`
2. Verify path matches exactly (case-sensitive)
3. Clear browser cache

### Too Many Ads

1. Check device detection (desktop vs mobile)
2. Verify `maxAdsDesktop` and `maxAdsMobile` settings
3. Check session cap

---

## END STATE

IRS Audit Response now has:

✅ Exact same monetization floor as Tax Letter Help  
✅ Trust-preserving ad placements  
✅ Zero interference with paid conversions  
✅ Compliant, professional ad labels  
✅ Session caps and lazy loading  
✅ Mobile-optimized experience  
✅ Zero maintenance required  

**Next Steps:**
1. Replace placeholder AdSense IDs
2. Test on staging
3. Deploy to production
4. Monitor performance in AdSense dashboard
