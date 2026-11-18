/**
 * Self-checking API keys: each key carries a signature made with this
 * server-only secret, so a key can be verified with zero database reads
 * (Firestore's free daily read quota often runs out). Env var overrides.
 */
const FALLBACK_SECRET = "cc031ffd245a28053219b82d4d033466234c48ce1b2426c16af30173a0c41252";

export type SignedPayload =
  | { t: "admin"; v: number }
  | { t: "dev"; u: string; p: string; e: number | null; i: number };

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function secret(): string {
  const env = typeof process !== "undefined" ? process.env?.["API_SIGNING_SECRET"] : undefined;
  return env && env.length >= 32 ? env : FALLBACK_SECRET;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

const PREFIX = { admin: "mmx_adm_", dev: "mmx_live_" } as const;

export async function signApiKey(payload: SignedPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const prefix = PREFIX[payload.t];
  return `${prefix}${body}.${await hmac(prefix + body)}`;
}

/** Payload of a genuinely signed key, or null (unsigned, tampered or malformed). */
export async function verifySignedKey(token: string): Promise<SignedPayload | null> {
  const prefix = token.startsWith(PREFIX.admin) ? PREFIX.admin : token.startsWith(PREFIX.dev) ? PREFIX.dev : null;
  if (!prefix || token.length > 400) return null;
  const [body, sig, extra] = token.slice(prefix.length).split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = await hmac(prefix + body);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SignedPayload;
    if (prefix === PREFIX.admin && p.t === "admin") return p;
    if (prefix === PREFIX.dev && p.t === "dev" && typeof p.u === "string" && typeof p.p === "string") return p;
  } catch {
    /* malformed */
  }
  return null;
}
