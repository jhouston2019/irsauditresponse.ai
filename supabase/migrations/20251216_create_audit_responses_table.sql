-- IRS Audit Response Database Schema
-- Run this in Supabase SQL Editor

-- Table for audit responses (separate from tax letter help)
CREATE TABLE IF NOT EXISTS public.audit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- User information
  user_email TEXT,
  
  -- Payment information
  stripe_session_id TEXT,
  stripe_payment_status TEXT CHECK (stripe_payment_status IN ('unpaid','paid','refunded')) DEFAULT 'unpaid',
  price_id TEXT DEFAULT 'audit_response_149',
  amount_paid INTEGER DEFAULT 14900, -- $149.00 in cents
  
  -- Audit notice data
  letter_text TEXT,
  notice_date TIMESTAMPTZ,
  
  -- Analysis results
  analysis JSONB,
  audit_type TEXT,
  risk_level TEXT CHECK (risk_level IN ('low','medium','high','critical')),
  escalation_required BOOLEAN DEFAULT FALSE,
  
  -- Response data
  response_outline TEXT,
  validation_result JSONB,
  
  -- Status tracking
  status TEXT CHECK (status IN ('uploaded','analyzed','response_generated','completed','error')) DEFAULT 'uploaded',
  
  -- Metadata
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS audit_responses_created_at_idx ON public.audit_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_responses_session_idx ON public.audit_responses (stripe_session_id);
CREATE INDEX IF NOT EXISTS audit_responses_email_idx ON public.audit_responses (user_email);
CREATE INDEX IF NOT EXISTS audit_responses_audit_type_idx ON public.audit_responses (audit_type);
CREATE INDEX IF NOT EXISTS audit_responses_status_idx ON public.audit_responses (status);

-- Enable Row Level Security
ALTER TABLE public.audit_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Deny all by default (server-only access)
CREATE POLICY "deny_all_by_default" ON public.audit_responses
  AS PERMISSIVE FOR ALL
  TO public
  USING (FALSE)
  WITH CHECK (FALSE);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audit_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_audit_responses_updated_at_trigger
  BEFORE UPDATE ON public.audit_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_responses_updated_at();

-- Comments
COMMENT ON TABLE public.audit_responses IS 'IRS Audit Response records - separate from Tax Letter Help';
COMMENT ON COLUMN public.audit_responses.audit_type IS 'Type of audit: correspondence_audit, office_audit, field_audit, document_request, follow_up_audit';
COMMENT ON COLUMN public.audit_responses.risk_level IS 'Risk assessment: low, medium, high, critical';
COMMENT ON COLUMN public.audit_responses.escalation_required IS 'Whether professional representation is required';

