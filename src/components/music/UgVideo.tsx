import { Link } from "@tanstack/react-router";
import { BadgeCheck, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TOP_ARTISTS } from "@/lib/ug-artists";
import { formatViews, isYtId, timeAgo, type YtVideo } from "@/lib/yt-music-rules";

/** Plays an official music video in a floating window. */
export function VideoModal({ video, onClose }: { video: YtVideo | null; onClose: () => void }) {
  return (
    <Dialog open={!!video} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl gap-3 border-border bg-card p-3 sm:p-4">
        {video && isYtId(video.id) && (
          <>
            <div className="aspect-video overflow-hidden rounded-xl bg-muted">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
                title={video.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="size-full"
              />
            </div>
            <div className="pr-8">
              <DialogTitle className="line-clamp-2 text-base font-bold leading-snug">{video.title}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link to="/music-artist/$slug" params={{ slug: video.artistSlug }} onClick={onClose} className="font-semibold text-foreground hover:underline">
                  {video.artist}
                </Link>
                {" · "}
                {formatViews(video.views)} · {timeAgo(video.published, Date.now())}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function VideoCard({ video, rank, onPlay, className = "" }: { video: YtVideo; rank?: number | undefined; onPlay: (v: YtVideo) => void; className?: string }) {
  return (
    <button onClick={() => onPlay(video)} className={`group min-w-0 text-left ${className}`}>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <img src={video.thumbnail} alt={video.title} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {rank != null && (
          <span className="absolute bottom-1 left-2 text-4xl font-black leading-none text-primary-foreground drop-shadow-[0_2px_6px_hsl(0_0%_0%/0.7)]">{rank}</span>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">Video</span>
        <span className="absolute inset-0 grid place-items-center bg-background/0 opacity-0 transition group-hover:bg-background/30 group-hover:opacity-100">
          <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="size-5 fill-current" /></span>
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{video.title}</p>
      <p className="truncate text-xs text-muted-foreground">
        {video.artist} · {formatViews(video.views)} · {timeAgo(video.published, Date.now())}
      </p>
    </button>
  );
}

/** A sideways row of music videos. */
export function VideoRow({
  title,
  icon,
  videos,
  loading,
  ranked,
  onPlay,
}: {
  title: string;
  icon: React.ReactNode;
  videos: YtVideo[];
  loading: boolean;
  ranked?: boolean;
  onPlay: (v: YtVideo) => void;
}) {
  if (!loading && videos.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-black sm:text-xl">{title}</h2>
      </div>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {loading
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-video w-60 shrink-0 animate-pulse rounded-xl bg-muted sm:w-72" />)
          : videos.map((v, i) => <VideoCard key={v.id} video={v} rank={ranked ? i + 1 : undefined} onPlay={onPlay} className="w-60 shrink-0 sm:w-72" />)}
      </div>
    </section>
  );
}

/** Round real photos of the top artists; each opens that artist's page. */
export function TopArtistsRow() {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-black sm:text-xl">Top Ugandan artists</h2>
      <div className="-mx-3 flex gap-4 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TOP_ARTISTS.map((a) => (
          <Link key={a.slug} to="/music-artist/$slug" params={{ slug: a.slug }} className="group w-20 shrink-0 text-center sm:w-24">
            <div className="mx-auto size-20 overflow-hidden rounded-full bg-muted ring-2 ring-border transition group-hover:ring-primary sm:size-24">
              <img src={a.avatar} alt={a.name} loading="lazy" className="size-full object-cover" />
            </div>
            <p className="mt-2 flex items-center justify-center gap-0.5 truncate text-xs font-bold">
              <span className="truncate">{a.name}</span>
              <BadgeCheck className="size-3.5 shrink-0 text-primary" />
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
