import { paymentKey } from "./payment-keys.server";
/**
 * Server-side Whop API helper. The API key is read from the private
 * WHOP_API_KEY secret inside each call — it is never shipped to the browser.
 */

const WHOP_API = "https://api.whop.com/api/v1";

type WhopError = { message?: string };

async function whopCall<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env["WHOP_API_KEY_V2"] || paymentKey("WHOP_API_KEY");
  if (!key) throw new Error("Card payments are not configured yet.");
  const res = await fetch(`${WHOP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text };
  }
  if (!res.ok) {
    const p = payload as WhopError & { error?: { message?: string } | string };
    const nested = typeof p.error === "object" ? p.error?.message : p.error;
    throw new Error(p.message ?? nested ?? `Card payment service error (${res.status})`);
  }
  return payload as T;
}

/** Whop caps product titles at 30 characters; drop "(monthly)"/"plan" words first. */
export function whopTitle(planName: string): string {
  const short = planName.replace(/\s*\([^)]*\)/g, "").replace(/\s+plan\b/gi, "").replace(/\s+/g, " ").trim();
  const full = `MOVIE MAX ${short}`.trim();
  return (full.length <= 30 ? full : short.length <= 30 ? short : short.slice(0, 30)).trim();
}

export type WhopCheckoutSession = {
  id: string;
  purchase_url?: string | null;
};

/**
 * Creates a one-time checkout session for a membership payment. The session
 * is embedded in the pay page; Whop shows card, Apple Pay and Google Pay
 * inside it automatically.
 */
export async function createWhopCheckout(input: {
  txId: string;
  reference: string;
  planName: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  /** Pre-fills the buyer's email on Whop's checkout form. */
  email?: string | undefined;
}): Promise<WhopCheckoutSession> {
  const companyId = paymentKey("WHOP_COMPANY_ID");
  if (!companyId) throw new Error("Card payments need your Whop business ID to be set up.");
  // Charge in the buyer's own local currency; only if Whop refuses that
  // currency do we fall back to the same amount converted to USD.
  const localCurrency = input.currency.toLowerCase();
  const localPrice = Math.max(0.01, Math.round(Number(input.amount) * 100) / 100);
  const open = (currency: string, price: number) =>
    whopCall<WhopCheckoutSession>("/checkout_configurations", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        variant: {
          company_id: companyId,
          currency,
          initial_price: price,
          billing_type: "one_time",
          title: whopTitle(input.planName),
        },
        redirect_url: input.redirectUrl,
        ...(input.email ? { customer_email: input.email } : {}),
        metadata: { tx_id: input.txId, reference: input.reference },
      }),
    });
  let session: WhopCheckoutSession | null = null;
  try {
    session = await open(localCurrency, localPrice);
  } catch (error) {
    if (localCurrency === "usd") throw error;
    console.warn("Whop rejected local currency", localCurrency, error);
    const { usdRate } = await import("./geo.server");
    const perUsd = await usdRate(localCurrency);
    session = await open("usd", Math.max(1, Math.round((localPrice / perUsd) * 100) / 100));
  }
  if (!session?.id) throw new Error("The card payment service did not start the checkout.");
  return session;
}

export type WhopPayment = {
  id: string;
  status?: string | null;
  substatus?: string | null;
  refunded_at?: string | number | null;
  failure_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Lists recent payments so we can find the one for a transaction. */
export async function listWhopPayments(): Promise<WhopPayment[]> {
  const res = await whopCall<{ data?: WhopPayment[] }>(
    `/payments?account_id=${paymentKey("WHOP_COMPANY_ID") ?? ""}&first=50`,
  );
  return Array.isArray(res?.data) ? res.data : [];
}

export type WhopPaymentState = { state: "paid" | "failed" | "pending"; paymentId: string | null; message: string };

/**
 * Strict verdict for a transaction: only status "paid" with a succeeded (or no)
 * substatus and no refund counts as paid. Anything else never activates.
 */
export async function whopPaymentState(txId: string): Promise<WhopPaymentState> {
  const mine = (await listWhopPayments()).filter(
    (p) => p.metadata && String(p.metadata["tx_id"] ?? "") === txId,
  );
  const ok = mine.find((p) => {
    const st = String(p.status ?? "").toLowerCase();
    const sub = String(p.substatus ?? "").toLowerCase();
    return st === "paid" && (!sub || sub === "succeeded") && !p.refunded_at;
  });
  if (ok) return { state: "paid", paymentId: ok.id, message: "Payment confirmed" };
  const bad = mine.find((p) => {
    const st = String(p.status ?? "").toLowerCase();
    const sub = String(p.substatus ?? "").toLowerCase();
    return ["void", "uncollectible", "failed", "canceled", "cancelled"].includes(st) ||
      ["failed", "canceled", "cancelled", "refunded", "disputed"].includes(sub) || Boolean(p.refunded_at);
  });
  if (bad) {
    const sub = String(bad.substatus ?? bad.status ?? "").toLowerCase();
    const msg = sub.includes("cancel") || sub === "void" ? "Payment was cancelled." : bad.failure_message || "Payment failed. No money was taken.";
    return { state: "failed", paymentId: bad.id, message: msg };
  }
  return { state: "pending", paymentId: null, message: "Waiting for payment" };
}
