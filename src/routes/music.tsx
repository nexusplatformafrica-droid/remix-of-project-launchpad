import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Flame, Music2, Play, Sparkles, Upload } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { AuthModal } from "@/components/auth/AuthModal";
import { ArtistOnboard } from "@/components/music/ArtistOnboard";
import { UploadSong } from "@/components/music/UploadSong";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { TrackCover } from "@/components/music/TrackCover";
import { TopArtistsRow, VideoModal, VideoRow } from "@/components/music/UgVideo";
import { useAuth } from "@/hooks/useAuth";
import { activeHeroSlides, getArtist, kindOf, listArtists, listPublicTracks, trackCover, type HeroSlide, type Track } from "@/lib/music";
import { listOpenUgandanTracks } from "@/lib/open-music";
import { isOpenTrack, mergeMusic } from "@/lib/open-music-rules";
import { getUgMusic } from "@/lib/ug-music.functions";
import { TOP_ARTISTS } from "@/lib/ug-music-rules";
import { getUgVideos } from "@/lib/yt-music.functions";
import type { YtVideo } from "@/lib/yt-music-rules";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "Music — Listen and Download Songs | MOVIE MAX" },
      { name: "description", content: "Listen to and download new songs from Ugandan and African artists, and upload your own music on MOVIE MAX." },
      { property: "og:title", content: "Music — Listen and Download Songs | MOVIE MAX" },
      { property: "og:description", content: "Listen to and download new songs from African artists, and upload your own music." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MusicPage,
});

/** Slow, calm auto-slide for the hero. */
const SLIDE_MS = 9000;

function MusicPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [authOpen, setAuthOpen] = useState(false);
  const [onboard, setOnboard] = useState(false);
  const [upload, setUpload] = useState(false);
  const [playing, setPlaying] = useState<Track | null>(null);
  const tracks = useQuery({ queryKey: ["music-tracks"], queryFn: listPublicTracks });
  const ugMusic = useQuery({
    queryKey: ["music-ugmuziki"],
    queryFn: () => getUgMusic(),
    staleTime: 30 * 60_000,
    retry: 2,
  });
  const openTracks = useQuery({
    queryKey: ["music-open-ugandan"],
    queryFn: listOpenUgandanTracks,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const ugVideos = useQuery({ queryKey: ["music-ug-videos"], queryFn: () => getUgVideos(), staleTime: 30 * 60_000, retry: 2 });
  const [video, setVideo] = useState<YtVideo | null>(null);
  const heroSlides = useQuery({ queryKey: ["music-hero-active"], queryFn: activeHeroSlides, refetchInterval: 60_000 });
  const artist = useQuery({ queryKey: ["artist", user?.id], enabled: !!user, queryFn: () => getArtist(user!.id) });
  const artists = useQuery({ queryKey: ["music-artists"], queryFn: listArtists, staleTime: 60_000 });
  const avatarById = new Map((artists.data ?? []).map((a) => [a.id, a.avatar_url]));

  const startUpload = () => {
    if (!user) return setAuthOpen(true);
    if (artist.data?.status === "active") return setUpload(true);
    setOnboard(true);
  };

  const playSong = (t: Track) => {
    setVideo(null);
    setPlaying(t);
  };
  const playVideo = (v: YtVideo) => {
    setPlaying(null);
    setVideo(v);
  };

  const uploads = tracks.data ?? [];
  const ugSongs = (ugMusic.data?.songs ?? []) as Track[];
  const newSongs = (ugMusic.data?.latest ?? []) as Track[];
  // Uploads first, then top Ugandan artists (newest first), then lesser-known open songs.
  const list: Track[] = [...mergeMusic<Track>(uploads, []), ...ugSongs, ...((openTracks.data ?? []) as Track[])];
  const loadingAny = tracks.isLoading || ugMusic.isLoading || openTracks.isLoading;
  const byId = new Map(uploads.map((t) => [t.id, t]));
  const paidSlides = (heroSlides.data ?? []).map((s) => ({ slide: s, track: s.track_id ? byId.get(s.track_id) : undefined }));
  // The hero promotes artists who uploaded here.
  const featured = uploads.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="px-3 pb-40 sm:px-4 lg:px-8 lg:pb-32">
          <Hero paidSlides={paidSlides} featured={featured} onPlay={playSong} onUpload={startUpload} />

          <TopArtistsRow />

          <VideoRow title="Trending in Uganda right now" icon={<Flame className="size-5 text-primary" />} videos={ugVideos.data?.trending ?? []} loading={ugVideos.isLoading} ranked onPlay={playVideo} />

          <VideoRow title="New this month" icon={<Sparkles className="size-5 text-primary" />} videos={ugVideos.data?.fresh ?? []} loading={ugVideos.isLoading} onPlay={playVideo} />

          <TrendingRow title="New songs to download" tracks={newSongs} loading={ugMusic.isLoading} onPlay={playSong} />

          <div className="mb-3 mt-8 flex items-center justify-between gap-3">
            <h1 className="text-xl font-black sm:text-2xl">All music</h1>
            <button onClick={startUpload} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <Upload className="size-4" /> Upload your music
            </button>
          </div>

          {list.length === 0 && loadingAny ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl bg-card py-16 text-center ring-1 ring-border">
              <Music2 className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">No songs yet. Be the first artist to upload.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {list.map((t) => {
                const open = isOpenTrack(t);
                const top = open ? TOP_ARTISTS.find((a) => a.match.test(t.stage_name ?? "")) : undefined;
                const avatar = top ? top.avatar : open ? t.artist_avatar : avatarById.get(t.artist_id);
                const initial = (t.stage_name ?? "").charAt(0).toUpperCase();
                const avatarInner = avatar ? <img src={avatar} alt={t.stage_name} loading="lazy" className="size-full bg-muted object-cover" /> : initial;
                const avatarClass = "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-black text-primary-foreground";
                return (
                <div key={t.id} className="group min-w-0">
                  <button onClick={() => playSong(t)} className="block w-full text-left">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                      <TrackCover track={t} alt={t.title} className="size-full transition-transform duration-300 group-hover:scale-105" />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        {kindOf(t)}
                      </span>
                      <span className="absolute inset-0 grid place-items-center bg-background/0 opacity-0 transition group-hover:bg-background/30 group-hover:opacity-100">
                        <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="size-5 fill-current" /></span>
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                    {top ? (
                      <Link to="/music-artist/$slug" params={{ slug: top.slug }} className={avatarClass}>{avatarInner}</Link>
                    ) : open ? (
                      <span className={avatarClass}>{avatarInner}</span>
                    ) : (
                      <Link to="/artist/$id" params={{ id: t.artist_id }} className={avatarClass}>{avatarInner}</Link>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {top ? (
                          <Link to="/music-artist/$slug" params={{ slug: top.slug }} className="hover:underline">{t.stage_name}</Link>
                        ) : open ? (
                          <span>{t.stage_name}</span>
                        ) : (
                          <Link to="/artist/$id" params={{ id: t.artist_id }} className="hover:underline">{t.stage_name}</Link>
                        )}
                        {t.genre ? ` · ${t.genre}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      {playing && <MusicPlayer track={playing} userId={user?.id} onClose={() => setPlaying(null)} />}
      <VideoModal video={video} onClose={() => setVideo(null)} />
      <MobileNav />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      {user && (
        <ArtistOnboard open={onboard} onOpenChange={setOnboard} userId={user.id} email={user.email}
          onDone={() => { void qc.invalidateQueries({ queryKey: ["artist", user.id] }); setUpload(true); }} />
      )}
      {artist.data && <UploadSong open={upload} onOpenChange={setUpload} artist={artist.data} />}
    </div>
  );
}

type PaidSlide = { slide: HeroSlide; track: Track | undefined };

function Hero({ paidSlides, featured, onPlay, onUpload }: { paidSlides: PaidSlide[]; featured: Track[]; onPlay: (t: Track) => void; onUpload: () => void }) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const onSel = () => setIndex(api.selectedScrollSnap());
    api.on("select", onSel);
    const timer = setInterval(() => api.scrollNext(), SLIDE_MS);
    return () => { clearInterval(timer); api.off("select", onSel); };
  }, [api]);

  // Paid/admin slides first, then the newest tracks, then the artist invite.
  const count = paidSlides.length + featured.length + 1;
  return (
    <section className="mt-3">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {paidSlides.map(({ slide, track }) => (
            <CarouselItem key={slide.id}>
              <HeroFrame image={slide.image_url || (track ? trackCover(track) : "")} contain={!slide.image_url && !!track && !track.cover_url}>
                <span className="w-fit rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">Featured</span>
                <h2 className="line-clamp-2 text-2xl font-black sm:text-4xl">{slide.title}</h2>
                {slide.stage_name && <p className="text-sm text-muted-foreground">{slide.stage_name}</p>}
                {track ? (
                  <button onClick={() => onPlay(track)} className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground"><Play className="size-4 fill-current" /> Play now</button>
                ) : slide.link ? (
                  <a href={slide.link} className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground">Open</a>
                ) : null}
              </HeroFrame>
            </CarouselItem>
          ))}
          {featured.map((t, i) => (
            <CarouselItem key={t.id}>
              <HeroFrame image={trackCover(t)} contain={!t.cover_url} eager={i === 0 && paidSlides.length === 0}>
                <span className="w-fit rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">New release</span>
                <h2 className="line-clamp-2 text-2xl font-black sm:text-4xl">{t.title}</h2>
                <p className="text-sm text-muted-foreground">{t.stage_name}</p>
                <button onClick={() => onPlay(t)} className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground"><Play className="size-4 fill-current" /> Play now</button>
              </HeroFrame>
            </CarouselItem>
          ))}
          <CarouselItem>
            <HeroFrame image="">
              <h2 className="text-2xl font-black sm:text-4xl">Are you an artist?</h2>
              <p className="text-sm text-muted-foreground">Upload your songs and earn UGX 10,000 for every 10,000 different listeners.</p>
              <button onClick={onUpload} className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground"><Upload className="size-4" /> Upload your music</button>
            </HeroFrame>
          </CarouselItem>
        </CarouselContent>
      </Carousel>
      <div className="mt-3 flex justify-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <button key={i} onClick={() => api?.scrollTo(i)} aria-label={`Slide ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40"}`} />
        ))}
      </div>
    </section>
  );
}

function HeroFrame({ image, contain, eager, children }: { image: string; contain?: boolean; eager?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-card ring-1 ring-border sm:aspect-[21/8]">
      {image && <img src={image} alt="" className={`absolute inset-0 size-full ${contain ? "object-contain p-10 sm:p-14" : "object-cover"}`} loading={eager ? "eager" : "lazy"} />}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="relative flex h-full max-w-xl flex-col justify-end gap-2 p-5 sm:p-10">{children}</div>
    </div>
  );
}

/** A sideways row of the newest full songs (play or download). */
function TrendingRow({ title, tracks, loading, onPlay }: { title: string; tracks: Track[]; loading: boolean; onPlay: (t: Track) => void }) {
  if (!loading && tracks.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Download className="size-5 text-primary" />
        <h2 className="text-lg font-black sm:text-xl">{title}</h2>
      </div>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square w-36 shrink-0 animate-pulse rounded-2xl bg-muted sm:w-44" />)
          : tracks.slice(0, 40).map((t) => (
              <button key={t.id} onClick={() => onPlay(t)} className="group w-36 shrink-0 text-left sm:w-44">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <TrackCover track={t} alt={t.title} className="size-full transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute inset-0 grid place-items-center bg-background/0 opacity-0 transition group-hover:bg-background/30 group-hover:opacity-100">
                    <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="size-5 fill-current" /></span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold">{t.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{t.stage_name}</p>
              </button>
            ))}
      </div>
    </section>
  );
}
