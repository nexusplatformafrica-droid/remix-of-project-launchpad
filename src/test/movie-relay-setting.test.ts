import { describe, expect, it } from "vitest";
import { normalizeRelayUrl, relayRequestUrl } from "@/lib/movie-relay";

describe("movie relay setting", () => {
  it("accepts the admin's https relay and strips the trailing slash", () => {
    expect(normalizeRelayUrl(" https://function-bun-production-bb9ef598.up.railway.app/ ")).toBe(
      "https://function-bun-production-bb9ef598.up.railway.app",
    );
  });
  it("rejects non-https or junk addresses", () => {
    expect(normalizeRelayUrl("http://relay.example.com")).toBeNull();
    expect(normalizeRelayUrl("not a url")).toBeNull();
    expect(normalizeRelayUrl("")).toBeNull();
  });
  it("builds the ?u= request the relay expects", () => {
    expect(relayRequestUrl("https://r.example.com/", "https://a.aoneroom.com/x?y=1")).toBe(
      "https://r.example.com/?u=https%3A%2F%2Fa.aoneroom.com%2Fx%3Fy%3D1",
    );
  });
});
