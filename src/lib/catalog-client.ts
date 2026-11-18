import { getSources, getTitle, searchTitles } from "./catalog.functions";
import type { CatalogItem } from "./moviebox";
import { resolveWatchId } from "./watch-links";

/**
 * Search the MovieBox web catalog from the visitor's browser first (hosted
 * servers like Cloudflare get refused), falling back to the server function.
 */
export async function searchAny(q: string, page = 1): Promise<CatalogItem[]> {
  if (typeof window !== "undefined") {
    try {
      const { searchCatalog } = await import("./moviebox");
      const items = await searchCatalog(q, page);
      if (items.length) return items;
    } catch {
      /* fall back to the server */
    }
  }
  return searchTitles({ data: { q, page } });
}

/** Title details: browser first (hosted servers get refused), server as fallback. */
export async function titleAny(id: string) {
  id = await resolveWatchId(id, searchAny);
  if (typeof window !== "undefined") {
    try {
      const { fetchDetails } = await import("./moviebox");
      return await fetchDetails(id);
    } catch {
      /* fall back to the server */
    }
  }
  return getTitle({ data: { id } });
}

/** Playback requires MovieBox's own Referer, which browsers cannot set. */
export async function sourcesAny(id: string, season = 0, episode = 0) {
  const { getDetailPath, fetchSources } = await import("./moviebox");
  const detailPath = getDetailPath(id);
  const sources = await getSources({ data: { id, season, episode, detailPath } }).catch(() => []);
  if (sources.length) return sources;
  if (typeof window !== "undefined") {
    try {
      const list = await fetchSources(id, season, episode, detailPath);
      if (list.length) return list;
    } catch {
      /* fall back to the server */
    }
  }
  return [];
}
