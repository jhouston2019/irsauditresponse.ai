-- Enforce at most one audit_responses row per Stripe Checkout session (idempotency).
-- Apply after deduplicating any duplicate stripe_session_id values in audit_responses.

create unique index if not exists audit_responses_stripe_session_id_unique
  on public.audit_responses (stripe_session_id)
  where stripe_session_id is not null;
