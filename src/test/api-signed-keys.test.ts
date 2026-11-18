import { afterEach, describe, expect, it, vi } from "vitest";
import { signApiKey, verifySignedKey } from "@/lib/api-signing.server";

// Simulates Firestore's "daily read quota used up" answer for every read.
function quotaExhausted() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":429}}', { status: 429 })));
}
afterEach(() => vi.unstubAllGlobals());

const req = (token: string) => new Request("https://site.test/api/public/v1/search?q=a", { headers: { authorization: `Bearer ${token}` } });

describe("signed API keys", () => {
  it("rejects a tampered key", async () => {
    const t = await signApiKey({ t: "admin", v: 1 });
    expect(await verifySignedKey(t)).not.toBeNull();
    expect(await verifySignedKey(t.slice(0, -2) + "xx")).toBeNull();
  });

  it("admin token is accepted with no limit while database reads are exhausted", async () => {
    quotaExhausted();
    const { checkApiAccess, resetApiTokenCache } = await import("@/lib/api-token");
    resetApiTokenCache();
    const r = await checkApiAccess(req(await signApiKey({ t: "admin", v: Date.now() })), {}, "https://site.test");
    expect(r.denied).toBeNull();
    expect(r.headers["x-quota-limit"]).toBe("unlimited");
  });

  it("developer key on a paid plan works while database reads are exhausted", async () => {
    quotaExhausted();
    const { checkApiAccess } = await import("@/lib/api-token");
    const key = await signApiKey({ t: "dev", u: "user1", p: "api_developer", e: Date.now() + 86_400_000, i: Date.now() });
    const r = await checkApiAccess(req(key), {}, "https://site.test");
    expect(r.denied).toBeNull();
    expect(r.headers["x-ratelimit-limit"]).toBe("5");
  });

  it("developer key whose plan expired is refused with 402", async () => {
    quotaExhausted();
    const { checkApiAccess } = await import("@/lib/api-token");
    const key = await signApiKey({ t: "dev", u: "user2", p: "api_pro", e: Date.now() - 1000, i: Date.now() });
    const r = await checkApiAccess(req(key), {}, "https://site.test");
    expect(r.denied?.status).toBe(402);
  });
});
