import { describe, expect, it } from "vitest";
import { DEV_PLANS, devPlan, planPriceUsd, quotaAllows, rateWindow, activeDevPlan } from "@/lib/developer-plans";

describe("developer plans", () => {
  it("match the published prices and limits", () => {
    expect(devPlan("api_developer")).toMatchObject({ monthlyUsd: 9.99, monthlyRequests: 10_000, perSecond: 5, keys: 1 });
    expect(devPlan("api_pro")).toMatchObject({ monthlyUsd: 24.99, monthlyRequests: 100_000, perSecond: 15, keys: 3 });
    expect(devPlan("api_business")).toMatchObject({ monthlyUsd: 59.99, monthlyRequests: 500_000, perSecond: 30, keys: 10 });
    expect(devPlan("api_premium")).toMatchObject({ monthlyUsd: 149.99, monthlyRequests: null, keys: null });
    expect(DEV_PLANS).toHaveLength(4);
  });
  it("yearly billing charges 10 months", () => {
    expect(planPriceUsd(devPlan("api_pro")!, "yearly")).toBe(249.9);
    expect(planPriceUsd(devPlan("api_pro")!, "monthly")).toBe(24.99);
  });
  it("allows 5 calls per second on Developer and refuses the 6th", () => {
    let hits: number[] = [];
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const r = rateWindow(hits, now + i, 5);
      expect(r.allowed).toBe(true);
      hits = r.hits;
    }
    expect(rateWindow(hits, now + 10, 5).allowed).toBe(false);
    expect(rateWindow(hits, now + 1001, 5).allowed).toBe(true);
  });
  it("stops at the monthly quota, never for unlimited", () => {
    expect(quotaAllows(9_999, 10_000)).toBe(true);
    expect(quotaAllows(10_000, 10_000)).toBe(false);
    expect(quotaAllows(10_000_000, null)).toBe(true);
  });
  it("ignores expired plans and picks the best active one", () => {
    const now = Date.parse("2026-11-15T00:00:00Z");
    expect(activeDevPlan([{ plan_id: "api_pro", status: "active", expires_at: "2026-11-01T00:00:00Z" }], now)).toBeNull();
    const best = activeDevPlan([
      { plan_id: "api_developer", status: "active", expires_at: "2026-12-01T00:00:00Z" },
      { plan_id: "api_business", status: "active", expires_at: "2026-12-01T00:00:00Z" },
    ], now);
    expect(best?.plan.id).toBe("api_business");
  });
});

/** Fake Firestore: one key owned by user u1, with configurable subscription + usage. */
function fakeFirestore(opts: { subs: unknown[]; usage: number }) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(":runQuery")) {
      return Response.json(opts.subs.map((s) => ({ document: { name: "x/s1", fields: Object.fromEntries(Object.entries(s as object).map(([k, v]) => [k, { stringValue: String(v) }])) } })));
    }
    if (url.includes(":commit")) return Response.json({});
    if (url.includes("/api_usage/")) return Response.json({ fields: { count: { integerValue: String(opts.usage) } } });
    if (url.includes("/api_keys/")) return Response.json({ fields: { user_id: { stringValue: "u1" }, revoked: { booleanValue: false } } });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

describe("developer key check", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  it("needs a paid plan (402), then enforces 5/s on Developer", async () => {
    const mod = await import("@/lib/developer-api");
    const orig = globalThis.fetch;
    try {
      globalThis.fetch = fakeFirestore({ subs: [], usage: 0 });
      const t1 = mod.newDeveloperKey();
      expect((await mod.checkDeveloperKey(t1, "https://x.site")).ok).toBe(false);
      expect(await mod.checkDeveloperKey(t1, "https://x.site")).toMatchObject({ status: 402 });

      globalThis.fetch = fakeFirestore({ subs: [{ user_id: "u1", plan_id: "api_developer", status: "active", expires_at: future }], usage: 0 });
      mod.forgetDeveloperCaches("u1");
      const t2 = mod.newDeveloperKey();
      const results = [];
      for (let i = 0; i < 6; i++) results.push(await mod.checkDeveloperKey(t2, "https://x.site"));
      expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
      expect(results[5]).toMatchObject({ ok: false, status: 429 });
    } finally {
      globalThis.fetch = orig;
    }
  });
  it("refuses once 10,000 monthly requests are used", async () => {
    const mod = await import("@/lib/developer-api");
    const orig = globalThis.fetch;
    try {
      globalThis.fetch = fakeFirestore({ subs: [{ user_id: "u1", plan_id: "api_developer", status: "active", expires_at: future }], usage: 10_000 });
      mod.forgetDeveloperCaches("u1");
      const r = await mod.checkDeveloperKey(mod.newDeveloperKey(), "https://x.site");
      expect(r).toMatchObject({ ok: false, status: 429 });
    } finally {
      globalThis.fetch = orig;
    }
  });
  it("admin token has no rate limit", async () => {
    const { checkApiAccess, newApiToken, sha256Hex, resetApiTokenCache } = await import("@/lib/api-token");
    const token = newApiToken();
    const hash = await sha256Hex(token);
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ fields: { value: { mapValue: { fields: { hash: { stringValue: hash } } } } } })) as typeof fetch;
    try {
      resetApiTokenCache();
      const req = new Request("https://x.site/api/public/v1/luo", { headers: { authorization: `Bearer ${token}` } });
      for (let i = 0; i < 50; i++) expect((await checkApiAccess(req, {}, "https://x.site")).denied).toBeNull();
    } finally {
      globalThis.fetch = orig;
      resetApiTokenCache();
    }
  });
});
