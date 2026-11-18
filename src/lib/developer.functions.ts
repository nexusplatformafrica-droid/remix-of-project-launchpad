import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Developer dashboard server functions. The caller proves who they are with
 * their Firebase ID token (signature-checked server-side); keys are created
 * only while the caller has an active paid developer plan.
 */

async function uidFrom(idToken: string): Promise<string> {
  const { verifyUploader } = await import("./r2-upload.server");
  const who = await verifyUploader(new Request("https://local/", { headers: { authorization: `Bearer ${idToken}` } }));
  if (!who) throw new Error("Please sign in again");
  return who.uid;
}

const auth = z.object({ idToken: z.string().min(20).max(12000) });

export type DevKeyRow = { hash: string; name: string; last4: string; created_at: string; used: number };

export const getDeveloperOverview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    const uid = await uidFrom(data.idToken);
    const api = await import("./developer-api");
    const { activeDevPlan } = await import("./developer-plans");
    const subs = (await api.userSubscriptions(uid, true)) ?? [];
    const active = activeDevPlan(subs);
    let keys: DevKeyRow[] = [];
    let error: string | null = null;
    try {
      const rows = await api.fsWhere("api_keys", "user_id", uid);
      keys = await Promise.all(
        rows
          .filter((r) => r["revoked"] !== true)
          .map(async (r) => ({
            hash: String(r["id"]),
            name: String(r["name"] ?? "API key"),
            last4: String(r["last4"] ?? ""),
            created_at: String(r["created_at"] ?? ""),
            used: await api.usageCount(String(r["id"])),
          })),
      );
      keys.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } catch {
      error = "Your keys could not be loaded right now (database daily limit). Try again later.";
    }
    return {
      plan: active ? { id: active.plan.id, name: active.plan.name, expiresAt: active.expiresAt } : null,
      keys,
      used: keys.reduce((n, k) => n + k.used, 0),
      error,
    };
  });

export const createDeveloperKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const uid = await uidFrom(data.idToken);
    const api = await import("./developer-api");
    const { activeDevPlan } = await import("./developer-plans");
    const busy = { ok: false as const, error: "The database has reached its daily limit, so your plan can't be checked right now. Please try again in a few hours." };
    const subs = await api.userSubscriptions(uid, true);
    if (subs === undefined) return busy;
    const active = activeDevPlan(subs);
    if (!active) return { ok: false as const, error: "Buy a developer plan first — keys are only created on a paid plan." };
    let existing: Record<string, unknown>[];
    try {
      existing = (await api.fsWhere("api_keys", "user_id", uid)).filter((r) => r["revoked"] !== true);
    } catch {
      return busy;
    }
    const max = active.plan.keys;
    if (max != null && existing.length >= max) {
      return { ok: false as const, error: `Your ${active.plan.name} plan allows ${max} API key${max === 1 ? "" : "s"}. Delete one or upgrade.` };
    }
    // Signed key: carries owner, plan and expiry so calls work even when database reads are exhausted.
    const { signApiKey } = await import("./api-signing.server");
    const expires = active.expiresAt ? new Date(active.expiresAt).getTime() : null;
    const token = await signApiKey({ t: "dev", u: uid, p: active.plan.id, e: expires, i: Date.now() });
    const hash = await api.sha256Hex(token);
    await api.fsSet(`api_keys/${hash}`, {
      user_id: uid,
      name: data.name,
      last4: token.slice(-4),
      revoked: false,
      created_at: new Date().toISOString(),
    });
    api.forgetDeveloperCaches(uid, hash);
    return { ok: true as const, token };
  });

export const revokeDeveloperKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(d))
  .handler(async ({ data }) => {
    const uid = await uidFrom(data.idToken);
    const api = await import("./developer-api");
    const doc = await api.fsGet(`api_keys/${data.hash}`);
    if (!doc || doc["user_id"] !== uid) return { ok: false as const, error: "Key not found" };
    await api.fsSet(`api_keys/${data.hash}`, { revoked: true, revoked_at: new Date().toISOString() });
    api.forgetDeveloperCaches(uid, data.hash);
    return { ok: true as const };
  });

/** Drops the cached plan right after a payment so new keys work at once. */
export const refreshDeveloperPlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    const uid = await uidFrom(data.idToken);
    const api = await import("./developer-api");
    api.forgetDeveloperCaches(uid);
    return { ok: true };
  });
