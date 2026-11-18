// MovieBox relay — Cloudflare Worker version (paste-ready).
//
// Copy this ENTIRE file into the Cloudflare dashboard:
//   dash.cloudflare.com -> Workers & Pages -> Create -> Worker -> "Deploy" button
//   (choose "Hello world" / no template) -> Edit code -> delete everything ->
//   paste this file -> Deploy -> copy the *.workers.dev URL into MOVIEBOX_RELAY
//   in src/lib/moviebox.ts.
//
// IMPORTANT: MovieBox's movie file server (hakunaymatata.com) is known to answer
// "427 Forbidden" to requests coming from Cloudflare's network. This Worker uses
// raw sockets so at least the CF-Worker header problem is avoided, but if the
// block is on Cloudflare's IPs themselves, movie BYTES may still be refused —
// the API/JSON calls will work either way.

const ALLOWED = /(^|\.)(aoneroom\.com|mzfi\.me|movieboxhd\.net|moviebox\.ph|hakunaymatata\.com)$/;

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

const EXPOSE = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
  "x-user",
  "access-control-allow-origin",
];

const enc = new TextEncoder();
const dec = new TextDecoder();

function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function indexOfCrlfCrlf(buf) {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

function dechunk(body) {
  const parts = [];
  let i = 0;
  while (i < body.length) {
    let lineEnd = i;
    while (lineEnd + 1 < body.length && !(body[lineEnd] === 13 && body[lineEnd + 1] === 10)) lineEnd++;
    const size = parseInt(dec.decode(body.subarray(i, lineEnd)).split(";")[0].trim(), 16);
    if (!size || Number.isNaN(size)) break;
    const start = lineEnd + 2;
    parts.push(body.subarray(start, start + size));
    i = start + size + 2;
  }
  return concat(parts);
}

async function connectRaw(hostname, port) {
  const { connect } = await import("cloudflare:sockets");
  return connect({ hostname, port }, { secureTransport: "on" });
}

// Non-GET (usually JSON POST): buffer the whole response.
async function socketFetch(url, method, headers, body) {
  const u = new URL(url);
  const socket = await connectRaw(u.hostname, Number(u.port) || 443);
  const head = { host: u.host, connection: "close", "accept-encoding": "identity" };
  for (const [k, v] of Object.entries(headers)) head[k.toLowerCase()] = v;
  if (body != null) head["content-length"] = String(enc.encode(body).length);
  const request =
    `${method} ${u.pathname}${u.search} HTTP/1.1\r\n` +
    Object.entries(head).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
    "\r\n\r\n" +
    (body ?? "");
  const writer = socket.writable.getWriter();
  await writer.write(enc.encode(request));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const chunks = [];
  const timer = setTimeout(() => void reader.cancel().catch(() => {}), 15000);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    await socket.close().catch(() => {});
  }
  const raw = concat(chunks);
  const split = indexOfCrlfCrlf(raw);
  if (split < 0) throw new Error("bad http response");
  const lines = dec.decode(raw.subarray(0, split)).split("\r\n");
  const status = Number(lines[0].split(" ")[1]) || 502;
  const resHeaders = new Headers();
  for (const line of lines.slice(1)) {
    const c = line.indexOf(":");
    if (c > 0) resHeaders.append(line.slice(0, c).trim(), line.slice(c + 1).trim());
  }
  let out = raw.subarray(split + 4);
  if ((resHeaders.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) out = dechunk(out);
  resHeaders.delete("transfer-encoding");
  return new Response(status === 204 || status === 304 || (status >= 100 && status < 200) ? null : out, {
    status,
    headers: resHeaders,
  });
}

// GET/HEAD: stream as soon as the headers arrive (Range works).
async function socketStream(url, method, headers, signal) {
  const u = new URL(url);
  const socket = await connectRaw(u.hostname, Number(u.port) || 443);
  const head = { host: u.host, connection: "close", "accept-encoding": "identity" };
  for (const [k, v] of Object.entries(headers)) head[k.toLowerCase()] = v;
  const writer = socket.writable.getWriter();
  await writer.write(
    enc.encode(
      `${method} ${u.pathname}${u.search} HTTP/1.1\r\n` +
        Object.entries(head).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
        "\r\n\r\n",
    ),
  );
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const close = () => {
    void reader.cancel().catch(() => {});
    void socket.close().catch(() => {});
  };
  signal?.addEventListener("abort", close, { once: true });

  let buf = new Uint8Array(0);
  let split = -1;
  const timer = setTimeout(close, 20000);
  try {
    while (split < 0) {
      const { value, done } = await reader.read();
      if (done) throw new Error("connection closed before headers");
      buf = concat([buf, value]);
      split = indexOfCrlfCrlf(buf);
      if (buf.length > 64 * 1024 && split < 0) throw new Error("headers too large");
    }
  } catch (e) {
    close();
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const lines = dec.decode(buf.subarray(0, split)).split("\r\n");
  const status = Number(lines[0].split(" ")[1]) || 502;
  const resHeaders = new Headers();
  for (const line of lines.slice(1)) {
    const c = line.indexOf(":");
    if (c > 0) resHeaders.append(line.slice(0, c).trim(), line.slice(c + 1).trim());
  }
  const leftover = buf.subarray(split + 4);
  if ((resHeaders.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) {
    const rest = [leftover];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest.push(value);
    }
    close();
    resHeaders.delete("transfer-encoding");
    return new Response(dechunk(concat(rest)), { status, headers: resHeaders });
  }
  let remaining = Number(resHeaders.get("content-length") ?? NaN);
  const body = new ReadableStream({
    start(controller) {
      if (leftover.length) {
        controller.enqueue(leftover);
        if (!Number.isNaN(remaining)) remaining -= leftover.length;
      }
    },
    async pull(controller) {
      if (remaining <= 0) {
        controller.close();
        close();
        return;
      }
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done || !value) {
        controller.close();
        close();
        return;
      }
      controller.enqueue(value);
      if (!Number.isNaN(remaining)) remaining -= value.length;
    },
    cancel() {
      close();
    },
  });
  const nullBody = status === 204 || status === 304 || status < 200;
  return new Response(nullBody ? null : body, { status, headers: resHeaders });
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
          "access-control-allow-headers": req.headers.get("access-control-request-headers") || "*",
          "access-control-max-age": "86400",
        },
      });
    }
    const cors = { "access-control-allow-origin": "*" };
    let target;
    try {
      target = new URL(new URL(req.url).searchParams.get("u"));
    } catch {
      return new Response("missing u", { status: 400, headers: cors });
    }
    if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
      return new Response("host not allowed", { status: 403, headers: cors });
    }
    const headers = {};
    for (const k of PASS) {
      const v = req.headers.get(k);
      if (v) headers[k] = v;
    }
    try {
      const body = req.method === "GET" || req.method === "HEAD" ? null : await req.text();
      const res =
        req.method === "GET" || req.method === "HEAD"
          ? await socketStream(target.toString(), req.method, headers, req.signal)
          : await socketFetch(target.toString(), req.method, headers, body);
      const out = new Headers(cors);
      for (const k of EXPOSE) {
        const v = res.headers.get(k);
        if (v) out.set(k, v);
      }
      if (!out.has("content-type")) out.set("content-type", "application/json");
      return new Response(res.body, { status: res.status, headers: out });
    } catch (e) {
      return new Response(`relay error: ${e?.message ?? e}`, { status: 502, headers: cors });
    }
  },
};
