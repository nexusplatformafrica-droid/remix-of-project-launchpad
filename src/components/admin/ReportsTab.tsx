import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/admin";
import { downloadCsv, inDateRange, methodLabel, toCsv } from "@/lib/admin-insights";
import { loadOverview } from "./Overview";
import { Panel, chipBtn, softField } from "./ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Date-range CSV exports and a daily summary table, from the cached overview load. */
export function ReportsTab() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: loadOverview });
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const d = q.data;

  const preset = (days: number) => {
    setFrom(iso(new Date(Date.now() - (days - 1) * 86_400_000)));
    setTo(iso(new Date()));
  };

  const sets = [
    {
      key: "users",
      name: "Users",
      rows: inDateRange(d?.profiles ?? [], from, to).map((p) => ({ joined: p.created_at, name: p.display_name, email: p.email, phone: p.phone ?? p.msisdn, country: p.country_code, last_seen: p.last_seen })),
    },
    {
      key: "payments",
      name: "Payments",
      rows: inDateRange(d?.tx ?? [], from, to).map((t) => ({ date: t.created_at, user_id: t.user_id, plan: t.plan_name, method: methodLabel(t.method ?? t.kind), amount: t.amount, currency: t.currency, status: t.status, reference: t.reference, phone: t.phone })),
    },
    {
      key: "memberships",
      name: "Memberships",
      rows: inDateRange(d?.subs ?? [], from, to).map((s) => ({ started: s.created_at, user_id: s.user_id, plan: s.plan_name, tier: s.tier, amount: s.amount, currency: s.currency, status: s.status, expires_at: s.expires_at })),
    },
    {
      key: "withdrawals",
      name: "Withdrawals",
      rows: inDateRange(d?.withdrawals ?? [], from, to).map((w) => ({ date: w.created_at, provider: w.provider ?? "relworx", amount: w.amount, currency: w.currency, to: w.phone, status: w.status, reason: w.reason, reference: w.reference })),
    },
    {
      key: "activity",
      name: "Activity",
      rows: inDateRange(d?.activities ?? [], from, to).map((a) => ({ date: a.created_at, user_id: a.user_id, action: a.action, target: a.target })),
    },
  ];

  // Daily summary between the two dates (max 62 days shown).
  const days: { day: string; users: number; paid: number; revenue: number; members: number; payouts: number }[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let t = end.getTime(); t >= start.getTime() && days.length < 62; t -= 86_400_000) {
    const day = iso(new Date(t + 12 * 3_600_000));
    const on = <T extends { created_at?: string | null }>(rows: T[]) => inDateRange(rows, day, day);
    const paid = on(d?.tx ?? []).filter((x) => x.status === "success");
    days.push({
      day,
      users: on(d?.profiles ?? []).length,
      paid: paid.length,
      revenue: paid.reduce((s, x) => s + (Number(x.amount) || 0), 0),
      members: on(d?.subs ?? []).length,
      payouts: on(d?.withdrawals ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0),
    });
  }
  const stamp = `${from}_to_${to}`;

  return (
    <div className="space-y-3">
      <Panel
        title="Report period"
        action={
          <div className="flex flex-wrap gap-1.5">
            {[7, 30, 90, 365].map((n) => (
              <button key={n} type="button" onClick={() => preset(n)} className={chipBtn(false)}>
                {n === 365 ? "1 year" : `${n} days`}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <label className="text-[11px] font-semibold opacity-70">
            From
            <input type="date" className={`${softField} mt-1 h-9`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-[11px] font-semibold opacity-70">
            To
            <input type="date" className={`${softField} mt-1 h-9`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {sets.map((s) => (
          <div key={s.key} className="flex flex-col rounded-2xl bg-white/65 p-3 ring-1 ring-black/5">
            <span className="flex items-center gap-1.5 text-[12px] font-bold">
              <FileSpreadsheet className="size-4 text-paypal-blue" /> {s.name}
            </span>
            <span className="mt-1 text-[20px] font-black leading-none">{q.isLoading ? "…" : s.rows.length.toLocaleString()}</span>
            <span className="text-[10.5px] opacity-60">records in period</span>
            <button
              type="button"
              disabled={!s.rows.length}
              onClick={() => downloadCsv(`moviemax-${s.key}-${stamp}`, toCsv(s.rows))}
              className="mt-2 flex h-8 items-center justify-center gap-1 rounded-full bg-paypal-navy text-[11.5px] font-bold text-paypal-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              <Download className="size-3.5" /> Download CSV
            </button>
          </div>
        ))}
      </div>

      <Panel
        title="Daily summary"
        action={
          <button type="button" onClick={() => downloadCsv(`moviemax-daily-${stamp}`, toCsv(days))} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
            <Download className="size-3" /> CSV
          </button>
        }
      >
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead className="sticky top-0 bg-white/90 text-left text-[10.5px] uppercase tracking-wide opacity-70">
              <tr>
                <th className="px-2 py-1.5">Day</th>
                <th className="px-2 py-1.5 text-right">New users</th>
                <th className="px-2 py-1.5 text-right">Paid</th>
                <th className="px-2 py-1.5 text-right">Revenue</th>
                <th className="px-2 py-1.5 text-right">Memberships</th>
                <th className="px-2 py-1.5 text-right">Paid out</th>
              </tr>
            </thead>
            <tbody>
              {days.map((r) => (
                <tr key={r.day} className="border-t border-black/5">
                  <td className="px-2 py-1.5 font-semibold">{r.day}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.users}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.paid}</td>
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums">{money(r.revenue)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.members}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{money(r.payouts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
