import { fdb, nowIso, uuid } from "./fdb";
import { uploadFile } from "./storage";
import { readStatus, relworx, sendWithdrawal } from "./relworx";
import { availableBalance, canWithdraw, earnedFromListeners, HERO_FEATURE_UGX, VERIFY_UGX, heroActive, heroExpiryIso, MIN_WITHDRAW_UGX, trackKind, withdrawalBreakdown } from "./music-rules";
import { isOpenTrack } from "./open-music-rules";

export type Socials = { instagram?: string; tiktok?: string; youtube?: string; facebook?: string; x?: string; linkedin?: string; whatsapp?: string; spotify?: string; website?: string };
export type Artist = {
  id: string;
  user_id: string;
  stage_name: string;
  management?: string;
  country?: string;
  email?: string;
  whatsapp?: string;
  bio?: string;
  avatar_url?: string;
  socials?: Socials;
  status: "active" | "pending" | "blocked";
  verified?: boolean;
  verified_at?: string;
  verify_ref?: string;
  created_at?: string;
};
export type Track = {
  id: string;
  artist_id: string;
  stage_name: string;
  title: string;
  genre?: string;
  cover_url?: string;
  audio_url: string;
  /** Set at upload from the file type; older tracks fall back to the URL. */
  kind?: "audio" | "video";
  created_at?: string;
  /** Set for songs shown from an open music platform (not uploaded here). */
  source?: "audius" | "ugmuziki";
  artist_avatar?: string;
  external_url?: string;
  /** Same-site download link when the file lives on another site. */
  download_url?: string;
};
/** Hero slide on the music page: paid artist feature (expires) or free admin slide (no expiry). */
export type HeroSlide = {
  id: string;
  kind: "artist" | "admin";
  track_id?: string;
  artist_id?: string;
  stage_name?: string;
  title: string;
  image_url?: string;
  link?: string;
  payment_ref?: string;
  expires_at?: string | null;
  created_at?: string;
};

/** Tracks without a cover show the website logo. */
export const DEFAULT_TRACK_COVER = "/brand/moviemax-logo.png";
export const trackCover = (t: Pick<Track, "cover_url">) => t.cover_url || DEFAULT_TRACK_COVER;
export const kindOf = (t: Pick<Track, "audio_url" | "kind">) => t.kind ?? trackKind(t.audio_url);
export type Withdrawal = { id: string; artist_id: string; gross: number; fee: number; net: number; phone: string; status: string; reference?: string; created_at?: string };
export type Channel = { id: string; name: string; category?: string; logo_url?: string; stream_url?: string; created_at?: string };

const byNewest = <T extends { created_at?: string }>(rows: T[]) =>
  [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

export async function getArtist(userId: string): Promise<Artist | null> {
  const { data } = await fdb.from("artists").select("*").eq("id", userId).maybeSingle();
  return (data as Artist) ?? null;
}

export async function registerArtist(userId: string, input: Pick<Artist, "stage_name" | "management" | "country" | "email" | "whatsapp">) {
  const { error } = await fdb.from("artists").insert({ ...input, id: userId, user_id: userId, status: "active", socials: {} });
  if (error) throw new Error("Could not save your artist profile. Try again.");
}

export async function updateArtist(userId: string, patch: Partial<Artist>) {
  const { error } = await fdb.from("artists").update(patch).eq("id", userId);
  if (error) throw new Error("Could not save. Try again.");
}

export const uploadArtistFile = (file: File, onProgress?: (percent: number) => void) =>
  uploadFile("artists", file, (p) => onProgress?.(p.percent));

export async function listTracks(): Promise<Track[]> {
  const { data } = await fdb.from("music_tracks").select("*");
  return byNewest((data ?? []) as Track[]);
}

/** Public catalog: tracks from blocked artists are hidden everywhere fans look. */
export async function listPublicTracks(): Promise<Track[]> {
  const [tracks, { data: artists }] = await Promise.all([listTracks(), fdb.from("artists").select("*")]);
  const blocked = new Set((artists ?? []).filter((a: Artist) => a.status === "blocked").map((a: Artist) => a.id));
  return tracks.filter((t) => !blocked.has(t.artist_id));
}

export async function listArtists(): Promise<Artist[]> {
  const { data } = await fdb.from("artists").select("*");
  return byNewest((data ?? []) as Artist[]);
}

export async function setArtistStatus(id: string, status: Artist["status"]) {
  const { error } = await fdb.from("artists").update({ status }).eq("id", id);
  if (error) throw new Error("Could not update the artist.");
}

/** Removes an artist and everything they uploaded: tracks, listens, hero slides. */
export async function deleteArtist(id: string) {
  await fdb.from("artists").delete().eq("id", id);
  await fdb.from("music_tracks").delete().eq("artist_id", id);
  await fdb.from("music_hero_slides").delete().eq("artist_id", id);
  await fdb.from("music_listens").delete().eq("artist_id", id);
}

/** Admin features any track on the music hero for free, no expiry. */
export async function adminFeatureTrack(track: Track, imageUrl?: string) {
  await adminAddHeroSlide({
    title: track.title,
    image_url: imageUrl || track.cover_url || "",
    track_id: track.id,
    artist_id: track.artist_id,
    stage_name: track.stage_name,
  });
}

export async function addTrack(artist: Artist, input: { title: string; genre?: string; cover_url?: string; audio_url: string }) {
  const { error } = await fdb.from("music_tracks").insert({ ...input, id: uuid(), artist_id: artist.id, stage_name: artist.stage_name, kind: trackKind(input.audio_url) });
  if (error) throw new Error("Could not publish the song. Try again.");
}

export async function deleteTrack(id: string) {
  await fdb.from("music_tracks").delete().eq("id", id);
}

/** One record per user per song: replays by the same user never count twice. */
export async function recordListen(track: Track, userId: string, kind: "play" | "download") {
  if (!userId || userId === track.artist_id) return;
  // Open-platform songs never earn money for anyone on this site.
  if (isOpenTrack(track)) return;
  await fdb.from("music_listens").insert({ id: `${track.id}_${userId}`, track_id: track.id, artist_id: track.artist_id, user_id: userId, kind, created_at: nowIso() });
}

export async function artistWallet(artistId: string) {
  const [{ data: listens }, { data: wds }] = await Promise.all([
    fdb.from("music_listens").select("*").eq("artist_id", artistId),
    fdb.from("artist_withdrawals").select("*").eq("artist_id", artistId),
  ]);
  const withdrawals = byNewest((wds ?? []) as Withdrawal[]);
  const listeners = new Set((listens ?? []).map((l: { user_id: string }) => l.user_id)).size;
  const earned = earnedFromListeners((listens ?? []).length);
  const available = availableBalance(earned, withdrawals);
  return { plays: (listens ?? []).length, listeners, earned, available, withdrawals };
}

/** Withdraws the whole available balance; refuses below the minimum. */
export async function withdrawEarnings(artistId: string, phone: string) {
  const { available } = await artistWallet(artistId);
  if (!canWithdraw(available)) throw new Error(`You can withdraw once you reach UGX ${MIN_WITHDRAW_UGX.toLocaleString()}`);
  const { gross, fee, net } = withdrawalBreakdown(available);
  const id = uuid();
  // Reserve the amount first so a second click can't withdraw it twice.
  await fdb.from("artist_withdrawals").insert({ id, artist_id: artistId, gross, fee, net, phone, status: "pending" });
  try {
    const res = await sendWithdrawal({ phone, amount: net, currency: "UGX", description: "MOVIE MAX artist earnings" });
    await fdb.from("artist_withdrawals").update({ status: res.status, reference: res.reference }).eq("id", id);
    return { ...res, gross, fee, net };
  } catch (err) {
    await fdb.from("artist_withdrawals").update({ status: "failed" }).eq("id", id);
    throw err;
  }
}

/* ---------- Music-page hero slides ---------- */

export async function listHeroSlides(): Promise<HeroSlide[]> {
  const { data } = await fdb.from("music_hero_slides").select("*");
  return byNewest((data ?? []) as HeroSlide[]);
}

/** Slides currently allowed on the hero: unexpired paid features + admin slides. */
export async function activeHeroSlides(): Promise<HeroSlide[]> {
  return (await listHeroSlides()).filter((s) => heroActive(s.expires_at));
}

/** Slides one artist has ever bought, newest first (active and expired). */
export async function artistHeroSlides(artistId: string): Promise<HeroSlide[]> {
  const { data } = await fdb.from("music_hero_slides").select("*").eq("artist_id", artistId);
  return byNewest((data ?? []) as HeroSlide[]);
}

export const deleteHeroSlide = (id: string) => fdb.from("music_hero_slides").delete().eq("id", id);

/** Admin hero slide: free, never expires until deleted. */
export async function adminAddHeroSlide(input: { title: string; image_url?: string; link?: string; track_id?: string; artist_id?: string; stage_name?: string }) {
  const { error } = await fdb.from("music_hero_slides").insert({ ...input, id: uuid(), kind: "admin", expires_at: null });
  if (error) throw new Error("Could not save the slide.");
}

/**
 * Charges the artist's mobile money for a hero feature and waits for the
 * provider to confirm. Throws unless the money actually arrived.
 */
async function chargeHeroFeature(phone: string, description: string, amount = HERO_FEATURE_UGX, prefix = "HERO"): Promise<string> {
  const reference = `MM-${prefix}-${Date.now()}`;
  const res = await relworx.deposit({
    msisdn: phone,
    amount,
    reference,
    description,
  });
  const internal = res?.internal_reference ?? res?.data?.internal_reference;
  if (!internal) {
    const first = readStatus(res);
    if (first.status === "failed") throw new Error(first.message || "The payment was rejected");
    throw new Error("The payment service did not start the request. Try again.");
  }
  // Poll for up to ~90s so the artist can approve the prompt on their phone.
  let last = readStatus(res);
  for (let i = 0; i < 30 && last.status === "pending"; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      last = readStatus(await relworx.requestStatus(String(internal)));
    } catch {
      continue;
    }
  }
  if (last.status !== "success")
    throw new Error(
      last.status === "failed"
        ? last.message || "Payment failed"
        : "Payment not confirmed yet — approve the prompt on your phone and try again.",
    );
  return String(internal);
}

/** Pays UGX 1,000 and puts the track on the music-page hero for 7 days. */
export async function featureTrackOnHero(artist: Artist, track: Track, phone: string, imageUrl?: string) {
  const ref = await chargeHeroFeature(phone, `MOVIE MAX hero feature — ${track.title}`);
  const { error } = await fdb.from("music_hero_slides").insert({
    id: uuid(),
    kind: "artist",
    track_id: track.id,
    artist_id: artist.id,
    stage_name: artist.stage_name,
    title: track.title,
    image_url: imageUrl || track.cover_url || "",
    payment_ref: ref,
    expires_at: heroExpiryIso(),
  });
  if (error) throw new Error("Payment received but the slide could not be saved. Contact support.");
}

/** Pays again and extends an expired (or active) slide for another 7 days from now. */
export async function renewHeroSlide(slide: HeroSlide, phone: string) {
  const ref = await chargeHeroFeature(phone, `MOVIE MAX hero renew — ${slide.title}`);
  const { error } = await fdb
    .from("music_hero_slides")
    .update({ expires_at: heroExpiryIso(), payment_ref: ref })
    .eq("id", slide.id);
  if (error) throw new Error("Payment received but the renewal could not be saved. Contact support.");
}

export async function listChannels(): Promise<Channel[]> {
  const { data } = await fdb.from("tv_channels").select("*");
  return byNewest((data ?? []) as Channel[]);
}
export async function saveChannel(input: Omit<Channel, "id" | "created_at">) {
  const { error } = await fdb.from("tv_channels").insert({ ...input, id: uuid() });
  if (error) throw new Error("Could not save the channel.");
}
export const deleteChannel = (id: string) => fdb.from("tv_channels").delete().eq("id", id);

/** Admin marks / unmarks an artist as verified. */
export async function setArtistVerified(id: string, verified: boolean) {
  const { error } = await fdb.from("artists").update({ verified, verified_at: verified ? nowIso() : null }).eq("id", id);
  if (error) throw new Error("Could not update verification.");
}

/** Artist pays UGX 5,000; verified badge is granted only after the payment is confirmed. */
export async function payArtistVerification(artist: Artist, phone: string) {
  const ref = await chargeHeroFeature(phone, `MOVIE MAX artist verification — ${artist.stage_name}`, VERIFY_UGX, "VERIFY");
  const { error } = await fdb.from("artists").update({ verified: true, verified_at: nowIso(), verify_ref: ref }).eq("id", artist.id);
  if (error) throw new Error("Payment received but verification could not be saved. Contact support.");
}
