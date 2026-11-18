/** Pure artist earnings / upload rules (tested in src/test/music-rules.test.ts). */
export const UGX_PER_LISTENER = 1; // 10,000 different listeners = UGX 10,000
export const MIN_WITHDRAW_UGX = 10_000;
export const WITHDRAW_FEE_RATE = 0.25;
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

/** Earned = one payment per different user who played or downloaded a track. */
export const earnedFromListeners = (uniqueListens: number) => Math.max(0, Math.floor(uniqueListens)) * UGX_PER_LISTENER;

/** Available = earned minus every withdrawal that hasn't failed. */
export function availableBalance(earned: number, withdrawals: { gross: number; status?: string }[]) {
  const used = withdrawals.filter((w) => w.status !== "failed").reduce((s, w) => s + (Number(w.gross) || 0), 0);
  return Math.max(0, earned - used);
}

export const canWithdraw = (available: number) => available >= MIN_WITHDRAW_UGX;

export function withdrawalBreakdown(gross: number) {
  const fee = Math.round(gross * WITHDRAW_FEE_RATE);
  return { gross, fee, net: gross - fee };
}

export const withinUploadLimit = (bytes: number) => bytes > 0 && bytes <= MAX_UPLOAD_BYTES;

/** Featuring a song on the music-page hero costs this much and lasts this long. */
export const HERO_FEATURE_UGX = 1_000;
export const HERO_FEATURE_DAYS = 7;

/** A track is a video when its file extension says so; everything else is audio. */
export const trackKind = (url: string): "audio" | "video" =>
  /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(url) ? "video" : "audio";

/** A paid/admin hero slide shows only while its expiry is in the future; admin slides have no expiry. */
export const heroActive = (expiresAt?: string | null) =>
  !expiresAt || new Date(expiresAt).getTime() > Date.now();

export const heroExpiryIso = (from = Date.now()) =>
  new Date(from + HERO_FEATURE_DAYS * 24 * 60 * 60 * 1000).toISOString();

/** One-off payment that gives an artist the verified badge. */
export const VERIFY_UGX = 5_000;
