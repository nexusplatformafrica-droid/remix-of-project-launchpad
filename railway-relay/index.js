// MovieBox relay — Railway entry point (plain JavaScript, runs on Bun or Node).
//
// WHY THIS FILE EXISTS
// MovieBox's movie file server refuses every request coming from Cloudflare's
// network (427 Forbidden), so the site Worker cannot pull movie bytes itself and
// sends those requests to a relay hosted somewhere NON-Cloudflare. This is that
// relay: plain `fetch`, no `cloudflare:sockets`, no Deno APIs. The Cloudflare
// Worker variant (docs/moviebox-relay/worker.js) crashes on Railway with
// "Cannot find package 'cloudflare:sockets'" — that is the 502 every movie
// request gets right now.
//
// DEPLOY ON RAILWAY
//   Railway -> New Project -> Deploy -> point at this folder (railway-relay/)
//   Railway installs deps and runs `npm start`, which runs this file with Bun
//   (or Node). It reads PORT automatically. Copy the resulting URL into
//   MOVIEBOX_RELAY in src/lib/moviebox.ts.
//
// RUN LOCALLY
//   bun index.js     # or: node index.js
//   http://localhost:8787/?u=<encoded https url>

const ALLOWED = /(^|\.)(aoneroom\.com|mzfi\.me|movieboxhd\.net|moviebox\.ph|hakunaymatata\.com)$/;

// Request headers forwarded upstream (the ones MovieBox's file server checks).
const PASS = [
  "authorization",
  "referer",
  "user-agent",
  "content-type",
  "accept",
  "accept-language",
  "x-client-info",
  "x-request-lang",
  "range",
  "if-range",
];

// Response headers handed back to the site Worker.
const EXPOSE = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
  "x-user",
];

async function handle(req) {
  const u = new URL(req.url).searchParams.get("u");
  let target;
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

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      signal: req.signal,
    });
  } catch (e) {
    // Upstream refused/dropped — say so instead of letting the caller see a crash.
    return new Response(`relay error: ${e && e.message ? e.message : String(e)}`, { status: 502 });
  }

  const out = new Headers();
  for (const k of EXPOSE) {
    const v = upstream.headers.get(k);
    if (v) out.set(k, v);
  }
  if (!out.has("content-type")) out.set("content-type", "application/json");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

const port = Number(process.env.PORT ?? 8787);

if (typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun.serve === "function") {
  globalThis.Bun.serve({ port, fetch: handle });
  console.log(`moviebox relay listening on :${port} (bun)`);
} else {
  const { createServer } = await import("node:http");
  const { Readable } = await import("node:stream");
  createServer(async (nodeReq, nodeRes) => {
    const url = new URL(nodeReq.url ?? "/", `http://localhost:${port}`);
    const req = new Request(url, {
      method: nodeReq.method,
      headers: nodeReq.headers,
      body: nodeReq.method === "GET" || nodeReq.method === "HEAD" ? undefined : nodeReq,
      duplex: "half",
    });
    const res = await handle(req);
    nodeRes.writeHead(res.status, Object.fromEntries(res.headers));
    if (res.body) {
      for await (const chunk of Readable.fromWeb(res.body)) nodeRes.write(chunk);
    }
    nodeRes.end();
  }).listen(port, () => console.log(`moviebox relay listening on :${port} (node)`));
}
