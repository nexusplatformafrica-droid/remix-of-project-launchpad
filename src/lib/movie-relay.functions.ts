import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeRelayUrl, relayRequestUrl, resetMovieRelayCache } from "./movie-relay";

export type RelayCheck = { ok: boolean; message: string };

/**
 * Proves a relay address really works: it must answer like the MovieBox relay,
 * refuse unrelated hosts, and pass a real MovieBox catalog request through.
 */
export const testMovieRelay = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ url: z.string().max(300) }).parse(d))
  .handler(async ({ data }): Promise<RelayCheck> => {
    const relay = normalizeRelayUrl(data.url);
    if (!relay) return { ok: false, message: "Enter a full https:// address." };
    const timed = (url: string, init?: RequestInit) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    try {
      const root = await timed(`${relay}/`);
      const rootText = (await root.text()).slice(0, 80);
      if (!/missing u/i.test(rootText)) {
        return { ok: false, message: `This address is not a movie relay (it answered ${root.status}).` };
      }
      const api = await timed(
        relayRequestUrl(relay, "https://h5-api.aoneroom.com/wefeed-h5api-bff/home?host=moviebox.ph"),
        { headers: { referer: "https://mzfi.me/", accept: "application/json" } },
      );
      const body = await api.text();
      if (!api.ok || !body.includes('"code"')) {
        return {
          ok: false,
          message: `Relay is up but MovieBox requests fail (${api.status}${body ? `: ${body.slice(0, 80)}` : ""}).`,
        };
      }
      const file = await checkMovieFile(relay);
      if (!file.ok) return file;
      resetMovieRelayCache();
      return { ok: true, message: "Relay works — a real movie file streamed through it." };
    } catch (e) {
      return { ok: false, message: `Could not reach the relay: ${e instanceof Error ? e.message : String(e)}` };
    }
  });

/** Streams the first KB of a real catalog movie through the relay. */
async function checkMovieFile(relay: string): Promise<RelayCheck> {
  const { fetchDetails, fetchHomeFeed, fetchSources, getMediaDomain } = await import("./moviebox");
  let feed = await fetchHomeFeed(0);
  const items = [...feed.items];
  for (let k = 0; k < 3 && feed.nextPage && !items.some((i) => i.type === "movie"); k++) {
    feed = await fetchHomeFeed(feed.nextPage);
    items.push(...feed.items);
  }
  const movie = items.find((i) => i.type === "movie");
  if (!movie) return { ok: false, message: "Relay passes MovieBox requests, but no movie was found to test the file stream." };
  await fetchDetails(String(movie.id));
  const sources = await fetchSources(String(movie.id));
  const first = sources[0];
  if (!first) return { ok: false, message: "Relay passes MovieBox requests, but no movie file was available to test." };
  const domain = (await getMediaDomain()).replace(/\/+$/, "");
  const res = await fetch(relayRequestUrl(relay, first.url), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "*/*",
      referer: `${domain}/`,
      range: "bytes=0-1023",
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = res.status === 206 || res.ok ? "" : (await res.text()).slice(0, 60);
  await res.body?.cancel().catch(() => undefined);
  if (res.status !== 206 && !res.ok) {
    return {
      ok: false,
      message: `MovieBox's movie file server refuses this relay (${res.status} ${text.trim()}). ${res.status === 426 ? "It blocks Railway, Render and Cloudflare servers: host the relay on Netlify Edge Functions or Deno Deploy instead." : "Host the relay with a different provider."}`,
    };
  }
  return { ok: true, message: "ok" };
}

/** Called after saving so this server instance picks up the new address now. */
export const refreshMovieRelay = createServerFn({ method: "POST" }).handler(async () => {
  resetMovieRelayCache();
  return { ok: true };
});
