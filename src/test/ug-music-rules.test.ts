import { describe, expect, it } from "vitest";
import { TOP_ARTISTS, byArtist, isAllowedUgFile, parseUgSongs, splitTitle, toUgTrack, ugMp3Url } from "@/lib/ug-music-rules";
import { isOpenTrack } from "@/lib/open-music-rules";

const card = `
<div class="welcome-track"><a href="https://www.ugmuziki.com/song/somebody-by-sheebah"><img src="https://www.ugmuziki.com/public/uploads/song_covers/ugmuziki-cover5745.jpg" alt=""></a>
<div id="song-name5745">Somebody By Sheebah Kalungi - Free Mp3 Audio Download</div>
<a id="song-author5745">Sheebah Kalungi</a><small>479 plays | 2434 downloads</small></div>`;

describe("UgMuziki songs", () => {
  it("reads a song card", () => {
    const [s] = parseUgSongs(card);
    expect(s).toMatchObject({ id: "5745", author: "Sheebah Kalungi", plays: 479 });
  });

  it("builds the full mp3 file address from title and id", () => {
    expect(ugMp3Url({ id: "5911", rawTitle: "Feel OK By Azawi and Truth 256 - Free Mp3 Audio Download" })).toBe(
      "https://www.ugmuziki.com/public/uploads/songs/ugmuziki.com%20-%20Feel%20OK%20By%20Azawi%20and%20Truth%20256%20-%20Free%20Mp3%20Audio%20Download%20-%205911.mp3",
    );
  });

  it("splits song name and artist", () => {
    expect(splitTitle("Somebody By Sheebah Kalungi - Free Mp3 Audio Download", "x")).toEqual({ title: "Somebody", artist: "Sheebah Kalungi" });
  });

  it("matches top artists, including features", () => {
    const t = toUgTrack(parseUgSongs(card)[0]!);
    expect(byArtist(t, TOP_ARTISTS.find((a) => a.name === "Sheebah")!)).toBe(true);
    expect(byArtist(t, TOP_ARTISTS.find((a) => a.name === "Kapeke")!)).toBe(false);
  });

  it("never counts UgMuziki songs toward artist earnings", () => {
    expect(isOpenTrack(toUgTrack(parseUgSongs(card)[0]!))).toBe(true);
  });

  it("only downloads real UgMuziki song files", () => {
    expect(isAllowedUgFile("https://www.ugmuziki.com/public/uploads/songs/a.mp3")).toBe(true);
    expect(isAllowedUgFile("https://evil.example/public/uploads/songs/a.mp3")).toBe(false);
    expect(isAllowedUgFile("https://www.ugmuziki.com/admin/secret")).toBe(false);
  });
});
