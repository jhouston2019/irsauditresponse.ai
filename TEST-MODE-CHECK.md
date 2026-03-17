# 🔍 IS YOUR SITE IN TEST MODE OR LIVE MODE?

**Date:** February 24, 2026  
**Quick Answer:** It depends on which Stripe key you added to Netlify

---

## 🎯 HOW TO CHECK

### Your site's mode is determined by the Stripe API key you set in Netlify.

**The code uses:** `process.env.STRIPE_SECRET_KEY`

**This variable determines the mode:**
- If key starts with `sk_test_` → **TEST MODE** ✅ (safe, no real money)
- If key starts with `sk_live_` → **LIVE MODE** 💰 (real money)

---

## 🔍 CHECK YOUR CURRENT MODE

### Method 1: Check Netlify Environment Variables (Fastest)

1. Go to: https://app.netlify.com
2. Select your site
3. Go to: **Site configuration** → **Environment variables**
4. Find: `STRIPE_SECRET_KEY`
5. Look at the value:
   - Starts with `sk_test_` → **TEST MODE**
   - Starts with `sk_live_` → **LIVE MODE**

**⚠️ Don't share this key with anyone!**

---

### Method 2: Try a Test Payment

1. Go to your site
2. Try to make a payment with test card: **4242 4242 4242 4242**
3. Check the result:
   - **Payment succeeds** → TEST MODE ✅
   - **Payment fails with "card declined"** → LIVE MODE (test cards don't work)

---

### Method 3: Check Stripe Dashboard

1. Go to: https://dashboard.stripe.com
2. Look at top-right corner toggle
3. Check which mode shows recent activity:
   - Activity in **Test mode** → You're in test mode
   - Activity in **Live mode** → You're in live mode

---

## ⚙️ TEST MODE vs LIVE MODE

### TEST MODE (Recommended for Now)

**Stripe Key:** `sk_test_...`

**What it means:**
- ✅ No real money charged
- ✅ Use test cards (4242 4242 4242 4242)
- ✅ Safe to experiment
- ✅ Can test unlimited times
- ✅ No bank account needed
- ✅ No business verification needed

**Use test mode for:**
- Testing payment flow
- Verifying features work
- Training staff
- Demo purposes
- Development

**Test Cards:**
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Requires auth: 4000 0025 0000 3155

---

### LIVE MODE (For Real Customers)

**Stripe Key:** `sk_live_...`

**What it means:**
- 💰 Real money is charged
- 💳 Only real cards work
- 🏦 Money goes to your bank
- ⚠️ Test cards will fail
- ⚠️ Requires business verification
- ⚠️ Requires bank account

**Use live mode for:**
- Accepting real payments
- Making real money
- Serving real customers
- Production environment

**Requirements:**
- Stripe business verification complete
- Bank account added
- Identity verified
- Terms accepted

---

## 🎯 WHICH MODE SHOULD YOU USE?

### Right Now: TEST MODE ✅

**Why:**
- You just updated pricing to $49
- Need to verify everything works
- Safe to test without risk
- Can fix issues without affecting customers

**How to ensure test mode:**
1. Go to Netlify environment variables
2. Set `STRIPE_SECRET_KEY=sk_test_...`
3. Redeploy site
4. Test payment flow

---

### After Testing: LIVE MODE 💰

**When to switch:**
- ✅ Test payment works perfectly
- ✅ Upload flow works
- ✅ AI analysis works
- ✅ Downloads work
- ✅ Success pages work
- ✅ You're ready for real customers

**How to switch:**
1. Complete Stripe verification
2. Add bank account
3. Get live keys from Stripe
4. Update Netlify: `STRIPE_SECRET_KEY=sk_live_...`
5. Update webhook secret: `STRIPE_WEBHOOK_SECRET=whsec_...` (live version)
6. Redeploy site
7. Test with your own real card
8. Refund test payment
9. Start marketing!

---

## 🔍 HOW TO TELL WHAT MODE YOU'RE IN

### Quick Check:

**Try this test card: 4242 4242 4242 4242**

**If it works:** You're in TEST MODE ✅  
**If it fails:** You're in LIVE MODE 💰

---

### Detailed Check:

**Look at your Netlify environment variables:**

```
STRIPE_SECRET_KEY=sk_test_xxxxx → TEST MODE
STRIPE_SECRET_KEY=sk_live_xxxxx → LIVE MODE
```

**You set these when you said "stripe and env variables updated"**

---

## ⚠️ IMPORTANT NOTES

### Test Mode is SAFE:

- ✅ No real money charged
- ✅ Can't accidentally charge customers
- ✅ Test cards only
- ✅ Perfect for development
- ✅ Use this until you're 100% confident

### Live Mode is REAL:

- 💰 Real money charged
- 💳 Real cards only
- 🏦 Money goes to your bank
- ⚠️ Customer service required
- ⚠️ Refunds if issues occur

---

## 🎯 MY RECOMMENDATION

### Start in TEST MODE:

**Today:**
1. Verify you're in test mode (check Netlify env vars)
2. Test payment with 4242 4242 4242 4242
3. Verify full flow works
4. Fix any issues

**Tomorrow:**
1. Complete Stripe verification
2. Switch to live mode
3. Test with real card
4. Start accepting real payments

---

## 📋 HOW TO CHECK YOUR CURRENT MODE

### Do This Now (2 minutes):

**Option 1: Check Netlify**
1. Go to: https://app.netlify.com
2. Your site → Site configuration → Environment variables
3. Find `STRIPE_SECRET_KEY`
4. Check if it starts with:
   - `sk_test_` = TEST MODE ✅
   - `sk_live_` = LIVE MODE 💰

**Option 2: Check Stripe Dashboard**
1. Go to: https://dashboard.stripe.com
2. Look at top-right corner
3. See which mode has recent activity
4. If unsure, toggle between modes and check payments

**Option 3: Try a Test Payment**
1. Go to your site
2. Start checkout
3. Use: 4242 4242 4242 4242
4. If it works = TEST MODE
5. If it fails = LIVE MODE

---

## 🎯 BOTTOM LINE

**I can't see your Netlify environment variables** (they're private), so I can't tell you definitively which mode you're in.

**But here's how YOU can check:**

1. **Go to Netlify** → Environment variables
2. **Look at STRIPE_SECRET_KEY**
3. **Check the prefix:**
   - `sk_test_` = TEST MODE (safe to test)
   - `sk_live_` = LIVE MODE (real money)

**My guess:** You're probably in **TEST MODE** since you just set this up.

**My recommendation:** Stay in test mode until you verify everything works, then switch to live.

---

## 🚀 WHAT TO DO NOW

**If you're in TEST MODE:**
- ✅ Perfect! Test the payment flow
- ✅ Use test card: 4242 4242 4242 4242
- ✅ Verify everything works
- ✅ Then switch to live when ready

**If you're in LIVE MODE:**
- ⚠️ Be careful - real money will be charged
- ⚠️ Test with your own card first
- ⚠️ Refund test payment immediately
- ⚠️ Make sure everything works before marketing

---

**Check your Netlify environment variables to see which mode you're in!**

---

*Guide created: February 24, 2026*  
*Mode: Determined by your STRIPE_SECRET_KEY*  
*Check: Netlify → Environment variables*
