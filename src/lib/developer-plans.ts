/**
 * Developer API plans (browser + server safe).
 * Prices are in USD; yearly billing = 10 × monthly (two months free).
 */
export type DevPlanId = "api_developer" | "api_pro" | "api_business" | "api_premium";
export type Billing = "monthly" | "yearly";

export type DevPlan = {
  id: DevPlanId;
  name: string;
  monthlyUsd: number;
  /** Requests per calendar month (UTC); null = unlimited. */
  monthlyRequests: number | null;
  /** Requests per second per key. */
  perSecond: number;
  /** API keys allowed at once; null = unlimited. */
  keys: number | null;
  features: string[];
  popular?: boolean;
};

export const DEV_PLANS: DevPlan[] = [
  {
    id: "api_developer",
    name: "Developer",
    monthlyUsd: 9.99,
    monthlyRequests: 10_000,
    perSecond: 5,
    keys: 1,
    features: ["10,000 requests/month", "5 requests/second", "1 API key", "All endpoints"],
  },
  {
    id: "api_pro",
    name: "Pro",
    monthlyUsd: 24.99,
    monthlyRequests: 100_000,
    perSecond: 15,
    keys: 3,
    popular: true,
    features: ["100,000 requests/month", "15 requests/second", "3 API keys", "All endpoints"],
  },
  {
    id: "api_business",
    name: "Business",
    monthlyUsd: 59.99,
    monthlyRequests: 500_000,
    perSecond: 30,
    keys: 10,
    features: ["500,000 requests/month", "30 requests/second", "10 API keys", "All endpoints"],
  },
  {
    id: "api_premium",
    name: "Premium",
    monthlyUsd: 149.99,
    monthlyRequests: null,
    perSecond: 100,
    keys: null,
    features: [
      "Unlimited API requests",
      "Higher rate limits (100 requests/second)",
      "Unlimited API keys",
      "Full API access",
      "Priority support",
      "Commercial usage",
      "No monthly request quota",
    ],
  },
];

export const YEARLY_MONTHS_CHARGED = 10;

export const DEV_CONTACT = {
  email: "nexusplatformafrica@gmail.com",
  whatsapp: "+256795592662",
  whatsappUrl: "https://wa.me/256795592662",
};

export function devPlan(id: string | null | undefined): DevPlan | null {
  return DEV_PLANS.find((p) => p.id === id) ?? null;
}

export function planPriceUsd(plan: DevPlan, billing: Billing): number {
  const v = billing === "yearly" ? plan.monthlyUsd * YEARLY_MONTHS_CHARGED : plan.monthlyUsd;
  return Math.round(v * 100) / 100;
}

export const billingDays = (billing: Billing) => (billing === "yearly" ? 365 : 30);

/** Percent saved with yearly billing, e.g. 17. */
export const yearlySavingPercent = () => Math.round((1 - YEARLY_MONTHS_CHARGED / 12) * 100);

const RANK: Record<DevPlanId, number> = { api_developer: 1, api_pro: 2, api_business: 3, api_premium: 4 };
export const planRank = (id: string) => RANK[id as DevPlanId] ?? 0;

export type DevSubscription = {
  plan_id: string;
  status?: string;
  expires_at?: string | null;
  billing?: string;
};

/** Best plan among a user's still-active developer subscriptions. */
export function activeDevPlan(subs: DevSubscription[], now = Date.now()): { plan: DevPlan; expiresAt: string | null } | null {
  let best: { plan: DevPlan; expiresAt: string | null } | null = null;
  for (const s of subs) {
    const plan = devPlan(s.plan_id);
    if (!plan || String(s.status ?? "").toLowerCase() !== "active") continue;
    if (s.expires_at && new Date(s.expires_at).getTime() <= now) continue;
    if (!best || planRank(plan.id) > planRank(best.plan.id) ||
        (plan.id === best.plan.id && (s.expires_at ?? "") > (best.expiresAt ?? ""))) {
      best = { plan, expiresAt: s.expires_at ?? null };
    }
  }
  return best;
}

/** Sliding one-second window: returns the kept timestamps and whether this hit is allowed. */
export function rateWindow(hits: number[], now: number, perSecond: number): { hits: number[]; allowed: boolean; remaining: number } {
  const kept = hits.filter((t) => now - t < 1000);
  if (kept.length >= perSecond) return { hits: kept, allowed: false, remaining: 0 };
  kept.push(now);
  return { hits: kept, allowed: true, remaining: Math.max(0, perSecond - kept.length) };
}

/** Monthly quota decision; `null` quota = unlimited. */
export function quotaAllows(used: number, quota: number | null) {
  return quota == null || used < quota;
}

/** UTC month key like 202611. */
export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Seconds until the next UTC month starts (for Retry-After on quota errors). */
export function secondsToNextMonth(d = new Date()) {
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - d.getTime()) / 1000));
}
