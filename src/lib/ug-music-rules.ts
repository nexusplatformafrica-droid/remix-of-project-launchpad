/**
 * Pure rules for full songs read from UgMuziki (tested in src/test/ug-music-rules.test.ts).
 */
export const UG_HOST = "https://www.ugmuziki.com";
export const UG_TRACK_PREFIX = "ug:";

/** Top Ugandan artists (real photos and channels), in display order. */
export { TOP_ARTISTS } from "./ug-artists";

export type UgSong = {
  id: string;
  rawTitle: string;
  author: string;
  cover: string;
  plays: number;
  pageUrl: string;
};

export type UgTrack = {
  id: string;
  artist_id: string;
  stage_name: string;
  title: string;
  cover_url?: string;
  audio_url: string;
  download_url: string;
  kind: "audio";
  source: "ugmuziki";
  external_url: string;
  plays: number;
  /** Bigger = newer on UgMuziki; used for newest-first ordering. */
  rank: number;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

/** Reads every song card (trending, latest, search, artist lists) from a UgMuziki page. */
export function parseUgSongs(html: string): UgSong[] {
  const out: UgSong[] = [];
  const seen = new Set<string>();
  const re = /id="song-name(\d+)"[^>]*>([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const before = html.slice(Math.max(0, m.index - 900), m.index);
    const after = html.slice(m.index, m.index + 1200);
    const author = new RegExp(`id="song-author${id}"[^>]*>([^<]+)<`).exec(after)?.[1] ?? "";
    const plays = Number(/([\d,]+)\s*plays/.exec(after)?.[1]?.replace(/,/g, "") ?? 0) || 0;
    const imgs = [...before.matchAll(/<img[^>]+src="([^"]+)"/g)];
    const cover = imgs.length ? imgs[imgs.length - 1]![1]! : `${UG_HOST}/public/uploads/song_covers/ugmuziki-cover${id}.jpg`;
    const links = [...before.matchAll(/href="(https:\/\/www\.ugmuziki\.com\/song\/[^"]+)"/g)];
    out.push({
      id,
      rawTitle: decode(m[2]!).trim(),
      author: decode(author).trim(),
      cover,
      plays,
      pageUrl: links.length ? links[links.length - 1]![1]! : "",
    });
  }
  return out;
}

/** UgMuziki stores each file as "ugmuziki.com - {title} - {id}.mp3". */
export const ugMp3Url = (s: Pick<UgSong, "id" | "rawTitle">) =>
  `${UG_HOST}/public/uploads/songs/${encodeURIComponent(`ugmuziki.com - ${s.rawTitle} - ${s.id}.mp3`)}`;

/** "Somebody By Sheebah Kalungi - Free Mp3 Audio Download" -> title + artist. */
export function splitTitle(raw: string, author: string): { title: string; artist: string } {
  const clean = raw.replace(/\s*-?\s*free\s*mp3.*$/i, "").replace(/\s+/g, " ").trim();
  const by = /^(.+?)\s+by\s+(?:by\s+)?(.+)$/i.exec(clean);
  if (by) return { title: by[1]!.trim(), artist: by[2]!.trim() };
  return { title: clean, artist: author || "Ugandan artist" };
}

export function toUgTrack(s: UgSong): UgTrack {
  const { title, artist } = splitTitle(s.rawTitle, s.author);
  const audio = ugMp3Url(s);
  const name = `${title} - ${artist}.mp3`;
  const out: UgTrack = {
    id: `${UG_TRACK_PREFIX}${s.id}`,
    artist_id: `${UG_TRACK_PREFIX}artist:${(s.author || artist).toLowerCase()}`,
    stage_name: artist,
    title,
    audio_url: audio,
    download_url: `/api/public/song?id=${encodeURIComponent(s.id)}&src=${encodeURIComponent(audio)}&name=${encodeURIComponent(name)}`,
    kind: "audio",
    source: "ugmuziki",
    external_url: s.pageUrl,
    plays: s.plays,
    rank: Number(s.id) || 0,
  };
  if (s.cover) out.cover_url = s.cover;
  return out;
}

/** True when a song is by (or features) the given top artist. */
export const byArtist = (t: Pick<UgTrack, "title" | "stage_name">, artist: { match: RegExp }) =>
  artist.match.test(`${t.stage_name} ${t.title}`);

/** Only real UgMuziki song files may be downloaded through the site. */
export function isAllowedUgFile(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname === "www.ugmuziki.com" && u.pathname.startsWith("/public/uploads/songs/") && /\.mp3$/i.test(u.pathname);
  } catch {
    return false;
  }
}
