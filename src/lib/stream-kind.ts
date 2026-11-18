/** Which engine plays a live TV link. Pure so it can be tested. */
export type StreamEngine = "hls" | "dash" | "mpegts" | "native";

export function detectStreamKind(url: string): StreamEngine | "unknown" {
  const u = url.trim().toLowerCase();
  if (/\.mpd(\?|#|$)/.test(u) || /(format|type)=(mpd|dash)\b/.test(u) || /manifest\(format=mpd/.test(u) || /\/dash\//.test(u) || /\.ism\/manifest(\?|#|$)/.test(u)) return "dash";
  if (/\.m3u8?(\?|#|$)/.test(u) || /(format|type|output)=(m3u8|hls)\b/.test(u)) return "hls";
  if (/\.(ts|m2ts|mts|flv)(\?|#|$)/.test(u) || /(format|type|output)=(ts|mpegts|flv)\b/.test(u)) return "mpegts";
  if (/\.(mp4|m4v|webm|mov|ogg|ogv|mp3|aac)(\?|#|$)/.test(u)) return "native";
  return "unknown";
}

/** Engines to try in order; the first is the detected format, the rest are fallbacks. */
export function engineOrder(url: string): StreamEngine[] {
  const kind = detectStreamKind(url);
  const all: StreamEngine[] = ["hls", "mpegts", "dash", "native"];
  if (kind === "unknown") return all;
  return [kind, ...all.filter((e) => e !== kind)];
}

/** "flv" for FLV links, otherwise MPEG-TS, for the mpegts engine. */
export const mpegtsType = (url: string) => (/\.flv(\?|#|$)/i.test(url) ? "flv" : "mpegts");

/** Split a "link#clearkey=KID:KEY[,KID:KEY]" channel link into the stream and ClearKey pairs (hex). */
export function splitClearKey(url: string): { url: string; keys: Record<string, string> } {
  const m = url.match(/#clearkey=([0-9a-f:,\-]+)$/i);
  if (!m) return { url, keys: {} };
  const keys: Record<string, string> = {};
  for (const pair of m[1]!.split(",")) {
    const [kid, key] = pair.split(":").map((v) => v.replace(/-/g, "").toLowerCase());
    if (kid && key && /^[0-9a-f]{32}$/.test(kid) && /^[0-9a-f]{32}$/.test(key)) keys[kid] = key;
  }
  return { url: url.slice(0, m.index), keys };
}

const hexToB64Url = (hex: string) =>
  btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** dash.js ClearKey protection data ({ kid: key } as base64url). */
export function clearKeyProtection(keys: Record<string, string>) {
  const clearkeys: Record<string, string> = {};
  for (const [kid, key] of Object.entries(keys)) clearkeys[hexToB64Url(kid)] = hexToB64Url(key);
  return { "org.w3.clearkey": { clearkeys } };
}
