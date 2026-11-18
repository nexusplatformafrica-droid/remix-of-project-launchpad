import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MonitorPlay } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { listChannels } from "@/lib/music";

export const Route = createFileRoute("/channels")({
  head: () => ({
    meta: [
      { title: "Live TV Channels — MOVIE MAX" },
      { name: "description", content: "Watch live TV channels and uploaded channel shows on MOVIE MAX." },
      { property: "og:title", content: "Live TV Channels — MOVIE MAX" },
      { property: "og:description", content: "Watch live TV channels and uploaded channel shows on MOVIE MAX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChannelsPage,
});

function ChannelsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["tv-channels"], queryFn: listChannels });
  const groups = Array.from(new Set(data.map((c) => c.category || "Channels")));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <h1 className="mb-5 mt-4 text-2xl font-black sm:text-3xl">Live TV channels</h1>
          {isLoading ? (
            <Grid>{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />)}</Grid>
          ) : data.length === 0 ? (
            <p className="rounded-2xl bg-card py-16 text-center text-muted-foreground ring-1 ring-border">No channels yet.</p>
          ) : (
            groups.map((g) => (
              <section key={g} className="mb-8">
                <h2 className="mb-3 text-lg font-bold">{g}</h2>
                <Grid>
                  {data.filter((c) => (c.category || "Channels") === g).map((c) => (
                    <Link key={c.id} to="/channel/$id" params={{ id: c.id }} className="group min-w-0 text-left">
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-card ring-1 ring-border transition duration-300 group-hover:z-10 group-hover:scale-[1.04] group-hover:ring-2 group-hover:ring-primary">
                        {c.logo_url ? <img src={c.logo_url} alt={c.name} loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><MonitorPlay className="size-8 text-muted-foreground" /></div>}
                        <span className="absolute left-2 top-2 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-black text-destructive-foreground">LIVE</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold">{c.name}</p>
                    </Link>
                  ))}
                </Grid>
              </section>
            ))
          )}
        </main>
      </div>
            <MobileNav />
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{children}</div>
);

