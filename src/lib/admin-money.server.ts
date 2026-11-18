/* eslint-disable @typescript-eslint/no-explicit-any */
import { paymentKey } from "./payment-keys.server";
import { PAYPAL_CLIENT_ID } from "./paypal.server";

/**
 * Live balances and payouts for every payment service the site takes money
 * through (pawaPay mobile money, Whop cards, PayPal). Server-only: keys never
 * reach the browser, and callers must pass requireAdmin first.
 */

export type ProviderBalance = { currency: string; available: number; pending?: number | undefined; label?: string | undefined };
export type ProviderState = {
  ok: boolean;
  balances: ProviderBalance[];
  message?: string | undefined;
  /** True when the provider answered but has not enabled this feature for the account yet. */
  needsApproval?: boolean | undefined;
};
export type PayoutMethod = { id: string; label: string; currency: string; isDefault: boolean };
export type PayoutResult = { ok: boolean; status: string; reference: string | null; message: string };

type Raw = { ok: boolean; status: number; json: any };

async function send(url: string, init: RequestInit): Promise<Raw> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, json };
}

const errText = (r: Raw, fallback: string) =>
  String(
    r.json?.failureReason?.failureMessage ??
      r.json?.message ??
      (typeof r.json?.error === "object" ? r.json?.error?.message : r.json?.error) ??
      r.json?.details?.[0]?.description ??
      `${fallback} (${r.status})`,
  );

/* ------------------------------ pawaPay ------------------------------ */

function pawa(method: "GET" | "POST", path: string, body?: unknown) {
  const token = paymentKey("PAWAPAY_API_TOKEN");
  if (!token) throw new Error("Mobile money is not configured yet.");
  return send(`https://api.pawapay.io${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

export async function pawaPayBalances(): Promise<ProviderState> {
  const r = await pawa("GET", "/v2/wallet-balances");
  if (!r.ok)
    return { ok: false, balances: [], needsApproval: r.status === 401 || r.status === 403, message: errText(r, "pawaPay balance unavailable") };
  const list: any[] = Array.isArray(r.json?.balances) ? r.json.balances : [];
  return {
    ok: true,
    balances: list.map((b) => ({
      currency: String(b.currency ?? ""),
      available: Number(b.balance) || 0,
      label: [b.country, b.provider].filter(Boolean).join(" · ") || undefined,
    })),
  };
}

export async function pawaPayPayout(input: { phone: string; amount: number; currency: string; note?: string | undefined }): Promise<PayoutResult> {
  const { resolveProvider, customerMessage } = await import("./pawapay.server");
  const { provider, phoneNumber } = await resolveProvider(input.phone);
  const payoutId = crypto.randomUUID();
  const r = await pawa("POST", "/v2/payouts", {
    payoutId,
    amount: String(input.amount),
    currency: input.currency,
    recipient: { type: "MMO", accountDetails: { phoneNumber, provider } },
    customerMessage: customerMessage(input.note || "MOVIEMAX payout"),
  });
  if (!r.ok) return { ok: false, status: "failed", reference: payoutId, message: errText(r, "pawaPay refused the payout") };
  const st = String(r.json?.status ?? "").toUpperCase();
  if (st === "REJECTED")
    return { ok: false, status: "failed", reference: payoutId, message: errText(r, "pawaPay rejected the payout") };
  return { ok: true, status: "processing", reference: payoutId, message: "pawaPay accepted the payout. The money is on its way." };
}

/* -------------------------------- Whop -------------------------------- */

function whop(path: string, init?: RequestInit & { idem?: string }) {
  const key = process.env["WHOP_API_KEY_V2"] || paymentKey("WHOP_API_KEY");
  if (!key) throw new Error("Card payments are not configured yet.");
  return send(`https://api.whop.com/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.idem ? { "Idempotency-Key": init.idem } : {}),
    },
  });
}

export async function whopBalances(): Promise<ProviderState & { methods: PayoutMethod[] }> {
  const company = paymentKey("WHOP_COMPANY_ID");
  if (!company) return { ok: false, balances: [], methods: [], message: "Whop business ID is missing." };
  const [led, methods] = await Promise.all([
    whop(`/ledger_accounts/${encodeURIComponent(company)}`),
    whop(`/payouts/methods?account_id=${encodeURIComponent(company)}&first=20`),
  ]);
  const list: PayoutMethod[] = methods.ok
    ? ((methods.json?.data ?? []) as any[])
        .filter((m) => m.status !== "broken" && !m.unavailable_reason)
        .map((m) => ({
          id: String(m.id),
          label: [m.nickname || m.payer_name || m.institution_name || "Payout method", m.account_reference ? `••${m.account_reference}` : ""]
            .filter(Boolean)
            .join(" "),
          currency: String(m.destination_currency ?? "usd").toUpperCase(),
          isDefault: Boolean(m.is_default),
        }))
    : [];
  if (!led.ok)
    return { ok: false, balances: [], methods: list, needsApproval: led.status === 401 || led.status === 403, message: errText(led, "Whop balance unavailable") };
  const balances = ((led.json?.balances ?? []) as any[]).map((b) => ({
    currency: String(b.currency ?? "usd").toUpperCase(),
    available: Number(b.balance) || 0,
    pending: Number(b.pending_balance) || 0,
  }));
  return { ok: true, balances, methods: list, message: methods.ok ? undefined : "Add a payout method in Whop to withdraw." };
}

export async function whopPayout(input: { amount: number; currency: string; payoutMethodId: string; note?: string | undefined }): Promise<PayoutResult> {
  const company = paymentKey("WHOP_COMPANY_ID");
  if (!company) return { ok: false, status: "failed", reference: null, message: "Whop business ID is missing." };
  const details = {
    account_id: company,
    amount: input.amount,
    currency: input.currency.toLowerCase(),
    payout_method_id: input.payoutMethodId,
    speed: "standard",
  };
  const quote = await whop("/payouts/quotes", { method: "POST", body: JSON.stringify(details), idem: crypto.randomUUID() });
  if (!quote.ok || !quote.json?.quote_token)
    return { ok: false, status: "failed", reference: null, message: errText(quote, "Whop could not price this payout") };
  const payout = await whop("/payouts", {
    method: "POST",
    idem: crypto.randomUUID(),
    body: JSON.stringify({
      ...details,
      quote_token: quote.json.quote_token,
      notes: (input.note || "MOVIE MAX payout").slice(0, 255),
      metadata: { source: "moviemax-admin" },
    }),
  });
  if (!payout.ok) return { ok: false, status: "failed", reference: null, message: errText(payout, "Whop refused the payout") };
  const status = String(payout.json?.status ?? "requested");
  const bad = ["failed", "denied", "canceled", "reversed"].includes(status);
  return {
    ok: !bad,
    status: status === "completed" ? "sent" : bad ? "failed" : "processing",
    reference: payout.json?.id ? String(payout.json.id) : null,
    message: bad ? `Whop payout ${status}` : "Whop accepted the payout. It arrives on your payout method soon.",
  };
}

/* ------------------------------- PayPal ------------------------------- */

async function paypal(path: string, init?: RequestInit) {
  const secret = paymentKey("PAYPAL_CLIENT_SECRET");
  if (!secret) throw new Error("PayPal is not configured yet.");
  const auth = await send("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!auth.ok || !auth.json?.access_token) throw new Error("PayPal sign-in failed.");
  return send(`https://api-m.paypal.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${auth.json.access_token}`, "Content-Type": "application/json" },
  });
}

export async function paypalBalances(): Promise<ProviderState> {
  const r = await paypal("/v1/reporting/balances");
  if (r.status === 401 || r.status === 403)
    return { ok: false, balances: [], needsApproval: true, message: "Waiting for PayPal to turn on balance access for this account." };
  if (!r.ok) return { ok: false, balances: [], message: errText(r, "PayPal balance unavailable") };
  const list: any[] = Array.isArray(r.json?.balances) ? r.json.balances : [];
  return {
    ok: true,
    balances: list.map((b) => ({
      currency: String(b.currency ?? b.total_balance?.currency_code ?? "USD"),
      available: Number(b.available_balance?.value ?? b.total_balance?.value) || 0,
      pending: Number(b.withheld_balance?.value) || 0,
    })),
  };
}

export async function paypalPayout(input: { amount: number; currency: string; receiver: string; note?: string | undefined }): Promise<PayoutResult> {
  const batch = `mmx-${Date.now()}`;
  const r = await paypal("/v1/payments/payouts", {
    method: "POST",
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: batch, email_subject: "MOVIE MAX payout" },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: input.receiver,
          amount: { value: input.amount.toFixed(2), currency: input.currency.toUpperCase() },
          note: (input.note || "MOVIE MAX payout").slice(0, 4000),
          sender_item_id: batch,
        },
      ],
    }),
  });
  if (r.status === 401 || r.status === 403)
    return { ok: false, status: "failed", reference: null, message: "PayPal hasn't approved payouts for this account yet. Once PayPal accepts, this button works." };
  if (!r.ok) return { ok: false, status: "failed", reference: null, message: errText(r, "PayPal refused the payout") };
  const id = r.json?.batch_header?.payout_batch_id ? String(r.json.batch_header.payout_batch_id) : null;
  return { ok: true, status: "processing", reference: id, message: "PayPal accepted the payout." };
}

/* ------------------------ Live transactions + refunds ------------------------ */

export type LiveTx = {
  provider: "pawapay" | "whop" | "paypal";
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  rawStatus: string;
  created_at: string;
  who: string;
  detail: string;
  refundable: boolean;
};
export type LiveList = { ok: boolean; tx: LiveTx[]; message?: string | undefined; needsApproval?: boolean | undefined };

const money = (v: any): number => (v && typeof v === "object" ? Number(v.amount ?? v.value) : Number(v)) || 0;

/** Real pawaPay deposits, looked up one by one by their deposit IDs. */
export async function pawaPayDeposits(ids: string[]): Promise<LiveList> {
  const rows = await Promise.all(
    ids.slice(0, 60).map(async (id) => {
      try {
        const r = await pawa("GET", `/v2/deposits/${encodeURIComponent(id)}`);
        if (!r.ok || r.json?.status !== "FOUND" || !r.json?.data) return null;
        const d = r.json.data;
        const st = String(d.status ?? "");
        const status: LiveTx["status"] = st === "COMPLETED" ? "paid" : st === "FAILED" ? "failed" : "pending";
        return {
          provider: "pawapay" as const,
          id: String(d.depositId ?? id),
          amount: Number(d.amount) || 0,
          currency: String(d.currency ?? ""),
          status,
          rawStatus: st,
          created_at: String(d.created ?? new Date().toISOString()),
          who: String(d.payer?.accountDetails?.phoneNumber ?? "—"),
          detail: [d.payer?.accountDetails?.provider, d.failureReason?.failureMessage].filter(Boolean).join(" · "),
          refundable: status === "paid",
        };
      } catch {
        return null;
      }
    }),
  );
  const tx = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  return { ok: ids.length === 0 || tx.length > 0, tx, message: ids.length && !tx.length ? "pawaPay did not return these payments." : undefined };
}

/** Real card payments from Whop. */
export async function whopPaymentsLive(): Promise<LiveList> {
  const company = paymentKey("WHOP_COMPANY_ID");
  if (!company) return { ok: false, tx: [], message: "Whop business ID is missing." };
  const r = await whop(`/payments?account_id=${encodeURIComponent(company)}&first=100&order=created_at&direction=desc`);
  if (!r.ok) return { ok: false, tx: [], needsApproval: r.status === 401 || r.status === 403, message: errText(r, "Whop payments unavailable") };
  const tx = ((r.json?.data ?? []) as any[]).map((p) => {
    const st = String(p.status ?? "").toLowerCase();
    const sub = String(p.substatus ?? "").toLowerCase();
    const status: LiveTx["status"] = p.refunded_at || sub === "refunded"
      ? "refunded"
      : st === "paid" && (!sub || sub === "succeeded")
        ? "paid"
        : ["void", "uncollectible", "failed", "canceled", "cancelled"].includes(st) || ["failed", "canceled", "cancelled"].includes(sub)
          ? "failed"
          : "pending";
    const total = p.total ?? p.amount_charged ?? p.usd_total;
    return {
      provider: "whop" as const,
      id: String(p.id),
      amount: money(total),
      currency: String((total && typeof total === "object" ? total.currency : p.currency) ?? "usd").toUpperCase(),
      status,
      rawStatus: sub || st,
      created_at: String(p.created_at ?? ""),
      who: String(p.customer_email ?? p.user?.email ?? p.user?.name ?? p.user?.username ?? "—"),
      detail: [p.payment_instrument?.brand, p.payment_instrument?.last4 ? `••${p.payment_instrument.last4}` : "", p.failure_message].filter(Boolean).join(" · "),
      refundable: Boolean(p.refundable),
    };
  });
  return { ok: true, tx };
}

/** Real PayPal transactions for the last 30 days (needs PayPal's transaction search access). */
export async function paypalTransactionsLive(): Promise<LiveList> {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86_400_000);
  const r = await paypal(
    `/v1/reporting/transactions?start_date=${start.toISOString().slice(0, 19)}Z&end_date=${end.toISOString().slice(0, 19)}Z&fields=transaction_info,payer_info&page_size=100`,
  );
  if (r.status === 401 || r.status === 403)
    return { ok: false, tx: [], needsApproval: true, message: "Waiting for PayPal to turn on transaction access for this account." };
  if (!r.ok) return { ok: false, tx: [], message: errText(r, "PayPal transactions unavailable") };
  const tx = ((r.json?.transaction_details ?? []) as any[])
    .map((t) => {
      const i = t.transaction_info ?? {};
      const amount = Number(i.transaction_amount?.value) || 0;
      const code = String(i.transaction_status ?? "");
      const status: LiveTx["status"] = code === "S" ? (amount < 0 ? "refunded" : "paid") : code === "P" ? "pending" : code === "V" ? "refunded" : "failed";
      return {
        provider: "paypal" as const,
        id: String(i.transaction_id ?? ""),
        amount: Math.abs(amount),
        currency: String(i.transaction_amount?.currency_code ?? "USD"),
        status,
        rawStatus: `${code} ${i.transaction_event_code ?? ""}`.trim(),
        created_at: String(i.transaction_initiation_date ?? ""),
        who: String(t.payer_info?.email_address ?? t.payer_info?.payer_name?.alternate_full_name ?? "—"),
        detail: String(i.transaction_subject ?? i.transaction_note ?? ""),
        refundable: code === "S" && amount > 0,
      };
    })
    .reverse();
  return { ok: true, tx };
}

export async function refundPayment(input: { provider: LiveTx["provider"]; id: string; amount?: number | undefined; currency?: string | undefined }): Promise<PayoutResult> {
  if (input.provider === "whop") {
    const r = await whop(`/payments/${encodeURIComponent(input.id)}/refund`, {
      method: "POST",
      idem: crypto.randomUUID(),
      body: JSON.stringify(input.amount ? { partial_amount: input.amount } : {}),
    });
    if (!r.ok) return { ok: false, status: "failed", reference: input.id, message: errText(r, "Whop refused the refund") };
    return { ok: true, status: "refunded", reference: input.id, message: "Whop refunded the payment. The buyer gets an email." };
  }
  if (input.provider === "paypal") {
    const r = await paypal(`/v2/payments/captures/${encodeURIComponent(input.id)}/refund`, {
      method: "POST",
      body: JSON.stringify(input.amount && input.currency ? { amount: { value: input.amount.toFixed(2), currency_code: input.currency } } : {}),
    });
    if (r.status === 401 || r.status === 403)
      return { ok: false, status: "failed", reference: input.id, message: "PayPal hasn't allowed refunds from this app yet." };
    if (!r.ok) return { ok: false, status: "failed", reference: input.id, message: errText(r, "PayPal refused the refund") };
    return { ok: true, status: "refunded", reference: String(r.json?.id ?? input.id), message: "PayPal refunded the payment." };
  }
  const refundId = crypto.randomUUID();
  const r = await pawa("POST", "/v2/refunds", {
    refundId,
    depositId: input.id,
    ...(input.amount && input.currency ? { amount: String(input.amount), currency: input.currency } : {}),
  });
  const st = String(r.json?.status ?? "").toUpperCase();
  if (!r.ok || st === "REJECTED") return { ok: false, status: "failed", reference: refundId, message: errText(r, "pawaPay refused the refund") };
  return { ok: true, status: "processing", reference: refundId, message: "pawaPay accepted the refund. The money returns to the customer's phone." };
}
