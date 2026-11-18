import { BadgeCheck, Globe } from "lucide-react";
import type { Artist, Socials } from "@/lib/music";
import youtube from "@/assets/social/youtube.svg";
import facebook from "@/assets/social/facebook.svg";
import linkedin from "@/assets/social/linkedin.svg";
import whatsapp from "@/assets/social/whatsapp.svg";
import spotify from "@/assets/social/spotify.svg";
import instagram from "@/assets/social/instagram.svg";
import x from "@/assets/social/x.png";

export const SOCIAL_FIELDS: { key: keyof Socials; label: string; icon?: string }[] = [
  { key: "youtube", label: "YouTube", icon: youtube },
  { key: "facebook", label: "Facebook", icon: facebook },
  { key: "instagram", label: "Instagram", icon: instagram },
  { key: "x", label: "X (Twitter)", icon: x },
  { key: "spotify", label: "Spotify", icon: spotify },
  { key: "linkedin", label: "LinkedIn", icon: linkedin },
  { key: "whatsapp", label: "WhatsApp", icon: whatsapp },
  { key: "tiktok", label: "TikTok" },
  { key: "website", label: "Website" },
];

/** Turns a stored link (or a bare WhatsApp number) into a clickable URL. */
function href(key: keyof Socials, v: string) {
  const t = v.trim();
  if (key === "whatsapp" && !/^https?:/i.test(t)) return `https://wa.me/${t.replace(/[^0-9]/g, "")}`;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Only the networks the artist actually filled in. */
export function ArtistSocials({ socials, className = "" }: { socials?: Socials | undefined; className?: string }) {
  const items = SOCIAL_FIELDS.filter((s) => socials?.[s.key]?.trim());
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((s) => (
        <a
          key={s.key}
          href={href(s.key, socials![s.key]!)}
          target="_blank"
          rel="noreferrer"
          title={s.label}
          aria-label={s.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-3 text-[11px] font-bold ring-1 ring-border hover:ring-primary"
        >
          <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-background">
            {s.icon ? <img src={s.icon} alt="" className="size-4 object-contain" /> : s.key === "website" ? <Globe className="size-4" /> : <span className="text-[10px] font-black">♪</span>}
          </span>
          {s.label}
        </a>
      ))}
    </div>
  );
}

export function VerifiedBadge({ artist, className = "size-5" }: { artist: Pick<Artist, "verified">; className?: string }) {
  if (!artist.verified) return null;
  return <BadgeCheck aria-label="Verified artist" className={`${className} shrink-0 fill-primary text-primary-foreground`} />;
}
