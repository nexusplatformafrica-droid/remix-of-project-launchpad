/**
 * Movie relay address, changeable by admins from the dashboard (Firestore
 * `app_settings/movie_relay`). Server code reads it through the public
 * Firestore REST endpoint with a short cache; when the setting is missing or
 * Firestore is unreachable, the last good value or the built-in default is used.
 */
export const DEFAULT_MOVIE_RELAY = "https://imaginative-hamster-d1eb74.netlify.app";
export const MOVIE_RELAY_KEY = "movie_relay";

const FIRESTORE_DOC =
  "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents/app_settings/movie_relay?key=AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const CACHE_MS = 60_000;

/** Returns a clean https origin (no trailing slash) or null when invalid. */
export function normalizeRelayUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function relayRequestUrl(relay: string, target: string) {
  return `${relay.replace(/\/+$/, "")}/?u=${encodeURIComponent(target)}`;
}

let cached: { value: string; at: number } | null = null;
let inflight: Promise<string> | null = null;

async function readStoredRelay(): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(FIRESTORE_DOC, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { fields?: { value?: { stringValue?: string; mapValue?: unknown } } };
    return normalizeRelayUrl(json.fields?.value?.stringValue);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Current relay address for server-side MovieBox requests. */
export async function getMovieRelay(): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  if (!inflight) {
    inflight = readStoredRelay()
      .then((stored) => {
        const value = stored ?? cached?.value ?? DEFAULT_MOVIE_RELAY;
        cached = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drops the cache so the next request re-reads the admin setting. */
export function resetMovieRelayCache() {
  cached = null;
}
