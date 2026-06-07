// Cloudflare Pages Function — reverse-proxy every /api/* request to the live
// Node backend on Render. This lets the static Pages site (the URL already
// shared with the hackathon) use the real intelligence engine WITHOUT changing
// the public link and WITHOUT any CORS setup (the hop is edge -> Render,
// server-to-server, so the browser only ever talks to its own origin).
//
// Set BACKEND_URL in the Pages project (Settings -> Environment variables) to
// your Render service URL. Falls back to the default below if unset.
const DEFAULT_BACKEND = "https://german-shepherd.onrender.com";

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);
  const backend = (env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, "");
  const target = backend + incoming.pathname + incoming.search;

  // Forward headers, but drop the inbound Host so Render routes on its own host.
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = { method: request.method, headers, redirect: "manual" };
  // Buffer the (small JSON) body for non-GET so we avoid streaming/duplex issues.
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(target, init);
    // Pass the upstream response straight through (status + headers + body).
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers(res.headers),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "backend_unreachable", target, detail: String(err) }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}
