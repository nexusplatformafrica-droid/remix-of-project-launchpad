import { useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MomoPayButton, momoFailState, type MomoState } from "@/components/auth/MomoPayButton";
import { featureTrackOnHero, renewHeroSlide, uploadArtistFile, type Artist, type HeroSlide, type Track } from "@/lib/music";
import { TrackCover } from "@/components/music/TrackCover";
import { HERO_FEATURE_DAYS, HERO_FEATURE_UGX, withinUploadLimit } from "@/lib/music-rules";
import { countryFromPhone, COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";

const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary";
const ugx = (n: number) => `UGX ${n.toLocaleString()}`;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artist: Artist;
  track: Track;
  /** Existing slide when renewing; empty for a first feature. */
  slide?: HeroSlide | undefined;
  onDone: () => void;
};

/** Charges UGX 1,000 on mobile money and features the song on the music-page hero for 7 days. */
export function FeatureHero({ open, onOpenChange, artist, track, slide, onDone }: Props) {
  const [phone, setPhone] = useState(artist.whatsapp ?? "");
  const [banner, setBanner] = useState<File | null>(null);
  const [state, setState] = useState<MomoState>("idle");
  const busy = state === "waiting";

  const detected = countryFromPhone(phone.replace(/[^0-9]/g, "")) ?? DEFAULT_COUNTRY;
  const networkName = COUNTRIES.find((c) => c.code === detected.code)?.providers?.[0] ?? null;

  const pickBanner = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !withinUploadLimit(f.size)) {
      toast.error("Picture must be 300 MB or smaller");
      e.target.value = "";
      return;
    }
    setBanner(f);
  };

  const pay = async () => {
    if (!phone.trim()) return void toast.error("Enter your mobile money number");
    setState("waiting");
    try {
      const imageUrl = banner ? await uploadArtistFile(banner) : undefined;
      if (slide) await renewHeroSlide(slide, phone.trim());
      else await featureTrackOnHero(artist, track, phone.trim(), imageUrl);
      setState("success");
      toast.success(`"${track.title}" is on the music page hero for ${HERO_FEATURE_DAYS} days`);
      onDone();
      setTimeout(() => onOpenChange(false), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setState(momoFailState(msg));
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{slide ? "Renew hero feature" : "Feature on the hero"}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
          <TrackCover track={track} className="size-14 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-bold">{track.title}</p>
            <p className="truncate text-xs text-muted-foreground">{artist.stage_name}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Your song shows in the big sliding banner on the music page for <b className="text-foreground">{HERO_FEATURE_DAYS} days</b>.
          It costs <b className="text-foreground">{ugx(HERO_FEATURE_UGX)}</b>; after {HERO_FEATURE_DAYS} days it comes down until you renew.
        </p>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Banner picture (optional — song cover is used otherwise)</span>
          <span className={`${field} flex cursor-pointer items-center gap-2`}>
            <ImageIcon className="size-4 shrink-0" />
            <span className="truncate">{banner ? banner.name : "Choose a wide picture"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={pickBanner} />
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Mobile money number</span>
          <input className={field} inputMode="tel" placeholder="07…" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <MomoPayButton
          name={networkName}
          logo=""
          checking={false}
          state={state}
          onClick={pay}
        />
        <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          {busy ? "Approve the prompt on your phone…" : `${ugx(HERO_FEATURE_UGX)} is charged once, no subscription.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
