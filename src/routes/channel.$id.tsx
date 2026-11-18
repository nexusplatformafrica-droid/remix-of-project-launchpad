import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { LivePlayer } from "@/components/tv/LivePlayer";
import { listChannels } from "@/lib/music";

export const Route = createFileRoute("/channel/$id")({
  head: () => ({
    meta: [
      { title: "Watch live TV — MOVIE MAX" },
      { name: "description", content: "Watch this live TV channel on MOVIE MAX and switch to other channels." },
      { property: "og:title", content: "Watch live TV — MOVIE MAX" },
      { property: "og:description", content: "Watch this live TV channel on MOVIE MAX and switch to other channels." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChannelWatch,
});

function ChannelWatch() {
  const { id } = Route.useParams();
  const { data = [], isLoading } = useQuery({ queryKey: ["tv-channels"], queryFn: listChannels });
  const channel = data.find((c) => c.id === id);
  const groups = Array.from(new Set(data.map((c) => c.category || "Channels")));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <Link to="/channels" className="mb-3 mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> All channels
          </Link>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0">
              {channel?.stream_url ? (
                <LivePlayer key={channel.id} src={channel.stream_url} title={channel.name} />
              ) : (
                <div className="grid aspect-video place-items-center rounded-xl bg-card text-sm text-muted-foreground">
                  {isLoading ? "Loading channel…" : "Channel not found."}
                </div>
              )}
              {channel && (
                <div className="mt-4 flex items-center gap-3">
                  {channel.logo_url && <img src={channel.logo_url} alt="" className="h-12 w-20 rounded-lg object-cover" />}
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-black sm:text-2xl">{channel.name}</h1>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-black text-destructive-foreground">LIVE</span>
                      {channel.category || "Channels"}
                    </p>
                  </div>
                </div>
              )}
            </section>
            <aside className="rounded-2xl bg-card p-3 ring-1 ring-border lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <h2 className="mb-2 px-1 text-base font-bold">Channels</h2>
              {groups.map((g) => (
                <div key={g} className="mb-3">
                  <p className="mb-1.5 px-1 text-xs font-semibold uppercase text-muted-foreground">{g}</p>
                  <div className="grid gap-1.5">
                    {data.filter((c) => (c.category || "Channels") === g).map((c) => (
                      <Link key={c.id} to="/channel/$id" params={{ id: c.id }}
                        className={`flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-muted ${c.id === id ? "bg-primary/15 ring-1 ring-primary" : ""}`}>
                        {c.logo_url ? <img src={c.logo_url} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded object-cover" /> : <div className="grid h-10 w-16 shrink-0 place-items-center rounded bg-muted"><MonitorPlay className="size-4 text-muted-foreground" /></div>}
                        <span className={`min-w-0 flex-1 truncate text-sm ${c.id === id ? "font-bold text-primary" : "font-medium"}`}>{c.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
