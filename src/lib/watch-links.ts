type WatchTitle = { id: string; title: string; year: string | null; type: "movie" | "series" };
const knownTitles = new Map<string, WatchTitle>();

export function watchName(title: string) {
  return title.replace(/\s+S\d+(?:\s*[-–]\s*S?\d+)?$/i, "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function watchSlug(item: WatchTitle) {
  const slug = [watchName(item.title) || "untitled", item.year, item.type].filter(Boolean).join("-");
  knownTitles.set(slug, item);
  if (knownTitles.size > 3000) {
    const first = knownTitles.keys().next().value;
    if (first) knownTitles.delete(first);
  }
  return slug;
}

export function watchSearchTerm(path: string) {
  return path.replace(/-(?:\d{4}-)?(?:movie|series)$/, "").replace(/-/g, " ");
}

/** Exact slug matching prevents silently opening another movie with a similar name. */
export async function resolveWatchId(path: string, search: (q: string) => Promise<WatchTitle[]>) {
  if (/^\d+$/.test(path)) return path;
  const known = knownTitles.get(path);
  if (known) return known.id;
  const items = await search(watchSearchTerm(path));
  const match = items.find((item) => watchSlug(item) === path);
  if (!match) throw new Error("Movie not found. Please search for its title.");
  return match.id;
}