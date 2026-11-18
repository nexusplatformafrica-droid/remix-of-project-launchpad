import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NaraboxCard, NaraboxItem, NaraboxPage } from "./narabox";

const kind = z.enum(["movies", "tv-shows"]);
async function readNarabox(path: string) {
  const response = await fetch(`https://portal.naraboxtv.com/api/v1/${path}`, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("The Luganda catalog is temporarily unavailable. Please try again.");
  return response.json();
}

export const getNaraboxPage = createServerFn({ method: "GET" })
  .inputValidator(z.object({ kind, page: z.number().int().min(1).max(1000) }))
  .handler(async ({ data }): Promise<NaraboxPage> => {
    const result = await readNarabox(`${data.kind}?page=${data.page}&per_page=${data.kind === "movies" ? 50 : 18}&sort=latest&order=desc`);
    if (!Array.isArray(result.data) || !result.meta) throw new Error("The Luganda catalog returned an incomplete response.");
    return result;
  });

export const getNaraboxTitle = createServerFn({ method: "GET" })
  .inputValidator(z.object({ kind, id: z.string().regex(/^\d+$/) }))
  .handler(async ({ data }): Promise<NaraboxItem> => {
    const result = await readNarabox(`${data.kind}/${data.id}`);
    const item = result.data ?? result;
    if (!item.id || !item.title) throw new Error("This title is not available.");
    return item;
  });
type Raw = NaraboxItem & { videoUrl?: string | null; is_playable?: boolean };
const slim = (i: Raw): NaraboxCard => ({
  id: i.id, title: i.title, thumbnail: i.thumbnail, vj: i.vj, genre: i.genre ?? [],
  releaseDate: i.releaseDate, createdAt: i.createdAt ?? null,
});
const newest = (a: NaraboxCard, b: NaraboxCard) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);
let catalogCache: { at: number; value: { movies: NaraboxCard[]; shows: NaraboxCard[] } } | null = null;

async function readAll(kind: "movies" | "tv-shows") {
  const per = 500;
  const path = (page: number) => `${kind}?page=${page}&per_page=${per}&sort=latest&order=desc`;
  const first = await readNarabox(path(1));
  const last = Math.min(Number(first.meta?.last_page ?? 1), 20);
  const rest = await Promise.all(Array.from({ length: last - 1 }, (_, i) => readNarabox(path(i + 2))));
  return [first, ...rest].flatMap((r) => (Array.isArray(r.data) ? (r.data as Raw[]) : []));
}

/** Every Narabox movie and series in one go, newest first; movies without a video are dropped. */
export async function loadNaraboxCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.value;
  const [movies, shows] = await Promise.all([readAll("movies"), readAll("tv-shows")]);
  const unique = (rows: Raw[]) => [...new Map(rows.map((r) => [r.id, r])).values()];
  const value = {
    movies: unique(movies).filter((m) => !!m.videoUrl && m.is_playable !== false).map(slim).sort(newest),
    shows: unique(shows).filter((s) => s.is_playable !== false).map(slim).sort(newest),
  };
  catalogCache = { at: Date.now(), value };
  return value;
}
export const getNaraboxCatalog = createServerFn({ method: "GET" }).handler(() => loadNaraboxCatalog());

/** How many episodes of each series really have a video (series with none are hidden). */
export const getNaraboxShowAvailability = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ids: z.array(z.number().int().positive()).max(30) }))
  .handler(async ({ data }) => {
    const out: Record<number, number> = {};
    await Promise.all(data.ids.map(async (id) => {
      try {
        const r = await readNarabox(`tv-shows/${id}`);
        const item = (r.data ?? r) as NaraboxItem;
        out[id] = (item.seasons ?? []).reduce((n, s) => n + s.episodes.filter((e) => !!e.videoUrl).length, 0);
      } catch { /* unknown: keep the series visible */ }
    }));
    return out;
  });
