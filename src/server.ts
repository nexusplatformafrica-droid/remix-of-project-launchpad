import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Public HTML pages are identical for every visitor (all personalised data is
 * fetched client-side), so let the CDN serve them from its own cache instead
 * of hitting our serverless function on every request. This is what keeps
 * origin transfer/invocations near zero on free hosting.
 */
function withEdgeCache(request: Request, response: Response): Response {
  if (request.method !== "GET") return response;
  if (response.status !== 200) return response;
  if (response.headers.has("cache-control")) return response;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return response;
  if (url.pathname.startsWith("/admin")) return response;
  if (/^\/(watch|luo|luganda)\/[^/]+$/.test(url.pathname)) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Pings the payments backend every 3 seconds for a minute when a scheduled
 * event fires. wrangler.jsonc deliberately has no cron triggers (free
 * Cloudflare accounts allow only 5), so this only runs if one is added by hand.
 */
const PAYMENT_BACKEND_HEALTH = "https://payment.nexusplatformafrica.workers.dev/health";

async function keepPaymentBackendAwake() {
  const started = Date.now();
  while (Date.now() - started < 57_000) {
    await fetch(PAYMENT_BACKEND_HEALTH, { cache: "no-store" }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export default {
  async scheduled(_event: unknown, _env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(keepPaymentBackendAwake());
  },
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withEdgeCache(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
