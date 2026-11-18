import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, Wallet, TrendingUp, Receipt, Download, Search, Smartphone, CreditCard, RefreshCw, Clock } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { fullDate, money, seriesByDay } from "@/lib/admin";
import { allWalletBalances, sendWithdrawal, walletBalance } from "@/lib/relworx";
import { adminWhopPayments } from "@/lib/admin-payments.functions";
import { adminProviderBalances, adminProviderPayout } from "@/lib/admin-money.functions";
import { COUNTRIES, countryByCurrency, formatAmount, normalizeFor } from "@/lib/countries";
import { downloadCsv, methodLabel, toCsv } from "@/lib/admin-insights";
import { getFbAuth } from "@/lib/firebase";
import { purgeTable } from "@/lib/fdb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Panel, Pill, SoftArea, Stat, chipBtn, paypalBtn, softField } from "./ui";

type Tx = {
  id: string;
  user_id: string | null;
  amount: number;
  currency: string;
  method: string | null;
  phone: string | null;
  reference: string | null;
  note: string | null;
  kind: string;
  status: string;
  created_at: string;
};

/** A real payment (pawaPay / Whop / PayPal) joined with the user and plan. */
type MergedTx = Tx & {
  userName: string;
  userEmail: string;
  planName: string;
  liveStatus?: string | undefined;
};

type Provider = "pawapay" | "whop" | "paypal";
type ProviderBalance = { currency: string; available: number; pending?: number | undefined; label?: string | undefined };
type ProviderState = { ok: boolean; balances: ProviderBalance[]; message?: string | undefined; needsApproval?: boolean | undefined };

async function idToken() {
  const u = getFbAuth().currentUser;
  if (!u) throw new Error("Please sign in again.");
  return u.getIdToken();
}

async function loadWallet() {
  const [tx, wd, profiles] = await Promise.all([
    supabase.from("luo_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("luo_withdrawals").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name, email, phone"),
  ]);
  return {
    tx: (tx.data ?? []) as Tx[],
    wd: wd.data ?? [],
    profiles: profiles.data ?? [],
  };
}

const PROVIDER_NAME: Record<Provider, string> = { pawapay: "Mobile money · pawaPay", whop: "Card · Whop", paypal: "PayPal" };

export function WalletTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-wallet"], queryFn: loadWallet });
  const [openTx, setOpenTx] = useState<MergedTx | null>(null);
  const [wdOpen, setWdOpen] = useState(false);
  const [payout, setPayout] = useState<Provider | null>(null);
  const [form, setForm] = useState({ phone: "", amount: "", reason: "", currency: "UGX" });
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | "success" | "pending" | "failed">("all");
  const [methodF, setMethodF] = useState<string>("all");

  const paidOut = (q.data?.wd ?? []).filter((w) => w.status !== "rejected").reduce((s, w) => s + Number(w.amount), 0);
  // The withdrawable amount is whatever Relworx actually holds; the ledger
  // difference is only a fallback when the payment service is unreachable.
  const live = useQuery({ queryKey: ["relworx-balance"], queryFn: () => walletBalance(), refetchInterval: 30_000, staleTime: 15_000 });
  /** Real live balance for every supported country. */
  const balances = useQuery({ queryKey: ["relworx-balances"], queryFn: allWalletBalances, refetchInterval: 30_000, staleTime: 15_000 });
  /** Live pawaPay, Whop and PayPal balances (admin-only server check). */
  const services = useQuery({
    queryKey: ["provider-balances"],
    queryFn: async () => adminProviderBalances({ data: { idToken: await idToken() } }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const payoutCountry = countryByCurrency(form.currency);
  const payoutBalance = balances.data?.find((b) => b.currency === form.currency)?.balance ?? null;
  const profileOf = (uid: string | null) => (q.data?.profiles ?? []).find((p) => p.id === uid);

  // Live card payments straight from Whop, matched to local transactions.
  const whop = useQuery({ queryKey: ["whop-payments"], queryFn: () => adminWhopPayments(), refetchInterval: 20_000, staleTime: 10_000 });

  const rows: MergedTx[] = (q.data?.tx ?? []).map((t) => {
    const p = profileOf(t.user_id);
    const liveCard = whop.data?.payments.find((w) => w.txId === String(t.id));
    const liveStatus = liveCard
      ? liveCard.refunded
        ? "refunded"
        : liveCard.status === "paid" && (!liveCard.substatus || liveCard.substatus === "succeeded")
          ? "success"
          : ["void", "uncollectible", "failed", "canceled", "cancelled"].includes(liveCard.status)
            ? "failed"
            : "pending"
      : undefined;
    return {
      ...t,
      status: liveStatus ?? t.status,
      liveStatus,
      userName: p?.display_name ?? p?.name ?? p?.email ?? t.phone ?? "Unknown user",
      userEmail: p?.email ?? "—",
      planName: (t as { plan_name?: string }).plan_name ?? t.method ?? t.kind,
    };
  });

  const successRows = rows.filter((t) => t.status === "success");
  const pendingRows = rows.filter((t) => t.status === "pending");
  const earned = successRows.reduce((s, t) => s + Number(t.amount), 0);
  const balance = live.data ?? earned - paidOut;
  const chart = seriesByDay<{ created_at: string; amount: number }>(successRows, 21, (t) => Number(t.amount));

  const methods = useMemo(() => [...new Set(rows.map((r) => methodLabel(r.method ?? r.kind)))], [rows]);
  const shown = rows.filter((t) => {
    if (statusF === "failed" ? !["failed", "expired", "refunded"].includes(t.status) : statusF !== "all" && t.status !== statusF) return false;
    if (methodF !== "all" && methodLabel(t.method ?? t.kind) !== methodF) return false;
    const s = search.trim().toLowerCase();
    return !s || [t.userName, t.userEmail, t.phone, t.reference, t.planName].some((v) => (v ?? "").toLowerCase().includes(s));
  });

  const refreshMoney = () => {
    for (const k of ["admin-wallet", "admin-overview", "relworx-balance", "relworx-balances", "whop-payments", "provider-balances"])
      void qc.invalidateQueries({ queryKey: [k] });
  };

  const purge = useMutation({
    mutationFn: () => purgeTable("luo_transactions"),
    onSuccess: (n) => {
      toast.success(`Cleared ${n} stored transaction${n === 1 ? "" : "s"}`);
      refreshMoney();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    // Real payout: money leaves the Relworx wallet first, then the ledger row
    // records whatever the provider actually did.
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!form.phone.trim()) throw new Error("Phone number is required");
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      const cap = payoutBalance ?? (form.currency === "UGX" ? balance : null);
      if (cap != null && amount > cap) throw new Error(`Amount is more than the available ${form.currency} balance`);
      const result = await sendWithdrawal({ phone: form.phone, amount, currency: form.currency, description: form.reason.trim() || "MOVIE MAX payout" });
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("luo_withdrawals").insert({
        amount,
        currency: result.currency,
        phone: normalizeFor(form.phone, payoutCountry),
        reason: form.reason.trim() || null,
        reference: result.reference,
        internal_reference: result.internal_reference,
        status: result.status === "success" ? "sent" : result.status,
        provider: "relworx",
        note: result.message,
        created_by: me.user?.id ?? null,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (result.status === "success") toast.success(result.message || "Payout sent");
      else toast.info(result.message || "Payout is still being processed");
      setForm({ phone: "", amount: "", reason: "", currency: form.currency });
      setWdOpen(false);
      refreshMoney();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const svc = services.data?.ok ? services.data : null;
  const svcError = services.data && !services.data.ok ? services.data.error : services.error instanceof Error ? services.error.message : null;

  const exportCsv = () =>
    downloadCsv(
      `moviemax-payments-${new Date().toISOString().slice(0, 10)}`,
      toCsv(
        shown.map((t) => ({
          date: t.created_at,
          user: t.userName,
          email: t.userEmail,
          phone: t.phone,
          plan: t.planName,
          method: methodLabel(t.method ?? t.kind),
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          reference: t.reference,
        })),
      ),
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat
          label="Mobile money balance"
          value={live.isLoading && live.data == null ? "…" : money(balance)}
          tone="paypal"
          sub={live.data == null ? "Ledger estimate · service offline" : "Live Relworx wallet"}
          icon={<Wallet className="size-4" />}
          onClick={() => setWdOpen(true)}
        />
        <Stat label="Total earned" value={money(earned)} tone="paypalSky" sub={`${successRows.length} paid · ${rows.length} total`} icon={<TrendingUp className="size-4" />} />
        <Stat label="Withdrawn" value={money(paidOut)} tone="paypalMist" sub={`${q.data?.wd.length ?? 0} payouts`} icon={<ArrowDownToLine className="size-4" />} />
        <Stat label="Pending payments" value={pendingRows.length.toLocaleString()} tone="paypalGold" sub={money(pendingRows.reduce((s, t) => s + Number(t.amount), 0))} icon={<Clock className="size-4" />} onClick={() => setStatusF("pending")} />
      </div>

      <Panel
        title="Balances · every payment service"
        action={
          <button type="button" onClick={refreshMoney} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
            <RefreshCw className={`size-3 ${services.isFetching || balances.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      >
        {svcError && <p className="mb-2 rounded-xl bg-paypal-mist px-3 py-2 text-[12px] text-paypal-navy">{svcError}</p>}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <ServiceCard
            name="Mobile money · Relworx"
            icon={<Smartphone className="size-4" />}
            state={{
              ok: (balances.data ?? []).some((b) => b.balance != null),
              balances: (balances.data ?? []).filter((b) => b.balance != null).map((b) => ({ currency: b.currency, available: b.balance ?? 0, label: `${b.flag} ${b.country}` })),
              message: balances.isLoading ? "Loading…" : undefined,
            }}
            loading={balances.isLoading}
            onPick={(cur) => {
              setForm((f) => ({ ...f, currency: cur }));
              setWdOpen(true);
            }}
            onWithdraw={() => setWdOpen(true)}
          />
          {(["pawapay", "whop", "paypal"] as Provider[]).map((p) => (
            <ServiceCard
              key={p}
              name={PROVIDER_NAME[p]}
              icon={p === "pawapay" ? <Smartphone className="size-4" /> : p === "whop" ? <CreditCard className="size-4" /> : <span className="text-[11px] font-black">PP</span>}
              state={svc?.[p] as ProviderState | undefined}
              loading={services.isLoading}
              onWithdraw={() => setPayout(p)}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Income · last 21 days" action={<span className="text-[11px] opacity-60">{money(earned)} lifetime</span>}>
        <SoftArea data={chart} prefix="UGX " color="oklch(0.56 0.19 255)" height={170} />
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Transactions"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] opacity-60">
                {q.isLoading ? "loading…" : `${shown.length}/${rows.length}${whop.data?.ok ? " · cards live from Whop" : ""}`}
              </span>
              <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
                <Download className="size-3" /> CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete every stored transaction from the database? The payment providers keep the real record.")) purge.mutate();
                }}
                disabled={purge.isPending}
                className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-black/5 hover:bg-white"
              >
                {purge.isPending ? "Clearing…" : "Clear database"}
              </button>
            </div>
          }
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <label className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-50" />
              <input className={`${softField} h-9 pl-8 text-[12.5px]`} placeholder="Search name, phone, reference" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {(["all", "success", "pending", "failed"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatusF(s)} className={chipBtn(statusF === s)}>
                {s === "all" ? "All" : s === "success" ? "Paid" : s[0]!.toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {["all", ...methods].map((m) => (
              <button key={m} type="button" onClick={() => setMethodF(m)} className={chipBtn(methodF === m)}>
                {m === "all" ? "Every method" : m}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <Empty>{q.isLoading ? "Loading payments…" : "No payments match."}</Empty>
          ) : (
            <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {shown.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenTx(t)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-paypal-mist px-2.5 py-2 text-left text-[12.5px] text-paypal-navy transition hover:brightness-[0.98]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paypal-blue text-[12px] font-black text-paypal-foreground">
                    {t.userName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{t.userName}</span>
                    <span className="block truncate text-[11px] opacity-70">
                      {methodLabel(t.method ?? t.kind)} · {t.planName} · {fullDate(t.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-black">{money(Number(t.amount), t.currency)}</span>
                    <Pill tone={t.status === "success" ? "on" : ["failed", "expired", "refunded"].includes(t.status) ? "off" : "warn"}>{t.status === "success" ? "paid" : t.status}</Pill>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Withdrawals" action={<button type="button" onClick={() => setWdOpen(true)} className={`${paypalBtn} h-8 px-3 text-[12px]`}>Withdraw</button>}>
          {(q.data?.wd.length ?? 0) === 0 ? (
            <Empty>No withdrawals yet.</Empty>
          ) : (
            <ul className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {q.data?.wd.map((w) => (
                <li key={w.id} className="rounded-xl bg-paypal-mist px-3 py-2 text-[12px] text-paypal-navy">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[13.5px]">{money(Number(w.amount), w.currency)}</b>
                    <Pill tone={["paid", "sent", "success"].includes(String(w.status)) ? "on" : ["failed", "rejected"].includes(String(w.status)) ? "off" : "warn"}>{w.status}</Pill>
                  </div>
                  <p className="mt-0.5 truncate opacity-75">
                    {String(w.provider ?? "relworx").toUpperCase()} · {w.phone}
                  </p>
                  {w.reason && <p className="truncate opacity-60">{w.reason}</p>}
                  <p className="opacity-50">{fullDate(w.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* transaction detail */}
      <Dialog open={!!openTx} onOpenChange={(v) => !v && setOpenTx(null)}>
        <DialogContent className="max-w-[440px] border-0 bg-paypal-mist p-5 text-paypal-navy">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold">Transaction details</DialogTitle>
          </DialogHeader>
          {openTx && (
            <div className="space-y-1.5 text-[13px]">
              <p className="rounded-2xl bg-paypal-gradient px-4 py-3 text-[26px] font-black leading-none">{money(Number(openTx.amount), openTx.currency)}</p>
              {[
                ["User", openTx.userName],
                ["Email", openTx.userEmail],
                ["Phone", openTx.phone ?? "—"],
                ["Plan", openTx.planName],
                ["Method", methodLabel(openTx.method ?? openTx.kind)],
                ["Reference", openTx.reference],
                ["Provider reference", (openTx as { internal_reference?: string | null }).internal_reference ?? "—"],
                ["Status", openTx.liveStatus ? `${openTx.status} (live)` : openTx.status],
                ["Date", fullDate(openTx.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 rounded-xl bg-white/80 px-3 py-1.5">
                  <span className="opacity-60">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-semibold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Relworx withdraw modal */}
      <Dialog open={wdOpen} onOpenChange={setWdOpen}>
        <DialogContent className="max-w-[420px] border-0 bg-paypal-mist p-5 text-paypal-navy">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold">Withdraw · Mobile money (Relworx)</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] opacity-75">
            Available: <b>{payoutBalance == null ? money(balance) : formatAmount(payoutBalance, form.currency)}</b>
          </p>
          <form
            className="mt-1 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              withdraw.mutate();
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => (
                <button key={c.code} type="button" onClick={() => setForm({ ...form, currency: c.currency })} className={chipBtn(form.currency === c.currency)}>
                  {c.flag} {c.currency}
                </button>
              ))}
            </div>
            <input className={softField} placeholder={`Phone number (${payoutCountry.providers.join(" / ")})`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={softField} inputMode="numeric" placeholder={`Amount (${form.currency})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className={softField} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <button type="submit" disabled={withdraw.isPending} className={`${paypalBtn} w-full`}>
              {withdraw.isPending ? "Sending money…" : "Send money now"}
            </button>
            <p className="text-center text-[11px] opacity-60">Money is sent straight from the Relworx wallet to this number.</p>
          </form>
        </DialogContent>
      </Dialog>

      <PayoutDialog
        provider={payout}
        state={payout && svc ? (svc[payout] as ProviderState) : undefined}
        methods={svc?.whop.methods ?? []}
        onClose={() => setPayout(null)}
        onDone={refreshMoney}
      />
    </div>
  );
}

function ServiceCard({
  name,
  icon,
  state,
  loading,
  onWithdraw,
  onPick,
}: {
  name: string;
  icon: ReactNode;
  state: ProviderState | undefined;
  loading: boolean;
  onWithdraw: () => void;
  onPick?: (currency: string) => void;
}) {
  const list = state?.balances ?? [];
  const main = [...list].sort((a, b) => b.available - a.available)[0];
  const waiting = !!state?.needsApproval;
  return (
    <div className="flex flex-col rounded-2xl bg-paypal-gradient p-3 shadow-paypal">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-bold sm:text-[12px]">
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/20">{icon}</span>
          <span className="truncate">{name}</span>
        </span>
        <span className={`size-2 shrink-0 rounded-full ${state?.ok ? "bg-paypal-gold" : "bg-white/40"}`} title={state?.ok ? "Live" : "Not live"} />
      </div>
      <p className="mt-2 truncate text-[16px] font-black leading-none sm:text-[20px]">
        {loading ? "…" : main ? formatAmount(main.available, main.currency) : waiting ? "Waiting approval" : "—"}
      </p>
      {main?.pending ? <p className="mt-0.5 text-[10.5px] opacity-80">{formatAmount(main.pending, main.currency)} pending</p> : null}
      {list.length > 1 && (
        <ul className="mt-2 max-h-[96px] space-y-0.5 overflow-y-auto pr-1 text-[11px]">
          {list
            .filter((b) => b !== main)
            .map((b, i) => (
              <li key={`${b.currency}-${b.label ?? i}`}>
                <button type="button" disabled={!onPick} onClick={() => onPick?.(b.currency)} className="flex w-full justify-between gap-2 rounded-md px-1 text-left enabled:hover:bg-white/10">
                  <span className="truncate opacity-80">{b.label ?? b.currency}</span>
                  <b className="shrink-0">{formatAmount(b.available, b.currency)}</b>
                </button>
              </li>
            ))}
        </ul>
      )}
      {!loading && state?.message && <p className="mt-1.5 line-clamp-2 text-[10.5px] opacity-80">{state.message}</p>}
      <button type="button" onClick={onWithdraw} disabled={loading || waiting} className={`${paypalBtn} mt-auto h-8 w-full text-[12px]`} style={{ marginTop: 10 }}>
        {waiting ? "Withdraw after approval" : "Withdraw"}
      </button>
    </div>
  );
}

function PayoutDialog({
  provider,
  state,
  methods,
  onClose,
  onDone,
}: {
  provider: Provider | null;
  state: ProviderState | undefined;
  methods: { id: string; label: string; currency: string; isDefault: boolean }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const currencies = [...new Set((state?.balances ?? []).map((b) => b.currency))];
  const [f, setF] = useState({ amount: "", currency: "", phone: "", receiver: "", methodId: "", note: "" });
  const currency = f.currency || currencies[0] || (provider === "pawapay" ? "UGX" : "USD");
  const available = state?.balances.filter((b) => b.currency === currency).reduce((s, b) => s + b.available, 0);
  const methodId = f.methodId || methods.find((m) => m.isDefault)?.id || methods[0]?.id || "";

  const send = useMutation({
    mutationFn: async () => {
      if (!provider) throw new Error("Pick a payment service");
      const amount = Number(f.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (available != null && state?.ok && amount > available) throw new Error(`Amount is more than the available ${currency} balance`);
      const base = { idToken: await idToken(), amount, currency, note: f.note.trim() || undefined };
      let to = "";
      let res;
      if (provider === "pawapay") {
        if (!f.phone.trim()) throw new Error("Phone number is required");
        to = normalizeFor(f.phone, countryByCurrency(currency));
        res = await adminProviderPayout({ data: { ...base, provider, phone: to } });
      } else if (provider === "whop") {
        if (!methodId) throw new Error("Add a payout method in your Whop dashboard first");
        to = methods.find((m) => m.id === methodId)?.label ?? methodId;
        res = await adminProviderPayout({ data: { ...base, provider, payoutMethodId: methodId } });
      } else {
        if (!f.receiver.trim()) throw new Error("PayPal email is required");
        to = f.receiver.trim();
        res = await adminProviderPayout({ data: { ...base, provider, receiver: to } });
      }
      if (!res.ok) throw new Error(res.message);
      const { data: me } = await supabase.auth.getUser();
      await supabase.from("luo_withdrawals").insert({
        amount,
        currency,
        phone: to,
        reason: f.note.trim() || null,
        reference: res.reference,
        status: res.status,
        provider,
        note: res.message,
        created_by: me.user?.id ?? null,
      });
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setF({ amount: "", currency: "", phone: "", receiver: "", methodId: "", note: "" });
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!provider} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px] border-0 bg-paypal-mist p-5 text-paypal-navy">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold">Withdraw · {provider ? PROVIDER_NAME[provider] : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] opacity-75">
          Available: <b>{available != null && state?.ok ? formatAmount(available, currency) : "unknown"}</b>
        </p>
        <form
          className="mt-1 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          {currencies.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {currencies.map((c) => (
                <button key={c} type="button" onClick={() => setF({ ...f, currency: c })} className={chipBtn(currency === c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {provider === "pawapay" && <input className={softField} placeholder="Mobile money number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}
          {provider === "paypal" && <input className={softField} type="email" placeholder="PayPal email to receive the money" value={f.receiver} onChange={(e) => setF({ ...f, receiver: e.target.value })} />}
          {provider === "whop" &&
            (methods.length === 0 ? (
              <p className="rounded-xl bg-white/80 px-3 py-2 text-[12px]">No payout method saved in Whop yet. Add your bank or wallet in the Whop dashboard, then come back.</p>
            ) : (
              <select className={softField} value={methodId} onChange={(e) => setF({ ...f, methodId: e.target.value })}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.currency}
                    {m.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            ))}
          <input className={softField} inputMode="decimal" placeholder={`Amount (${currency})`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <input className={softField} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button type="submit" disabled={send.isPending} className={`${paypalBtn} w-full`}>
            <Receipt className="size-4" /> {send.isPending ? "Sending…" : "Send money now"}
          </button>
          {provider === "paypal" && <p className="text-center text-[11px] opacity-60">Works once PayPal approves Payouts for your account.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
