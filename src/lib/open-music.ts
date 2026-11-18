import { OPEN_MUSIC_API, OPEN_MUSIC_APP, pickUgandanTracks, isUgandanTrack, type OpenTrack } from "./open-music-rules";

/** Searches that surface Ugandan songs on the open Audius platform. */
const SEARCHES = [
  "uganda",
  "ugandan music",
  "kampala",
  "luganda",
  "kadongo kamu",
  "lugaflow",
  "uganda afrobeat",
  "uganda gospel",
  "buganda",
  "acholi",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getData(path: string): Promise<any[]> {
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${OPEN_MUSIC_API}${path}${sep}app_name=${OPEN_MUSIC_APP}`, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const json: any = await res.json().catch(() => ({}));
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

/**
 * Ugandan songs from the open Audius platform: keyword searches, then every
 * song of the Ugandan artists those searches found. Never throws.
 */
export async function listOpenUgandanTracks(): Promise<OpenTrack[]> {
  const found = (await Promise.all(SEARCHES.map((q) => getData(`/tracks/search?query=${encodeURIComponent(q)}&limit=100`)))).flat();
  const artistIds = [
    ...new Set(
      found
        .filter((t) => /uganda|kampala/i.test(String(t?.user?.location ?? "")) || isUgandanTrack({ user: t?.user }))
        .map((t) => String(t?.user?.id ?? ""))
        .filter(Boolean),
    ),
  ].slice(0, 25);
  const byArtist = (await Promise.all(artistIds.map((id) => getData(`/users/${encodeURIComponent(id)}/tracks?limit=100`)))).flat();
  return pickUgandanTracks([...found, ...byArtist]);
}
