/**
 * Pure rules for artists' official YouTube music videos (tested in src/test/yt-music-rules.test.ts).
 * Videos come from each channel's public feed, which carries the real upload date and view count.
 */
export type YtVideo = {
  id: string;
  title: string;
  /** ISO date the video went up on YouTube. */
  published: string;
  views: number;
  thumbnail: string;
  artist: string;
  artistSlug: string;
};

const DAY = 86_400_000;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Reads every video from a YouTube channel/playlist feed. */
export function parseYtFeed(xml: string, artist: { name: string; slug: string }): YtVideo[] {
  const out: YtVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = /<yt:videoId>([^<]+)</.exec(entry)?.[1];
    const title = /<title>([^<]*)</.exec(entry)?.[1];
    const published = /<published>([^<]+)</.exec(entry)?.[1];
    if (!id || !title || !published) continue;
    out.push({
      id,
      title: decode(title).replace(/\s+/g, " ").trim(),
      published,
      views: Number(/views="(\d+)"/.exec(entry)?.[1] ?? 0) || 0,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      artist: artist.name,
      artistSlug: artist.slug,
    });
  }
  return out;
}

const NOT_MUSIC =
  /talk about it|interview|trailer|podcast|vlog|behind the scenes|\bbts\b|\bep\s*\d|episode|press conference|reaction|documentary|live ?stream|\bq\s*&\s*a\b|unboxing|thank you|birthday|teaser|#shorts|announcement|challenge/i;
/** Song uploads almost always say so: "Official Video", "ft", "Artist - Song", "Lyrics", "Remix"… */
const MUSIC_HINT = /official|video|audio|lyric|visuali[sz]er|\bft\b|\bfeat|remix|\s[-–—=]\s?|\bx\b|\bprod\b|acoustic|performance|\bmp3\b|\bsong\b/i;

/** Songs only — leaves out interviews, vlogs, trailers, charity visits and similar talk videos. */
export const isMusicVideo = (title: string) => !NOT_MUSIC.test(title) && MUSIC_HINT.test(title);

const UNIT_MS: Record<string, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
};

/** "7 hours ago" / "2 weeks ago" / "Streamed 3 days ago" -> milliseconds ago (null if unreadable). */
export function agoToMs(text: string): number | null {
  const m = /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(text);
  return m ? Number(m[1]) * UNIT_MS[m[2]!.toLowerCase()]! : null;
}

/** "1.2M views" -> 1200000. */
export function viewsFromText(text: string): number {
  const m = /([\d.,]+)\s*([KMB])?\s*views?/i.exec(text);
  if (!m) return 0;
  const n = Number(m[1]!.replace(/,/g, ""));
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Math.round(n * mult);
}

/** Reads the videos tab of a channel (YouTube's own page data). Upload dates are YouTube's "x days ago". */
export function parseYtBrowse(data: unknown, artist: { name: string; slug: string }, now: number): YtVideo[] {
  const out: YtVideo[] = [];
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    const l = rec["lockupViewModel"] as { contentId?: unknown; metadata?: any } | undefined;
    if (l && typeof l.contentId === "string") {
      const id = l.contentId;
      const m = l.metadata?.lockupMetadataViewModel;
      const parts: string[] = (m?.metadata?.contentMetadataViewModel?.metadataRows ?? []).flatMap((r: any) =>
        (r?.metadataParts ?? []).map((p: any) => String(p?.text?.content ?? "")),
      );
      const ago = parts.map(agoToMs).find((x) => x != null);
      const title = String(m?.title?.content ?? "").replace(/\s+/g, " ").trim();
      if (title && ago != null) {
        out.push({
          id,
          title,
          published: new Date(now - ago).toISOString(),
          views: viewsFromText(parts.find((p) => /views?/i.test(p)) ?? ""),
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          artist: artist.name,
          artistSlug: artist.slug,
        });
      }
      return;
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(data);
  return out;
}

const ageDays = (v: YtVideo, now: number) => (now - Date.parse(v.published)) / DAY;

/** One copy per video, music only. */
export function cleanVideos(videos: YtVideo[]): YtVideo[] {
  const seen = new Set<string>();
  return videos.filter((v) => isMusicVideo(v.title) && !seen.has(v.id) && !!seen.add(v.id));
}

/** Released in the last `days` days, newest first. */
export function newReleases(videos: YtVideo[], now: number, days = 30): YtVideo[] {
  return cleanVideos(videos)
    .filter((v) => ageDays(v, now) >= 0 && ageDays(v, now) < days)
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

/**
 * Trending now: songs released in the last `days` days, ranked by how fast they gain views
 * (views per day, counting at least 2 days so a few-hours-old video isn't over-ranked).
 */
export function trendingNow(videos: YtVideo[], now: number, days = 45): YtVideo[] {
  const speed = (v: YtVideo) => v.views / Math.max(2, ageDays(v, now));
  return cleanVideos(videos)
    .filter((v) => ageDays(v, now) >= 0 && ageDays(v, now) <= days)
    .sort((a, b) => speed(b) - speed(a));
}

/** "1.2M views", "34K views". */
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M views`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`;
  return `${n} views`;
}

/** "today", "3 days ago", "2 weeks ago", "5 months ago". */
export function timeAgo(iso: string, now: number): string {
  const d = Math.floor((now - Date.parse(iso)) / DAY);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`;
  const y = Math.floor(d / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}

/** Only real YouTube video IDs may be embedded. */
export const isYtId = (id: string) => /^[\w-]{11}$/.test(id);
