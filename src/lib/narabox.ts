export type NaraboxKind = "movies" | "tv-shows";
export type NaraboxItem = {
  id: number; title: string; slug: string; description: string;
  thumbnail: string | null; backdrop: string | null; rating: number | null;
  releaseDate: string | null; vj: string | null; genre: string[]; createdAt?: string | null;
  videoUrl?: string | null; downloadEnabled?: boolean; is_playable?: boolean;
  seasons?: { id: number; number: number; title: string; episodes: { id: number; number: number; title: string; videoUrl: string | null }[] }[];
};
export type NaraboxPage = { data: NaraboxItem[]; meta: { current_page: number; last_page: number; total: number; per_page: number } };

export function filterNarabox(items: NaraboxItem[], filters: { search: string; vj: string; genre: string }) {
  const normalize = (value: string) => value.toLowerCase().replace(/^vj[\s-]*/i, "").trim();
  return items.filter((item) => item.title.toLowerCase().includes(filters.search.toLowerCase().trim()) &&
    (!filters.vj || normalize(item.vj ?? "") === normalize(filters.vj)) &&
    (!filters.genre || item.genre.includes(filters.genre)));
}

export const compactMovieGrid = "grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9";
/** Narabox titles often end in " - vj junior"; the VJ tag already shows that. */
export function cleanNaraboxTitle(title: string) {
  return title.replace(/\s*[-–|]\s*vj\b.*$/i, "").trim() || title;
}

/** One poster in the mixed Luganda grid (admin upload or Narabox title). */
export type MixedTitle = {
  key: string;
  source: "upload" | "narabox";
  id: string;
  naraboxKind?: NaraboxKind;
  kind: "movie" | "series";
  title: string;
  poster: string | null;
  vj: string | null;
  genre: string[];
  year: string | null;
  /** Upload / last-update time in ms; newest is shown first. */
  at: number;
};

/** Slim catalog entry sent to the browser (whole catalog in one response). */
export type NaraboxCard = Pick<NaraboxItem, "id" | "title" | "thumbnail" | "vj" | "genre" | "releaseDate" | "createdAt">;

export function naraboxToMixed(item: NaraboxCard, kind: NaraboxKind): MixedTitle {
  return {
    key: `nb-${kind}-${item.id}`, source: "narabox", id: String(item.id), naraboxKind: kind,
    kind: kind === "movies" ? "movie" : "series", title: cleanNaraboxTitle(item.title),
    poster: item.thumbnail, vj: item.vj, genre: item.genre ?? [],
    year: item.releaseDate?.slice(0, 4) ?? null, at: Date.parse(item.createdAt ?? "") || 0,
  };
}

/** Merges every source, removes duplicates and puts the latest uploads first. */
export function mixNewestFirst(...groups: MixedTitle[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((t) => !seen.has(t.key) && !!seen.add(t.key)).sort((a, b) => b.at - a.at);
}

/** The episode a series should open on: the first one that actually has a video. */
export function firstPlayableEpisode(seasons: NonNullable<NaraboxItem["seasons"]>) {
  const ordered = [...seasons].sort((a, b) => a.number - b.number);
  for (const s of ordered) {
    const ep = [...s.episodes].sort((a, b) => a.number - b.number).find((e) => !!e.videoUrl);
    if (ep) return { season: s.number, episodeId: ep.id };
  }
  return null;
}
