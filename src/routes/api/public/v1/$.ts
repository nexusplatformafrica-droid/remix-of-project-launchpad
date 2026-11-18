import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  fetchDetails,
  fetchHome,
  fetchHomeFeed,
  fetchMostTrending,
  fetchRelated,
  fetchSources,
  getDetailPath,
  searchCatalog,
  type StreamSource,
} from "@/lib/moviebox";
import { resolveWatchId } from "@/lib/watch-links";
import { loadNaraboxCatalog } from "@/lib/narabox.functions";
import { cleanNaraboxTitle, type NaraboxItem } from "@/lib/narabox";
import { listCollection } from "@/lib/firestore-rest";
import { toEpisode, toTitle, type LuoTitle } from "@/lib/luo";
import { checkApiAccess } from "@/lib/api-token";

/**
 * MOVIE MAX public content API (read-only, JSON, CORS-open).
 * Everything is served from this site's own domain; play/download/subtitle
 * links point back to /api/public/movie, /api/public/stream, /api/public/subtitle.
 * Every data endpoint needs the admin-created API token (see src/lib/api-token.ts).
 * Full reference: src/content/moviemax-api.md (shown on /doc)
 */

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization, X-API-Key",
  "access-control-max-age": "86400",
  "access-control-expose-headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-Quota-Limit, X-Quota-Used, X-Quota-Remaining, X-Plan, Retry-After",
};

class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const json = (data: unknown, maxAge = 120) =>
  Response.json(
    { ok: true, data },
    { headers: { ...cors, "cache-control": `private, max-age=${maxAge}`, vary: "Authorization, X-API-Key" } },
  );
const fail = (message: string, status: number) =>
  Response.json({ ok: false, error: message }, { status, headers: cors });

const num = (v: string | null, def: number, min: number, max: number) => {
  const n = v == null || v === "" ? def : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ApiError(`Invalid number: ${v}`);
  return n;
};
const digits = (v: string | undefined, what: string) => {
  if (!v || !/^\d{1,80}$/.test(v)) throw new ApiError(`Invalid ${what}`);
  return v;
};

const fileName = (s: string) => (s.replace(/[^\w\s.()-]+/g, "").trim().replace(/\s+/g, "-") || "moviemax").slice(0, 90);

/* ---------------- MovieBox (English) ---------------- */

function sourceLinks(origin: string, id: string, se: number, ep: number, title: string, s: StreamSource, detailPath?: string) {
  const base = new URLSearchParams({
    subjectId: id,
    se: String(se > 0 ? se : 0),
    ep: String(se > 0 ? Math.max(1, ep) : 0),
    resourceId: s.id,
    res: String(s.resolution || 0),
  });
  if (detailPath) base.set("detailPath", detailPath);
  const dl = new URLSearchParams(base);
  dl.set("dl", `${fileName(`${title}${se > 0 ? ` S${se}E${ep}` : ""} ${s.resolution}p`)}.mp4`);
  return {
    resourceId: s.id,
    resolution: s.resolution,
    codec: s.codec,
    bytes: s.bytes,
    size: s.size,
    promo: s.promo,
    playUrl: `${origin}/api/public/movie?${base}`,
    downloadUrl: `${origin}/api/public/movie?${dl}`,
    subtitles: s.captions.map((c) => ({
      label: c.label,
      url: `${origin}/api/public/subtitle?url=${encodeURIComponent(c.url)}`,
      downloadUrl: `${origin}/api/public/subtitle?url=${encodeURIComponent(c.url)}&dl=${encodeURIComponent(`${fileName(title)}-${fileName(c.label)}.vtt`)}`,
    })),
  };
}

async function moviebox(parts: string[], q: URLSearchParams, origin: string) {
  const [action, rawId] = parts;
  switch (action) {
    case "home":
      return json(await fetchHome(), 300);
    case "feed":
      return json(await fetchHomeFeed(num(q.get("page"), 0, 0, 100_000)), 300);
    case "trending":
      return json(await fetchMostTrending(), 300);
    case "search": {
      const term = (q.get("q") ?? "").trim();
      if (!term || term.length > 120) throw new ApiError("Missing q");
      return json(await searchCatalog(term, num(q.get("page"), 1, 1, 500)), 300);
    }
    case "title": {
      if (!rawId) throw new ApiError("Missing id");
      const id = /^\d+$/.test(rawId) ? rawId : await resolveWatchId(rawId, searchCatalog);
      const d = await fetchDetails(id);
      return json({ ...d, detailPath: getDetailPath(id) ?? null }, 600);
    }
    case "sources": {
      const id = digits(rawId, "id");
      const se = num(q.get("se"), 0, 0, 10_000);
      const ep = num(q.get("ep"), 0, 0, 100_000);
      const detailPath = q.get("detailPath") ?? getDetailPath(id);
      const title = q.get("title") ?? (await fetchDetails(id).then((d) => d.title).catch(() => "moviemax"));
      const sources = await fetchSources(id, se, ep, detailPath ?? undefined);
      // Short-lived: source lists are re-signed upstream; play/download links themselves stay valid.
      return json(
        sources
          .sort((a, b) => b.resolution - a.resolution)
          .map((s) => sourceLinks(origin, id, se, ep, title, s, detailPath ?? undefined)),
        20,
      );
    }
    case "related": {
      const id = digits(rawId, "id");
      const d = await fetchDetails(id);
      return json(await fetchRelated({ id, title: d.title, genre: d.genre, type: d.type }), 600);
    }
    default:
      throw new ApiError("Unknown MovieBox endpoint", 404);
  }
}

/* ---------------- Luganda (Narabox) ---------------- */

type NbKind = "movies" | "tv-shows";
const nbKind = (v: string | undefined | null): NbKind => {
  if (v === "movies" || v === "tv-shows") return v;
  throw new ApiError("kind must be movies or tv-shows");
};
async function readNarabox(path: string) {
  const res = await fetch(`https://portal.naraboxtv.com/api/v1/${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new ApiError("Luganda catalog temporarily unavailable", 502);
  return res.json() as Promise<any>;
}
const stream = (origin: string, url: string | null | undefined, name?: string) =>
  url
    ? {
        playUrl: `${origin}/api/public/stream?url=${encodeURIComponent(url)}`,
        downloadUrl: `${origin}/api/public/stream?url=${encodeURIComponent(url)}&dl=${encodeURIComponent(`${fileName(name ?? "moviemax")}.mp4`)}`,
      }
    : { playUrl: null, downloadUrl: null };

function narabox(item: NaraboxItem, kind: NbKind, origin: string) {
  const title = cleanNaraboxTitle(item.title);
  return {
    id: item.id,
    source: "narabox",
    kind: kind === "movies" ? "movie" : "series",
    title,
    originalTitle: item.title,
    slug: item.slug,
    description: item.description ?? null,
    poster: item.thumbnail,
    backdrop: item.backdrop ?? null,
    rating: item.rating ?? null,
    year: item.releaseDate?.slice(0, 4) ?? null,
    releaseDate: item.releaseDate ?? null,
    vj: item.vj,
    genre: item.genre ?? [],
    createdAt: item.createdAt ?? null,
    ...(kind === "movies" ? stream(origin, item.videoUrl, title) : {}),
    seasons: item.seasons?.map((s) => ({
      season: s.number,
      title: s.title,
      episodes: s.episodes.map((e) => ({
        id: e.id,
        episode: e.number,
        title: e.title,
        ...stream(origin, e.videoUrl, `${title} S${s.number}E${e.number}`),
      })),
    })),
  };
}

/* ---------------- Uploaded library (Luo / Luganda / Teso) ---------------- */

const LANGS = ["luo", "luganda", "teso"] as const;
async function uploads(): Promise<LuoTitle[]> {
  const rows = await listCollection("media");
  return rows
    .map(toTitle)
    .filter((t) => t.published)
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
}
function upload(t: LuoTitle, origin: string) {
  return {
    id: t.id,
    source: "upload",
    language: t.language,
    kind: t.kind === "series" ? "series" : "movie",
    title: t.title,
    description: t.description,
    poster: t.poster_url,
    backdrop: t.backdrop_url,
    vj: t.vj,
    genre: t.genre,
    year: t.year,
    latest: t.latest,
    createdAt: t.created_at,
    ...stream(origin, t.video_url, t.title),
  };
}
async function uploadDetail(id: string, origin: string) {
  const title = (await uploads()).find((t) => t.id === id);
  if (!title) throw new ApiError("Title not found", 404);
  const episodes = (await listCollection("episodes"))
    .map(toEpisode)
    .filter((e) => e.title_id === id && e.video_url)
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
    .map((e) => ({
      id: e.id,
      season: e.season,
      episode: e.episode,
      name: e.name,
      ...stream(origin, e.video_url, `${title.title} S${e.season}E${e.episode}`),
    }));
  return { ...upload(title, origin), episodes };
}
function page<T>(items: T[], q: URLSearchParams) {
  const p = num(q.get("page"), 1, 1, 100_000);
  const per = num(q.get("per_page"), 50, 1, 500);
  return { items: items.slice((p - 1) * per, p * per), page: p, perPage: per, total: items.length, lastPage: Math.max(1, Math.ceil(items.length / per)) };
}

async function library(lang: (typeof LANGS)[number], parts: string[], q: URLSearchParams, origin: string) {
  const [action, a, b] = parts;
  if (!action || action === "list") {
    const list = (await uploads()).filter((t) => t.language === lang);
    const term = (q.get("q") ?? "").toLowerCase().trim();
    const vj = (q.get("vj") ?? "").toLowerCase().trim();
    const filtered = list.filter(
      (t) => (!term || t.title.toLowerCase().includes(term)) && (!vj || (t.vj ?? "").toLowerCase().includes(vj)),
    );
    return json(page(filtered.map((t) => upload(t, origin)), q), 120);
  }
  if (action === "title") return json(await uploadDetail(a ?? "", origin), 120);
  if (lang === "luganda" && action === "narabox") {
    // /luganda/narabox?kind=movies&page=1   |   /luganda/narabox/{kind}/{id}
    if (a && b) {
      const kind = nbKind(a);
      digits(b, "id");
      const r = await readNarabox(`${kind}/${b}`);
      const item = (r.data ?? r) as NaraboxItem;
      if (!item?.id) throw new ApiError("Title not found", 404);
      return json(narabox(item, kind, origin), 300);
    }
    const kind = nbKind(q.get("kind") ?? "movies");
    const p = num(q.get("page"), 1, 1, 1000);
    const per = num(q.get("per_page"), 50, 1, 100);
    const r = await readNarabox(`${kind}?page=${p}&per_page=${per}&sort=latest&order=desc`);
    return json({ items: (r.data as NaraboxItem[]).map((i) => narabox(i, kind, origin)), meta: r.meta }, 300);
  }
  if (lang === "luganda" && action === "catalog") {
    const c = await loadNaraboxCatalog();
    const card = (k: NbKind) => (i: (typeof c.movies)[number]) => ({
      id: i.id, source: "narabox", kind: k === "movies" ? "movie" : "series", title: cleanNaraboxTitle(i.title),
      poster: i.thumbnail, vj: i.vj, genre: i.genre, year: i.releaseDate?.slice(0, 4) ?? null, createdAt: i.createdAt ?? null,
      detailUrl: `${origin}/api/public/v1/luganda/narabox/${k}/${i.id}`,
    });
    return json({ movies: c.movies.map(card("movies")), series: c.shows.map(card("tv-shows")) }, 300);
  }
  throw new ApiError("Unknown endpoint", 404);
}

/* ---------------- Global search ---------------- */

async function search(q: URLSearchParams, origin: string) {
  const term = (q.get("q") ?? "").trim();
  if (!term || term.length > 120) throw new ApiError("Missing q");
  const lower = term.toLowerCase();
  const [mb, nb, up] = await Promise.allSettled([searchCatalog(term, 1), loadNaraboxCatalog(), uploads()]);
  const match = (s: string) => s.toLowerCase().includes(lower);
  return json(
    {
      query: term,
      moviebox: mb.status === "fulfilled" ? mb.value : [],
      luganda: nb.status === "fulfilled"
        ? [
            ...nb.value.movies.filter((i) => match(i.title)).map((i) => ({ id: i.id, kind: "movie", title: cleanNaraboxTitle(i.title), poster: i.thumbnail, vj: i.vj, detailUrl: `${origin}/api/public/v1/luganda/narabox/movies/${i.id}` })),
            ...nb.value.shows.filter((i) => match(i.title)).map((i) => ({ id: i.id, kind: "series", title: cleanNaraboxTitle(i.title), poster: i.thumbnail, vj: i.vj, detailUrl: `${origin}/api/public/v1/luganda/narabox/tv-shows/${i.id}` })),
          ].slice(0, 60)
        : [],
      uploads: up.status === "fulfilled"
        ? up.value.filter((t) => match(t.title) || match(t.vj ?? "")).slice(0, 60).map((t) => ({ ...upload(t, origin), detailUrl: `${origin}/api/public/v1/${t.language}/title/${t.id}` }))
        : [],
    },
    120,
  );
}

function index(origin: string) {
  const b = `${origin}/api/public/v1`;
  return json({
    name: "MOVIE MAX API",
    version: "v1",
    docs: `${origin}/doc`,
    auth: `Every endpoint below needs an API key from ${origin}/developer (paid developer plan): header 'Authorization: Bearer <key>' or 'X-API-Key: <key>', or query '?api_key=<key>'.`,
    plans: `${origin}/developer`,
    endpoints: {
      search: `${b}/search?q=`,
      moviebox: [`${b}/moviebox/home`, `${b}/moviebox/feed?page=0`, `${b}/moviebox/trending`, `${b}/moviebox/search?q=&page=1`, `${b}/moviebox/title/{id}`, `${b}/moviebox/sources/{id}?se=0&ep=0`, `${b}/moviebox/related/{id}`],
      luganda: [`${b}/luganda?page=1`, `${b}/luganda/title/{id}`, `${b}/luganda/narabox?kind=movies&page=1`, `${b}/luganda/narabox/{movies|tv-shows}/{id}`, `${b}/luganda/catalog`],
      luo: [`${b}/luo?page=1`, `${b}/luo/title/{id}`],
      teso: [`${b}/teso?page=1`, `${b}/teso/title/{id}`],
    },
  }, 3600);
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const origin = `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${request.headers.get("x-forwarded-host") ?? url.host}`;
        const parts = z.string().max(400).parse(params._splat ?? "").split("/").filter(Boolean).map(decodeURIComponent);
        try {
          const [area, ...rest] = parts;
          if (!area) return index(origin);
          const access = await checkApiAccess(request, cors, origin);
          if (access.denied) return access.denied;
          const res =
            area === "search"
              ? await search(url.searchParams, origin)
              : area === "moviebox"
                ? await moviebox(rest, url.searchParams, origin)
                : (LANGS as readonly string[]).includes(area)
                  ? await library(area as (typeof LANGS)[number], rest, url.searchParams, origin)
                  : fail("Unknown endpoint", 404);
          for (const [k, v] of Object.entries(access.headers)) res.headers.set(k, v);
          return res;
        } catch (e) {
          if (e instanceof ApiError) return fail(e.message, e.status);
          console.error("api v1", e);
          return fail(e instanceof Error ? e.message : "Upstream unavailable", 502);
        }
      },
    },
  },
});
