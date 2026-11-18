import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TOP_ARTISTS, UG_HOST, byArtist, parseUgSongs, toUgTrack, type UgSong, type UgTrack } from "./ug-music-rules";

export type UgMusic = { trending: UgTrack[]; latest: UgTrack[]; songs: UgTrack[] };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function page(path: string, tries = 3): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${UG_HOST}${path}`, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return await res.text();
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return "";
}

/** UgMuziki errors when hit with many requests at once, so read a few pages at a time. */
async function pages(paths: string[], size = 4): Promise<string[]> {
  const out: string[] = new Array(paths.length).fill("");
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < paths.length) {
        const i = next++;
        out[i] = await page(paths[i]!);
      }
    }),
  );
  return out;
}

let cache: { at: number; data: UgMusic } | null = null;
const CACHE_MS = 20 * 60_000;
const LATEST_PAGES = [1, 2, 3, 4, 5];

/** Full songs from UgMuziki: trending, newest uploads, and every top artist. */
export const getUgMusic = createServerFn({ method: "GET" }).handler(async (): Promise<UgMusic> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  // Stays under the hosting limit of ~50 outgoing requests per call.
  const [home = "", ...rest] = await pages([
    "/",
    ...LATEST_PAGES.map((p) => `/latest_songs?page=${p}`),
    ...TOP_ARTISTS.slice(0, 30).map((a) => `/search?q=${encodeURIComponent(a.name)}`),
    ...TOP_ARTISTS.slice(0, 6).map((a) => `/search?q=${encodeURIComponent(a.name)}&page=2`),
  ]);

  const start = home.indexOf("Trending Songs");
  const end = home.indexOf("New Songs", start + 1);
  const trendingHtml = start >= 0 ? home.slice(start, end > start ? end : undefined) : "";
  const trending = parseUgSongs(trendingHtml).map(toUgTrack);
  const latest = rest
    .slice(0, LATEST_PAGES.length)
    .flatMap((h) => parseUgSongs(h))
    .map(toUgTrack)
    .sort((a, b) => b.rank - a.rank);

  const all = new Map<string, UgSong>();
  for (const html of [home, ...rest]) for (const s of parseUgSongs(html)) if (!all.has(s.id)) all.set(s.id, s);
  const songs = [...all.values()].map(toUgTrack).sort((a, b) => b.rank - a.rank);

  const data = { trending, latest, songs };
  if (songs.length) cache = { at: Date.now(), data };
  return data;
});

/** Every UgMuziki song by (or featuring) one top artist, newest first. */
export const getUgArtistSongs = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<UgTrack[]> => {
    const artist = TOP_ARTISTS.find((a) => a.slug === data.slug);
    if (!artist) return [];
    const q = encodeURIComponent(artist.name);
    const found = new Map<string, UgSong>();
    // Read search pages three at a time until a batch brings nothing new.
    for (let p = 1; p <= 12; p += 3) {
      const htmls = await pages([p, p + 1, p + 2].map((n) => `/search?q=${q}&page=${n}`), 3);
      let added = 0;
      for (const s of htmls.flatMap((h) => parseUgSongs(h))) if (!found.has(s.id)) (found.set(s.id, s), added++);
      if (!added) break;
    }
    return [...found.values()]
      .map(toUgTrack)
      .filter((t) => byArtist(t, artist))
      .sort((a, b) => b.rank - a.rank);
  });

/** Finds the real file on a song page when the usual file name doesn't open. */
export const resolveUgSong = createServerFn({ method: "GET" })
  .inputValidator(z.object({ pageUrl: z.string().url().refine((u) => u.startsWith(`${UG_HOST}/song/`)) }))
  .handler(async ({ data }): Promise<string | null> => {
    const html = await page(data.pageUrl.slice(UG_HOST.length));
    const url = /data-track-url="([^"]+\.mp3)"/i.exec(html)?.[1];
    return url ? encodeURI(url) : null;
  });
