import { paymentKey } from "./payment-keys.server";
import { countryFromPhone, providerFromPhone } from "./countries";

/** Server-only pawaPay (live, API v2) helper. The token never reaches the browser. */
const PAWAPAY_API = "https://api.pawapay.io";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<any> {
  const token = paymentKey("PAWAPAY_API_TOKEN");
  if (!token) throw new Error("Mobile money is not configured yet.");
  const res = await fetch(`${PAWAPAY_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.failureReason?.failureMessage ?? `Mobile money error ${res.status}`);
  return json;
}

/** Asks pawaPay which network a phone number belongs to. */
export async function predictProvider(phone: string): Promise<{ provider: string; phoneNumber: string }> {
  const r = await call("POST", "/v2/predict-provider", { phoneNumber: phone.replace(/\D/g, "") });
  if (!r?.provider) throw new Error("We couldn't recognise that mobile money number.");
  return { provider: r.provider, phoneNumber: r.phoneNumber };
}

/** pawaPay customer messages must be 4–22 letters, digits or spaces. */
export function customerMessage(text: string) {
  const clean = text.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 22);
  return clean.length >= 4 ? clean : "MOVIEMAX payment";
}

const confCache = new Map<string, { at: number; list: { provider: string; displayName: string; logo: string }[] }>();

/** Live list of networks pawaPay has enabled for deposits in a country. */
export async function activeProviders(iso3: string) {
  const hit = confCache.get(iso3);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.list;
  const r = await call("GET", `/v2/active-conf?country=${iso3}&operationType=DEPOSIT`);
  const list = (r?.countries?.[0]?.providers ?? []).map((p: any) => ({ provider: String(p.provider), displayName: String(p.displayName ?? ""), logo: String(p.logo ?? "") }));
  confCache.set(iso3, { at: Date.now(), list });
  return list as { provider: string; displayName: string; logo: string }[];
}

const KEYWORDS: [RegExp, string][] = [
  [/mtn/i, "MTN"], [/airtel/i, "AIRTEL"], [/vodacom|m-?pesa/i, "VODACOM|MPESA"], [/orange/i, "ORANGE"],
  [/moov/i, "MOOV"], [/wave/i, "WAVE"], [/free/i, "FREE"], [/africell/i, "AFRICELL"], [/zamtel/i, "ZAMTEL"], [/e-?mola|movitel/i, "MOVITEL|EMOLA"],
];

/** Picks the pawaPay network from the site's own prefix table (or the customer's chosen network). */
export async function resolveProvider(phone: string, chosen?: string): Promise<{ provider: string; phoneNumber: string }> {
  const digits = phone.replace(/\D/g, "");
  const country = countryFromPhone(digits);
  const name = chosen || (country ? providerFromPhone(digits, country) : null);
  if (country?.iso3 && name) {
    const key = KEYWORDS.find(([re]) => re.test(name))?.[1];
    if (key) {
      const re = new RegExp(key, "i");
      const match = (await activeProviders(country.iso3)).find((p) => re.test(p.provider) || re.test(p.displayName));
      if (match) return { provider: match.provider, phoneNumber: digits };
    }
  }
  return predictProvider(digits);
}

export async function startDeposit(input: { phone: string; amount: number; currency: string; reference: string; description?: string | undefined; provider?: string | undefined }) {
  const { provider, phoneNumber } = await resolveProvider(input.phone, input.provider);
  const depositId = crypto.randomUUID();
  const r = await call("POST", "/v2/deposits", {
    depositId,
    payer: { type: "MMO", accountDetails: { phoneNumber, provider } },
    amount: String(Math.round(Number(input.amount))),
    currency: input.currency.toUpperCase(),
    clientReferenceId: input.reference.slice(0, 64),
    customerMessage: customerMessage(input.description ?? "MOVIEMAX payment"),
  });
  if (r?.status === "REJECTED")
    return { internal_reference: null, status: "failed", message: r?.failureReason?.failureMessage ?? "Payment rejected" };
  return { internal_reference: depositId, status: "pending", provider, message: "Approve the prompt on your phone" };
}

/** Maps pawaPay's deposit state to the app's success / failed / pending. */
export function mapDepositStatus(r: any): { status: "success" | "failed" | "pending"; message: string } {
  if (r?.status === "NOT_FOUND") return { status: "pending", message: "Waiting for confirmation" };
  const s = String(r?.data?.status ?? "");
  if (s === "COMPLETED") return { status: "success", message: "Payment received" };
  if (s === "FAILED")
    return { status: "failed", message: r?.data?.failureReason?.failureMessage ?? "Payment failed" };
  return { status: "pending", message: "Waiting for confirmation" };
}

export async function depositStatus(depositId: string) {
  return mapDepositStatus(await call("GET", `/v2/deposits/${encodeURIComponent(depositId)}`));
}
