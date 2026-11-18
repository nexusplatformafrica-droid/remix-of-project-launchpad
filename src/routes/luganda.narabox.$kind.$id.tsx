import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";
import { getNaraboxPage, getNaraboxTitle } from "@/lib/narabox.functions";
import { cleanNaraboxTitle, compactMovieGrid, firstPlayableEpisode, type NaraboxKind } from "@/lib/narabox";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { Player } from "@/components/youku/Player";
import { SubscribeGate } from "@/components/youku/SubscribeGate";
import { TitleActions } from "@/components/youku/TitleActions";
import { MediaCardShell } from "@/components/luo/LuoWatch";
import { useSubscription } from "@/hooks/useSubscription";
import { vjInfo } from "@/lib/vj";

const titleQuery = (kind: NaraboxKind, id: string) =>
  queryOptions({ queryKey: ["narabox-title", kind, id], queryFn: () => getNaraboxTitle({ data: { kind, id } }), staleTime: 60_000 });
function parseKind(kind: string): NaraboxKind {
  if (kind !== "movies" && kind !== "tv-shows") throw notFound();
  return kind;
}

export const Route = createFileRoute("/luganda/narabox/$kind/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(titleQuery(parseKind(params.kind), params.id)),
  head: ({ loaderData }) => {
    const name = loaderData ? cleanNaraboxTitle(loaderData.title) : "Luganda title";
    const title = `${name} in Luganda — Watch on MOVIE MAX`;
    const description = loaderData?.description?.slice(0, 160) || "Watch Luganda translated movies and series on MOVIE MAX.";
    const image = loaderData?.backdrop?.startsWith("https://") ? loaderData.backdrop : null;
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "video.movie" }, { name: "twitter:card", content: "summary_large_image" },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
      ],
    };
  },
  component: NaraboxWatch,
});

function NaraboxWatch() {
  const { kind: rawKind, id } = Route.useParams();
  const kind = parseKind(rawKind);
  const { data } = useSuspenseQuery(titleQuery(kind, id));
  const isSeries = kind === "tv-shows";
  const name = cleanNaraboxTitle(data.title);
  const [season, setSeason] = useState<number | null>(null);
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [theater, setTheater] = useState(false);
  const { canPlay } = useSubscription();

  const seasons = [...(data.seasons ?? [])].sort((a, b) => a.number - b.number);
  const start = firstPlayableEpisode(seasons);
  const activeSeason = seasons.find((s) => s.number === (season ?? start?.season)) ?? seasons[0];
  const seasonEps = [...(activeSeason?.episodes ?? [])].sort((a, b) => a.number - b.number);
  const current =
    seasonEps.find((e) => e.id === (episodeId ?? start?.episodeId)) ?? seasonEps.find((e) => !!e.videoUrl) ?? seasonEps[0];
  const src = (isSeries ? current?.videoUrl : data.videoUrl) ?? "";
  const playable = !!src && data.is_playable !== false;
  const tag = vjInfo(data.vj);

  const siblings = useQuery({
    queryKey: ["narabox-related", kind],
    queryFn: () => getNaraboxPage({ data: { kind, page: 1 } }),
    staleTime: 5 * 60_000,
  });
  const related = useMemo(() => {
    const pool = (siblings.data?.data ?? []).filter((t) => String(t.id) !== id);
    const same = pool.filter((t) => t.genre.some((g) => data.genre.includes(g)));
    return [...same, ...pool.filter((t) => !same.includes(t))].slice(0, 18);
  }, [siblings.data, id, data.genre]);

  const nextEpisode = () => {
    const i = seasonEps.findIndex((e) => e.id === current?.id);
    const next = seasonEps.slice(i + 1).find((e) => !!e.videoUrl);
    if (next) setEpisodeId(next.id);
  };

  const relatedGrid = (
    <div className={compactMovieGrid}>
      {related.map((t) => (
        <Link key={t.id} to="/luganda/narabox/$kind/$id" params={{ kind, id: String(t.id) }} className="block">
          <MediaCardShell
            poster={t.thumbnail ?? ""}
            label={cleanNaraboxTitle(t.title)}
            badge={isSeries ? "Series" : "Movie"}
            vj={t.vj}
            meta={[t.releaseDate?.slice(0, 4), t.genre[0]].filter(Boolean).join(" · ")}
          />
        </Link>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <Link to="/luganda" className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to Luganda
          </Link>

          <div className={`mt-3 flex flex-col gap-6 ${theater ? "" : "lg:flex-row"}`}>
            <div className="min-w-0 flex-1">
              {playable ? (
                <div className="relative overflow-hidden rounded-[1.25rem] bg-black">
                  {!canPlay && <SubscribeGate title={name} />}
                  <Player
                    src={canPlay ? src : ""}
                    poster={data.backdrop ?? data.thumbnail ?? undefined}
                    title={name}
                    theater={theater}
                    onTheater={() => setTheater((v) => !v)}
                    {...(isSeries ? { onNext: nextEpisode } : {})}
                  />
                </div>
              ) : (
                <div className="grid aspect-video w-full place-items-center rounded-[1.25rem] bg-card px-6 text-center text-sm text-muted-foreground">
                  {isSeries ? "New episodes of this series are coming soon." : "This movie is coming soon."}
                </div>
              )}

              <h1 className="mt-4 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {name}
                {isSeries && current && activeSeason ? ` · S${activeSeason.number} E${current.number}` : ""}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {tag && (
                  <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2 py-0.5 font-black uppercase text-white ${tag.gradient}`}>
                    <ShieldCheck className="size-3" /> {tag.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-foreground">
                  <Star className="size-3.5 fill-current text-vip" />
                  Luganda
                </span>
                {[data.releaseDate?.slice(0, 4), data.genre.join(", ")].filter(Boolean).map((bit) => (
                  <span key={String(bit)}>· {bit}</span>
                ))}
              </div>

              <TitleActions
                titleId={`narabox-${kind}-${id}`}
                titleName={name}
                description={data.description}
                cast={[]}
                sources={
                  playable && data.downloadEnabled !== false
                    ? [{ id: String(current?.id ?? id), url: src, resolution: 720, codec: null, size: null, captions: [] }]
                    : []
                }
                downloadName={isSeries && current && activeSeason ? `${name} S${activeSeason.number}E${current.number}` : name}
                shareImage={data.thumbnail ?? data.backdrop}
                blobDownload
              />

              {!!related.length && (
                <section className="mt-8 hidden lg:block">
                  <h2 className="mb-3 text-lg font-bold text-foreground">You may also like</h2>
                  {relatedGrid}
                </section>
              )}
            </div>

            {isSeries && seasonEps.length > 0 && (
              <aside className="w-full shrink-0 lg:w-[320px]">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Episodes</h2>
                {seasons.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {seasons.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSeason(s.number); setEpisodeId(null); }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                          s.number === activeSeason?.number
                            ? "bg-brand text-brand-foreground ring-brand"
                            : "bg-card text-muted-foreground ring-border hover:text-foreground"
                        }`}
                      >
                        Season {s.number}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                  {seasonEps.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      title={e.videoUrl ? e.title || `Episode ${e.number}` : "Coming soon"}
                      disabled={!e.videoUrl}
                      onClick={() => setEpisodeId(e.id)}
                      className={`h-9 rounded text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        current?.id === e.id
                          ? "bg-brand text-brand-foreground ring-brand"
                          : "bg-card text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      {e.number}
                    </button>
                  ))}
                </div>
              </aside>
            )}

            {!!related.length && (
              <section className="lg:hidden">
                <h2 className="mb-3 text-lg font-bold text-foreground">You may also like</h2>
                {relatedGrid}
              </section>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
