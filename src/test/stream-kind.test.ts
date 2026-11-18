import { describe, expect, it } from "vitest";
import { detectStreamKind, engineOrder, splitClearKey } from "@/lib/stream-kind";

describe("Live TV stream formats", () => {
  it("plays .m3u8 links with the HLS engine first", () => {
    expect(engineOrder("https://tv.example/live/index.m3u8?token=1")[0]).toBe("hls");
  });
  it("plays .ts links with the MPEG-TS engine first", () => {
    expect(engineOrder("http://iptv.example/live/user/pass/123.ts")[0]).toBe("mpegts");
  });
  it("plays .mpd links with the DASH engine first", () => {
    expect(engineOrder("https://cdn.example/channel/manifest.mpd")[0]).toBe("dash");
  });
  it("tries every engine for links without a known extension", () => {
    expect(detectStreamKind("http://iptv.example/live/123")).toBe("unknown");
    expect(engineOrder("http://iptv.example/live/123")).toEqual(["hls", "mpegts", "dash", "native"]);
  });
  it("reads ClearKey pairs added after a .mpd link", () => {
    const kid = "69a5aa835a061ce64a630d1046727e40", key = "0123456789abcdef0123456789abcdef";
    const r = splitClearKey(`https://cdn.example/cenc.mpd#clearkey=${kid}:${key}`);
    expect(r.url).toBe("https://cdn.example/cenc.mpd");
    expect(r.keys).toEqual({ [kid]: key });
    expect(engineOrder(r.url)[0]).toBe("dash");
  });
});
