/**
 * Sitemap builders. Every file is regenerated at most once an hour (in-memory
 * cache + 1h HTTP cache), so newly added movies, Luo/Luganda titles and VJs
 * appear within the hour.
 */
import { CATEGORIES, isAdultItem } from "./categories";
import { fdb } from "./fdb";
import { restListTitles, type LuoPublicTitle } from "./luo-rest";
import { fetchMostTrending, searchCatalog, type CatalogItem } from "./moviebox";
import { vjInfo, vjKey } from "./vj";
import { TOP_ARTISTS } from "./ug-artists";
import { loadNaraboxCatalog } from "./narabox.functions";
import { cleanNaraboxTitle, type NaraboxCard } from "./narabox";
import { watchSlug } from "./watch-links";

type NbRow = NaraboxCard & { kind: "movies" | "tv-shows" };
/** Every Luganda API movie and series (no database quota involved). */
export const naraboxTitles = () =>
  sticky<NbRow>("narabox", 25_000, () =>
    cached("narabox", async () => {
      const { movies, shows } = await loadNaraboxCatalog();
      return [...movies.map((m) => ({ ...m, kind: "movies" as const })), ...shows.map((s) => ({ ...s, kind: "tv-shows" as const }))];
    }),
  );
const nbPath = (t: NbRow) => `/luganda/narabox/${t.kind}/${t.id}`;
const nbImages = (t: NbRow) => (t.thumbnail ? [{ loc: t.thumbnail, title: `${cleanNaraboxTitle(t.title)} — Luganda ${t.kind === "movies" ? "movie" : "series"}` }] : []);

export const BASE_URL = "https://luofilm.site";
const HOUR = 3_600_000;

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Resolves to `fallback` instead of hanging past `ms`, so Google never times out. */
function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([Promise.resolve().then(() => p).catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/** Keeps the last non-empty list so a bad upstream read never empties a sitemap. */
const lastGood = new Map<string, unknown[]>();
async function sticky<T>(key: string, ms: number, fn: () => Promise<T[]>): Promise<T[]> {
  const list = await within(fn(), ms, [] as T[]);
  if (list.length) lastGood.set(key, list);
  return list.length ? list : ((lastGood.get(key) as T[]) ?? []);
}

export const luoTitles = () => sticky<LuoPublicTitle>("luo", 20_000, () => cached("luo", () => restListTitles()));

export const catalogTitles = () => sticky<CatalogItem>("catalog", 25_000, () => catalogTitlesRaw());
const catalogTitlesRaw = () =>
  cached<CatalogItem[]>("catalog", async () => {
    const seen = new Map<string, CatalogItem>();
    const add = (list: CatalogItem[]) => {
      for (const i of list) if (!seen.has(i.id) && !isAdultItem(i)) seen.set(i.id, i);
    };
    add(await fetchMostTrending().catch(() => []));
    const keywords = [...new Set(CATEGORIES.filter((c) => !c.adult).flatMap((c) => [c.keyword, ...(c.keywords ?? [])]).filter(Boolean))];
    const jobs = keywords.flatMap((k) => [1, 2, 3].map((p) => () => searchCatalog(k, p).catch(() => [])));
    for (let i = 0; i < jobs.length; i += 6) {
      const batch = await Promise.all(jobs.slice(i, i + 6).map((j) => j()));
      batch.forEach(add);
    }
    return [...seen.values()];
  });

export function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Robots-Tag": "all",
    },
  });
}

export type UrlEntry = {
  path: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
  images?: { loc: string; title?: string }[];
  video?: { thumb: string; title: string; description: string; player: string; content?: string | null };
};

export function urlset(entries: UrlEntry[]) {
  if (!entries.length) entries = [{ path: "/", changefreq: "hourly", priority: "1.0" }];
  // Google rejects image URLs that are not absolute http(s).
  entries = entries.map((e) => {
    const images = (e.images ?? []).filter((i) => /^https?:\/\//.test(i.loc)).slice(0, 1000);
    // Google drops videos without an absolute thumbnail; fall back to a page image, else omit the video.
    let video = e.video;
    if (video && !/^https?:\/\//.test(video.thumb || "")) {
      video = images[0] ? { ...video, thumb: images[0].loc } : undefined;
    }
    if (video && (!video.title?.trim() || !video.description?.trim())) video = undefined;
    const { video: _v, ...rest } = e;
    return video ? { ...rest, images, video } : { ...rest, images };
  });
  const body = entries
    .map((e) => {
      const parts = [`  <url>`, `    <loc>${esc(BASE_URL + e.path)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${esc(e.lastmod)}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority) parts.push(`    <priority>${e.priority}</priority>`);
      for (const img of e.images ?? []) {
        parts.push(`    <image:image><image:loc>${esc(img.loc)}</image:loc>${img.title ? `<image:title>${esc(img.title)}</image:title>` : ""}</image:image>`);
      }
      if (e.video) {
        const v = e.video;
        parts.push(
          `    <video:video><video:thumbnail_loc>${esc(v.thumb)}</video:thumbnail_loc><video:title>${esc(v.title)}</video:title><video:description>${esc(v.description.slice(0, 2000))}</video:description>${v.content ? `<video:content_loc>${esc(v.content)}</video:content_loc>` : ""}<video:player_loc>${esc(v.player)}</video:player_loc><video:family_friendly>yes</video:family_friendly></video:video>`,
        );
      }
      parts.push(`  </url>`);
      return parts.join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${body}\n</urlset>`;
}

export const SITEMAP_FILES = [
  "sitemap-pages.xml",
  "sitemap-movies.xml",
  "sitemap-series.xml",
  "sitemap-animations.xml",
  "sitemap-luo-movies.xml",
  "sitemap-luganda-movies.xml",
  "sitemap-vj.xml",
  "sitemap-images.xml",
  "sitemap-videos.xml",
  "sitemap-music.xml",
  "sitemap-channels.xml",
];

export function sitemapIndex() {
  const now = new Date(Math.floor(Date.now() / HOUR) * HOUR).toISOString();
  const items = SITEMAP_FILES.map((f) => `  <sitemap><loc>${BASE_URL}/${f}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}

export async function buildSitemap(name: string): Promise<string> {
  switch (name) {
    case "pages": {
      const entries: UrlEntry[] = [
        { path: "/", changefreq: "hourly", priority: "1.0" },
        { path: "/luo", changefreq: "hourly", priority: "0.9" },
        { path: "/luganda", changefreq: "hourly", priority: "0.9" },
        { path: "/tutorial", changefreq: "monthly", priority: "0.6" },
        { path: "/plans", changefreq: "daily", priority: "0.8" },
        { path: "/music", changefreq: "hourly", priority: "0.9" },
        { path: "/channels", changefreq: "daily", priority: "0.8" },
        { path: "/search", changefreq: "daily", priority: "0.6" },
      ];
      for (const c of CATEGORIES) if (c.slug !== "home" && !c.adult) entries.push({ path: `/category/${c.slug}`, changefreq: "hourly", priority: "0.7" });
      return urlset(entries);
    }
    case "movies": {
      const list = await catalogTitles();
      return urlset(list.map((t) => ({
        path: `/watch/${watchSlug(t)}`,
        changefreq: "daily",
        priority: "0.8",
        images: [t.poster, t.backdrop].filter(Boolean).map((loc) => ({ loc: loc!, title: t.title })),
      })));
    }
    case "series": {
      const list = (await catalogTitles()).filter((t) => t.type === "series");
      return urlset(list.map((t) => ({
        path: `/watch/${watchSlug(t)}`,
        changefreq: "daily",
        priority: "0.8",
        images: [t.poster, t.backdrop].filter(Boolean).map((loc) => ({ loc: loc!, title: `${t.title} series` })),
      })));
    }
    case "animations": {
      const animated = /animation|animated|anime|cartoon|family/i;
      const list = (await catalogTitles()).filter((t) => animated.test(`${t.genre ?? ""} ${t.title}`));
      return urlset(list.map((t) => ({
        path: `/watch/${watchSlug(t)}`,
        changefreq: "daily",
        priority: "0.8",
        images: [t.poster, t.backdrop].filter(Boolean).map((loc) => ({ loc: loc!, title: `${t.title} animation` })),
      })));
    }
    case "luo-movies":
    case "luganda-movies": {
      const lang = name === "luo-movies" ? "luo" : "luganda";
      const [all, nb] = await Promise.all([luoTitles(), lang === "luganda" ? naraboxTitles() : Promise.resolve([] as NbRow[])]);
      const list = all.filter((t) => t.language === lang);
      return urlset([
        ...list.map((t) => ({
          path: `/${lang}/${encodeURIComponent(t.id)}`,
          lastmod: t.updatedAt,
          changefreq: "daily",
          priority: "0.9",
          images: t.poster ? [{ loc: t.poster, title: t.title }] : [],
        })),
        ...nb.map((t) => ({ path: nbPath(t), changefreq: "daily", priority: "0.9", images: nbImages(t) })),
      ]);
    }
    case "vj": {
      const [uploaded, nb] = await Promise.all([luoTitles(), naraboxTitles()]);
      const list = [
        ...uploaded,
        ...nb.map((t) => ({ vj: t.vj, language: "luganda", poster: t.thumbnail, title: cleanNaraboxTitle(t.title), updatedAt: null as string | null })),
      ];
      const seen = new Map<string, UrlEntry>();
      for (const t of list) {
        const key = vjKey(t.vj);
        if (!key) continue;
        const path = `/${t.language}?vj=${encodeURIComponent(key)}`;
        const entry = seen.get(path) ?? { path, changefreq: "daily", priority: "0.8", images: [] };
        if (t.poster && entry.images!.length < 20) entry.images!.push({ loc: t.poster, title: `${vjInfo(key)?.name ?? key} — ${t.title}` });
        if (!entry.lastmod || (t.updatedAt && t.updatedAt > entry.lastmod)) entry.lastmod = t.updatedAt;
        seen.set(path, entry);
      }
      return urlset([...seen.values()]);
    }
    case "images": {
      const [luo, cat, nb] = await Promise.all([luoTitles(), catalogTitles(), naraboxTitles()]);
      return urlset([
        ...nb.filter((t) => t.thumbnail).map((t) => ({ path: nbPath(t), images: nbImages(t) })),
        ...luo.filter((t) => t.poster).map((t) => ({ path: `/${t.language}/${encodeURIComponent(t.id)}`, images: [{ loc: t.poster!, title: t.title }] })),
        ...cat.filter((t) => t.poster || t.backdrop).map((t) => ({
          path: `/watch/${watchSlug(t)}`,
          images: [t.poster, t.backdrop].filter(Boolean).map((loc) => ({ loc: loc!, title: t.title })),
        })),
      ]);
    }
    case "videos": {
      // Pages with their real poster/backdrop images. Video tags are omitted:
      // Google needs a real embeddable player URL, and a page URL caused errors.
      const [luo, cat] = await Promise.all([luoTitles(), catalogTitles()]);
      return urlset([
        ...luo.map((t) => ({ path: `/${t.language}/${encodeURIComponent(t.id)}`, lastmod: t.updatedAt, changefreq: "daily", images: t.poster ? [{ loc: t.poster, title: t.title }] : [] })),
        ...cat.map((t) => ({ path: `/watch/${watchSlug(t)}`, changefreq: "daily", images: [t.backdrop, t.poster].filter(Boolean).map((loc) => ({ loc: loc!, title: t.title })) })),
      ]);
    }
    case "music": {
      // Artists and their songs: every artist page, with song covers as images.
      const empty = { data: [] as any[], error: null };
      const [{ data: artists }, { data: tracks }] = await Promise.all([
        within(fdb.from("artists").select("*") as unknown as Promise<typeof empty>, 15_000, empty),
        within(fdb.from("music_tracks").select("*") as unknown as Promise<typeof empty>, 15_000, empty),
      ]);
      const blocked = new Set((artists ?? []).filter((a) => a.status === "blocked").map((a) => String(a.id)));
      const entries: UrlEntry[] = [{ path: "/music", changefreq: "hourly", priority: "0.9" }];
      for (const a of TOP_ARTISTS) {
        entries.push({ path: `/music-artist/${a.slug}`, changefreq: "daily", priority: "0.8", images: [{ loc: a.avatar, title: `${a.name} — Ugandan artist` }] });
      }
      for (const a of artists ?? []) {
        if (blocked.has(String(a.id))) continue;
        const songs = (tracks ?? []).filter((t) => t.artist_id === a.id);
        const images = [a.avatar_url, ...songs.map((t) => t.cover_url)].filter(Boolean).slice(0, 20)
          .map((loc) => ({ loc: String(loc), title: String(a.stage_name) }));
        const newest = songs.map((t) => String(t.created_at ?? "")).sort().pop();
        entries.push({
          path: `/artist/${encodeURIComponent(String(a.id))}`,
          lastmod: newest || null,
          changefreq: "daily",
          priority: "0.8",
          images,
        });
      }
      return urlset(entries);
    }
    case "channels": {
      const empty = { data: [] as any[], error: null };
      const { data: channels } = await within(fdb.from("tv_channels").select("*") as unknown as Promise<typeof empty>, 15_000, empty);
      return urlset([
        {
          path: "/channels",
          changefreq: "daily",
          priority: "0.8",
          images: (channels ?? []).filter((c) => c.logo_url).slice(0, 50)
            .map((c) => ({ loc: String(c.logo_url), title: String(c.name) })),
        },
        ...(channels ?? []).map((c) => ({
          path: `/channel/${encodeURIComponent(String(c.id))}`,
          changefreq: "daily",
          priority: "0.7",
          images: c.logo_url ? [{ loc: String(c.logo_url), title: `${c.name} live` }] : [],
        })),
      ]);
    }
    default:
      return urlset([]);
  }
}
