import { createServerFn } from "@tanstack/react-start";
import { fromFirestoreValue } from "./firestore-rest";
import { ANNOUNCEMENT_KEY, liveAnnouncement, type Announcement } from "./announcement";

const DOC = `https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents/app_settings/${ANNOUNCEMENT_KEY}?key=AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0`;
const CACHE_MS = 60_000;
let cached: { value: Partial<Announcement> | null; at: number } | null = null;

/**
 * Public: the current announcement bar. Read through Firestore REST with a
 * 60-second server cache so visitors never spend the daily read quota.
 */
export const getAnnouncement = createServerFn({ method: "GET" }).handler(async () => {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(DOC, { signal: ctrl.signal });
      if (res.ok) {
        const json = (await res.json()) as { fields?: { value?: never } };
        cached = { value: (fromFirestoreValue(json.fields?.value) as Partial<Announcement> | null) ?? null, at: Date.now() };
      } else if (res.status === 404) {
        cached = { value: null, at: Date.now() };
      }
    } catch {
      /* keep the last good value */
    } finally {
      clearTimeout(t);
    }
  }
  return liveAnnouncement(cached?.value ?? null);
});
