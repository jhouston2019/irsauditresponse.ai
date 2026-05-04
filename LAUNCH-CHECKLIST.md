---

# Pre-launch checklist — IRS Audit Defense Pro

Three manual steps remain before production. Complete them in order.

---

## Step 1 — Verify live Supabase DB state (FIX #3)

Run these three queries in the Supabase SQL editor for this project.
All three must return meaningful results before launch.

**Query 1 — confirm audit_jobs columns**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_jobs'
ORDER BY ordinal_position;
```
Expected: rows for id, user_id, paid, is_unlocked, stripe_session_id, letter_full, preview_text, customer_email.
If customer_email is missing, proceed to Step 3 first.

**Query 2 — confirm RLS policies on audit_jobs**
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'audit_jobs';
```
Expected: at least one policy gating reads/writes to auth.uid() = user_id.
If empty: RLS is not enforced. Do not launch until policies are confirmed.

**Query 3 — confirm handle_new_user trigger**
```sql
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgname = 'handle_new_user';
```
Expected: one row, tgenabled = 'O' (enabled).
If missing: new user signups will not create the expected downstream rows.

---

## Step 2 — Apply FK constraint public.users → auth.users (FIX #8)

Run this migration in the Supabase SQL editor.
If the constraint already exists, the query returns an error — that is fine, ignore it.

```sql
ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;
```

---

## Step 3 — Apply customer_email + stripe_session_id unique index migration (FIX #4 / #5)

Apply the migration at supabase/migrations/20260203130000_audit_jobs_customer_email_stripe_unique.sql
via the Supabase dashboard (SQL editor) or Supabase CLI before deploying to production.

This migration:
- Adds the customer_email column to audit_jobs if missing
- Creates a partial unique index on stripe_session_id where not null

The verify-session email fallback and stripe-webhook upsert both depend on this being live.
Deploying without it means the webhook upsert will fail silently and the email fallback will not function.

To apply via CLI:
  supabase db push

To apply manually: open the migration file, copy the SQL, run it in the Supabase SQL editor.

---

## Step 4 — Confirm Stripe price ID matches $49

The STRIPE_PRICE_ID env variable is injected at build time.
Verify in the Stripe dashboard that the price ID in your Netlify environment variables
corresponds to a $49 one-time payment product.

images/og-image-generator.html contains $149 in generator copy — this is not part of
the live checkout funnel but should be updated before any paid acquisition campaign
to avoid screenshot confusion.

---

## Step 5 — Smoke test the full purchase flow end-to-end

Use Stripe test mode. Complete this sequence:

1. Land on /pricing — confirm $49 is displayed
2. Click buy — confirm Stripe checkout opens with correct price
3. Complete payment with test card 4242 4242 4242 4242 4242
4. Confirm redirect to /register?session_id=...
5. Create a new account
6. Confirm redirect to /app (or audit-defense.html)
7. Upload or paste a notice and run Analyze
8. Confirm analysis loads (not a 402)
9. Select a strategy and generate a letter
10. Download PDF and DOCX
11. Confirm both files contain the correct job content

If step 8 returns 402: the webhook has not written paid=true yet. Check Stripe webhook logs
in the dashboard. Confirm the stripe-webhook function received the checkout.session.completed event.

---

All five steps complete → safe to launch.
