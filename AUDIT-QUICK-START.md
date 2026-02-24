# IRS Audit Response - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you quickly deploy and test the IRS Audit Response system.

---

## Step 1: Database Setup (2 minutes)

1. Open Supabase SQL Editor
2. Run the migration:

```sql
-- Copy and paste from:
-- supabase/migrations/20251216_create_audit_responses_table.sql
```

3. Verify table created:
```sql
SELECT * FROM audit_responses LIMIT 1;
```

---

## Step 2: Stripe Configuration (3 minutes)

### Create Product

1. Go to Stripe Dashboard → Products
2. Click "Add Product"
3. Fill in:
   - **Name:** IRS Audit Response Preparation
   - **Description:** One-time preparation guidance for IRS audits using a constrained, risk-aware system designed to help limit scope and reduce over-disclosure during examinations.
   - **Pricing:** $19.00 USD (one-time)

### Add Metadata

Click "Add metadata" and enter:

```
product_type: irs_audit_response
pricing_model: one_time
risk_level: high
ai_mode: constrained_procedural
audit_only: true
not_chat_based: true
```

### Copy Price ID

Copy the Price ID (starts with `price_`) and add to environment variables.

---

## Step 3: Environment Variables (1 minute)

Add to Netlify dashboard:

```bash
STRIPE_AUDIT_PRICE_ID=price_xxxxxxxxxxxxx
```

(Other variables already configured from Tax Letter Help)

---

## Step 4: Deploy (1 minute)

```bash
git add .
git commit -m "Add IRS Audit Response system"
git push origin main
```

Netlify will automatically deploy.

---

## Step 5: Test (5 minutes)

### Test 1: Rejection of Non-Audit Notice

1. Go to `/audit-upload.html`
2. Paste this CP2000 text:

```
CP2000 Notice
Proposed Changes to Your Tax Return
Tax Year: 2023
We have information that differs from what you reported.
```

3. Click "Analyze Audit Notice"
4. **Expected:** Notice rejected, redirect to Tax Letter Help offered

### Test 2: Correspondence Audit (Low Risk)

1. Go to `/audit-upload.html`
2. Paste this text:

```
Examination Notice
Tax Year: 2023
We are examining your tax return for the following items:
- Schedule C Business Expenses
- Home Office Deduction
Please provide documentation to support these deductions.
This is a correspondence audit. You may respond by mail.
```

3. Click "Analyze Audit Notice"
4. **Expected:** 
   - Audit classified as "Correspondence Audit"
   - Risk level: Medium
   - Response outline generation available

### Test 3: Field Audit (Hard Stop)

1. Go to `/audit-upload.html`
2. Paste this text:

```
Field Audit Notice
Tax Years: 2021, 2022, 2023
A Revenue Agent will visit your business location to conduct an examination.
Items under examination: Business income, expenses, and inventory.
Estimated tax deficiency: $75,000
```

3. Click "Analyze Audit Notice"
4. **Expected:**
   - Audit classified as "Field Audit"
   - Risk level: Critical
   - Hard stop triggered
   - Message: "This is the point at which professional representation is strongly recommended."
   - Response generation blocked

### Test 4: Payment Flow

1. Go to `/audit-payment.html`
2. Enter email address
3. Click "Proceed to Secure Checkout"
4. Complete Stripe test checkout (use test card: 4242 4242 4242 4242)
5. **Expected:** Redirect to `/audit-success.html`

### Test 5: Run Test Suite

```bash
node test-audit-system.js
```

**Expected:** All tests pass

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] `/audit-response.html` loads correctly
- [ ] `/audit-payment.html` payment flow works
- [ ] `/audit-upload.html` upload and analysis works
- [ ] Non-audit notices are rejected
- [ ] Hard stops trigger for field audits
- [ ] Database records are created
- [ ] Stripe checkout works ($19)
- [ ] Test suite passes

---

## 🎯 Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| Landing | `/audit-response.html` | Main product page |
| Payment | `/audit-payment.html` | Stripe checkout |
| Upload | `/audit-upload.html` | Upload and analyze |
| Success | `/audit-success.html` | Payment confirmation |
| Cancel | `/audit-cancel.html` | Payment cancelled |

---

## 🔧 Troubleshooting

### "Notice rejected" for actual audit

**Cause:** Classification patterns may need adjustment  
**Fix:** Check `classification-engine.js` patterns

### Hard stop not triggering

**Cause:** Risk evaluation may need adjustment  
**Fix:** Check `risk-guardrails.js` conditions

### Payment fails

**Cause:** Stripe configuration issue  
**Fix:** Verify `STRIPE_AUDIT_PRICE_ID` is correct

### Database error

**Cause:** Migration not run or RLS blocking  
**Fix:** Verify migration ran, check RLS policies

---

## 📊 Monitor These Metrics

### First Week

- **Rejection Rate:** Should be ~30-40% (many non-audit notices)
- **Hard Stop Rate:** Should be ~20-30% (field, multi-year, large dollar)
- **Payment Conversion:** Monitor checkout completion
- **Response Generation:** Track successful outline generation

### Red Flags

- ⚠️ Rejection rate >60% (too aggressive)
- ⚠️ Rejection rate <10% (too lenient)
- ⚠️ Hard stop rate <5% (not escalating enough)
- ⚠️ Hard stop rate >50% (escalating too much)

---

## 🚨 Emergency Procedures

### If System Down

1. Check Netlify function logs
2. Verify environment variables
3. Check Supabase connection
4. Review error messages

### If Too Many Rejections

1. Review rejection logs
2. Check classification patterns
3. Adjust if needed (with full testing)

### If Payment Issues

1. Check Stripe dashboard for errors
2. Verify webhook configuration
3. Check price ID matches

---

## 📞 Need Help?

1. **Documentation:**
   - AUDIT-SYSTEM-SUMMARY.md (complete overview)
   - AUDIT-DEPLOYMENT.md (detailed deployment)
   - netlify/functions/irs-audit-intelligence/README.md (technical details)

2. **Testing:**
   - Run: `node test-audit-system.js`
   - Check: Test suite output

3. **Logs:**
   - Netlify function logs
   - Supabase logs
   - Stripe dashboard

---

## ✅ Success Criteria

You're ready for production when:

- ✅ All 5 tests pass
- ✅ Test suite passes
- ✅ Payment flow works
- ✅ Database records created
- ✅ Non-audit rejection works
- ✅ Hard stops trigger correctly

---

## 🎉 You're Done!

The IRS Audit Response system is now live and ready to:

1. **Reject** non-audit notices
2. **Classify** audit types
3. **Assess** risk levels
4. **Trigger** hard stops
5. **Generate** restrictive response outlines
6. **Escalate** to professionals when needed

**Remember:** This system is designed to STOP users from making mistakes, not help them talk to the IRS.

---

**Questions?** Review the documentation or run the test suite.

**Ready to launch?** You're all set! 🚀

