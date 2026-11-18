import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Music2, Play } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { useAuth } from "@/hooks/useAuth";
import { getArtist, kindOf, listPublicTracks, type Track } from "@/lib/music";
import { TrackCover } from "@/components/music/TrackCover";
import { ArtistSocials, VerifiedBadge } from "@/components/music/ArtistSocials";

export const Route = createFileRoute("/artist/$id")({
  head: () => ({
    meta: [
      { title: "Artist — MOVIE MAX Music" },
      { name: "description", content: "Listen to this artist's songs on MOVIE MAX Music." },
      { property: "og:title", content: "Artist — MOVIE MAX Music" },
      { property: "og:description", content: "Listen to this artist's songs on MOVIE MAX Music." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArtistPage,
});

type Tab = "about" | "music" | "videos";

function ArtistPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [playing, setPlaying] = useState<Track | null>(null);
  const [tab, setTab] = useState<Tab>("music");
  const artist = useQuery({ queryKey: ["artist", id], queryFn: () => getArtist(id) });
  const tracks = useQuery({ queryKey: ["music-tracks"], queryFn: listPublicTracks });
  const all = (tracks.data ?? []).filter((t) => t.artist_id === id);
  const mine = all.filter((t) => kindOf(t) === (tab === "videos" ? "video" : "audio"));
  const a = artist.data;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="px-3 pb-40 sm:px-4 lg:px-8 lg:pb-32">
          {artist.isLoading ? (
            <div className="mt-3 h-40 animate-pulse rounded-3xl bg-muted" />
          ) : !a ? (
            <p className="py-24 text-center text-muted-foreground">Artist not found.</p>
          ) : a.status === "blocked" ? (
            <p className="py-24 text-center text-muted-foreground">This artist is not available.</p>
          ) : (
            <>
              <section className="mt-3 flex flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center ring-1 ring-border sm:flex-row sm:text-left">
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="size-24 rounded-full bg-muted object-contain ring-2 ring-border" />
                ) : (
                  <div className="grid size-24 place-items-center rounded-full bg-primary text-4xl font-black text-primary-foreground">{a.stage_name[0]?.toUpperCase()}</div>
                )}
                <div className="min-w-0">
                  <h1 className="flex items-center justify-center gap-2 text-2xl font-black sm:justify-start sm:text-3xl">{a.stage_name}<VerifiedBadge artist={a} className="size-6" /></h1>
                  <p className="text-sm text-muted-foreground">{[a.management, a.country].filter(Boolean).join(" · ")}</p>
                  <ArtistSocials socials={a.socials} className="mt-3 justify-center sm:justify-start" />
                </div>
              </section>

              <nav className="mt-6 grid max-w-md grid-cols-3 gap-1 rounded-full bg-card p-1 ring-1 ring-border">
                {(["about", "music", "videos"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded-full py-2 text-sm font-bold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
                ))}
              </nav>
              {tab === "about" ? (
                <section className="mt-6 grid gap-2 rounded-2xl bg-card p-5 text-sm ring-1 ring-border">
                  <p className="whitespace-pre-line text-muted-foreground">{a.bio || "This artist hasn't written a bio yet."}</p>
                  {a.management && <p><b>Management:</b> {a.management}</p>}
                  {a.country && <p><b>Country:</b> {a.country}</p>}
                  <p><b>Songs:</b> {all.filter((t) => kindOf(t) === "audio").length} · <b>Videos:</b> {all.filter((t) => kindOf(t) === "video").length}</p>
                </section>
              ) : mine.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-card py-16 text-center ring-1 ring-border">
                  <Music2 className="mx-auto mb-3 size-10 text-muted-foreground" />
                  <p className="text-muted-foreground">No {tab === "videos" ? "videos" : "songs"} from this artist yet.</p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {mine.map((t) => (
                    <button key={t.id} onClick={() => setPlaying(t)} className="group min-w-0 text-left">
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                        <TrackCover track={t} alt={t.title} className="size-full transition-transform duration-300 group-hover:scale-105" />
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">{kindOf(t)}</span>
                        <span className="absolute inset-0 grid place-items-center bg-background/0 opacity-0 transition group-hover:bg-background/30 group-hover:opacity-100">
                          <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="size-5 fill-current" /></span>
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
                      {t.genre && <p className="truncate text-xs text-muted-foreground">{t.genre}</p>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {playing && <MusicPlayer track={playing} userId={user?.id} onClose={() => setPlaying(null)} />}
      <MobileNav />
    </div>
  );
}
