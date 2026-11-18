/**
 * Pure rules for songs pulled from the open Audius music platform
 * (tested in src/test/open-music-rules.test.ts).
 */
export const OPEN_MUSIC_API = "https://api.audius.co/v1";
export const OPEN_MUSIC_APP = "MOVIEMAX";
/** Prefix that marks a track as coming from the open platform, never from our uploads. */
export const OPEN_TRACK_PREFIX = "audius:";

const UGANDA = /uganda|kampala|luganda|lugaflow|kadongo|acholi|\bgulu\b|buganda|\bug\b|\b256\b/i;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Art = Record<string, string | string[] | undefined> | null | undefined;
const pickArt = (a: Art) => (a ? String(a["480x480"] ?? a["1000x1000"] ?? a["150x150"] ?? "") : "");

/** True when a song or its artist clearly belongs to Uganda. */
export function isUgandanTrack(t: any): boolean {
  const user = t?.user ?? {};
  const hay = [t?.title, t?.tags, t?.description, t?.genre, user.location, user.name, user.bio].filter(Boolean).join(" ");
  return UGANDA.test(hay);
}

/** Only free, full songs: no locked, preview-only, deleted or unlisted tracks. */
export function isPlayableOpenTrack(t: any): boolean {
  if (!t?.id || !t?.title) return false;
  if (t.is_delete || t.is_unlisted || t.is_available === false) return false;
  if (t.is_streamable === false || t.is_stream_gated) return false;
  return true;
}

export type OpenTrack = {
  id: string;
  artist_id: string;
  stage_name: string;
  title: string;
  genre?: string;
  cover_url?: string;
  audio_url: string;
  kind: "audio";
  created_at?: string;
  source: "audius";
  artist_avatar?: string;
  external_url?: string;
};

export function toOpenTrack(t: any): OpenTrack {
  const user = t.user ?? {};
  const out: OpenTrack = {
    id: `${OPEN_TRACK_PREFIX}${t.id}`,
    artist_id: `${OPEN_TRACK_PREFIX}${user.id ?? t.user_id ?? "unknown"}`,
    stage_name: String(user.name ?? "Unknown artist"),
    title: String(t.title).trim(),
    audio_url: `${OPEN_MUSIC_API}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${OPEN_MUSIC_APP}`,
    kind: "audio",
    source: "audius",
  };
  if (t.genre) out.genre = String(t.genre);
  const cover = pickArt(t.artwork);
  if (cover) out.cover_url = cover;
  const avatar = pickArt(user.profile_picture);
  if (avatar) out.artist_avatar = avatar;
  const date = t.release_date ?? t.created_at;
  if (date) out.created_at = new Date(date).toISOString();
  if (t.permalink) out.external_url = `https://audius.co${t.permalink}`;
  return out;
}

/** Ugandan, playable, de-duplicated songs, newest first. */
export function pickUgandanTracks(raw: any[]): OpenTrack[] {
  const seen = new Map<string, OpenTrack>();
  for (const t of raw) {
    if (!isPlayableOpenTrack(t) || !isUgandanTrack(t)) continue;
    const track = toOpenTrack(t);
    if (!seen.has(track.id)) seen.set(track.id, track);
  }
  return [...seen.values()].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

/** Songs from outside platforms (Audius, UgMuziki) — never uploads made on this site. */
export const isOpenTrack = (t: { id: string; source?: string }) =>
  !!t.source || t.id.startsWith(OPEN_TRACK_PREFIX) || t.id.startsWith("ug:");

/** Puts uploads and open-platform songs into one list, newest first. */
export function mergeMusic<T extends { id: string; created_at?: string }>(uploads: T[], open: T[]): T[] {
  return [...uploads, ...open].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}
