import { describe, expect, it } from "vitest";
import { firstPlayableEpisode, cleanNaraboxTitle, filterNarabox, mixNewestFirst, naraboxToMixed, type MixedTitle, type NaraboxItem } from "@/lib/narabox";

const items: NaraboxItem[] = [
  { id: 2523, slug: "the-four", title: "The Four", description: "", thumbnail: null, backdrop: null, rating: 6.4, releaseDate: "2012-07-12", vj: "VJ Junior", genre: ["Action", "Fantasy"] },
  { id: 89, slug: "sinbad", title: "Sinbad", description: "", thumbnail: null, backdrop: null, rating: 5.6, releaseDate: "2012-07-08", vj: "VJ Emmy", genre: ["Drama"] },
];
describe("Luganda API filters", () => {
  it("keeps all API movies and series without a filter", () => expect(filterNarabox(items, { search: "", vj: "", genre: "" }).map(i => i.id)).toEqual([2523, 89]));
  it("matches the existing VJ selector without needing the VJ prefix", () => expect(filterNarabox(items, { search: "", vj: "junior", genre: "" }).map(i => i.id)).toEqual([2523]));
  it("combines movie search and genre filters", () => expect(filterNarabox(items, { search: "four", vj: "", genre: "Action" }).map(i => i.id)).toEqual([2523]));
});
describe("Mixed Luganda grid", () => {
  const up: MixedTitle = { key: "up-1", source: "upload", id: "a", kind: "series", title: "Upload", poster: null, vj: "Junior", genre: [], year: null, at: Date.parse("2026-10-22T00:00:00Z") };
  it("puts the latest uploaded title first across uploads, API movies and API series", () => {
    const movie = naraboxToMixed({ ...items[0]!, createdAt: "2026-10-21T13:34:30+03:00" }, "movies");
    const show = naraboxToMixed({ ...items[1]!, createdAt: "2026-10-23T08:00:00Z" }, "tv-shows");
    expect(mixNewestFirst([up], [movie], [show]).map((t) => t.key)).toEqual(["nb-tv-shows-89", "up-1", "nb-movies-2523"]);
  });
  it("removes the VJ suffix from API titles", () => expect(cleanNaraboxTitle("The Four - vj junior")).toBe("The Four"));
});

describe("Series episode choice", () => {
  it("opens the first episode that has a video instead of an empty one", () => {
    const seasons = [
      { id: 1, number: 1, title: "S1", episodes: [{ id: 10, number: 1, title: "", videoUrl: null }, { id: 11, number: 2, title: "", videoUrl: null }] },
      { id: 2, number: 2, title: "S2", episodes: [{ id: 21, number: 2, title: "", videoUrl: "https://x/2.mp4" }, { id: 20, number: 1, title: "", videoUrl: null }] },
    ];
    expect(firstPlayableEpisode(seasons)).toEqual({ season: 2, episodeId: 21 });
  });
  it("reports no playable episode when none have videos", () =>
    expect(firstPlayableEpisode([{ id: 1, number: 1, title: "S1", episodes: [{ id: 10, number: 1, title: "", videoUrl: null }] }])).toBeNull());
});
