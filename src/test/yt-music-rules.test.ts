import { describe, expect, it } from "vitest";
import { agoToMs, formatViews, isMusicVideo, newReleases, parseYtBrowse, parseYtFeed, trendingNow, viewsFromText, type YtVideo } from "@/lib/yt-music-rules";
import { TOP_ARTISTS } from "@/lib/ug-artists";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const v = (id: string, title: string, daysAgo: number, views: number): YtVideo => ({
  id: id.padEnd(11, "x"),
  title: `${title} (Official Video)`,
  published: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  views,
  thumbnail: "",
  artist: "Sheebah",
  artistSlug: "sheebah",
});

describe("YouTube music videos", () => {
  it("reads the real title, date and views from a channel feed", () => {
    const xml = `<feed><entry><yt:videoId>yOE6fdyJjOc</yt:videoId><title>Sheebah - Stress Killer (Official Video)</title><published>2026-08-07T08:11:06+00:00</published><media:statistics views="1297199"/></entry></feed>`;
    const [x] = parseYtFeed(xml, { name: "Sheebah", slug: "sheebah" });
    expect(x).toMatchObject({ id: "yOE6fdyJjOc", published: "2026-08-07T08:11:06+00:00", views: 1297199, artistSlug: "sheebah" });
  });

  it("leaves out talk shows and trailers", () => {
    expect(isMusicVideo("SMILING THROUGH IT ALL! || (Let's Talk About It Ep 3)")).toBe(false);
    expect(isMusicVideo("LETS TALK ABOUT IT - EP 1 TRAILER")).toBe(false);
    expect(isMusicVideo("Nsi Namba - Sheebah & T Paul 256 (Official Video)")).toBe(true);
    expect(isMusicVideo("Spice Diana  in Masulita with Dina Special Children Foundation")).toBe(false);
    expect(isMusicVideo("Kuba kuzina Ft 14k bwongo [Official Audio}")).toBe(true);
  });

  it("a song uploaded 1 month ago is not new this month, 4 weeks ago is", () => {
    const mk = (ago: string) => ({ ...v("z", "Song", 0, 1), published: new Date(NOW - agoToMs(ago)!).toISOString() });
    expect(newReleases([mk("1 month ago")], NOW)).toHaveLength(0);
    expect(newReleases([mk("4 weeks ago")], NOW)).toHaveLength(1);
  });

  it("reads YouTube's channel page data", () => {
    expect(viewsFromText("1.2M views")).toBe(1_200_000);
    expect(viewsFromText("7,201 views")).toBe(7201);
    const data = { x: [{ lockupViewModel: { contentId: "kmEt-GrhOmw", metadata: { lockupMetadataViewModel: { title: { content: "Spice Diana - Finally (Official Music Video)" }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: "1.2M views" } }, { text: { content: "3 days ago" } }] }] } } } } } }] };
    const [x] = parseYtBrowse(data, { name: "Spice Diana", slug: "spice-diana" }, NOW);
    expect(x).toMatchObject({ id: "kmEt-GrhOmw", views: 1_200_000, published: new Date(NOW - 3 * 86_400_000).toISOString() });
  });

  it("new this month only includes the last 30 days, newest first", () => {
    const out = newReleases([v("a", "Old hit", 200, 9_000_000), v("b", "Week song", 7, 10), v("c", "Today song", 0.5, 5)], NOW);
    expect(out.map((x) => x.title)).toEqual(["Today song (Official Video)", "Week song (Official Video)"]);
  });

  it("trending ranks recent songs by views per day and ignores old hits", () => {
    const out = trendingNow([v("a", "Old hit", 300, 50_000_000), v("b", "Slow", 20, 100_000), v("c", "Hot", 4, 400_000)], NOW);
    expect(out.map((x) => x.title)).toEqual(["Hot (Official Video)", "Slow (Official Video)"]);
  });

  it("formats views", () => {
    expect(formatViews(1_297_199)).toBe("1.3M views");
    expect(formatViews(33_098)).toBe("33K views");
  });

  it("every top artist has a real channel and photo", () => {
    expect(TOP_ARTISTS.length).toBeGreaterThanOrEqual(40);
    for (const a of TOP_ARTISTS) {
      expect(a.channelId).toMatch(/^UC[\w-]{22}$/);
      expect(a.avatar).toMatch(/^https:\/\/yt3\./);
    }
    expect(new Set(TOP_ARTISTS.map((a) => a.slug)).size).toBe(TOP_ARTISTS.length);
  });
});
