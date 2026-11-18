import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TOP_ARTISTS, artistBySlug, type TopArtist } from "./ug-artists";
import { cleanVideos, newReleases, parseYtBrowse, parseYtFeed, trendingNow, type YtVideo } from "./yt-music-rules";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** The channel's "Videos" tab (full-length uploads, newest first, ~30). */
async function channelVideos(a: TopArtist): Promise<YtVideo[]> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
        method: "POST",
        headers: { "user-agent": UA, "content-type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "UG" } },
          browseId: a.channelId,
          params: "EgZ2aWRlb3PyBgQKAjoA",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const list = parseYtBrowse(await res.json(), a, Date.now());
        if (list.length) return list;
      }
    } catch {
      /* retry */
    }
  }
  return feed(a, "UULF");
}

/** Public feeds: "UULF…" = full-length uploads, "UULP…" = most popular. YouTube answers these unreliably. */
async function feed(a: TopArtist, kind: "UULF" | "UULP"): Promise<YtVideo[]> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${kind}${a.channelId.slice(2)}`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return parseYtFeed(await res.text(), a);
    } catch {
      /* retry */
    }
  }
  return [];
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

export type UgVideos = { trending: YtVideo[]; fresh: YtVideo[] };

/** Last good list per artist, so one failed read never empties the rows. */
const perArtist = new Map<string, { at: number; videos: YtVideo[] }>();
let cache: { at: number; data: UgVideos } | null = null;
const CACHE_MS = 30 * 60_000;

/** Trending now + new this month, from every top artist's official channel. */
export const getUgVideos = createServerFn({ method: "GET" }).handler(async (): Promise<UgVideos> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const lists = await pool(TOP_ARTISTS, 6, async (a) => {
    const fresh = await channelVideos(a);
    if (fresh.length) perArtist.set(a.slug, { at: Date.now(), videos: fresh });
    return fresh.length ? fresh : (perArtist.get(a.slug)?.videos ?? []);
  });
  const all = lists.flat();
  const now = Date.now();
  const data = { trending: trendingNow(all, now).slice(0, 30), fresh: newReleases(all, now).slice(0, 60) };
  if (all.length) cache = { at: now, data };
  return data;
});

export type ArtistVideos = { latest: YtVideo[]; popular: YtVideo[] };

/** One artist's newest and most popular music videos. */
export const getArtistVideos = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<ArtistVideos> => {
    const a = artistBySlug(data.slug);
    if (!a) return { latest: [], popular: [] };
    const [latestRaw, popularRaw] = await Promise.all([channelVideos(a), feed(a, "UULP")]);
    if (latestRaw.length) perArtist.set(a.slug, { at: Date.now(), videos: latestRaw });
    const latest = cleanVideos(latestRaw.length ? latestRaw : (perArtist.get(a.slug)?.videos ?? []));
    // When YouTube's popular list doesn't answer, rank the newest videos by views instead.
    const popular = popularRaw.length ? cleanVideos(popularRaw) : [...latest].sort((x, y) => y.views - x.views).slice(0, 12);
    return { latest, popular };
  });
