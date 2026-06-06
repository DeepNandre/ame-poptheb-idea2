// Demo-request capture → Supabase (PostgREST).
//
// Writes one row to public.demo_requests directly from the browser. This works
// on any host (including a static deploy) — no Node server required.
//
// The publishable "anon" key below is SAFE to ship to the browser: the table
// has Row-Level Security with an INSERT-only policy, so visitors can submit a
// lead but cannot read, update, or delete anything. See supabase/demo_requests.sql.

const SUPABASE_URL = "https://tqluopqiwnmpxeqevxmb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbHVvcHFpd25tcHhlcWV2eG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjczODUsImV4cCI6MjA5NjI0MzM4NX0.3SJzJOsdJ4XbEpMmIwMD1L_2tbY6IoR7cfN-jsUt8nY";

export interface DemoRequest {
  name: string;
  email: string;
  company: string;
}

export async function submitDemoRequest({ name, email, company }: DemoRequest): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name,
      email,
      company: company || null,
      source: "book-a-demo",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${detail}`);
  }
}
