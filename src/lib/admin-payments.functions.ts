import { createServerFn } from "@tanstack/react-start";
import { listWhopPayments } from "./whop.server";

export type AdminWhopPayment = {
  id: string;
  status: string;
  substatus: string;
  txId: string | null;
  refunded: boolean;
};

/**
 * Live card payments straight from Whop, so the admin dashboard shows the
 * provider's real record instead of a third-party mirror.
 */
export const adminWhopPayments = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; payments: AdminWhopPayment[] }> => {
    try {
      const payments = await listWhopPayments();
      return {
        ok: true,
        payments: payments.map((p) => ({
          id: p.id,
          status: String(p.status ?? ""),
          substatus: String(p.substatus ?? ""),
          txId: p.metadata ? String(p.metadata["tx_id"] ?? "") || null : null,
          refunded: Boolean(p.refunded_at),
        })),
      };
    } catch (err) {
      console.error("[admin] whop payments failed", err);
      return { ok: false, payments: [] };
    }
  },
);
