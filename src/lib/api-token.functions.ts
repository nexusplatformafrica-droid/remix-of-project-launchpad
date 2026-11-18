import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/** Drops the cached token hash so a newly created token works right away. */
export const refreshApiToken = createServerFn({ method: "POST" }).handler(async () => {
  const { resetApiTokenCache } = await import("./api-token");
  resetApiTokenCache();
  return { ok: true };
});

/** Public origin of the current request (for the /doc page). */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const first = (v: string) => (v.split(",")[0] ?? v).trim();
  return `${first(proto)}://${first(host)}`;
});

/**
 * Signs a new admin API token (unlimited). Only the site admin may call it:
 * the Firebase sign-in is signature-checked and the fixed admin identity is
 * matched without any database read. The browser then stores its hash.
 */
export const createAdminApiToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ idToken: z.string().min(20).max(12000) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyUploader } = await import("./r2-upload.server");
    const { isAdminEmail } = await import("./admin-identity");
    const who = await verifyUploader(new Request("https://local/", { headers: { authorization: `Bearer ${data.idToken}` } }));
    if (!who) return { ok: false as const, error: "Please sign in again" };
    if (!isAdminEmail(who.email)) {
      let assigned = false;
      try {
        const { fsWhere } = await import("./developer-api");
        assigned = (await fsWhere("user_roles", "user_id", who.uid)).some((r) => r["role"] === "admin");
      } catch {
        return { ok: false as const, error: "Your admin role can't be checked right now (database daily limit). Try again later or use the main admin account." };
      }
      if (!assigned) return { ok: false as const, error: "Only the site admin can create this token" };
    }
    const { signApiKey } = await import("./api-signing.server");
    const { resetApiTokenCache } = await import("./api-token");
    resetApiTokenCache();
    return { ok: true as const, token: await signApiKey({ t: "admin", v: Date.now() }) };
  });
