import { describe, expect, it } from "vitest";
import { breakdown, expiringWithin, methodLabel, recentlyExpired, revenueWindows, successRate, toCsv, DAY_MS } from "@/lib/admin-insights";

const now = new Date("2026-11-18T12:00:00").getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe("admin insights", () => {
  it("counts only successful payments in revenue", () => {
    const tx = [
      { amount: 5000, status: "success", created_at: iso(now - 1000) },
      { amount: 9000, status: "failed", created_at: iso(now - 1000) },
      { amount: 15000, status: "success", created_at: iso(now - 10 * DAY_MS) },
    ];
    expect(revenueWindows(tx, now)).toEqual({ today: 5000, week: 5000, month: 20000, lifetime: 20000 });
    expect(successRate(tx)).toBe(67);
  });

  it("lists memberships ending within 7 days, soonest first", () => {
    const subs = [
      { user_id: "a", status: "active", expires_at: iso(now + 6 * DAY_MS) },
      { user_id: "b", status: "active", expires_at: iso(now + 2 * DAY_MS) },
      { user_id: "c", status: "active", expires_at: iso(now + 8 * DAY_MS) },
      { user_id: "d", status: "active", expires_at: iso(now - DAY_MS) },
    ];
    expect(expiringWithin(subs, 7, now).map((s) => s.user_id)).toEqual(["b", "a"]);
  });

  it("win-back list skips members who already renewed", () => {
    const subs = [
      { user_id: "a", status: "active", expires_at: iso(now - 2 * DAY_MS) },
      { user_id: "a", status: "active", expires_at: iso(now + 20 * DAY_MS) },
      { user_id: "b", status: "active", expires_at: iso(now - 3 * DAY_MS) },
    ];
    expect(recentlyExpired(subs, 30, now).map((s) => s.user_id)).toEqual(["b"]);
  });

  it("groups payment methods with shares", () => {
    const rows = ["mobile_money", "card", "paypal", "mobile_money"].map((m) => ({ m }));
    expect(breakdown(rows, (r) => methodLabel(r.m))[0]).toEqual({ label: "Mobile money", value: 2, share: 50 });
  });

  it("quotes CSV cells with commas and quotes", () => {
    expect(toCsv([{ name: 'Paul, "VJ"', n: 2 }])).toBe('name,n\n"Paul, ""VJ""",2');
  });
});
