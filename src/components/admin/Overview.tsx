import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Crown, Wallet, Film, Tv, Activity, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/db";
import { purgeTable } from "@/lib/fdb";
import { money, seriesByDay, timeAgo } from "@/lib/admin";
import { walletBalance } from "@/lib/relworx";
import { revenueWindows, startOfDay, expiringWithin } from "@/lib/admin-insights";
import { Empty, MiniStat, Panel, SoftArea, Stat } from "./ui";
import { OnlineNow, RevenueGoal } from "./SpecialPanels";

export type AdminTab = "overview" | "insights" | "members" | "reports" | "system" | "users" | "content" | "hero" | "mhero" | "artists" | "notify" | "wallet" | "settings" | "team" | "channels" | "tools";

/** Everything the overview, insights, members and reports tools read — one cached load. */
export async function loadOverview() {
  const [profiles, subs, tx, withdrawals, titles, episodes, activities, roles] = await Promise.all([
    supabase.from("profiles").select("id, created_at, display_name, email, phone, msisdn, country_code, last_seen").order("created_at", { ascending: false }),
    supabase.from("luo_subscriptions").select("*").order("created_at", { ascending: false }),
    supabase.from("luo_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("luo_withdrawals").select("*").order("created_at", { ascending: false }),
    supabase.from("media").select("*"),
    supabase.from("episodes").select("*"),
    supabase.from("luo_activities").select("*").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("*"),
  ]);
  return {
    profiles: profiles.data ?? [],
    subs: subs.data ?? [],
    tx: tx.data ?? [],
    withdrawals: withdrawals.data ?? [],
    titles: titles.data ?? [],
    episodes: episodes.data ?? [],
    activities: activities.data ?? [],
    roles: roles.data ?? [],
  };
}

export function Overview({ go, limited = false }: { go: (t: AdminTab) => void; limited?: boolean }) {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: loadOverview });
  const raw = q.data;
  // Team members never see the main admin's own activity.
  const adminIds = new Set((raw?.roles ?? []).filter((r) => r.role === "admin").map((r) => String(r.user_id)));
  const d = raw && limited ? { ...raw, activities: raw.activities.filter((a) => !adminIds.has(String(a.user_id))) } : raw;
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearActivities() {
    if (!window.confirm("Delete ALL activity records? This cannot be undone.")) return;
    setClearing(true);
    try {
      const removed = await purgeTable("luo_activities");
      toast.success(`Deleted ${removed.toLocaleString()} activity records`);
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete activities");
    } finally {
      setClearing(false);
    }
  }

  // Real money sitting in the Relworx wallet, refreshed every half minute.
  const wallet = useQuery({
    queryKey: ["relworx-balance"],
    queryFn: () => walletBalance(),
    enabled: !limited,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const now = Date.now();
  const activeSubs = (d?.subs ?? []).filter(
    (s) => s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > now),
  );
  const revenue = (d?.tx ?? [])
    .filter((t) => t.status === "success")
    .reduce((s, t) => s + Number(t.amount), 0);

  const revChart = seriesByDay(
    (d?.tx ?? []).filter((t) => t.status === "success"),
    14,
    (t) => Number(t.amount),
  );
  const userChart = seriesByDay(d?.profiles ?? [], 14);

  // Anyone whose profile pinged in the last 5 minutes counts as online now.
  const onlineNow = (d?.profiles ?? []).filter(
    (p) => p.last_seen && now - new Date(p.last_seen).getTime() < 5 * 60 * 1000,
  ).length;
  const activeToday = (d?.profiles ?? []).filter(
    (p) => p.last_seen && now - new Date(p.last_seen).getTime() < 24 * 60 * 60 * 1000,
  ).length;
  const profilesById = new Map((d?.profiles ?? []).map((profile) => [profile.id, profile]));
  const today = startOfDay(now);
  const isToday = (v?: string | null) => !!v && new Date(v).getTime() >= today;
  const rev = revenueWindows(d?.tx ?? [], now);
  const todayTx = (d?.tx ?? []).filter((t) => isToday(t.created_at));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {!limited && <MiniStat label="Revenue today" value={money(rev.today)} onClick={() => go("wallet")} />}
        {!limited && <MiniStat label="7 days" value={money(rev.week)} onClick={() => go("insights")} />}
        <MiniStat label="New users" value={(d?.profiles ?? []).filter((p) => isToday(p.created_at)).length} onClick={() => go("users")} />
        <MiniStat label="New members" value={(d?.subs ?? []).filter((s) => isToday(s.created_at)).length} onClick={() => go(limited ? "users" : "members")} />
        <MiniStat label="Paid today" value={`${todayTx.filter((t) => t.status === "success").length}/${todayTx.length}`} onClick={limited ? undefined : () => go("wallet")} />
        <MiniStat label="Expiring 3d" value={expiringWithin(d?.subs ?? [], 3, now).length} onClick={() => go(limited ? "users" : "members")} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat
          label="Total users"
          value={(d?.profiles.length ?? 0).toLocaleString()}
          sub={`${onlineNow.toLocaleString()} online now · ${activeToday.toLocaleString()} active today`}
          tone="violet"
          icon={<Users className="size-4" />}
          onClick={() => go("users")}
        />
        <Stat
          label="Active members"
          value={activeSubs.length.toLocaleString()}
          sub={`${d?.subs.length ?? 0} subscriptions · ${onlineNow.toLocaleString()} watching now`}
          tone="gold"
          icon={<Crown className="size-4" />}
          onClick={() => go("users")}
        />
        {!limited && <Stat
          label="Relworx balance"
          value={wallet.isLoading ? "…" : wallet.data == null ? "Unavailable" : money(wallet.data)}
          sub={wallet.data == null ? "Relworx did not answer · open Wallet" : "Live Relworx payout wallet"}
          tone="mint"
          icon={<Wallet className="size-4" />}
          onClick={() => go("wallet")}
        />}
        <Stat
          label="Library"
          value={`${d?.titles.length ?? 0}`}
          sub={`${d?.episodes.length ?? 0} episodes uploaded`}
          tone="rose"
          icon={<Film className="size-4" />}
          onClick={() => go("content")}
        />
      </div>

      <div className={`grid gap-3 ${limited ? "" : "lg:grid-cols-2"}`}>
        {!limited && <RevenueGoal tx={d?.tx ?? []} />}
        <OnlineNow profiles={d?.profiles ?? []} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        {!limited && <Panel title="Revenue · last 14 days" action={<span className="text-[12px] opacity-60">{money(revenue)} lifetime</span>}>
          <SoftArea data={revChart} prefix="UGX " color="oklch(0.56 0.19 255)" height={170} />
        </Panel>}
        <Panel title="New users · last 14 days">
          <SoftArea data={userChart} color="oklch(0.6 0.15 300)" height={170} />
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel
          title="Recent activity"
          action={
            <span className="flex items-center gap-2 text-[12px]">
              <span className="flex items-center gap-1 opacity-60">
                <Activity className="size-3.5" /> live
              </span>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full bg-white/70 px-2.5 py-1 font-semibold ring-1 ring-black/5 transition hover:bg-white"
              >
                {showAll ? "Show less" : `View all (${d?.activities.length ?? 0})`}
              </button>
              {!limited && <button
                type="button"
                onClick={clearActivities}
                disabled={clearing}
                className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 font-semibold text-red-600 ring-1 ring-red-500/20 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="size-3" /> {clearing ? "Deleting…" : "Delete all"}
              </button>}
            </span>
          }
        >
          {q.isLoading ? (
            <Empty>Loading…</Empty>
          ) : (d?.activities.length ?? 0) === 0 ? (
            <Empty>No activity yet.</Empty>
          ) : (
            <ul className={`space-y-1.5 ${showAll ? "max-h-[480px] overflow-y-auto pr-1" : ""}`}>
              {(showAll ? d?.activities : d?.activities.slice(0, 12))?.map((a) => {
                const person = profilesById.get(a.user_id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-1.5">
                    <span className="min-w-0 text-[13px]">
                      <span className="block truncate font-semibold">{person?.display_name ?? person?.email ?? "Signed-in user"}</span>
                      <span className="block truncate opacity-70">
                        {person?.phone ? `${person.phone} · ` : ""}{a.action}{a.target ? ` · ${a.target}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] opacity-55">{timeAgo(a.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Shortcuts">
          <div className="grid grid-cols-2 gap-2">
            {[
              { t: "Upload a movie", i: Film, tab: "content" as AdminTab },
              { t: "Add episodes", i: Tv, tab: "content" as AdminTab },
              { t: "Users & subscriptions", i: Users, tab: "users" as AdminTab },
              ...(limited
                ? []
                : [
                    { t: "Withdraw money", i: Wallet, tab: "wallet" as AdminTab },
                    { t: "Insights", i: Activity, tab: "insights" as AdminTab },
                    { t: "Expiring members", i: Crown, tab: "members" as AdminTab },
                    { t: "Download reports", i: Film, tab: "reports" as AdminTab },
                    { t: "System health", i: Activity, tab: "system" as AdminTab },
                  ]),
            ].map((s) => (
              <button
                key={s.t}
                type="button"
                onClick={() => go(s.tab)}
                className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-left text-[12.5px] font-semibold ring-1 ring-black/5 transition hover:bg-white"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[linear-gradient(120deg,oklch(0.95_0.06_90),oklch(0.9_0.1_60))]">
                  <s.i className="size-4" />
                </span>
                {s.t}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
