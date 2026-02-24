# IRS Audit Response Deployment Guide

## Overview

This guide covers deployment of the **IRS Audit Response** product, which is separate from and more restrictive than Tax Letter Help.

## Product Specifications

- **Name:** IRS Audit Response Preparation
- **Price:** $19.00 (one-time)
- **Scope:** Audit-only (rejects all non-audit notices)
- **Risk Level:** High
- **Architecture:** Constrained procedural system (not chat-based)

## Pre-Deployment Checklist

### 1. Database Setup

Run the audit responses table migration:

```sql
-- In Supabase SQL Editor
-- Run: supabase/migrations/20251216_create_audit_responses_table.sql
```

Verify:
- ✅ `audit_responses` table created
- ✅ Indexes created
- ✅ RLS policies enabled
- ✅ Triggers configured

### 2. Stripe Product Configuration

Create Stripe product with exact specifications:

**Product Details:**
- Name: `IRS Audit Response Preparation`
- Description: `One-time preparation guidance for IRS audits using a constrained, risk-aware system designed to help limit scope and reduce over-disclosure during examinations.`
- Price: `$19.00 USD`
- Type: `One-time payment`

**Metadata (REQUIRED):**
```json
{
  "product_type": "irs_audit_response",
  "pricing_model": "one_time",
  "risk_level": "high",
  "ai_mode": "constrained_procedural",
  "audit_only": "true",
  "not_chat_based": "true"
}
```

Copy the Price ID to `STRIPE_AUDIT_PRICE_ID` environment variable.

### 3. Environment Variables

Set in Netlify dashboard:

```bash
# Required
STRIPE_AUDIT_PRICE_ID=price_xxxxxxxxxxxxx
SITE_URL=https://auditresponse.ai

# Already configured (shared with Tax Letter Help)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLIC_KEY=your_stripe_publishable_key
```

### 4. Netlify Functions

Verify these functions are deployed:

- ✅ `analyze-audit-notice.js` - Audit-only analysis
- ✅ `generate-audit-response.js` - Restrictive response generation
- ✅ `create-audit-checkout-session.js` - Stripe checkout ($19)

### 5. Landing Pages

Verify these pages are deployed:

- ✅ `audit-response.html` - Main landing page
- ✅ `audit-payment.html` - Payment page
- ✅ `audit-upload.html` - Upload and analysis page
- ✅ `audit-success.html` - Payment success
- ✅ `audit-cancel.html` - Payment cancelled

## Testing Checklist

### Test 1: Rejection of Non-Audit Notices

Upload a CP2000 notice to `audit-upload.html`:

**Expected Result:**
- ❌ Notice rejected
- Message: "This is a CP2000 notice, not an audit..."
- Redirect offered to Tax Letter Help

### Test 2: Correspondence Audit (Low Risk)

Upload a correspondence audit notice:

**Expected Result:**
- ✅ Audit classified
- Risk level: Medium
- Response outline generated
- No hard stop

### Test 3: Field Audit (Hard Stop)

Upload a field audit notice:

**Expected Result:**
- ✅ Audit classified
- Risk level: Critical
- Hard stop triggered
- Message: "This is the point at which professional representation is strongly recommended."
- Response generation blocked

### Test 4: Multi-Year Audit (Hard Stop)

Upload an audit covering 2+ years:

**Expected Result:**
- ✅ Audit classified
- Multi-year detected
- Hard stop triggered
- Escalation required

### Test 5: Payment Flow

Complete payment flow:

1. Go to `audit-payment.html`
2. Enter email
3. Complete Stripe checkout ($19)
4. Verify redirect to `audit-success.html`
5. Verify database record created

### Test 6: Response Generation

For a low-risk correspondence audit:

1. Upload notice
2. Review analysis
3. Click "Generate Response Outline"
4. Verify restrictive outline (minimal narrative)
5. Verify validation warnings

## Acceptance Criteria

All must pass before production deployment:

### Core Functionality
- ✅ Rejects all non-audit notices
- ✅ Classifies audit types correctly
- ✅ Triggers hard stops appropriately
- ✅ Generates restrictive response outlines
- ✅ Validates responses against playbook rules

### Safety Features
- ✅ No free-form advice
- ✅ No generic AI language
- ✅ No empathy or reassurance
- ✅ Scope expansion detection works
- ✅ Over-disclosure warnings appear

### Payment & Database
- ✅ Stripe checkout works ($19)
- ✅ Database records created correctly
- ✅ Payment status tracked
- ✅ Email receipts sent

### User Experience
- ✅ Clear differentiation from Tax Letter Help
- ✅ "Not a chatbot" messaging prominent
- ✅ Hard stop messages clear
- ✅ Professional escalation guidance clear

## Post-Deployment Monitoring

### Week 1: Monitor Closely

1. **Rejection Rate**
   - Track how many notices are rejected
   - Verify rejections are appropriate

2. **Escalation Rate**
   - Track hard stop triggers
   - Verify escalations are appropriate

3. **Payment Conversion**
   - Monitor checkout completion rate
   - Track revenue vs. Tax Letter Help

4. **User Feedback**
   - Monitor for confusion about product difference
   - Track professional escalation follow-through

### Ongoing Metrics

- Audit type distribution
- Risk level distribution
- Hard stop condition frequency
- Average response outline length
- Validation error rate

## Rollback Plan

If critical issues arise:

1. **Immediate:** Disable audit-specific functions in Netlify
2. **Redirect:** Point `audit-response.html` to maintenance page
3. **Notify:** Email users who paid in last 24 hours
4. **Refund:** Process refunds if system unavailable >48 hours

## Support Escalation

### Level 1: User Confusion
- "Is this different from Tax Letter Help?"
- **Response:** Yes, this is audit-only and more restrictive. See differentiation page.

### Level 2: Rejection Disputes
- "Why was my notice rejected?"
- **Response:** This system only processes audits. Your notice is [type]. Use Tax Letter Help instead.

### Level 3: Hard Stop Disputes
- "Why can't I generate a response?"
- **Response:** Your audit meets criteria requiring professional representation. This is a safety feature.

### Level 4: Technical Issues
- System errors, payment failures, database issues
- **Escalate to:** Development team immediately

## Maintenance Windows

Schedule for:
- Playbook updates
- Risk threshold adjustments
- Hard stop condition additions
- Classification pattern improvements

**⚠️ All changes require full test suite execution.**

## Success Metrics

### 30-Day Goals
- 50+ audit analyses completed
- <5% inappropriate rejections
- >90% appropriate hard stops
- $950+ revenue ($19 × 50)

### 90-Day Goals
- 200+ audit analyses completed
- Clear differentiation from Tax Letter Help
- Positive feedback on restrictive approach
- $30,000+ revenue

## Conclusion

This is a **high-risk, high-value** product. The restrictive nature is a feature, not a bug. Users should feel:

> "This system is stopping me from making a mistake."

Not:

> "This system is helping me talk to the IRS."

Deploy with confidence. Monitor closely. Maintain safety locks.

