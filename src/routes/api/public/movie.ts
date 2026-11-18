import { createFileRoute } from "@tanstack/react-router";
import { fetchFreshSources, fetchSources, getMediaDomain } from "@/lib/moviebox";
import { getMovieRelay, relayRequestUrl } from "@/lib/movie-relay";
import { z } from "zod";
import { isWorkerd, socketStream } from "@/lib/socket-fetch";
import { exactMovieSource, movieRequestRange, validMovieContentRange } from "@/lib/movie-relay-rules";

/**
 * Stable relay for full website MP4 files. It resolves a fresh signed URL for
 * each browser Range request, preventing an expired URL from breaking long
 * playback sessions or downloads.
 */

const safeName = (value: string) =>
  (value.replace(/[^\w\s.()-]+/g, "").trim() || "luofilm").slice(0, 90);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Range, Content-Type, Authorization",
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Content-Disposition",
  "access-control-max-age": "86400",
} as const;

const querySchema = z.object({
  subjectId: z.string().regex(/^\d{1,80}$/),
  detailPath: z.string().max(300).optional(),
  se: z.coerce.number().int().min(0).max(10_000).default(0),
  ep: z.coerce.number().int().min(0).max(100_000).default(0),
  res: z.coerce.number().int().min(0).max(8_640).default(0),
  resourceId: z.string().min(1).max(200),
  dl: z.string().max(120).nullish(),
  probe: z.string().max(10).nullish(),
  diag: z.string().max(10).nullish(),
});

/** Bumped on every relay change so a deployed site can be checked with ?diag=1. */
const RELAY_VERSION = "relay-3";

const errorResponse = (message: string, status: number) =>
  new Response(message, { status, headers: corsHeaders });

export const Route = createFileRoute("/api/public/movie")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return errorResponse("Invalid media request", 400);
        const { subjectId, se, ep, resourceId, detailPath } = parsed.data;
        const requestedName = parsed.data.dl ?? null;
        const probe = parsed.data.probe !== null && parsed.data.probe !== undefined;
        const filename = safeName(requestedName ?? "movie.mp4");

        const selectSource = (items: Awaited<ReturnType<typeof fetchSources>>) =>
          exactMovieSource(items, resourceId);
        const [sources, domain] = await Promise.all([
          fetchSources(subjectId, se, ep, detailPath).catch(() => []),
          getMediaDomain(),
        ]);
        let source = selectSource(sources);
        if (!source) return errorResponse("Full movie file is unavailable", 404);

        // Website stream metadata includes the full file size. Return it immediately so
        // the download dialog never waits for the large media host to answer.
        if (probe && source.bytes > 0) {
          return Response.json(
            { size: source.bytes, type: "video/mp4" },
            {
              headers: {
                "cache-control": "private, max-age=60",
                ...corsHeaders,
              },
            },
          );
        }

        const incomingRange = request.headers.get("range");
        const range = movieRequestRange(incomingRange, probe);
        const ifRange = request.headers.get("if-range");
        // The media host returns 403 for requests without a browser
        // User-Agent (the hosted server sends none by default).
        const mediaReferer = `${domain}/`;
        const mediaHeaders = (): Record<string, string> => ({
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
          accept: "*/*",
          referer: mediaReferer,
          ...(range ? { range } : {}),
          ...(range && ifRange ? { "if-range": ifRange } : {}),
        });
        // On Cloudflare, fetch() adds CF-Worker/X-Forwarded headers the media host
        // can refuse; a raw socket sends only our headers. Fall back to fetch().
        const plainFetch = (url: string) =>
          fetch(url, { headers: mediaHeaders(), signal: request.signal }).catch(() => null);
        const attempts: string[] = [];
        const safeFetch = async (url: string) => {
          if (!isWorkerd()) {
            const r = await plainFetch(url);
            attempts.push(`fetch:${r?.status ?? "error"}`);
            return r;
          }
          // MovieBox's file server refuses all of Cloudflare's network (427), so a
          // Cloudflare deployment pulls the bytes through the outside relay.
          const relay = await getMovieRelay();
          if (relay) {
            const viaRelay = await fetch(
              relayRequestUrl(relay, url),
              { headers: mediaHeaders(), signal: request.signal },
            ).catch(() => null);
            attempts.push(`relay:${viaRelay?.status ?? "error"}`);
            if (viaRelay && (viaRelay.ok || viaRelay.status === 416)) return viaRelay;
            await viaRelay?.body?.cancel().catch(() => undefined);
          }
          const viaSocket = await socketStream(url, mediaHeaders(), request.signal).catch((e: unknown) => {
            attempts.push(`socket-error:${e instanceof Error ? e.message : String(e)}`);
            return null;
          });
          if (viaSocket) attempts.push(`socket:${viaSocket.status}`);
          if (viaSocket && (viaSocket.ok || viaSocket.status === 206 || viaSocket.status === 416)) return viaSocket;
          await viaSocket?.body?.cancel().catch(() => undefined);
          const viaFetch = await plainFetch(url);
          attempts.push(`fetch:${viaFetch?.status ?? "error"}`);
          return viaFetch;
        };
        if (parsed.data.diag) {
          const r = await safeFetch(source.url);
          const info = {
            version: RELAY_VERSION,
            workerd: isWorkerd(),
            relay: await getMovieRelay(),
            host: new URL(source.url).host,
            attempts,
            type: r?.headers.get("content-type") ?? null,
            server: r?.headers.get("server") ?? null,
            body: r && !r.ok && r.status !== 206 ? (await r.text().catch(() => "")).slice(0, 300) : null,
          };
          await r?.body?.cancel().catch(() => undefined);
          return Response.json(info, { headers: { "cache-control": "no-store", ...corsHeaders } });
        }
        let upstream = await safeFetch(source.url);
        if (request.signal.aborted) return errorResponse("Media request cancelled", 499);
        // A signed CDN URL may expire during a long range download. Refresh
        // play-info once and retry the exact same range against the same file.
        if (!upstream || [401, 403, 404, 410, 429].includes(upstream.status)) {
          await upstream?.body?.cancel();
          const freshSources = await fetchFreshSources(subjectId, se, ep, detailPath).catch(() => []);
          const fresh = selectSource(freshSources);
          if (!fresh) return errorResponse("This movie file is no longer available", 404);
          source = fresh;
          upstream = await safeFetch(source.url);
        }
        if (upstream?.status === 416) {
          const headers = new Headers(corsHeaders);
          const contentRange = upstream.headers.get("content-range");
          if (contentRange) headers.set("content-range", contentRange);
          else if (source.bytes > 0) headers.set("content-range", `bytes */${source.bytes}`);
          headers.set("cache-control", "no-store");
          await upstream.body?.cancel();
          return new Response(null, { status: 416, headers });
        }
        if (!upstream || (!upstream.ok && upstream.status !== 206)) {
          await upstream?.body?.cancel();
          if (probe) {
            // The media host refused our server; the browser can read the size itself.
            return Response.json(
              { size: source.bytes || null, type: "video/mp4", direct: source.url },
              { headers: { "cache-control": "no-store", ...corsHeaders } },
            );
          }
          return new Response(`Full movie file could not be opened (${attempts.join(", ")})`, {
            status: 502,
            headers: { ...corsHeaders, "x-relay-version": RELAY_VERSION },
          });
        }

        const mediaType = (upstream.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
        if (!["video/mp4", "application/octet-stream"].includes(mediaType ?? "") ||
            (upstream.status === 206 && !validMovieContentRange(upstream.headers.get("content-range")))) {
          await upstream.body?.cancel();
          return errorResponse("Media provider returned an invalid movie file", 502);
        }

        if (probe) {
          const contentRange = upstream.headers.get("content-range");
          const rangedSize = contentRange ? Number(contentRange.split("/")[1]) || 0 : 0;
          const size = rangedSize || Number(upstream.headers.get("content-length")) || source.bytes || 0;
          await upstream.body?.cancel();
          return Response.json(
            { size: size || null, type: upstream.headers.get("content-type") ?? "video/mp4" },
            {
              headers: {
                "cache-control": "private, max-age=60",
                ...corsHeaders,
              },
            },
          );
        }

        const headers = new Headers();
        for (const key of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "etag",
          "last-modified",
        ]) {
          const value = upstream.headers.get(key);
          if (value) headers.set(key, value);
        }
        headers.set("content-type", "video/mp4");
        headers.set("cache-control", "private, no-store");
        for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
        headers.set("x-content-type-options", "nosniff");
        if (requestedName) headers.set("content-disposition", `attachment; filename="${filename}"`);
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
