import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, Wallet, TrendingUp, Receipt } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { fullDate, money, seriesByDay } from "@/lib/admin";
import {
  allWalletBalances,
  sendWithdrawal,
  walletBalance,
} from "@/lib/relworx";
import { adminWhopPayments } from "@/lib/admin-payments.functions";
import { COUNTRIES, countryByCurrency, formatAmount, normalizeFor } from "@/lib/countries";

import { purgeTable } from "@/lib/fdb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Panel, Pill, SoftArea, Stat, goldBtn, softField } from "./ui";

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

export function WalletTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-wallet"], queryFn: loadWallet });
  const [openTx, setOpenTx] = useState<MergedTx | null>(null);
  const [wdOpen, setWdOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", amount: "", reason: "", currency: "UGX" });

  const paidOut = (q.data?.wd ?? []).filter((w) => w.status !== "rejected").reduce((s, w) => s + Number(w.amount), 0);
  // The withdrawable amount is whatever Relworx actually holds; the ledger
  // difference is only a fallback when the payment service is unreachable.
  const live = useQuery({
    queryKey: ["relworx-balance"],
    queryFn: () => walletBalance(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  /** Real live balance for every supported country. */
  const balances = useQuery({
    queryKey: ["relworx-balances"],
    queryFn: allWalletBalances,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const payoutCountry = countryByCurrency(form.currency);
  const payoutBalance =
    balances.data?.find((b) => b.currency === form.currency)?.balance ?? null;




  const profileOf = (uid: string | null) => (q.data?.profiles ?? []).find((p) => p.id === uid);

  /* ---------- Real provider records: pawaPay / Whop / PayPal ---------- */
  // Live card payments straight from Whop, matched to local transactions.
  const whop = useQuery({
    queryKey: ["whop-payments"],
    queryFn: () => adminWhopPayments(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  // Every local transaction is a real payment record: mobile money deposits
  // are confirmed live against pawaPay, card payments against Whop, and
  // PayPal orders against PayPal — each row carries the provider reference.
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
  const earned = successRows.reduce((s, t) => s + Number(t.amount), 0);
  const balance = live.data ?? earned - paidOut;
  const chart = seriesByDay<{ created_at: string; amount: number }>(
    successRows,
    21,
    (t) => Number(t.amount),
  );

  const purge = useMutation({
    mutationFn: () => purgeTable("luo_transactions"),
    onSuccess: (n) => {
      toast.success(`Cleared ${n} stored transaction${n === 1 ? "" : "s"}`);
      void qc.invalidateQueries({ queryKey: ["admin-wallet"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
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
      if (cap != null && amount > cap)
        throw new Error(`Amount is more than the available ${form.currency} balance`);

      const result = await sendWithdrawal({
        phone: form.phone,
        amount,
        currency: form.currency,
        description: form.reason.trim() || "MOVIE MAX payout",
      });

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
      void qc.invalidateQueries({ queryKey: ["admin-wallet"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      void qc.invalidateQueries({ queryKey: ["relworx-balance"] });
      void qc.invalidateQueries({ queryKey: ["relworx-balances"] });
      void qc.invalidateQueries({ queryKey: ["whop-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Available balance"
          value={live.isLoading && live.data == null ? "…" : money(balance)}
          tone="mint"
          sub={live.data == null ? "Ledger estimate · service offline" : "Live Relworx balance"}
          icon={<Wallet className="size-4" />}
        />
        <Stat label="Total earned" value={money(earned)} tone="gold" sub={`${rows.length || (q.data?.tx.length ?? 0)} transactions`} icon={<TrendingUp className="size-4" />} />
        <Stat label="Withdrawn" value={money(paidOut)} tone="rose" sub={`${q.data?.wd.length ?? 0} requests`} icon={<ArrowDownToLine className="size-4" />} />
        <Stat
          label="Withdraw money"
          value="Cash out"
          tone="violet"
          sub="Phone · amount · reason"
          icon={<Receipt className="size-4" />}
          onClick={() => setWdOpen(true)}
        />
      </div>

      <Panel
        title="Balances by country"
        action={
          <span className="text-[11px] opacity-60">
            {balances.isFetching ? "refreshing…" : "live from Relworx"}
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(balances.data ?? COUNTRIES.map((c) => ({
            currency: c.currency,
            country: c.name,
            flag: c.flag,
            balance: null as number | null,
          }))).map((b) => (
            <button
              key={`${b.country}-${b.currency}`}
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, currency: b.currency }));
                setWdOpen(true);
              }}
              className="rounded-2xl bg-white/65 px-3 py-3 text-left transition hover:bg-white"
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="text-[16px]">{b.flag}</span>
                {b.country}
              </span>
              <span className="mt-1 block text-[16px] font-black leading-none">
                {b.balance == null
                  ? balances.isLoading
                    ? "…"
                    : "unavailable"
                  : formatAmount(b.balance, b.currency)}
              </span>
              <span className="mt-1 block text-[10.5px] opacity-55">{b.currency} wallet</span>
            </button>
          ))}
        </div>
      </Panel>



      <Panel title="Income · last 21 days">
        <SoftArea data={chart} prefix="UGX " color="oklch(0.68 0.14 160)" />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Payments"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[11px] opacity-60">
                {q.isLoading ? "loading…" : `${rows.length} payments${whop.data?.ok ? " · card status live from Whop" : ""}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete every stored transaction from the database? The payment providers keep the real record."))
                    purge.mutate();
                }}
                disabled={purge.isPending}
                className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold ring-1 ring-black/5 hover:bg-white"
              >
                {purge.isPending ? "Clearing…" : "Clear database"}
              </button>
            </div>
          }
        >
          {rows.length === 0 ? (
            <Empty>{q.isLoading ? "Loading payments…" : "No payments yet."}</Empty>
          ) : (
            <div className="space-y-2">
              {rows.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenTx(t)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/65 px-3 py-3 text-left text-[13px] transition hover:bg-white"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(120deg,oklch(0.95_0.05_160),oklch(0.9_0.09_170))] font-black">
                    {t.userName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.userName}</span>
                    <span className="block truncate text-[11px] opacity-60">
                      {t.planName} · {t.reference}
                    </span>
                    <span className="block truncate text-[11px] opacity-50">{fullDate(t.created_at)}</span>
                  </span>
                  <span className="shrink-0 font-black">{money(Number(t.amount), t.currency)}</span>
                  <Pill tone={t.status === "success" ? "on" : t.status === "failed" ? "off" : "warn"}>
                    {t.status}
                  </Pill>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Withdrawals" action={<button type="button" onClick={() => setWdOpen(true)} className={goldBtn}>Withdraw</button>}>
          {(q.data?.wd.length ?? 0) === 0 ? (
            <Empty>No withdrawals yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {q.data?.wd.map((w) => (
                <li key={w.id} className="rounded-2xl bg-white/65 px-3 py-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[14px]">{money(Number(w.amount), w.currency)}</b>
                    <Pill
                      tone={
                        ["paid", "sent", "success"].includes(String(w.status))
                          ? "on"
                          : ["failed", "rejected"].includes(String(w.status))
                            ? "off"
                            : "warn"
                      }
                    >
                      {w.status}
                    </Pill>
                  </div>
                  <p className="mt-1 opacity-70">{w.phone}</p>
                  {w.reason && <p className="mt-0.5 opacity-60">{w.reason}</p>}
                  <p className="mt-0.5 opacity-50">{fullDate(w.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* transaction detail */}
      <Dialog open={!!openTx} onOpenChange={(v) => !v && setOpenTx(null)}>
        <DialogContent className="max-w-[440px] border-0 bg-[linear-gradient(165deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_55%,oklch(0.98_0.03_80))] p-6 text-[oklch(0.28_0.03_320)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">Transaction details</DialogTitle>
          </DialogHeader>
          {openTx && (
            <div className="space-y-2 text-[13px]">
              <p className="text-[28px] font-black leading-none">{money(Number(openTx.amount), openTx.currency)}</p>
              {[
                ["User", openTx.userName],
                ["Email", openTx.userEmail],
                ["Phone", openTx.phone ?? "—"],
                ["Plan", openTx.planName],
                ["Method", openTx.method ?? openTx.kind],
                ["Reference", openTx.reference],
                ["Provider reference", (openTx as { internal_reference?: string | null }).internal_reference ?? "—"],
                ["Status", openTx.liveStatus ? `${openTx.status} (live)` : openTx.status],
                ["Date", fullDate(openTx.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2">
                  <span className="opacity-60">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-semibold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* withdraw modal */}
      <Dialog open={wdOpen} onOpenChange={setWdOpen}>
        <DialogContent className="max-w-[420px] border-0 bg-[linear-gradient(165deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_55%,oklch(0.98_0.03_80))] p-6 text-[oklch(0.28_0.03_320)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">Withdraw money</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] opacity-65">
            Available balance:{" "}
            <b>
              {payoutBalance == null ? money(balance) : formatAmount(payoutBalance, form.currency)}
            </b>
          </p>
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              withdraw.mutate();
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setForm({ ...form, currency: c.currency })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    form.currency === c.currency
                      ? "bg-[oklch(0.88_0.11_82)] ring-1 ring-black/10"
                      : "bg-white/70 opacity-70 ring-1 ring-black/5 hover:opacity-100"
                  }`}
                >
                  {c.flag} {c.currency}
                </button>
              ))}
            </div>
            <input className={softField} placeholder={`Phone number (${payoutCountry.providers.join(" / ")})`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={softField} inputMode="numeric" placeholder={`Amount (${form.currency})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />

            <textarea
              className="min-h-20 w-full rounded-2xl bg-white/70 p-3 text-sm outline-none ring-1 ring-black/5 placeholder:opacity-50 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]"
              placeholder="Reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <button type="submit" disabled={withdraw.isPending} className={`${goldBtn} w-full`}>
              {withdraw.isPending ? "Sending money…" : "Send money now"}
            </button>
            <p className="text-center text-[11px] opacity-55">
              Money is sent straight from the Relworx wallet to this number.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
