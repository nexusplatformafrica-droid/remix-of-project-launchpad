import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Lock, Music2, Sparkles, Trash2, Upload, Wallet } from "lucide-react";
import { artistHeroSlides, artistWallet, deleteTrack, kindOf, listTracks, updateArtist, uploadArtistFile, withdrawEarnings, type Artist, type HeroSlide, type Socials, type Track } from "@/lib/music";
import { TrackCover } from "@/components/music/TrackCover";
import { canWithdraw, HERO_FEATURE_UGX, heroActive, MIN_WITHDRAW_UGX, withdrawalBreakdown, withinUploadLimit } from "@/lib/music-rules";
import { UploadSong } from "./UploadSong";
import { FeatureHero } from "./FeatureHero";
import { ArtistSocials, SOCIAL_FIELDS, VerifiedBadge } from "./ArtistSocials";
import { VerifyArtist } from "./VerifyArtist";

const card = "rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5";
const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary";
const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;
type Tab = "about" | "musics" | "wallet";

/** Artist area shown on the profile page only for registered artists. */
export function ArtistProfile({ artist }: { artist: Artist }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("about");
  const [busyPic, setBusyPic] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["artist", artist.id] });

  const changePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!withinUploadLimit(f.size)) return void toast.error("Picture must be 300 MB or smaller");
    setBusyPic(true);
    try {
      await updateArtist(artist.id, { avatar_url: await uploadArtistFile(f) });
      toast.success("Profile picture updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyPic(false);
    }
  };

  return (
    <>
      <section className={`${card} grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4`}>
        <label className="relative cursor-pointer">
          {artist.avatar_url ? (
            <img src={artist.avatar_url} alt="" className="size-20 rounded-full bg-muted object-contain sm:size-24" />
          ) : (
            <div className="grid size-20 place-items-center rounded-full bg-primary text-3xl font-black text-primary-foreground sm:size-24">{artist.stage_name[0]?.toUpperCase()}</div>
          )}
          <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-foreground text-background ring-2 ring-card">
            {busyPic ? <span className="size-3 animate-spin rounded-full border-2 border-background border-t-transparent" /> : <Camera className="size-4" />}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={changePic} disabled={busyPic} />
        </label>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Artist</p>
          <h2 className="flex items-center gap-1.5 text-xl font-black sm:text-2xl"><span className="truncate">{artist.stage_name}</span><VerifiedBadge artist={artist} /></h2>
          <p className="truncate text-sm text-muted-foreground">{[artist.management, artist.country].filter(Boolean).join(" · ")}</p>
          <ArtistSocials socials={artist.socials} className="mt-2" />
        </div>
      </section>

      <nav className="grid grid-cols-3 gap-1 rounded-full bg-card p-1 ring-1 ring-border">
        {(["about", "musics", "wallet"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full py-2 text-sm font-bold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </nav>

      {tab === "about" && <VerifyArtist artist={artist} onDone={refresh} />}
      {tab === "about" && <About artist={artist} onSaved={refresh} />}
      {tab === "musics" && <Musics artist={artist} />}
      {tab === "wallet" && <ArtistWallet artist={artist} />}
    </>
  );
}

function About({ artist, onSaved }: { artist: Artist; onSaved: () => void }) {
  const [f, setF] = useState({ bio: "", email: "", whatsapp: "", management: "" });
  const [socials, setSocials] = useState<Socials>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setF({ bio: artist.bio ?? "", email: artist.email ?? "", whatsapp: artist.whatsapp ?? "", management: artist.management ?? "" });
    setSocials(artist.socials ?? {});
  }, [artist]);

  const save = async () => {
    setSaving(true);
    try { await updateArtist(artist.id, { ...f, socials }); toast.success("Saved"); onSaved(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); }
    finally { setSaving(false); }
  };

  return (
    <section className={card}>
      <h3 className="mb-3 font-black">About</h3>
      <textarea className={`${field} min-h-24`} placeholder="Tell fans about yourself" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input className={field} placeholder="Crew or management" value={f.management} onChange={(e) => setF({ ...f, management: e.target.value })} />
        <input className={field} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={field} placeholder="WhatsApp" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
      </div>
      <h3 className="mb-2 mt-5 font-black">Social media</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_FIELDS.map(({ key, label }) => (
          <input key={key} className={field} placeholder={key === "whatsapp" ? "WhatsApp number or link" : `${label} link`} value={socials[key] ?? ""} onChange={(e) => setSocials({ ...socials, [key]: e.target.value })} />
        ))}
      </div>
      <button disabled={saving} onClick={save} className="mt-4 w-full rounded-full bg-foreground py-2.5 text-sm font-bold text-background disabled:opacity-60 sm:w-auto sm:px-6">{saving ? "Saving…" : "Save"}</button>
    </section>
  );
}

function Musics({ artist }: { artist: Artist }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<{ track: Track; slide: HeroSlide | undefined } | null>(null);
  const { data = [] } = useQuery({ queryKey: ["music-tracks"], queryFn: listTracks });
  const slides = useQuery({ queryKey: ["artist-hero-slides", artist.id], queryFn: () => artistHeroSlides(artist.id) });
  const mine = data.filter((t) => t.artist_id === artist.id);
  const slideFor = (trackId: string) => (slides.data ?? []).find((s) => s.track_id === trackId);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["music-tracks"] });
    void qc.invalidateQueries({ queryKey: ["artist-hero-slides", artist.id] });
    void qc.invalidateQueries({ queryKey: ["music-hero-active"] });
  };
  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-black">My music ({mine.length})</h3>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Upload className="size-4" /> Upload</button>
      </div>
      {mine.length === 0 ? <p className="text-sm text-muted-foreground">No songs yet.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {mine.map((t) => {
            const slide = slideFor(t.id);
            const live = slide ? heroActive(slide.expires_at) : false;
            return (
              <li key={t.id} className="min-w-0">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                  <TrackCover track={t} className="size-full" />
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">{kindOf(t)}</span>
                  <button aria-label="Delete song" onClick={async () => { if (!confirm(`Delete "${t.title}"?`)) return; await deleteTrack(t.id); refresh(); }} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-background/80"><Trash2 className="size-4" /></button>
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold">{t.title}</p>
                <button
                  onClick={() => setFeature({ track: t, slide })}
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${live ? "bg-primary/10 text-primary ring-primary/30" : "bg-muted ring-border"}`}
                >
                  <Sparkles className="size-3" />
                  {live ? `On hero until ${new Date(String(slide!.expires_at)).toLocaleDateString()}` : slide ? "Renew hero — UGX 1,000" : `Feature on hero — UGX ${HERO_FEATURE_UGX.toLocaleString()}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <UploadSong open={open} onOpenChange={setOpen} artist={artist} />
      {feature && (
        <FeatureHero open onOpenChange={(v) => !v && setFeature(null)} artist={artist} track={feature.track} slide={feature.slide} onDone={refresh} />
      )}
    </section>
  );
}

function ArtistWallet({ artist }: { artist: Artist }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState(artist.whatsapp ?? "");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["artist-wallet", artist.id], queryFn: () => artistWallet(artist.id) });
  const available = data?.available ?? 0;
  const allowed = canWithdraw(available);
  const { fee, net } = withdrawalBreakdown(available);

  const withdraw = async () => {
    if (!allowed) return;
    if (!phone.trim()) return void toast.error("Enter your mobile money number");
    setBusy(true);
    try {
      const res = await withdrawEarnings(artist.id, phone.trim());
      if (res.status === "success") toast.success(`${ugx(res.net)} sent to ${phone}`);
      else toast.info(res.message || "Withdrawal is being processed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["artist-wallet", artist.id] });
    }
  };

  return (
    <section className={card}>
      <h3 className="mb-3 flex items-center gap-2 font-black"><Wallet className="size-4" /> Wallet</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box label="Available" value={isLoading ? "…" : ugx(available)} strong />
        <Box label="Total earned" value={ugx(data?.earned ?? 0)} />
        <Box label="Listens" value={String(data?.plays ?? 0)} />
        <Box label="Listeners" value={String(data?.listeners ?? 0)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">You earn UGX 1 for each different user who plays or downloads your song (UGX 10,000 per 10,000 users). You can withdraw from {ugx(MIN_WITHDRAW_UGX)}; a 25% withdraw fee is deducted.</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (available / MIN_WITHDRAW_UGX) * 100)}%` }} /></div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={field} inputMode="tel" placeholder="Mobile money number" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!allowed} />
        <button disabled={!allowed || busy} onClick={withdraw} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
          {!allowed && <Lock className="size-4" />}{busy ? "Sending…" : allowed ? `Withdraw ${ugx(net)}` : "Withdraw"}
        </button>
      </div>
      {allowed ? (
        <p className="mt-2 text-xs text-muted-foreground">{ugx(available)} − {ugx(fee)} fee = you receive {ugx(net)}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Withdraw unlocks at {ugx(MIN_WITHDRAW_UGX)} — {ugx(MIN_WITHDRAW_UGX - available)} to go.</p>
      )}

      {!!data?.withdrawals.length && (
        <ul className="mt-4 divide-y divide-border text-sm">
          {data.withdrawals.map((w) => (
            <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
              <span className="min-w-0 truncate">{ugx(w.net)} to {w.phone} <span className="text-muted-foreground">· {new Date(String(w.created_at)).toLocaleDateString()}</span></span>
              <span className={`text-xs font-bold capitalize ${w.status === "failed" ? "text-destructive" : ""}`}>{w.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Box({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2 ${strong ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      <p className="text-[11px] opacity-70">{label}</p>
      <p className="truncate font-black">{value}</p>
    </div>
  );
}
