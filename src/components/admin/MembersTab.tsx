import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, AlarmClock, UserMinus, Download, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { fullDate, money, timeAgo } from "@/lib/admin";
import { breakdown, downloadCsv, expiringWithin, recentlyExpired, toCsv, type SubLike } from "@/lib/admin-insights";
import { loadOverview } from "./Overview";
import { BarList, Empty, Panel, Pill, Stat, chipBtn } from "./ui";
import { PaymentProblems } from "./SpecialPanels";

type Profile = { id: string; display_name?: string | null; email?: string | null; phone?: string | null; msisdn?: string | null };

/** Membership health: who is about to expire, who to win back, and plan mix. */
export function MembersTab() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: loadOverview });
  const [days, setDays] = useState(7);
  const subs = (q.data?.subs ?? []) as (SubLike & { id: string; amount?: number; currency?: string })[];
  const profiles = new Map(((q.data?.profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  const now = Date.now();
  const active = subs.filter((s) => s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > now));
  const expiring = expiringWithin(subs, days, now);
  const lapsed = recentlyExpired(subs, 30, now);

  const row = (s: SubLike & { id: string }) => {
    const p = profiles.get(String(s.user_id));
    return { s, p, phone: p?.phone ?? p?.msisdn ?? "", name: p?.display_name ?? p?.email ?? p?.phone ?? "Unknown user" };
  };

  const exportList = (name: string, list: (SubLike & { id: string })[]) =>
    downloadCsv(
      name,
      toCsv(
        list.map((s) => {
          const r = row(s);
          return { name: r.name, email: r.p?.email ?? "", phone: r.phone, plan: s.plan_name, tier: s.tier, expires_at: s.expires_at };
        }),
      ),
    );

  const List = ({ list, kind }: { list: (SubLike & { id: string })[]; kind: "soon" | "lapsed" }) =>
    list.length === 0 ? (
      <Empty>{q.isLoading ? "Loading…" : kind === "soon" ? "Nobody expires in this window." : "No lapsed members in the last 30 days."}</Empty>
    ) : (
      <ul className="max-h-[440px] space-y-1.5 overflow-y-auto pr-1">
        {list.map((s) => {
          const r = row(s);
          const digits = r.phone.replace(/\D/g, "");
          const msg = encodeURIComponent(
            kind === "soon"
              ? `Hi ${r.name}, your MOVIE MAX ${s.plan_name ?? "plan"} ends soon. Renew now to keep watching without interruption.`
              : `Hi ${r.name}, we miss you on MOVIE MAX! New movies are waiting — renew your plan today.`,
          );
          return (
            <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2.5 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{r.name}</span>
                <span className="block truncate text-[11px] opacity-65">
                  {s.plan_name} · {kind === "soon" ? `ends ${fullDate(s.expires_at)}` : `ended ${timeAgo(s.expires_at)}`}
                </span>
              </span>
              {r.phone && (
                <button
                  type="button"
                  aria-label="Copy phone"
                  onClick={() => {
                    void navigator.clipboard.writeText(r.phone);
                    toast.success("Phone copied");
                  }}
                  className="grid size-7 place-items-center rounded-full bg-white ring-1 ring-black/5"
                >
                  <Copy className="size-3.5" />
                </button>
              )}
              {digits && (
                <a
                  href={`https://wa.me/${digits}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Message on WhatsApp"
                  className="grid size-7 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground"
                >
                  <MessageCircle className="size-3.5" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    );

  const revenueActive = active.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label="Active members" value={active.length.toLocaleString()} sub={`${money(revenueActive)} in active plans`} tone="paypal" icon={<Crown className="size-4" />} />
        <Stat label={`Expiring · ${days} days`} value={expiring.length.toLocaleString()} sub="Remind them to renew" tone="paypalGold" icon={<AlarmClock className="size-4" />} />
        <Stat label="Lapsed · 30 days" value={lapsed.length.toLocaleString()} sub="Win them back" tone="paypalSky" icon={<UserMinus className="size-4" />} />
        <Stat label="All memberships" value={subs.length.toLocaleString()} sub={`${new Set(subs.map((s) => s.user_id)).size} different people`} tone="paypalMist" icon={<Crown className="size-4" />} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel
          title="Expiring soon"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 3, 7, 14].map((n) => (
                <button key={n} type="button" onClick={() => setDays(n)} className={chipBtn(days === n)}>
                  {n}d
                </button>
              ))}
              <button type="button" onClick={() => exportList(`expiring-${days}d`, expiring)} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
                <Download className="size-3" /> CSV
              </button>
            </div>
          }
        >
          <List list={expiring} kind="soon" />
        </Panel>
        <Panel
          title="Win back (lapsed)"
          action={
            <button type="button" onClick={() => exportList("lapsed-30d", lapsed)} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
              <Download className="size-3" /> CSV
            </button>
          }
        >
          <List list={lapsed} kind="lapsed" />
        </Panel>
      </div>

      <PaymentProblems tx={q.data?.tx ?? []} profiles={(q.data?.profiles ?? []) as Profile[]} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Active plans">
          <BarList rows={breakdown(active, (s) => String(s.plan_name ?? "Other"))} format={(n) => `${n} members`} empty="No active members." />
        </Panel>
        <Panel title="Tiers">
          <div className="flex flex-wrap gap-2">
            {breakdown(active, (s) => String(s.tier ?? "vip").toUpperCase()).map((t) => (
              <Pill key={t.label} tone="on">
                {t.label} · {t.value}
              </Pill>
            ))}
            {active.length === 0 && <Empty>No active members.</Empty>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
