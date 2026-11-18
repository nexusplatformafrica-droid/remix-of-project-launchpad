/**
 * Minimal HTTPS/1.1 client over Cloudflare `connect()` sockets.
 *
 * Cloudflare stamps every Worker `fetch()` subrequest with a `CF-Worker`
 * header that MovieBox's API gateway rejects (429). Raw TCP sockets are not
 * HTTP subrequests, so no header is added. Only used on workerd; elsewhere
 * callers use the normal `fetch`.
 */

export const isWorkerd = () =>
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

type Init = { method?: string; headers?: Record<string, string>; body?: string | null };

const enc = new TextEncoder();
const dec = new TextDecoder();

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function indexOfCrlfCrlf(buf: Uint8Array) {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

/** Decodes a chunked transfer-encoded body. */
export function dechunk(body: Uint8Array) {
  const parts: Uint8Array[] = [];
  let i = 0;
  while (i < body.length) {
    let lineEnd = i;
    while (lineEnd + 1 < body.length && !(body[lineEnd] === 13 && body[lineEnd + 1] === 10)) lineEnd++;
    const size = parseInt(dec.decode(body.subarray(i, lineEnd)).split(";")[0]!.trim(), 16);
    if (!size || Number.isNaN(size)) break;
    const start = lineEnd + 2;
    parts.push(body.subarray(start, start + size));
    i = start + size + 2;
  }
  return concat(parts);
}

/** Parses a raw HTTP/1.1 response into a standard Response. */
export function parseHttpResponse(raw: Uint8Array): Response {
  const split = indexOfCrlfCrlf(raw);
  if (split < 0) throw new Error("bad http response");
  const lines = dec.decode(raw.subarray(0, split)).split("\r\n");
  const status = Number(lines[0]!.split(" ")[1]) || 502;
  const headers = new Headers();
  for (const line of lines.slice(1)) {
    const c = line.indexOf(":");
    if (c > 0) headers.append(line.slice(0, c).trim(), line.slice(c + 1).trim());
  }
  let body = raw.subarray(split + 4);
  if ((headers.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) body = dechunk(body);
  headers.delete("transfer-encoding");
  const nullBody = status === 204 || status === 304 || (status >= 100 && status < 200);
  return new Response(nullBody ? null : (body as unknown as BodyInit), { status, headers });
}

export async function socketFetch(url: string, init: Init = {}): Promise<Response> {
  const u = new URL(url);
  const mod = "cloudflare:sockets";
  const { connect } = (await import(/* @vite-ignore */ mod)) as {
    connect: (a: { hostname: string; port: number }, o: { secureTransport: "on" }) => {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
      close: () => Promise<void>;
    };
  };
  const socket = connect({ hostname: u.hostname, port: Number(u.port) || 443 }, { secureTransport: "on" });
  const body = init.body ?? null;
  const head: Record<string, string> = {
    host: u.host,
    connection: "close",
    "accept-encoding": "identity",
    ...Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
  };
  if (body !== null) head["content-length"] = String(enc.encode(body).length);
  const request =
    `${init.method ?? "GET"} ${u.pathname}${u.search} HTTP/1.1\r\n` +
    Object.entries(head).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
    "\r\n\r\n" +
    (body ?? "");
  const writer = socket.writable.getWriter();
  await writer.write(enc.encode(request));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  const chunks: Uint8Array[] = [];
  const timer = setTimeout(() => void reader.cancel().catch(() => undefined), 15_000);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    await socket.close().catch(() => undefined);
  }
  return parseHttpResponse(concat(chunks));
}

/**
 * Streaming variant for large media (Range requests). Returns as soon as the
 * response headers arrive; the body streams straight from the socket.
 */
export async function socketStream(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  const u = new URL(url);
  const mod = "cloudflare:sockets";
  const { connect } = (await import(/* @vite-ignore */ mod)) as {
    connect: (a: { hostname: string; port: number }, o: { secureTransport: "on" }) => {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
      close: () => Promise<void>;
    };
  };
  const socket = connect({ hostname: u.hostname, port: Number(u.port) || 443 }, { secureTransport: "on" });
  const head: Record<string, string> = {
    host: u.host,
    connection: "close",
    "accept-encoding": "identity",
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const writer = socket.writable.getWriter();
  await writer.write(
    enc.encode(`GET ${u.pathname}${u.search} HTTP/1.1\r\n${Object.entries(head).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`),
  );
  writer.releaseLock();
  const reader = socket.readable.getReader();
  const close = () => {
    void reader.cancel().catch(() => undefined);
    void socket.close().catch(() => undefined);
  };
  signal?.addEventListener("abort", close, { once: true });

  let buf: Uint8Array = new Uint8Array(0);
  let split = -1;
  const timer = setTimeout(close, 20_000);
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
  const status = Number(lines[0]!.split(" ")[1]) || 502;
  const resHeaders = new Headers();
  for (const line of lines.slice(1)) {
    const c = line.indexOf(":");
    if (c > 0) resHeaders.append(line.slice(0, c).trim(), line.slice(c + 1).trim());
  }
  const leftover = buf.subarray(split + 4);
  if ((resHeaders.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) {
    // Rare for media; buffer and decode.
    const rest: Uint8Array[] = [leftover];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest.push(value);
    }
    close();
    resHeaders.delete("transfer-encoding");
    return new Response(dechunk(concat(rest)) as unknown as BodyInit, { status, headers: resHeaders });
  }
  let remaining = Number(resHeaders.get("content-length") ?? NaN);
  const body = new ReadableStream<Uint8Array>({
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
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
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
