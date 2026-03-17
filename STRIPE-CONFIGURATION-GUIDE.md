# 💳 STRIPE CONFIGURATION GUIDE - $49 PRICING

**Current Price:** $49 one-time payment  
**Updated:** February 24, 2026  
**Status:** Code updated, Stripe configuration needed

---

## 🎯 QUICK START

### What You Need to Do:

1. **Create Stripe account** (if you don't have one)
2. **Create a $49 product** in Stripe
3. **Get your API keys** from Stripe
4. **Add keys to Netlify** environment variables
5. **Test in test mode** before going live

**Time Required:** 30 minutes

---

## 📋 STEP-BY-STEP SETUP

### Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click "Sign Up"
3. Complete business verification
4. Verify your email

**Note:** You can start in test mode immediately, no verification needed for testing.

---

### Step 2: Create $49 Product

**Option A: Using Stripe Dashboard (Recommended)**

1. Log in to https://dashboard.stripe.com
2. Click **Products** in left sidebar
3. Click **+ Add product**
4. Fill in details:
   - **Name:** `IRS Letter Response Package`
   - **Description:** `AI-powered IRS letter analysis and response generation`
   - **Pricing:** One-time payment
   - **Price:** `$49.00 USD`
   - **Tax behavior:** Not taxable (or configure based on your state)
5. Click **Save product**
6. **Copy the Price ID** (starts with `price_...`)

**Option B: Dynamic Pricing (Already Configured)**

Your site uses `create-audit-checkout-session.js` which creates prices dynamically. This means Stripe will automatically create the product when the first payment is made. **No manual product creation needed!**

However, you still need to set up your Stripe keys (Step 3).

---

### Step 3: Get API Keys

1. In Stripe Dashboard, click **Developers** → **API keys**
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - **Secret key** (starts with `sk_test_...` or `sk_live_...`)

**For Testing:**
- Use **Test mode** keys (toggle in top right)
- Test key: `sk_test_...`
- Publishable key: `pk_test_...`

**For Production:**
- Use **Live mode** keys
- Secret key: `sk_live_...`
- Publishable key: `pk_live_...`

**⚠️ IMPORTANT:** Never share your secret key or commit it to git!

---

### Step 4: Configure Webhooks

**Why:** Stripe needs to notify your site when payments succeed.

1. Go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. **Endpoint URL:** `https://irsauditresponseai.netlify.app/.netlify/functions/stripe-webhook`
4. **Events to send:**
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_...`)

---

### Step 5: Add to Netlify

1. Log in to https://app.netlify.com
2. Go to your site
3. Click **Site configuration** → **Environment variables**
4. Click **Add a variable**
5. Add these variables:

```bash
# Stripe Keys (REQUIRED)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Optional: If you created a product manually
STRIPE_PRICE_RESPONSE=price_xxxxxxxxxxxxx
```

**Note:** If using dynamic pricing (Option B), you don't need `STRIPE_PRICE_RESPONSE`.

6. Click **Save**
7. **Redeploy your site** (Netlify → Deploys → Trigger deploy)

---

## 🧪 TESTING YOUR STRIPE INTEGRATION

### Test Mode Setup:

**Use Stripe Test Cards:**
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires auth:** 4000 0025 0000 3155

**Any future expiry date, any 3-digit CVC**

---

### Test Flow:

1. **Start payment:**
   - Go to your site
   - Click "Get My Audit Response Letter - $49"
   - Enter test email: `test@example.com`
   - Click checkout button

2. **Complete payment:**
   - Enter test card: 4242 4242 4242 4242
   - Expiry: 12/34
   - CVC: 123
   - ZIP: 12345
   - Click "Pay"

3. **Verify success:**
   - Should redirect to `audit-success.html`
   - Should show "Your payment of $49 has been processed"
   - Should see "Access Your Audit Upload" button

4. **Check Stripe Dashboard:**
   - Go to **Payments**
   - Should see $49.00 payment
   - Status: Succeeded
   - Customer email: test@example.com

5. **Check Database:**
   - Go to Supabase dashboard
   - Check `audit_responses` table
   - Should see new row with:
     - user_email: test@example.com
     - payment_status: 'paid'
     - stripe_session_id: cs_test_...

---

## 💰 PRICING BREAKDOWN

### Current Configuration:

**Product:** IRS Letter Response Package  
**Price:** $49.00 USD  
**Type:** One-time payment  
**No subscription, no recurring fees**

### Stripe Fees:

**Per Transaction:**
- Stripe fee: 2.9% + $0.30
- On $49: $1.72
- Your net: $47.28
- Profit margin: 96.5%

**Monthly (at 100 customers):**
- Gross revenue: $4,900
- Stripe fees: $172
- Net revenue: $4,728
- **Plus OpenAI costs (~$10), Supabase ($0-25), Netlify ($0-19)**

---

## 🔐 SECURITY BEST PRACTICES

### DO:
- ✅ Use environment variables for all keys
- ✅ Keep secret keys in Netlify only
- ✅ Use test mode for testing
- ✅ Verify webhook signatures
- ✅ Use HTTPS only

### DON'T:
- ❌ Commit keys to git
- ❌ Share secret keys
- ❌ Use live keys in test mode
- ❌ Hardcode keys in code
- ❌ Use same keys across projects

---

## 🚀 GOING LIVE

### When Ready to Accept Real Payments:

1. **Complete Stripe Verification:**
   - Provide business details
   - Add bank account
   - Verify identity
   - Enable live mode

2. **Switch to Live Keys:**
   - Get live secret key (`sk_live_...`)
   - Get live webhook secret (`whsec_...`)
   - Update Netlify environment variables
   - Redeploy site

3. **Test with Real Card:**
   - Use your own card
   - Make a $49 payment
   - Verify full flow works
   - Refund the test payment

4. **Monitor:**
   - Watch Stripe dashboard
   - Check for failed payments
   - Monitor webhook deliveries
   - Track revenue

---

## 🐛 TROUBLESHOOTING

### Payment Not Working?

**Check:**
1. ✅ Stripe keys are set in Netlify
2. ✅ Keys are for correct mode (test vs live)
3. ✅ Webhook endpoint is correct
4. ✅ Site is deployed (not local)
5. ✅ CORS is enabled

**Common Errors:**

**"No such price"**
- Solution: Remove `STRIPE_PRICE_RESPONSE` variable (use dynamic pricing)
- Or: Create product in Stripe and update price ID

**"Invalid API key"**
- Solution: Check key starts with `sk_test_` or `sk_live_`
- Verify key is copied correctly (no spaces)

**"Webhook signature invalid"**
- Solution: Update `STRIPE_WEBHOOK_SECRET` in Netlify
- Verify webhook endpoint URL is correct

**"CORS error"**
- Solution: Redeploy site to Netlify
- Check function has CORS headers

---

## 📊 MONITORING YOUR PAYMENTS

### Stripe Dashboard:

**Daily Checks:**
- **Payments** → View all transactions
- **Customers** → See customer list
- **Balance** → Check pending payouts

**Weekly Checks:**
- **Reports** → Download revenue reports
- **Logs** → Check for errors
- **Webhooks** → Verify delivery success

### Supabase Dashboard:

**Check Tables:**
- `audit_responses` → Verify paid status
- `tlh_letters` → Check payment records
- `users` → Monitor user growth

---

## 💡 PRICING OPTIMIZATION TIPS

### After First 50 Customers:

**Analyze:**
- Conversion rate (visitors → buyers)
- Cart abandonment rate
- Customer feedback
- Revenue per customer

**Consider:**
- A/B test $39 vs $49
- Add $79 premium tier
- Offer bundle pricing
- Create referral program

### Promotional Strategies:

**Launch Special:**
- First 100 customers: $39 (save $10)
- Regular price: $49
- Creates urgency

**Seasonal Promotions:**
- Tax season (Jan-Apr): $44
- Black Friday: $39
- New Year: $39

**Referral Program:**
- Give $10, Get $10
- Refer 3 friends, get free analysis
- Build viral growth

---

## 🎯 REVENUE GOALS

### Conservative (50 customers/month):
- Monthly revenue: $2,450
- Annual revenue: $29,400
- Net after fees: ~$28,000

### Moderate (100 customers/month):
- Monthly revenue: $4,900
- Annual revenue: $58,800
- Net after fees: ~$56,000

### Aggressive (250 customers/month):
- Monthly revenue: $12,250
- Annual revenue: $147,000
- Net after fees: ~$140,000

**All achievable with good marketing!**

---

## 📞 STRIPE SUPPORT

**Need Help?**
- Stripe Docs: https://stripe.com/docs
- Support: https://support.stripe.com
- Community: https://github.com/stripe

**Common Resources:**
- Checkout setup: https://stripe.com/docs/checkout
- Webhooks guide: https://stripe.com/docs/webhooks
- Testing guide: https://stripe.com/docs/testing

---

## ✅ CONFIGURATION CHECKLIST

### Before Launch:
- [ ] Stripe account created
- [ ] Business verified (for live mode)
- [ ] Bank account added
- [ ] Product created ($49) OR using dynamic pricing
- [ ] API keys obtained
- [ ] Webhook endpoint configured
- [ ] Keys added to Netlify
- [ ] Test payment completed successfully
- [ ] Success page verified
- [ ] Upload page unlocks after payment
- [ ] Database records payment correctly

### After Launch:
- [ ] Monitor first 10 payments
- [ ] Verify webhook deliveries
- [ ] Check customer emails
- [ ] Track conversion rate
- [ ] Collect feedback
- [ ] Optimize based on data

---

**Your site is ready to accept $49 payments!**  
**Just configure Stripe and test the flow.** 🚀

---

*Guide created: February 24, 2026*  
*Current price: $49*  
*Stripe setup time: 30 minutes*  
*Ready to launch: After configuration*
