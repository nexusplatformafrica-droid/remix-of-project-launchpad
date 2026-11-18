import { describe, expect, it } from "vitest";
import { isOpenTrack, mergeMusic, pickUgandanTracks } from "@/lib/open-music-rules";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "abc",
  title: "Song",
  release_date: "2026-01-01T00:00:00Z",
  user: { id: "u1", name: "Artist", location: "Kampala, Uganda" },
  ...over,
});

describe("open Ugandan music", () => {
  it("keeps songs whose artist is in Uganda", () => {
    expect(pickUgandanTracks([raw()])).toHaveLength(1);
  });

  it("drops songs with nothing linking them to Uganda", () => {
    expect(pickUgandanTracks([raw({ user: { id: "u2", name: "Someone", location: "Berlin" } })])).toHaveLength(0);
  });

  it("drops locked or unplayable songs", () => {
    expect(pickUgandanTracks([raw({ is_stream_gated: true }), raw({ id: "x", is_streamable: false })])).toHaveLength(0);
  });

  it("mixes uploads and open songs newest first", () => {
    const merged = mergeMusic(
      [{ id: "up1", created_at: "2026-02-01T00:00:00Z" }],
      [{ id: "audius:a", created_at: "2026-03-01T00:00:00Z" }],
    );
    expect(merged.map((t) => t.id)).toEqual(["audius:a", "up1"]);
  });

  it("marks open songs so they never count toward artist earnings", () => {
    const [t] = pickUgandanTracks([raw()]);
    expect(isOpenTrack(t!)).toBe(true);
    expect(isOpenTrack({ id: "upload-1" })).toBe(false);
  });
});
