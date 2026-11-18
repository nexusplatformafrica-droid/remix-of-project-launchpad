import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { TrendingUp, Users, Percent, BadgeDollarSign } from "lucide-react";
import { money } from "@/lib/admin";
import { phoneCountry } from "@/lib/phone-country";
import { breakdown, hourHistogram, methodLabel, revenueWindows, successRate } from "@/lib/admin-insights";
import { loadOverview } from "./Overview";
import { BarList, MiniStat, Panel, Stat } from "./ui";

/** Business insights computed from the same cached overview load (no extra reads). */
export function InsightsTab() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: loadOverview });
  const d = q.data;
  const tx = d?.tx ?? [];
  const paidTx = tx.filter((t) => t.status === "success");
  const rev = revenueWindows(tx);
  const payers = new Set(paidTx.map((t) => t.user_id).filter(Boolean)).size;
  const users = d?.profiles.length ?? 0;
  const arpu = payers ? rev.lifetime / payers : 0;
  const conversion = users ? Math.round((payers / users) * 1000) / 10 : 0;
  const repeat = (() => {
    const counts = new Map<string, number>();
    for (const t of paidTx) if (t.user_id) counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
    const n = [...counts.values()].filter((c) => c > 1).length;
    return payers ? Math.round((n / payers) * 100) : 0;
  })();

  const hours = hourHistogram(d?.activities ?? []).map((v, h) => ({ day: `${h}h`, value: v }));
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), { day: "—", value: 0 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label="Revenue · 30 days" value={money(rev.month)} sub={`${money(rev.week)} in 7 days`} tone="paypal" icon={<TrendingUp className="size-4" />} />
        <Stat label="Paying users" value={payers.toLocaleString()} sub={`${conversion}% of ${users.toLocaleString()} users`} tone="paypalSky" icon={<Users className="size-4" />} />
        <Stat label="Avg per payer" value={money(arpu)} sub={`${repeat}% paid more than once`} tone="paypalMist" icon={<BadgeDollarSign className="size-4" />} />
        <Stat label="Payment success" value={`${successRate(tx)}%`} sub={`${paidTx.length} paid · ${tx.filter((t) => t.status === "failed").length} failed`} tone="paypalGold" icon={<Percent className="size-4" />} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <MiniStat label="Today" value={money(rev.today)} />
        <MiniStat label="Lifetime" value={money(rev.lifetime)} />
        <MiniStat label="Titles" value={d?.titles.length ?? 0} />
        <MiniStat label="Episodes" value={d?.episodes.length ?? 0} />
        <MiniStat label="Activity records" value={(d?.activities.length ?? 0).toLocaleString()} />
        <MiniStat label="Busiest hour" value={peak.day} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Revenue by payment method">
          <BarList rows={breakdown(paidTx, (t) => methodLabel(t.method ?? t.kind), (t) => Number(t.amount) || 0)} format={(n) => money(n)} />
        </Panel>
        <Panel title="Best-selling plans">
          <BarList rows={breakdown(paidTx, (t) => String(t.plan_name ?? t.plan_id ?? t.note ?? methodLabel(t.method ?? t.kind))).slice(0, 8)} format={(n) => `${n} sales`} />
        </Panel>
        <Panel title="Users by country">
          <BarList
            rows={breakdown(d?.profiles ?? [], (p) => phoneCountry(p.country_code, p.msisdn ?? p.phone)?.name ?? "Not provided").slice(0, 8)}
            format={(n) => n.toLocaleString()}
          />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="When people use the site" action={<span className="text-[11px] opacity-60">activity by hour</span>}>
          <div className="h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(0,0,0,0.45)" }} axisLine={false} tickLine={false} interval={2} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} formatter={(v) => [`${v} actions`, ""]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="oklch(0.56 0.19 255)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Most clicked">
          <BarList rows={breakdown((d?.activities ?? []).filter((a) => a.target), (a) => String(a.target)).slice(0, 8)} format={(n) => `${n}×`} empty="No clicks recorded yet." />
        </Panel>
      </div>
    </div>
  );
}
