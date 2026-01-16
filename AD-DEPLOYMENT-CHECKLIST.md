# AD SYSTEM DEPLOYMENT CHECKLIST

## PRE-DEPLOYMENT

### 1. AdSense Account Setup
- [ ] AdSense account approved for IRS Audit Response domain
- [ ] Publisher ID obtained (ca-pub-XXXXXXXXXXXXXXXX)
- [ ] Ad units created in AdSense dashboard:
  - [ ] Post-Content Ad Unit (slot ID obtained)
  - [ ] Exit Grid Ad Unit (slot ID obtained)
  - [ ] Mobile Footer Ad Unit (slot ID obtained)
- [ ] Domain verified in AdSense
- [ ] Ads.txt file added to root (if required)

### 2. Configuration Updates
- [ ] Replace `ca-pub-XXXXXXXXXXXXXXXX` in:
  - [ ] `src/ads-config.js` (line 13)
  - [ ] All HTML pages with ad script
- [ ] Replace slot IDs in `src/ads-config.js`:
  - [ ] `POST_CONTENT_SLOT_ID_IRS`
  - [ ] `EXIT_GRID_SLOT_ID_IRS`
  - [ ] `MOBILE_FOOTER_SLOT_ID_IRS`

### 3. Page Integration Status
- [x] `irs-examination-notice.html` — Ads added ✓
- [x] `how-to-respond-to-irs-audit.html` — Ads added ✓
- [x] `irs-audit-help.html` — Ads added ✓
- [x] `irs-cp2000-audit-response.html` — Ads added ✓
- [ ] `irs-audit-letter.html` — Needs ads
- [ ] `irs-audit-letter-what-to-do.html` — Needs ads
- [ ] `irs-audit-response-help.html` — Needs ads
- [ ] `irs-audit-written-response.html` — Needs ads
- [ ] `irs-audit-explanation-letter.html` — Needs ads
- [ ] `irs-audit-supporting-documents.html` — Needs ads
- [ ] `irs-audit-document-request.html` — Needs ads
- [ ] `irs-audit-additional-information-requested.html` — Needs ads
- [ ] `irs-audit-adjustment-dispute.html` — Needs ads
- [ ] `irs-audit-appeal-response.html` — Needs ads
- [ ] `irs-audit-certified-mail-response.html` — Needs ads
- [ ] `irs-audit-deadline-missed.html` — Needs ads
- [ ] `irs-audit-notice-confusing.html` — Needs ads
- [ ] `irs-audit-penalties-help.html` — Needs ads
- [ ] `irs-correspondence-audit-response.html` — Needs ads
- [ ] `irs-field-audit-response.html` — Needs ads
- [ ] `irs-office-audit-response.html` — Needs ads
- [ ] `irs-office-field-audit.html` — Needs ads
- [ ] `irs-random-audit-response.html` — Needs ads
- [ ] `correspondence-audit.html` — Needs ads
- [ ] `resources.html` — Needs ads
- [ ] `resource.html` — Needs ads

---

## TESTING (STAGING)

### Desktop Testing
- [ ] Open SEO page on desktop (1920x1080)
- [ ] Verify no ads above the fold
- [ ] Scroll down, verify post-content ad loads
- [ ] Scroll to 75%, verify exit ad loads
- [ ] Verify max 2 ads visible (post-content + exit)
- [ ] Verify mobile footer NOT visible
- [ ] Check browser console for errors
- [ ] Verify session cap: refresh 3 times, 4th time should show no ads

### Mobile Testing
- [ ] Open SEO page on mobile (375x667)
- [ ] Verify no ads above the fold
- [ ] Scroll down, verify post-content ad loads
- [ ] Verify mobile footer sticky ad appears at bottom
- [ ] Verify exit ad NOT visible
- [ ] Verify max 2 ads visible (post-content + mobile footer)
- [ ] Click X button on mobile footer, verify it dismisses
- [ ] Check browser console for errors
- [ ] Verify body padding added when footer ad visible

### Excluded Pages Testing
- [ ] Open `payment.html` — Verify NO ads
- [ ] Open `audit-payment.html` — Verify NO ads
- [ ] Open `login.html` — Verify NO ads
- [ ] Open `dashboard.html` — Verify NO ads
- [ ] Open `audit-upload.html` — Verify NO ads
- [ ] Open `audit-response.html` — Verify NO ads

### Ad Placement Testing
- [ ] Verify post-content ad is AFTER main content
- [ ] Verify post-content ad is BEFORE primary CTA
- [ ] Verify exit ad is AFTER primary CTA
- [ ] Verify exit ad is BEFORE related resources
- [ ] Verify no ads inside instructions or explanations
- [ ] Verify no ads near conversion buttons

### Label Compliance
- [ ] Verify all ads have "Sponsored Resources" or "Additional Support Options" label
- [ ] Verify no forbidden labels ("Deals", "Offers", "Recommended")
- [ ] Verify labels are clearly visible
- [ ] Verify labels are above ad content

### Performance Testing
- [ ] Run Lighthouse audit — verify no performance degradation
- [ ] Check page load time — should be < 3s
- [ ] Verify lazy loading works (ads don't load until scrolled)
- [ ] Verify no layout shift when ads load
- [ ] Check Core Web Vitals (LCP, FID, CLS)

---

## PRODUCTION DEPLOYMENT

### Pre-Deploy
- [ ] All staging tests passed
- [ ] AdSense account fully approved
- [ ] All placeholder IDs replaced with real IDs
- [ ] Code reviewed for compliance
- [ ] Backup current production code

### Deploy
- [ ] Push to production
- [ ] Clear CDN cache (if applicable)
- [ ] Verify deployment successful

### Post-Deploy Verification
- [ ] Test 3 random SEO pages on desktop
- [ ] Test 3 random SEO pages on mobile
- [ ] Test 2 excluded pages (payment, login)
- [ ] Check browser console for errors
- [ ] Verify ads loading correctly
- [ ] Monitor AdSense dashboard for impressions

---

## MONITORING (FIRST 7 DAYS)

### Daily Checks
- [ ] Day 1: Check AdSense dashboard for impressions
- [ ] Day 1: Monitor error logs
- [ ] Day 1: Check user complaints/feedback
- [ ] Day 2: Verify revenue tracking
- [ ] Day 3: Check ad viewability metrics
- [ ] Day 5: Review session cap effectiveness
- [ ] Day 7: Full performance review

### Metrics to Monitor
- [ ] Ad impressions per day
- [ ] Click-through rate (CTR)
- [ ] Revenue per thousand impressions (RPM)
- [ ] Ad viewability percentage
- [ ] Page load time impact
- [ ] Conversion rate (ensure no drop)
- [ ] User engagement metrics
- [ ] Session duration
- [ ] Bounce rate

### Red Flags (Take Action If Detected)
- [ ] Conversion rate drops > 5%
- [ ] Page load time increases > 500ms
- [ ] User complaints about ads
- [ ] Ads appearing on excluded pages
- [ ] Ads appearing above the fold
- [ ] AdSense policy violations
- [ ] Zero impressions after 24 hours

---

## OPTIMIZATION (AFTER 30 DAYS)

### Performance Review
- [ ] Analyze ad placement effectiveness
- [ ] Review session cap (adjust if needed)
- [ ] Check scroll-depth trigger (adjust if needed)
- [ ] Evaluate mobile footer dismiss rate
- [ ] Compare revenue to projections

### A/B Testing Ideas
- [ ] Test different scroll-depth triggers (70%, 75%, 80%)
- [ ] Test different session caps (2, 3, 4)
- [ ] Test different ad labels
- [ ] Test post-content ad placement variations

### Adjustments
- [ ] Update `scrollDepthTrigger` if needed
- [ ] Update `sessionCap` if needed
- [ ] Add/remove pages from exclusion list
- [ ] Optimize ad unit sizes

---

## MAINTENANCE

### Monthly
- [ ] Review AdSense performance report
- [ ] Check for policy violations
- [ ] Update excluded pages list if new pages added
- [ ] Verify ads still loading correctly

### Quarterly
- [ ] Full audit of ad placements
- [ ] Review and optimize session caps
- [ ] Check for new AdSense features
- [ ] Update documentation if changes made

### Annually
- [ ] Full system review
- [ ] Evaluate ROI vs maintenance cost
- [ ] Consider alternative ad networks
- [ ] Update compliance documentation

---

## ROLLBACK PLAN

If issues detected:

1. **Minor Issues** (ads not loading, low impressions)
   - Check AdSense dashboard for issues
   - Verify IDs are correct
   - Check browser console for errors
   - Fix and redeploy

2. **Major Issues** (conversion drop, policy violation)
   - Set `ADS_ENABLED = false` in `src/ads-config.js`
   - Deploy immediately
   - Investigate root cause
   - Fix and re-enable after testing

3. **Emergency Rollback**
   - Restore previous production code from backup
   - Clear CDN cache
   - Notify team
   - Post-mortem analysis

---

## CONTACT INFO

- **AdSense Support**: [AdSense Help Center](https://support.google.com/adsense)
- **Policy Questions**: [AdSense Policies](https://support.google.com/adsense/answer/48182)
- **Technical Issues**: Check `AD-SYSTEM-README.md` troubleshooting section

---

## SIGN-OFF

- [ ] Developer: Code complete and tested
- [ ] QA: All tests passed
- [ ] Product: Approved for deployment
- [ ] Legal: Compliance verified
- [ ] Marketing: Revenue tracking configured

**Deployment Date**: _______________  
**Deployed By**: _______________  
**AdSense Account**: _______________  
**Publisher ID**: _______________
