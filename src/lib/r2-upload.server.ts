// Server-only (this .server.ts file is never bundled for the browser).
const UPLOAD_TOKEN = "*";
export const UPLOAD_BACKEND = "https://moviemax-upload.nexusplatformafrica.workers.dev";

/** Forwards a signing request to the upload backend with the server-only UPLOAD_TOKEN. */
export async function callUploadBackend(path: string, body: unknown): Promise<Response> {
  const token = UPLOAD_TOKEN;
  const res = await fetch(`${UPLOAD_BACKEND}/uploads/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export type Uploader = { uid: string; role: "admin" | "artist"; email?: string | undefined };
/** Last refusal reason (non-sensitive) so the client sees why. */
export let lastRefusal = "";
const refuse = (why: string) => { lastRefusal = why; console.error("upload refused:", why); return null; };

/**
 * Verifies the Firebase ID token's signature and expiry only.
 * No database reads: any genuinely signed-in user may upload, so the
 * daily Firestore quota can never block an upload.
 */
let jwkCache: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;

export async function verifyUploader(request: Request): Promise<Uploader | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || token.length > 12000) return refuse("not signed in");
  try {
    const [encodedHeader, encodedClaims, encodedSignature, extra] = token.split(".");
    if (!encodedHeader || !encodedClaims || !encodedSignature || extra) return null;
    const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const header = JSON.parse(new TextDecoder().decode(decode(encodedHeader))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(decode(encodedClaims))) as {
      aud?: string; iss?: string; sub?: string; exp?: number; iat?: number; email?: string; email_verified?: boolean;
    };
    const project = "luo-film-2026";
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid || claims.aud !== project ||
        claims.iss !== `https://securetoken.google.com/${project}` || !claims.sub ||
        claims.exp == null || claims.exp <= now || claims.iat == null || claims.iat > now + 300) return refuse("sign-in expired, sign in again");
    if (!jwkCache || Date.now() - jwkCache.at > 3_600_000 || !jwkCache.keys.some((k) => k.kid === header.kid)) {
      const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
      if (!response.ok) return refuse("could not load sign-in keys");
      const body = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
      jwkCache = { at: Date.now(), keys: body.keys ?? [] };
    }
    const jwk = jwkCache.keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`));
    if (!valid) return refuse("invalid sign-in");
    return { uid: claims.sub, role: "admin", email: claims.email };
  } catch (e) {
    return refuse(`check error: ${String(e)}`);
  }
}
