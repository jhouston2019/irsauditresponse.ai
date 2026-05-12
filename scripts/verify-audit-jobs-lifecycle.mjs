#!/usr/bin/env node
/**
 * Direct Supabase verification for audit_jobs persistence (service role; bypasses RLS).
 * Does not infer success from builds or HTTP — reads actual row state.
 *
 * Usage:
 *   node scripts/verify-audit-jobs-lifecycle.mjs
 *   node scripts/verify-audit-jobs-lifecycle.mjs --job-id=<uuid>
 *
 * Optional dashboard-style RLS read (anon key + user access token):
 *   VERIFY_USER_JWT=<supabase_access_token> node scripts/verify-audit-jobs-lifecycle.mjs --user-id=<auth.users_uuid>
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loads .env from cwd if present)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val && process.env[key] == null) process.env[key] = val;
  }
}

function parseArgs() {
  const out = { jobId: null, userId: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--job-id=")) out.jobId = a.slice(9).trim();
    if (a.startsWith("--user-id=")) out.userId = a.slice(11).trim();
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function summarizeRow(r) {
  return {
    id: r.id,
    updated_at: r.updated_at,
    created_at: r.created_at,
    user_id: r.user_id,
    paid: r.paid,
    is_unlocked: r.is_unlocked,
    stripe_session_id: r.stripe_session_id ? `${String(r.stripe_session_id).slice(0, 14)}…` : null,
    selected_strategy: r.selected_strategy ?? null,
    letter_full_chars: r.letter_full ? String(r.letter_full).length : 0,
    letter_html_chars: r.letter_html ? String(r.letter_html).length : 0,
    has_preview_text: Boolean(r.preview_text && String(r.preview_text).trim()),
  };
}

async function main() {
  loadDotEnv();
  const { jobId: argJobId, userId: argUserId } = parseArgs();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log(
      JSON.stringify(
        {
          finding: "BLOCKED_NO_DB_CREDENTIALS",
          message:
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env) to query audit_jobs. Node/build checks do not verify persistence.",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const columns =
    "id,created_at,updated_at,user_id,stripe_session_id,paid,is_unlocked,selected_strategy,preview_text,letter_html,letter_full,customer_email";

  if (argJobId) {
    if (!UUID_RE.test(argJobId)) {
      console.log(JSON.stringify({ finding: "INVALID_JOB_ID", argJobId }, null, 2));
      process.exit(1);
    }
    const { data: row, error } = await admin.from("audit_jobs").select(columns).eq("id", argJobId).maybeSingle();
    if (error) {
      console.log(JSON.stringify({ finding: "QUERY_ERROR", message: error.message, code: error.code }, null, 2));
      process.exit(1);
    }
    if (!row) {
      console.log(JSON.stringify({ finding: "JOB_NOT_FOUND", job_id: argJobId }, null, 2));
      process.exit(1);
    }

    const letterFullLen = row.letter_full ? String(row.letter_full).length : 0;
    let analysisParsable = false;
    try {
      if (row.letter_full && String(row.letter_full).trim()) {
        JSON.parse(String(row.letter_full));
        analysisParsable = true;
      }
    } catch {
      analysisParsable = false;
    }
    const letterHtmlLen = row.letter_html ? String(row.letter_html).length : 0;

    const paidish = !!(row.paid || row.is_unlocked);
    const issues = [];
    if (paidish && !row.stripe_session_id && !row.user_id) {
      issues.push("paid/is_unlocked but both stripe_session_id and user_id are null");
    }

    console.log(
      JSON.stringify(
        {
          finding: issues.length ? "JOB_INTEGRITY_ISSUES" : "JOB_ROW_OK",
          job: summarizeRow(row),
          analysis_json_ok: analysisParsable,
          has_selected_strategy: Boolean(row.selected_strategy && String(row.selected_strategy).trim()),
          integrity_issues: issues,
        },
        null,
        2,
      ),
    );
    process.exit(issues.length ? 1 : 0);
  }

  const { data: orphans, error: oErr } = await admin
    .from("audit_jobs")
    .select("id,paid,user_id,stripe_session_id,updated_at")
    .eq("paid", true)
    .is("user_id", null)
    .limit(30);

  if (oErr) {
    console.log(JSON.stringify({ finding: "ORPHAN_QUERY_ERROR", message: oErr.message }, null, 2));
    process.exit(1);
  }

  const { data: recent, error: rErr } = await admin
    .from("audit_jobs")
    .select(columns)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (rErr) {
    console.log(JSON.stringify({ finding: "RECENT_QUERY_ERROR", message: rErr.message }, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        finding: "FLEET_SCAN",
        orphan_paid_no_user_count: orphans?.length ?? 0,
        orphan_paid_no_user_ids: (orphans || []).map((r) => r.id),
        recent_row_count: recent?.length ?? 0,
        recent: (recent || []).map(summarizeRow),
      },
      null,
      2,
    ),
  );

  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const jwt = process.env.VERIFY_USER_JWT;
  const uid = argUserId || process.env.VERIFY_USER_ID;
  if (anon && jwt && uid && UUID_RE.test(uid)) {
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const { data: rlsRows, error: rlsErr } = await userClient.from("audit_jobs").select("id,user_id,updated_at");
    const { count: svcCount, error: cErr } = await admin
      .from("audit_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);

    const rlsIds = new Set((rlsRows || []).map((r) => r.id));
    const foreign = (rlsRows || []).filter((r) => r.user_id && r.user_id !== uid);

    console.log(
      JSON.stringify(
        {
          finding: "RLS_DASHBOARD_READ_SIMULATION",
          user_id: uid,
          rls_error: rlsErr?.message || null,
          rows_visible_under_rls: rlsRows?.length ?? 0,
          service_role_count_for_user_id_eq: cErr ? null : svcCount,
          rls_row_ids: [...rlsIds],
          user_id_mismatch_in_rls_rows: foreign.map((r) => r.id),
          note: "JWT must belong to user_id; RLS policy is auth.uid() = user_id",
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      JSON.stringify(
        {
          finding: "RLS_CHECK_SKIPPED",
          need: "SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY), VERIFY_USER_JWT, and --user-id=<uuid> matching that session",
        },
        null,
        2,
      ),
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.log(JSON.stringify({ finding: "SCRIPT_ERROR", message: e.message }, null, 2));
  process.exit(1);
});
