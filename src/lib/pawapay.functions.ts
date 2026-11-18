import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { activeProviders, depositStatus, startDeposit } from "./pawapay.server";

export const pawaPayDeposit = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        amount: z.number().positive(),
        currency: z.string().length(3),
        reference: z.string().min(1).max(120),
        description: z.string().max(200).optional(),
        provider: z.string().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      return await startDeposit(data);
    } catch (e) {
      return { internal_reference: null, status: "failed", message: e instanceof Error ? e.message : "Payment failed" };
    }
  });

export const pawaPayDepositStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => depositStatus(data.id));

/** Live networks (with pawaPay's real logos) enabled on this account for a country. */
export const pawaPayNetworks = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ iso3: z.string().length(3) }).parse(d))
  .handler(async ({ data }) => {
    try {
      return await activeProviders(data.iso3.toUpperCase());
    } catch {
      return null;
    }
  });
