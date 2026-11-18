import { describe, expect, it } from "vitest";
import { exactMovieSource, movieRequestRange, validMovieContentRange } from "@/lib/movie-relay-rules";

describe("Full MovieBox playback and downloads", () => {
  it("preserves full GET and open-ended playback requests", () => {
    expect(movieRequestRange(null)).toBeNull();
    expect(movieRequestRange("bytes=0-")).toBe("bytes=0-");
    expect(movieRequestRange("bytes=10485760-")).toBe("bytes=10485760-");
    expect(movieRequestRange("bytes=100-199")).toBe("bytes=100-199");
    expect(movieRequestRange(null, true)).toBe("bytes=0-0");
  });
  it("never resumes a different resource of the same quality", () => {
    const sources = [{ id: "episode-one", resolution: 480 }, { id: "different-file", resolution: 480 }];
    expect(exactMovieSource(sources, "episode-one")).toBe(sources[0]);
    expect(exactMovieSource(sources, "missing-file")).toBeUndefined();
  });
  it("requires valid complete-file bounds for partial media", () => {
    expect(validMovieContentRange("bytes 0-1023/286868942")).toBe(true);
    expect(validMovieContentRange("bytes 2048-1023/286868942")).toBe(false);
    expect(validMovieContentRange("bytes 0-1024/1024")).toBe(false);
    expect(validMovieContentRange(null)).toBe(false);
  });
});