import { describe, expect, it } from "vitest";
import { extractApiToken, newApiToken, sha256Hex, tokenMatches } from "@/lib/api-token";

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("developer API token", () => {
  it("accepts the token from Authorization: Bearer", () => {
    expect(extractApiToken(req("https://x.site/api/public/v1/luo", { authorization: "Bearer mmx_abc" }))).toBe("mmx_abc");
  });
  it("accepts the token from X-API-Key", () => {
    expect(extractApiToken(req("https://x.site/api/public/v1/luo", { "x-api-key": "mmx_def" }))).toBe("mmx_def");
  });
  it("accepts the token from ?api_key=", () => {
    expect(extractApiToken(req("https://x.site/api/public/v1/luo?api_key=mmx_q"))).toBe("mmx_q");
  });
  it("finds no token when none is sent", () => {
    expect(extractApiToken(req("https://x.site/api/public/v1/luo"))).toBeNull();
  });
  it("matches only the token whose hash is stored", async () => {
    const token = newApiToken();
    const hash = await sha256Hex(token);
    expect(await tokenMatches(token, hash)).toBe(true);
    expect(await tokenMatches(newApiToken(), hash)).toBe(false);
    expect(await tokenMatches(null, hash)).toBe(false);
    expect(await tokenMatches(token, null)).toBe(false);
  });
});

describe("API access check", () => {
  it("lets the stored token in and turns others away with 401", async () => {
    const { checkApiAccess, resetApiTokenCache } = await import("@/lib/api-token");
    const token = newApiToken();
    const hash = await sha256Hex(token);
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      Response.json({ fields: { value: { mapValue: { fields: { hash: { stringValue: hash } } } } } })) as typeof fetch;
    try {
      resetApiTokenCache();
      const url = "https://x.site/api/public/v1/luo";
      expect((await checkApiAccess(req(url, { authorization: `Bearer ${token}` }), {}, "https://x.site")).denied).toBeNull();
      expect((await checkApiAccess(req(url, { authorization: "Bearer wrong" }), {}, "https://x.site")).denied?.status).toBe(401);
      expect((await checkApiAccess(req(url), {}, "https://x.site")).denied?.status).toBe(401);
    } finally {
      globalThis.fetch = orig;
      resetApiTokenCache();
    }
  });
  it("turns tokens away (401) while no admin token exists", async () => {
    const { checkApiAccess, resetApiTokenCache } = await import("@/lib/api-token");
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response("{}", { status: 404 })) as typeof fetch;
    try {
      resetApiTokenCache();
      expect((await checkApiAccess(req("https://x.site/api/public/v1/luo", { "x-api-key": "anything" }), {}, "https://x.site")).denied?.status).toBe(401);
    } finally {
      globalThis.fetch = orig;
      resetApiTokenCache();
    }
  });
});
