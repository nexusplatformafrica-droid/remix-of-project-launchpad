import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, XCircle, RefreshCw, Trash2, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { paymentBackend } from "@/lib/relworx";
import { fdb, purgeTable } from "@/lib/fdb";
import { adminProviderBalances } from "@/lib/admin-money.functions";
import { getFbAuth } from "@/lib/firebase";
import { MiniStat, Panel, ghostBtn } from "./ui";

type Check = { name: string; ok: boolean; ms: number; detail: string };

async function timed(name: string, fn: () => Promise<string>): Promise<Check> {
  const t = performance.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Math.round(performance.now() - t), detail };
  } catch (e) {
    return { name, ok: false, ms: Math.round(performance.now() - t), detail: e instanceof Error ? e.message : "Failed" };
  }
}

async function runChecks(): Promise<Check[]> {
  const svc = (async () => {
    const u = getFbAuth().currentUser;
    if (!u) throw new Error("Not signed in");
    return adminProviderBalances({ data: { idToken: await u.getIdToken() } });
  })();
  const fromSvc = (key: "pawapay" | "whop" | "paypal") => async () => {
    const r = await svc;
    if (!r.ok) throw new Error(r.error);
    const s = r[key];
    if (!s.ok) throw new Error(s.message ?? "Not reachable");
    return `${s.balances.length} balance${s.balances.length === 1 ? "" : "s"} live`;
  };
  return Promise.all([
    timed("Website server", async () => {
      const r = await fetch("/robots.txt", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "Responding";
    }),
    timed("Database (Firebase)", async () => {
      const { error } = await fdb.from("app_settings").select("*").limit(1);
      if (error) throw new Error(error.message);
      return "Reads working";
    }),
    timed("Mobile money · Relworx backend", async () => {
      const r = await fetch(`${paymentBackend()}/health`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "Awake";
    }),
    timed("Mobile money · pawaPay", fromSvc("pawapay")),
    timed("Card payments · Whop", fromSvc("whop")),
    timed("PayPal", fromSvc("paypal")),
  ]);
}

/** Live health of every service the site depends on, plus maintenance tools. */
export function SystemTab() {
  const qc = useQueryClient();
  const checks = useQuery({ queryKey: ["system-checks"], queryFn: runChecks, refetchInterval: 60_000, staleTime: 30_000 });
  const [cleared, setCleared] = useState(false);
  const list = checks.data ?? [];
  const up = list.filter((c) => c.ok).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Services up" value={checks.isLoading ? "…" : `${up}/${list.length}`} />
        <MiniStat label="Your connection" value={typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"} />
        <MiniStat label="Kampala time" value={new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" })} />
        <MiniStat label="Last check" value={checks.dataUpdatedAt ? new Date(checks.dataUpdatedAt).toLocaleTimeString() : "—"} />
      </div>

      <Panel
        title="Service health"
        action={
          <button type="button" onClick={() => void checks.refetch()} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
            <RefreshCw className={`size-3 ${checks.isFetching ? "animate-spin" : ""}`} /> Check now
          </button>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(checks.isLoading ? Array.from({ length: 6 }, (_, i) => ({ name: `…${i}`, ok: true, ms: 0, detail: "Checking…" })) : list).map((c) => (
            <li key={c.name} className="flex items-start gap-2 rounded-xl bg-white/65 px-3 py-2 text-[12.5px] ring-1 ring-black/5">
              {checks.isLoading ? (
                <Activity className="mt-0.5 size-4 shrink-0 animate-pulse opacity-50" />
              ) : c.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-paypal-blue" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{checks.isLoading ? "Checking…" : c.name}</span>
                <span className="block truncate text-[11px] opacity-65">{c.detail}</span>
              </span>
              {!checks.isLoading && (
                <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] tabular-nums opacity-60">
                  <Clock className="size-3" />
                  {c.ms}ms
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Maintenance">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${ghostBtn} h-9 text-[12.5px]`}
            onClick={() => {
              qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "system-checks" });
              setCleared(true);
              toast.success("Dashboard data cleared. Fresh data loads as you open each tool.");
            }}
          >
            <Trash2 className="mr-1 inline size-3.5" /> {cleared ? "Cleared" : "Clear dashboard cache"}
          </button>
          <button type="button" className={`${ghostBtn} h-9 text-[12.5px]`} onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 inline size-3.5" /> Reload dashboard
          </button>
          <button
            type="button"
            className={`${ghostBtn} h-9 text-[12.5px]`}
            onClick={async () => {
              if (!confirm("Delete every stored payment attempt from the site's database? The payment services keep their real records.")) return;
              try {
                const n = await purgeTable("luo_transactions");
                toast.success(`Cleared ${n} stored payment record${n === 1 ? "" : "s"}`);
                void qc.invalidateQueries();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not clear");
              }
            }}
          >
            <Trash2 className="mr-1 inline size-3.5" /> Clear stored payment records
          </button>
          <a href="/sitemap.xml" target="_blank" rel="noreferrer" className={`${ghostBtn} inline-flex h-9 items-center text-[12.5px]`}>
            <Globe className="mr-1 size-3.5" /> Open sitemap
          </a>
          <a href="/doc" target="_blank" rel="noreferrer" className={`${ghostBtn} inline-flex h-9 items-center text-[12.5px]`}>
            <Globe className="mr-1 size-3.5" /> API docs
          </a>
        </div>
      </Panel>
    </div>
  );
}
