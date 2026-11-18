import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idToken = z.string().min(20).max(12000);
const amount = z.number().positive().max(1_000_000_000);
const currency = z.string().trim().min(3).max(4);
const note = z.string().trim().max(200).optional();

async function guard(token: string) {
  const { requireAdmin } = await import("./admin-guard.server");
  await requireAdmin(token);
}

/** Live balances from pawaPay, Whop and PayPal for the admin wallet. Admin only. */
export const adminProviderBalances = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ idToken }).parse(d))
  .handler(async ({ data }) => {
    try {
      await guard(data.idToken);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Not allowed" };
    }
    const m = await import("./admin-money.server");
    const safe = async <T extends { ok: boolean; balances: unknown[] }>(fn: () => Promise<T>, empty: T): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        return { ...empty, ok: false, message: e instanceof Error ? e.message : "Unavailable" };
      }
    };
    const [pawapay, whop, paypal] = await Promise.all([
      safe(m.pawaPayBalances, { ok: false, balances: [] }),
      safe(m.whopBalances, { ok: false, balances: [], methods: [] }),
      safe(m.paypalBalances, { ok: false, balances: [] }),
    ]);
    return { ok: true as const, pawapay, whop, paypal };
  });

const payoutInput = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("pawapay"), idToken, amount, currency, note, phone: z.string().trim().min(8).max(20) }),
  z.object({ provider: z.literal("whop"), idToken, amount, currency, note, payoutMethodId: z.string().trim().min(3).max(80) }),
  z.object({ provider: z.literal("paypal"), idToken, amount, currency, note, receiver: z.string().trim().email().max(200) }),
]);

/** Sends money out of a payment service's balance. Admin only. */
export const adminProviderPayout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payoutInput.parse(d))
  .handler(async ({ data }) => {
    try {
      await guard(data.idToken);
    } catch (e) {
      return { ok: false, status: "failed", reference: null, message: e instanceof Error ? e.message : "Not allowed" };
    }
    const m = await import("./admin-money.server");
    try {
      if (data.provider === "pawapay")
        return await m.pawaPayPayout({ phone: data.phone, amount: data.amount, currency: data.currency, note: data.note });
      if (data.provider === "whop")
        return await m.whopPayout({ amount: data.amount, currency: data.currency, payoutMethodId: data.payoutMethodId, note: data.note });
      return await m.paypalPayout({ amount: data.amount, currency: data.currency, receiver: data.receiver, note: data.note });
    } catch (e) {
      return { ok: false, status: "failed", reference: null, message: e instanceof Error ? e.message : "Payout failed" };
    }
  });

/** Live transactions straight from pawaPay, Whop and PayPal. Admin only. */
export const adminProviderTransactions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ idToken, depositIds: z.array(z.string().uuid()).max(60) }).parse(d))
  .handler(async ({ data }) => {
    try {
      await guard(data.idToken);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Not allowed" };
    }
    const m = await import("./admin-money.server");
    const safe = async (fn: () => Promise<import("./admin-money.server").LiveList>) => {
      try {
        return await fn();
      } catch (e) {
        return { ok: false, tx: [], message: e instanceof Error ? e.message : "Unavailable" };
      }
    };
    const [pawapay, whop, paypal] = await Promise.all([
      safe(() => m.pawaPayDeposits(data.depositIds)),
      safe(m.whopPaymentsLive),
      safe(m.paypalTransactionsLive),
    ]);
    return { ok: true as const, pawapay, whop, paypal };
  });

/** Refunds a real payment at its provider. Admin only. */
export const adminRefund = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        idToken,
        provider: z.enum(["pawapay", "whop", "paypal"]),
        id: z.string().trim().min(3).max(120),
        amount: amount.optional(),
        currency: currency.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      await guard(data.idToken);
    } catch (e) {
      return { ok: false, status: "failed", reference: null, message: e instanceof Error ? e.message : "Not allowed" };
    }
    const m = await import("./admin-money.server");
    try {
      return await m.refundPayment({ provider: data.provider, id: data.id, amount: data.amount, currency: data.currency });
    } catch (e) {
      return { ok: false, status: "failed", reference: null, message: e instanceof Error ? e.message : "Refund failed" };
    }
  });
