/** Pure numbers behind the admin dashboard's insights, members and reports tools. */

export type TxLike = {
  amount: number | string;
  status: string;
  created_at: string;
  method?: string | null;
  kind?: string | null;
  plan_name?: string | null;
  user_id?: string | null;
};
export type SubLike = {
  user_id?: string | null;
  status: string;
  expires_at: string | null;
  plan_name?: string | null;
  tier?: string | null;
  created_at?: string;
};

export const DAY_MS = 86_400_000;

export function startOfDay(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const paid = (t: TxLike) => t.status === "success";
const amt = (t: TxLike) => Number(t.amount) || 0;

/** Successful revenue for today, the last 7 and 30 days, and lifetime. */
export function revenueWindows(tx: TxLike[], now = Date.now()) {
  const ok = tx.filter(paid);
  const since = (ms: number) => ok.filter((t) => new Date(t.created_at).getTime() >= ms).reduce((s, t) => s + amt(t), 0);
  return {
    today: since(startOfDay(now)),
    week: since(now - 7 * DAY_MS),
    month: since(now - 30 * DAY_MS),
    lifetime: ok.reduce((s, t) => s + amt(t), 0),
  };
}

/** Share of finished payments that succeeded (pending and abandoned/expired checkouts are left out). */
export function successRate(tx: TxLike[]) {
  const ok = tx.filter(paid).length;
  const failed = tx.filter((t) => t.status === "failed").length;
  return ok + failed === 0 ? 0 : Math.round((ok / (ok + failed)) * 100);
}

/** Groups rows by a label, summing a value; sorted biggest first with % share. */
export function breakdown<T>(rows: T[], label: (r: T) => string, value: (r: T) => number = () => 1) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = label(r) || "Other";
    map.set(k, (map.get(k) ?? 0) + value(r));
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([k, v]) => ({ label: k, value: v, share: total ? Math.round((v / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Human name for how a payment was made. */
export function methodLabel(method?: string | null) {
  const m = (method ?? "").toLowerCase();
  if (!m) return "Other";
  if (m.includes("paypal")) return "PayPal";
  if (/card|whop|google|apple|link|stripe/.test(m)) return "Card";
  if (/mobile|momo|mtn|airtel|pawapay|relworx|money/.test(m)) return "Mobile money";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Count of rows per hour of the day (0–23, local time). */
export function hourHistogram(rows: { created_at: string }[]) {
  const out = Array.from({ length: 24 }, () => 0);
  for (const r of rows) {
    const h = new Date(r.created_at).getHours();
    if (Number.isFinite(h)) out[h] = (out[h] ?? 0) + 1;
  }
  return out;
}

const isActive = (s: SubLike, now: number) =>
  s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > now);

/** Active memberships that end within the next `days` days, soonest first. */
export function expiringWithin<T extends SubLike>(subs: T[], days: number, now = Date.now()): T[] {
  const end = now + days * DAY_MS;
  return subs
    .filter((s) => isActive(s, now) && s.expires_at && new Date(s.expires_at).getTime() <= end)
    .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());
}

/** Members whose plan ended in the last `days` days and who have not renewed. */
export function recentlyExpired<T extends SubLike>(subs: T[], days: number, now = Date.now()): T[] {
  const activeUsers = new Set(subs.filter((s) => isActive(s, now)).map((s) => s.user_id));
  const seen = new Set<string | null | undefined>();
  return subs
    .filter((s) => {
      if (!s.expires_at) return false;
      const t = new Date(s.expires_at).getTime();
      return t <= now && t >= now - days * DAY_MS && !activeUsers.has(s.user_id);
    })
    .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())
    .filter((s) => (seen.has(s.user_id) ? false : (seen.add(s.user_id), true)));
}

/** Rows to CSV text; values with commas, quotes or line breaks are quoted. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

/** Browser download of CSV text. */
export function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".csv") ? name : `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Keeps rows whose created_at falls on or between two yyyy-mm-dd dates (local). */
export function inDateRange<T extends { created_at?: string | null }>(rows: T[], from?: string, to?: string) {
  const a = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const b = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
  return rows.filter((r) => {
    if (!r.created_at) return false;
    const t = new Date(r.created_at).getTime();
    return t >= a && t <= b;
  });
}

/** People who tried to pay 2+ times recently without a single success — they likely need help. */
export function paymentProblems<T extends TxLike>(tx: T[], days = 7, min = 2, now = Date.now()) {
  const since = now - days * DAY_MS;
  const byUser = new Map<string, T[]>();
  for (const t of tx) {
    if (!t.user_id || new Date(t.created_at).getTime() < since) continue;
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);
  }
  return [...byUser.entries()]
    .filter(([, list]) => list.length >= min && !list.some(paid))
    .map(([user_id, list]) => ({ user_id, attempts: list.length, last: list.map((t) => t.created_at).sort().at(-1)! }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));
}

/** Progress toward a monthly revenue goal: earned this month, % done, and the daily pace still needed. */
export function goalProgress(tx: TxLike[], goal: number, now = Date.now()) {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const earned = tx.filter((t) => paid(t) && new Date(t.created_at).getTime() >= monthStart).reduce((s, t) => s + amt(t), 0);
  const daysLeft = Math.max(1, Math.ceil((monthEnd - now) / DAY_MS));
  return {
    earned,
    percent: goal > 0 ? Math.min(100, Math.round((earned / goal) * 100)) : 0,
    daysLeft,
    perDayNeeded: Math.max(0, Math.ceil((goal - earned) / daysLeft)),
  };
}

type SubWithAmount = SubLike & { amount?: number | string | null };

/**
 * Expected renewal money for the next `days`: memberships ending in that window,
 * times how often people who lapsed in the last 90 days bought again.
 */
export function renewalForecast(subs: SubWithAmount[], days = 30, now = Date.now()) {
  const end = now + days * DAY_MS;
  const active = (s: SubLike) => String(s.status).toLowerCase() === "active";
  const due = subs.filter((s) => active(s) && s.expires_at && new Date(s.expires_at).getTime() > now && new Date(s.expires_at).getTime() <= end);
  const dueAmount = due.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const lapsed = subs.filter((s) => s.expires_at && s.user_id && new Date(s.expires_at).getTime() <= now && new Date(s.expires_at).getTime() > now - 90 * DAY_MS);
  const renewed = lapsed.filter((s) =>
    subs.some((o) => o !== s && o.user_id === s.user_id && o.created_at && s.created_at && o.created_at > s.created_at),
  );
  const rate = lapsed.length ? renewed.length / lapsed.length : 0;
  return { due: due.length, dueAmount, rate, expected: Math.round(dueAmount * rate) };
}
