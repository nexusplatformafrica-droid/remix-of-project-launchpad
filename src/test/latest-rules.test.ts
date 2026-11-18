import { describe, expect, it } from "vitest";
import { movieboxLatest, naraboxLatest, toggleLatest } from "@/lib/latest-rules";

describe("External latest selections", () => {
  it("labels MovieBox titles ENG and preserves the correct watch path", () => {
    const pick = movieboxLatest({ id: "123", title: "Example", type: "movie", year: "2026", poster: null, backdrop: null, rating: null, genre: null });
    expect(pick.tag).toBe("ENG");
    expect(pick.href).toBe("/watch/example-2026-movie");
  });
  it("keeps the Narabox VJ tag and namespaced destination", () => {
    const pick = naraboxLatest({ id: 123, title: "Example - vj junior", thumbnail: null, vj: "junior", genre: [], releaseDate: null }, "movies");
    expect(pick.tag).toBe("VJ Junior");
    expect(pick.href).toBe("/luganda/narabox/movies/123");
  });
  it("adds and removes latest without duplicate picks", () => {
    const pick = naraboxLatest({ id: 123, title: "Example", thumbnail: null, vj: "junior", genre: [], releaseDate: null }, "tv-shows");
    const selected = toggleLatest([], pick);
    expect(selected).toEqual([pick]);
    expect(toggleLatest(selected, pick)).toEqual([]);
  });
});