import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Download, Flame, Music2, Play, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { TrackCover } from "@/components/music/TrackCover";
import { VideoCard, VideoModal } from "@/components/music/UgVideo";
import { useAuth } from "@/hooks/useAuth";
import { artistBySlug } from "@/lib/ug-artists";
import { getUgArtistSongs } from "@/lib/ug-music.functions";
import { getArtistVideos } from "@/lib/yt-music.functions";
import type { Track } from "@/lib/music";
import type { YtVideo } from "@/lib/yt-music-rules";

export const Route = createFileRoute("/music-artist/$slug")({
  loader: ({ params }) => {
    const artist = artistBySlug(params.slug);
    if (!artist) throw notFound();
    return { slug: artist.slug };
  },
  head: ({ params }) => {
    const a = artistBySlug(params.slug);
    const name = a?.name ?? "Artist";
    const title = `${name} — Songs, New Music & Videos | MOVIE MAX`;
    const description = `Listen to and download ${name}'s songs, watch the newest official music videos and the most popular hits on MOVIE MAX.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
        ...(a ? [{ property: "og:image", content: a.avatar }, { name: "twitter:image", content: a.avatar }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <p className="mb-4 text-muted-foreground">This artist wasn't found.</p>
        <Link to="/music" className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Back to music</Link>
      </div>
    </div>
  ),
  component: ArtistPage,
});

function ArtistPage() {
  const { slug } = Route.useParams();
  const artist = artistBySlug(slug)!;
  const { user } = useAuth();
  const [playing, setPlaying] = useState<Track | null>(null);
  const [video, setVideo] = useState<YtVideo | null>(null);
  const videos = useQuery({ queryKey: ["artist-videos", slug], queryFn: () => getArtistVideos({ data: { slug } }), staleTime: 30 * 60_000 });
  const songs = useQuery({ queryKey: ["artist-songs", slug], queryFn: () => getUgArtistSongs({ data: { slug } }), staleTime: 30 * 60_000, retry: 2 });
  const songList = (songs.data ?? []) as Track[];

  const playVideo = (v: YtVideo) => {
    setPlaying(null);
    setVideo(v);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="px-3 pb-40 sm:px-4 lg:px-8 lg:pb-32">
          <Link to="/music" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Music
          </Link>

          <header className="relative mt-3 overflow-hidden rounded-3xl bg-card ring-1 ring-border">
            <img src={artist.avatar} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" />
            <div className="relative flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-end sm:p-10 sm:text-left">
              <img src={artist.avatar} alt={artist.name} className="size-32 rounded-full object-cover ring-4 ring-background sm:size-44" />
              <div className="min-w-0">
                <p className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider text-primary sm:justify-start">
                  <BadgeCheck className="size-4" /> Verified artist
                </p>
                <h1 className="mt-1 text-3xl font-black sm:text-5xl">{artist.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {artist.subscribers} fans on YouTube
                  {songs.data ? ` · ${songList.length} songs` : ""}
                </p>
                {songList[0] && (
                  <button onClick={() => { setVideo(null); setPlaying(songList[0]!); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground">
                    <Play className="size-4 fill-current" /> Play newest song
                  </button>
                )}
              </div>
            </div>
          </header>

          <VideoGrid title="Latest releases" icon={<Sparkles className="size-5 text-primary" />} videos={videos.data?.latest ?? []} loading={videos.isLoading} onPlay={playVideo} />

          <section className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <Music2 className="size-5 text-primary" />
              <h2 className="text-lg font-black sm:text-xl">All songs{songs.data ? ` (${songList.length})` : ""}</h2>
            </div>
            {songs.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : songList.length === 0 ? (
              <p className="rounded-2xl bg-card py-10 text-center text-sm text-muted-foreground ring-1 ring-border">No downloadable songs found right now — watch the videos above.</p>
            ) : (
              <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                {songList.map((t, i) => (
                  <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${playing?.id === t.id ? "bg-muted" : ""}`}>
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <button onClick={() => { setVideo(null); setPlaying(t); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <TrackCover track={t} alt={t.title} className="size-full" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.stage_name}</span>
                      </span>
                    </button>
                    {t.download_url && (
                      <a href={t.download_url} aria-label={`Download ${t.title}`} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Download className="size-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <VideoGrid title="Most popular" icon={<Flame className="size-5 text-primary" />} videos={videos.data?.popular ?? []} loading={videos.isLoading} onPlay={playVideo} />
        </main>
      </div>
      {playing && <MusicPlayer track={playing} userId={user?.id} onClose={() => setPlaying(null)} />}
      <VideoModal video={video} onClose={() => setVideo(null)} />
      <MobileNav />
    </div>
  );
}

function VideoGrid({ title, icon, videos, loading, onPlay }: { title: string; icon: React.ReactNode; videos: YtVideo[]; loading: boolean; onPlay: (v: YtVideo) => void }) {
  if (!loading && videos.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-black sm:text-xl">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-x-3 gap-y-6 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {loading
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />)
          : videos.map((v) => <VideoCard key={v.id} video={v} onPlay={onPlay} />)}
      </div>
    </section>
  );
}
