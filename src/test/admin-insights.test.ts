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

import { goalProgress, paymentProblems } from "@/lib/admin-insights";

describe("payment problems and goals", () => {
  it("flags people with 2+ attempts and no success in 7 days", () => {
    const tx = [
      { user_id: "a", amount: 1000, status: "failed", created_at: iso(now - DAY_MS) },
      { user_id: "a", amount: 1000, status: "pending", created_at: iso(now - 2 * DAY_MS) },
      { user_id: "b", amount: 1000, status: "failed", created_at: iso(now - DAY_MS) },
      { user_id: "b", amount: 1000, status: "success", created_at: iso(now - 2 * DAY_MS) },
      { user_id: "c", amount: 1000, status: "failed", created_at: iso(now - DAY_MS) },
    ];
    expect(paymentProblems(tx, 7, 2, now).map((p) => [p.user_id, p.attempts])).toEqual([["a", 2]]);
  });

  it("measures this month's revenue against the goal", () => {
    const tx = [
      { amount: 50000, status: "success", created_at: iso(new Date("2026-11-02T10:00:00").getTime()) },
      { amount: 99000, status: "success", created_at: iso(new Date("2026-10-30T10:00:00").getTime()) },
    ];
    const g = goalProgress(tx, 200000, now);
    expect(g.earned).toBe(50000);
    expect(g.percent).toBe(25);
    expect(g.daysLeft).toBe(13);
    expect(g.perDayNeeded).toBe(11539);
  });
});
