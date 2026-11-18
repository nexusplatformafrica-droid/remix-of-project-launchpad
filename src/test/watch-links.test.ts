import { describe, expect, it } from "vitest";
import { resolveWatchId, watchName, watchSearchTerm, watchSlug } from "@/lib/watch-links";

describe("Movie-name watch URLs", () => {
  it("uses the movie name instead of the numeric ID", () => {
    expect(watchSlug({ id: "5262873104975547168", title: "Tulsa King S1-S3", year: "2022", type: "series" })).toBe("tulsa-king-2022-series");
    expect(watchName("John Wick")).toBe("john-wick");
  });
  it("keeps legacy numeric links and resolves exact names", async () => {
    expect(await resolveWatchId("5262873104975547168", async () => [])).toBe("5262873104975547168");
    const item = { id: "42", title: "Unique Test Film", year: "2024", type: "movie" as const };
    expect(await resolveWatchId("unique-test-film-2024-movie", async () => [item])).toBe("42");
    expect(watchSearchTerm("tulsa-king-2022-series")).toBe("tulsa king");
  });
  it("does not substitute a fuzzy match for a missing title", async () => {
    await expect(resolveWatchId("missing-title-2020-movie", async () => [{ id: "7", title: "Different title", year: "2020", type: "movie" }])).rejects.toThrow("Movie not found");
  });
});