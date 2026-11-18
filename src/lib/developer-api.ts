/**
 * Developer API keys, plan lookup and metering — all in Firestore.
 * Collections:
 *  - api_keys/{sha256(token)}   { user_id, name, last4, revoked, created_at }
 *  - api_subscriptions/{id}     { user_id, plan_id, billing, status, expires_at, ... }
 *  - api_usage/{hash}_{YYYYMM}  { key_hash, user_id, month, count }
 * Runs in server routes / server functions (REST, no Firebase SDK).
 * Reads are cached in-isolate to protect the free daily read quota; usage
 * counts are batched and flushed with atomic Firestore increments.
 */
import { fromFirestoreFields } from "./firestore-rest";
import {
  activeDevPlan,
  devPlan,
  monthKey,
  quotaAllows,
  rateWindow,
  secondsToNextMonth,
  type DevPlan,
  type DevSubscription,
} from "./developer-plans";

const PROJECT = "luo-film-2026";
const KEY = "AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const DB = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DB}`;

/* ---------------- Firestore REST helpers ---------------- */

type Fs = Record<string, unknown>;

function toValue(v: unknown): Fs {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}
const toFields = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

class FsUnavailable extends Error {}

/** After a 429 (daily read quota used up) skip reads for a minute so calls stay fast. */
let readsDownUntil = 0;
function readGate() {
  if (Date.now() < readsDownUntil) throw new FsUnavailable("firestore reads paused");
}
function noteReadStatus(status: number) {
  if (status === 429) readsDownUntil = Date.now() + 60_000;
}

export async function fsGet(path: string): Promise<Record<string, unknown> | null> {
  readGate();
  const res = await fetch(`${BASE}/${path}?key=${KEY}`, { signal: AbortSignal.timeout(4000) });
  if (res.status === 404) return null;
  noteReadStatus(res.status);
  if (!res.ok) throw new FsUnavailable(`firestore ${res.status}`);
  const j = (await res.json()) as { fields?: Record<string, never> };
  return fromFirestoreFields(j.fields);
}

export async function fsSet(path: string, data: Record<string, unknown>) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(`${BASE}/${path}?key=${KEY}&${mask}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: toFields(data) }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Could not save (${res.status})`);
}

/** All docs in a collection where `field == value` (single-field index, no setup needed). */
export async function fsWhere(collection: string, field: string, value: string): Promise<Record<string, unknown>[]> {
  readGate();
  const res = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
        limit: 500,
      },
    }),
    signal: AbortSignal.timeout(6000),
  });
  noteReadStatus(res.status);
  if (!res.ok) throw new FsUnavailable(`firestore ${res.status}`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, never> } }[];
  return rows.filter((r) => r.document).map((r) => ({ ...fromFirestoreFields(r.document!.fields), id: r.document!.name.split("/").pop() }));
}

async function fsIncrement(path: string, by: number, fields: Record<string, unknown>) {
  const res = await fetch(`${BASE}:commit?key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          update: { name: `${DB}/${path}`, fields: toFields(fields) },
          updateMask: { fieldPaths: Object.keys(fields) },
          updateTransforms: [{ fieldPath: "count", increment: { integerValue: String(by) } }],
        },
      ],
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`usage write ${res.status}`);
}

/* ---------------- token helpers ---------------- */

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newDeveloperKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `mmx_live_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/* ---------------- cached lookups ---------------- */

type KeyDoc = { user_id: string; revoked: boolean; name: string };
const keyCache = new Map<string, { at: number; doc: KeyDoc | null }>();
const subCache = new Map<string, { at: number; subs: DevSubscription[] }>();
const KEY_TTL = 60_000;
const SUB_TTL = 60_000;

async function lookupKey(hash: string): Promise<KeyDoc | null | undefined> {
  const hit = keyCache.get(hash);
  if (hit && Date.now() - hit.at < KEY_TTL) return hit.doc;
  try {
    const d = await fsGet(`api_keys/${hash}`);
    const doc = d && d["user_id"] ? { user_id: String(d["user_id"]), revoked: d["revoked"] === true, name: String(d["name"] ?? "") } : null;
    keyCache.set(hash, { at: Date.now(), doc });
    return doc;
  } catch {
    return hit ? hit.doc : undefined; // stale copy when Firestore is out of quota
  }
}

export async function userSubscriptions(uid: string, fresh = false): Promise<DevSubscription[] | undefined> {
  const hit = subCache.get(uid);
  if (!fresh && hit && Date.now() - hit.at < SUB_TTL) return hit.subs;
  try {
    const subs = (await fsWhere("api_subscriptions", "user_id", uid)) as unknown as DevSubscription[];
    subCache.set(uid, { at: Date.now(), subs });
    return subs;
  } catch {
    return hit?.subs;
  }
}

export function forgetDeveloperCaches(uid?: string, hash?: string) {
  if (uid) subCache.delete(uid);
  if (hash) keyCache.delete(hash);
}

/* ---------------- metering ---------------- */

type Usage = { month: string; remote: number; remoteAt: number; pending: number; lastFlush: number; uid: string };
const usage = new Map<string, Usage>();
const hits = new Map<string, number[]>();
const FLUSH_EVERY = 10;
const FLUSH_MS = 5000;
const REMOTE_TTL = 60_000;

async function usageFor(hash: string, uid: string): Promise<Usage> {
  const month = monthKey();
  let u = usage.get(hash);
  if (!u || u.month !== month) {
    u = { month, remote: 0, remoteAt: 0, pending: 0, lastFlush: Date.now(), uid };
    usage.set(hash, u);
  }
  if (Date.now() - u.remoteAt > REMOTE_TTL) {
    try {
      const d = await fsGet(`api_usage/${hash}_${month}`);
      u.remote = Number(d?.["count"] ?? 0) || 0;
      u.remoteAt = Date.now();
    } catch {
      /* keep last known count */
    }
  }
  return u;
}

async function flush(hash: string, u: Usage, force = false) {
  if (u.pending <= 0) return;
  if (!force && u.pending < FLUSH_EVERY && Date.now() - u.lastFlush < FLUSH_MS) return;
  const n = u.pending;
  u.pending = 0;
  u.lastFlush = Date.now();
  try {
    await fsIncrement(`api_usage/${hash}_${u.month}`, n, {
      key_hash: hash,
      user_id: u.uid,
      month: u.month,
      updated_at: new Date().toISOString(),
    });
    u.remote += n;
  } catch (e) {
    u.pending += n; // retry on the next request
    console.error("api usage flush", e);
  }
}

export type DeveloperCheck =
  | { ok: true; headers: Record<string, string>; plan: DevPlan }
  | { ok: false; status: number; error: string; headers: Record<string, string> };

/** Checks a developer key: valid, paid plan, per-second rate and monthly quota; then counts the call. */
export async function checkDeveloperKey(token: string, origin: string): Promise<DeveloperCheck> {
  const hash = await sha256Hex(token);
  const { verifySignedKey } = await import("./api-signing.server");
  const signed = await verifySignedKey(token);
  const payload = signed && signed.t === "dev" ? signed : null;
  const key = await lookupKey(hash);
  let uid: string;
  if (key === undefined) {
    // Database unreadable (daily read limit): a signed key carries its owner, plan and expiry.
    if (!payload) {
      return { ok: false, status: 503, error: `This is an old-style API key that needs the database to check it, and the database is busy. Create a new key at ${origin}/developer — new keys always work.`, headers: { "retry-after": "60" } };
    }
    uid = payload.u;
  } else {
    if (!key || key.revoked) return { ok: false, status: 401, error: "Invalid or missing API token", headers: {} };
    uid = key.user_id;
  }

  const subs = await userSubscriptions(uid);
  let plan: DevPlan | null = null;
  if (subs !== undefined) {
    plan = activeDevPlan(subs)?.plan ?? null;
  } else if (payload && payload.u === uid && (payload.e == null || payload.e > Date.now())) {
    plan = devPlan(payload.p);
  } else if (!payload) {
    return { ok: false, status: 503, error: "Plan could not be checked — retry shortly", headers: { "retry-after": "60" } };
  }
  if (!plan) {
    return { ok: false, status: 402, error: `No active developer plan — subscribe at ${origin}/developer`, headers: {} };
  }

  const rate = rateWindow(hits.get(hash) ?? [], Date.now(), plan.perSecond);
  hits.set(hash, rate.hits);
  const rateHeaders = { "x-ratelimit-limit": String(plan.perSecond), "x-ratelimit-remaining": String(rate.remaining), "x-plan": plan.name };
  if (!rate.allowed) {
    return { ok: false, status: 429, error: `Rate limit: ${plan.perSecond} requests per second on the ${plan.name} plan`, headers: { ...rateHeaders, "retry-after": "1" } };
  }

  const u = await usageFor(hash, uid);
  const used = u.remote + u.pending;
  const quota = plan.monthlyRequests;
  const quotaHeaders: Record<string, string> = quota == null
    ? { "x-quota-limit": "unlimited", "x-quota-used": String(used + 1) }
    : { "x-quota-limit": String(quota), "x-quota-used": String(Math.min(quota, used + 1)), "x-quota-remaining": String(Math.max(0, quota - used - 1)) };
  if (!quotaAllows(used, quota)) {
    return {
      ok: false,
      status: 429,
      error: `Monthly quota of ${quota!.toLocaleString("en-US")} requests reached on the ${plan.name} plan — upgrade at ${origin}/developer`,
      headers: { ...rateHeaders, ...quotaHeaders, "x-quota-remaining": "0", "retry-after": String(secondsToNextMonth()) },
    };
  }
  u.pending += 1;
  await flush(hash, u);
  return { ok: true, plan, headers: { ...rateHeaders, ...quotaHeaders } };
}

/** Usage numbers for the developer dashboard (includes not-yet-flushed calls in this isolate). */
export async function usageCount(hash: string): Promise<number> {
  const u = usage.get(hash);
  if (u && u.month === monthKey()) await flush(hash, u, true);
  try {
    const d = await fsGet(`api_usage/${hash}_${monthKey()}`);
    return Number(d?.["count"] ?? 0) || 0;
  } catch {
    return u ? u.remote + u.pending : 0;
  }
}
