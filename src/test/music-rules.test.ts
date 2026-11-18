import { describe, expect, it } from "vitest";
import { availableBalance, canWithdraw, earnedFromListeners, HERO_FEATURE_DAYS, HERO_FEATURE_UGX, heroActive, heroExpiryIso, trackKind, VERIFY_UGX, withdrawalBreakdown, withinUploadLimit } from "@/lib/music-rules";

describe("artist earnings", () => {
  it("pays UGX 10,000 for 10,000 different listeners", () => {
    expect(earnedFromListeners(10_000)).toBe(10_000);
    expect(earnedFromListeners(1_000)).toBe(1_000);
  });
  it("blocks withdraw below 10,000 and allows from 10,000", () => {
    expect(canWithdraw(9_999)).toBe(false);
    expect(canWithdraw(10_000)).toBe(true);
  });
  it("deducts a 25% withdraw fee", () => {
    expect(withdrawalBreakdown(10_000)).toEqual({ gross: 10_000, fee: 2_500, net: 7_500 });
  });
  it("subtracts past withdrawals except failed ones", () => {
    expect(availableBalance(25_000, [{ gross: 10_000, status: "success" }, { gross: 5_000, status: "failed" }])).toBe(15_000);
  });
  it("limits uploads to 300 MB", () => {
    expect(withinUploadLimit(300 * 1024 * 1024)).toBe(true);
    expect(withinUploadLimit(300 * 1024 * 1024 + 1)).toBe(false);
  });
});

describe("music hero featuring", () => {
  it("costs UGX 1,000 for 7 days", () => {
    expect(HERO_FEATURE_UGX).toBe(1_000);
    expect(HERO_FEATURE_DAYS).toBe(7);
  });
  it("tags tracks audio or video from the file extension", () => {
    expect(trackKind("https://x/song.mp3")).toBe("audio");
    expect(trackKind("https://x/clip.MP4?tok=1")).toBe("video");
    expect(trackKind("https://x/movie.webm")).toBe("video");
  });
  it("deactivates a slide after its week and keeps admin slides (no expiry) active", () => {
    expect(heroActive(null)).toBe(true);
    expect(heroActive(new Date(Date.now() + 864e5).toISOString())).toBe(true);
    expect(heroActive(new Date(Date.now() - 1).toISOString())).toBe(false);
  });
  it("expires a new feature exactly 7 days out", () => {
    const from = Date.UTC(2026, 9, 22);
    expect(heroExpiryIso(from)).toBe(new Date(from + 7 * 864e5).toISOString());
  });
});

describe("artist verification", () => {
  it("costs UGX 5,000", () => expect(VERIFY_UGX).toBe(5000));
});
