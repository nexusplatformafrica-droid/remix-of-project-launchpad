import type { CatalogItem } from "./moviebox";
import { cleanNaraboxTitle, type NaraboxCard, type NaraboxKind } from "./narabox";
import { watchSlug } from "./watch-links";
import { vjInfo } from "./vj";

export type LatestPick = {
  key: string;
  source: "moviebox" | "narabox";
  title: string;
  poster: string | null;
  href: string;
  tag: string;
};

export function movieboxLatest(item: CatalogItem): LatestPick {
  return { key: `moviebox-${item.id}`, source: "moviebox", title: item.title, poster: item.poster,
    href: `/watch/${watchSlug(item)}`, tag: "ENG" };
}

export function naraboxLatest(item: NaraboxCard, kind: NaraboxKind): LatestPick {
  return { key: `narabox-${kind}-${item.id}`, source: "narabox", title: cleanNaraboxTitle(item.title),
    poster: item.thumbnail, href: `/luganda/narabox/${kind}/${item.id}`,
    tag: vjInfo(item.vj)?.name ?? "VJ" };
}

export function toggleLatest(picks: LatestPick[], item: LatestPick) {
  return picks.some((p) => p.key === item.key) ? picks.filter((p) => p.key !== item.key) : [item, ...picks];
}