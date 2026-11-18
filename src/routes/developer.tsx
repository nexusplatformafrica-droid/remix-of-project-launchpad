import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Gauge, KeyRound, Mail, MessageCircle, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { DevHeader } from "@/components/dev/DevHeader";
import { SubscribeModal, type CustomPayPlan } from "@/components/auth/SubscribeModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useDevTheme } from "@/hooks/useDevTheme";
import { getFbAuth } from "@/lib/firebase";
import {
  createDeveloperKey,
  getDeveloperOverview,
  refreshDeveloperPlan,
  revokeDeveloperKey,
  type DevKeyRow,
} from "@/lib/developer.functions";
import {
  DEV_CONTACT,
  DEV_PLANS,
  billingDays,
  devPlan,
  planPriceUsd,
  yearlySavingPercent,
  type Billing,
  type DevPlan,
} from "@/lib/developer-plans";

export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "Developer Dashboard & API Plans — MOVIE MAX" },
      { name: "description", content: "Choose a MOVIE MAX API plan, create API keys and track your monthly requests and rate limits." },
      { property: "og:title", content: "Developer Dashboard & API Plans — MOVIE MAX" },
      { property: "og:description", content: "Developer, Pro, Business and Premium API plans with monthly or yearly billing. Create keys and watch usage live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperPage,
});

type Overview = Awaited<ReturnType<typeof getDeveloperOverview>>;

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => n.toLocaleString("en-US");

async function idToken() {
  const u = getFbAuth().currentUser;
  if (!u) throw new Error("Please sign in");
  return u.getIdToken();
}

function DeveloperPage() {
  const { theme, toggle } = useDevTheme();
  const { user, loading } = useAuth();
  const overviewFn = useServerFn(getDeveloperOverview);
  const createFn = useServerFn(createDeveloperKey);
  const revokeFn = useServerFn(revokeDeveloperKey);
  const refreshFn = useServerFn(refreshDeveloperPlan);

  const [billing, setBilling] = useState<Billing>("monthly");
  const [data, setData] = useState<Overview | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buying, setBuying] = useState<CustomPayPlan | null>(null);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getFbAuth().currentUser) return;
    setLoadingData(true);
    try {
      setData(await overviewFn({ data: { idToken: await idToken() } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load your dashboard");
    } finally {
      setLoadingData(false);
    }
  }, [overviewFn]);

  useEffect(() => {
    if (user) void load();
    else setData(null);
  }, [user, load]);

  const active = data?.plan ? devPlan(data.plan.id) : null;

  const buy = (plan: DevPlan) => {
    if (!user) return setAuthOpen(true);
    setBuying({
      id: `${plan.id}_${billing}`,
      tier: plan.id,
      name: `${plan.name} API plan (${billing === "yearly" ? "yearly" : "monthly"})`,
      usd: planPriceUsd(plan, billing),
      days: billingDays(billing),
      blurb: `${plan.monthlyRequests == null ? "Unlimited" : num(plan.monthlyRequests)} requests/month · ${plan.perSecond} requests/second`,
    });
  };

  const onPaid = async () => {
    try {
      await refreshFn({ data: { idToken: await idToken() } });
    } catch {
      /* plan shows after the cache expires */
    }
    setTimeout(() => void load(), 1500);
  };

  const create = async () => {
    setCreating(true);
    try {
      const r = await createFn({ data: { idToken: await idToken(), name: keyName.trim() || "My app" } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setNewKey(r.token);
      setKeyName("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (k: DevKeyRow) => {
    if (!confirm(`Delete the key “${k.name}”? Apps using it will stop working.`)) return;
    try {
      const r = await revokeFn({ data: { idToken: await idToken(), hash: k.hash } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Key deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the key");
    }
  };

  const quota = active?.monthlyRequests ?? null;
  const used = data?.used ?? 0;
  const pct = quota ? Math.min(100, (used / quota) * 100) : 0;
  const keyCount = data?.keys.length ?? 0;
  const canCreate = !!active && (active.keys == null || keyCount < active.keys);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DevHeader theme={theme} onToggleTheme={toggle} active="dashboard" />
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-black uppercase tracking-wider text-brand">Developer dashboard</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight lg:text-4xl">Build with the MOVIE MAX API</h1>
          </div>
        </div>

        {/* Plans */}
        <section className="mt-6" id="plans">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">API plans</h2>
              <p className="text-[13px] text-muted-foreground">Pay with mobile money, PayPal or card. Keys work as soon as payment is confirmed.</p>
            </div>
            <label className="inline-flex items-center gap-3 rounded-full bg-card px-4 py-2 ring-1 ring-border">
              <span className={`text-[13px] font-bold ${billing === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
              <Switch checked={billing === "yearly"} onCheckedChange={(v) => setBilling(v ? "yearly" : "monthly")} aria-label="Yearly billing" />
              <span className={`text-[13px] font-bold ${billing === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>Yearly</span>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-black text-brand">Save {yearlySavingPercent()}%</span>
            </label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {DEV_PLANS.map((p) => {
              const price = planPriceUsd(p, billing);
              const current = active?.id === p.id;
              return (
                <div key={p.id} className={`relative flex flex-col rounded-2xl bg-card p-5 ring-1 ${p.popular ? "ring-2 ring-brand" : "ring-border"}`}>
                  {p.popular && <span className="absolute -top-3 left-5 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-black text-brand-foreground">Most popular</span>}
                  <p className="text-[15px] font-black">{p.name}</p>
                  {p.id === "api_premium" && <p className="text-[11px] font-black uppercase tracking-wider text-brand">Unlimited</p>}
                  <p className="mt-3 text-3xl font-black tracking-tight">
                    {usd(price)}
                    <span className="text-[13px] font-bold text-muted-foreground"> /{billing === "yearly" ? "year" : "month"}</span>
                  </p>
                  {billing === "yearly" && <p className="text-[12px] font-semibold text-muted-foreground">{usd(price / 12)}/month, billed yearly</p>}
                  <ul className="mt-4 flex-1 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2 text-[13px] text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => buy(p)}
                    className={`mt-5 h-11 rounded-xl text-[14px] font-black transition ${p.popular ? "bg-brand text-brand-foreground hover:opacity-90" : "bg-muted text-foreground hover:bg-accent"}`}
                  >
                    {current ? "Renew" : active ? "Switch to " + p.name : "Get " + p.name}
                  </button>
                  {current && <p className="mt-2 text-center text-[11px] font-bold text-brand">Your current plan</p>}
                </div>
              );
            })}
            <div className="flex flex-col rounded-2xl bg-gradient-to-br from-brand/15 to-transparent p-5 ring-1 ring-border sm:col-span-2 xl:col-span-1">
              <p className="text-[15px] font-black">Custom</p>
              <p className="mt-3 text-2xl font-black tracking-tight">Let's talk</p>
              <p className="mt-2 flex-1 text-[13px] text-muted-foreground">Bigger volumes, dedicated limits, white-label or reseller deals — we'll build a plan around you.</p>
              <div className="mt-5 space-y-2">
                <a href={`mailto:${DEV_CONTACT.email}?subject=${encodeURIComponent("MOVIE MAX API custom plan")}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-muted text-[13px] font-black text-foreground hover:bg-accent">
                  <Mail className="size-4" /> Email us
                </a>
                <a href={`${DEV_CONTACT.whatsappUrl}?text=${encodeURIComponent("Hi, I'm interested in a custom MOVIE MAX API plan.")}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-whatsapp text-[13px] font-black text-whatsapp-foreground hover:opacity-90">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
                <p className="pt-1 text-center text-[11.5px] text-muted-foreground">{DEV_CONTACT.email}<br />+256 795 592 662</p>
              </div>
            </div>
          </div>
        </section>
        {/* Status */}
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <Stat icon={<Zap className="size-4" />} label="Plan">
            {!user ? (
              <span className="text-muted-foreground">Not signed in</span>
            ) : active ? (
              <>
                {active.name}
                {data?.plan?.expiresAt && (
                  <span className="mt-1 block text-[12px] font-semibold text-muted-foreground">
                    Active until {new Date(data.plan.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{loadingData ? "Loading…" : "No plan yet"}</span>
            )}
          </Stat>
          <Stat icon={<Gauge className="size-4" />} label="Requests this month">
            {num(used)}
            <span className="text-[14px] font-bold text-muted-foreground"> / {active ? (quota == null ? "Unlimited" : num(quota)) : "—"}</span>
            {quota != null && active && (
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
            )}
          </Stat>
          <Stat icon={<KeyRound className="size-4" />} label="API keys">
            {keyCount}
            <span className="text-[14px] font-bold text-muted-foreground"> / {active ? (active.keys == null ? "Unlimited" : active.keys) : "—"}</span>
            {active && <span className="mt-1 block text-[12px] font-semibold text-muted-foreground">{active.perSecond} requests/second per key</span>}
          </Stat>
        </section>

        {/* Keys */}
        <section className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Your API keys</h2>
              <p className="text-[13px] text-muted-foreground">Send a key as <code className="rounded bg-muted px-1 text-foreground">Authorization: Bearer YOUR_API_KEY</code>.</p>
            </div>
          </div>
          {data?.error && <p className="mt-4 rounded-xl bg-muted p-3 text-[13px] text-muted-foreground">{data.error}</p>}

          {!user ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-4">
              <p className="flex-1 text-[14px] text-muted-foreground">{loading ? "Checking your account…" : "Sign in to buy a plan and create API keys."}</p>
              <button type="button" onClick={() => setAuthOpen(true)} className="h-10 rounded-lg bg-brand px-4 text-[13px] font-black text-brand-foreground">Sign in</button>
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  maxLength={60}
                  placeholder="Key name, e.g. My movie app"
                  disabled={!canCreate}
                  className="h-11 flex-1 rounded-xl bg-background px-3 text-[14px] text-foreground outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-brand disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={create}
                  disabled={!canCreate || creating}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-black text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="size-4" /> {creating ? "Creating…" : "Create API key"}
                </button>
              </div>
              {!active && !loadingData && (
                <p className="mt-2 text-[12.5px] font-semibold text-muted-foreground">You need a paid plan to create keys — choose one below.</p>
              )}
              {active && !canCreate && (
                <p className="mt-2 text-[12.5px] font-semibold text-muted-foreground">Your {active.name} plan allows {active.keys} key{active.keys === 1 ? "" : "s"}. Delete one or upgrade.</p>
              )}
              <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl ring-1 ring-border">
                {(data?.keys ?? []).map((k) => (
                  <div key={k.hash} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <KeyRound className="size-4 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold">{k.name}</p>
                      <p className="font-mono text-[12px] text-muted-foreground">mmx_live_••••••••{k.last4} · created {k.created_at ? new Date(k.created_at).toLocaleDateString() : "—"}</p>
                    </div>
                    <span className="text-[12px] font-bold text-muted-foreground">{num(k.used)} requests this month</span>
                    <button type="button" onClick={() => revoke(k)} aria-label={`Delete ${k.name}`} className="grid size-9 place-items-center rounded-lg text-muted-foreground ring-1 ring-border hover:bg-destructive/15 hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {data && data.keys.length === 0 && !data.error && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No keys yet.</p>}
                {!data && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Loading…</p>}
              </div>
            </>
          )}
        </section>

        <p className="mt-8 max-w-2xl text-[14px] text-muted-foreground">
          Pick a plan, create your API key and start calling the API on our domain. Read the <Link to="/doc" className="font-bold text-brand underline underline-offset-2">developer guide</Link> for every endpoint.
        </p>
      </main>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      {buying && (
        <SubscribeModal
          open={!!buying}
          onOpenChange={(v) => !v && setBuying(null)}
          customPlan={buying}
          onPaid={onPaid}
        />
      )}
      <Dialog open={!!newKey} onOpenChange={(v) => !v && setNewKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>Copy it now — for your safety it will not be shown again.</DialogDescription>
          <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-foreground">{newKey}</code>
            <button
              type="button"
              onClick={() => {
                if (newKey) void navigator.clipboard.writeText(newKey).then(() => toast.success("Copied"));
              }}
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border"
              aria-label="Copy key"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-brand/15 text-brand">{icon}</span>
        {label}
      </p>
      <div className="mt-3 text-2xl font-black tracking-tight">{children}</div>
    </div>
  );
}
