// MovieBox relay — deploy on a NON-Cloudflare host (Deno Deploy, Render, Vercel Node).
// MovieBox's movie file server (hakunaymatata.com) answers "427 Forbidden" to every
// request coming from Cloudflare's network, even raw sockets, so a Cloudflare-hosted
// site cannot pull movie files itself. The site Worker sends those requests here.
// Deno Deploy: new project -> paste this file -> copy the URL into
// MOVIEBOX_RELAY in src/lib/moviebox.ts.

const ALLOWED = /(^|\.)(aoneroom\.com|mzfi\.me|movieboxhd\.net|moviebox\.ph|hakunaymatata\.com)$/;
const PASS = [
  "authorization",
  "referer",
  "user-agent",
  "content-type",
  "accept",
  "x-client-info",
  "x-request-lang",
  "range",
  "if-range",
];
const EXPOSE = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
  "x-user",
];

async function handle(req: Request): Promise<Response> {
  const u = new URL(req.url).searchParams.get("u");
  let target: URL;
  try {
    target = new URL(u ?? "");
  } catch {
    return new Response("missing u", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }
  const headers = new Headers();
  for (const k of PASS) {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  }
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    signal: req.signal,
  });
  const out = new Headers();
  for (const k of EXPOSE) {
    const v = upstream.headers.get(k);
    if (v) out.set(k, v);
  }
  if (!out.has("content-type")) out.set("content-type", "application/json");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

Deno.serve(handle);
