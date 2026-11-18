import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNaraboxCatalog, getNaraboxShowAvailability } from "@/lib/narabox.functions";
import { compactMovieGrid, mixNewestFirst, naraboxToMixed, type MixedTitle, type NaraboxKind } from "@/lib/narabox";
import { listAllEpisodes, listLuoTitles } from "@/lib/luo";
import { matchesVj, vjInfo, vjKey } from "@/lib/vj";

type KindFilter = "all" | "movie" | "series";

/** Luganda uploads and Narabox movies/series in one newest-first grid. */
export function NaraboxLibrary({ vj = "" }: { vj?: string }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedVj, setVj] = useState(vjKey(vj));
  const [genre, setGenre] = useState("");

  const fetchCatalog = useServerFn(getNaraboxCatalog);
  const fetchAvailability = useServerFn(getNaraboxShowAvailability);
  const catalog = useQuery({ queryKey: ["narabox-catalog"], queryFn: () => fetchCatalog(), staleTime: 5 * 60_000, retry: 2 });
  const showIds = (catalog.data?.shows ?? []).map((s) => s.id);
  const chunks = Array.from({ length: Math.ceil(showIds.length / 30) }, (_, i) => showIds.slice(i * 30, i * 30 + 30));
  const availability = useQueries({
    queries: chunks.map((ids) => ({
      queryKey: ["narabox-availability", ids.join(",")],
      queryFn: () => fetchAvailability({ data: { ids } }),
      staleTime: 10 * 60_000,
    })),
  });
  const playableEpisodes: Record<number, number> = Object.assign({}, ...availability.map((a) => a.data ?? {}));
  const uploads = useQuery({ queryKey: ["luo-titles", "luganda"], queryFn: () => listLuoTitles("luganda"), staleTime: 30_000 });
  const episodes = useQuery({ queryKey: ["luo-all-episodes"], queryFn: listAllEpisodes, staleTime: 60_000 });

  const lastEp = new Map<string, number>();
  for (const e of episodes.data ?? []) {
    const at = Date.parse(e.created_at) || 0;
    if (at > (lastEp.get(e.title_id) ?? 0)) lastEp.set(e.title_id, at);
  }
  const uploaded: MixedTitle[] = (uploads.data ?? []).map((t) => ({
    key: `up-${t.id}`, source: "upload", id: t.id, kind: t.kind === "series" ? "series" : "movie",
    title: t.title, poster: t.poster_url, vj: t.vj, genre: t.genre ? [t.genre] : [],
    year: t.year ? String(t.year) : null, at: Math.max(Date.parse(t.created_at) || 0, lastEp.get(t.id) ?? 0),
  }));
  const all = mixNewestFirst(
    uploaded,
    (catalog.data?.movies ?? []).map((i) => naraboxToMixed(i, "movies")),
    (catalog.data?.shows ?? []).filter((s) => playableEpisodes[s.id] !== 0).map((i) => naraboxToMixed(i, "tv-shows")),
  );
  const q = search.toLowerCase().trim();
  const items = all.filter(
    (t) => (kind === "all" || t.kind === kind) && matchesVj(t.vj, selectedVj) &&
      (!genre || t.genre.includes(genre)) && t.title.toLowerCase().includes(q),
  );
  const vjs = [...new Map(all.map((t) => vjInfo(t.vj)).filter((v) => !!v).map((v) => [v.key, v.name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const genres = [...new Set(all.flatMap((t) => t.genre))].sort();

  const pending = catalog.isPending;
  const failed = catalog.isError;
  // Render in steps so thousands of posters never freeze the page.
  const [shown, setShown] = useState(120);
  useEffect(() => {
    if (shown >= items.length) return;
    const t = setTimeout(() => setShown((n) => n + 240), 400);
    return () => clearTimeout(t);
  }, [shown, items.length]);

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Luganda movies & series</h1>
        <div className="flex gap-1" role="group" aria-label="Title type">
          {(["all", "movie", "series"] as const).map((k) => (
            <Button key={k} variant={kind === k ? "default" : "ghost"} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "all" ? "All" : k === "movie" ? "Movies" : "Series"}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_180px_180px]">
        <Input className="col-span-2 sm:col-span-1" aria-label="Search Luganda titles" placeholder="Search titles" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by VJ" value={selectedVj} onChange={(e) => setVj(e.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="">All VJs</option>
          {vjs.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <select aria-label="Filter by genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="">All genres</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {pending && (
        <div className={compactMovieGrid}>
          {Array.from({ length: 18 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-md bg-muted" />)}
        </div>
      )}
      {failed && !uploaded.length && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <p>The Luganda catalog could not load.</p>
          <Button variant="outline" onClick={() => void catalog.refetch()}>Retry</Button>
        </div>
      )}

      <div className={compactMovieGrid}>
        {items.slice(0, shown).map((item, idx) => <Poster key={item.key} item={item} first={idx === 0} />)}
      </div>
      {!pending && !items.length && !failed && <p className="text-sm text-muted-foreground">No matching titles in the loaded results.</p>}
    </section>
  );
}

function Poster({ item, first }: { item: MixedTitle; first: boolean }) {
  const tag = vjInfo(item.vj);
  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform group-hover:-translate-y-1 group-hover:ring-brand">
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center px-2 text-center text-xs text-muted-foreground">{item.title}</div>
        )}
        {tag && (
          <span className={`absolute left-0 top-0 z-10 max-w-[86%] truncate rounded-br-lg bg-gradient-to-r px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.7)] sm:text-[10px] ${tag.gradient}`}>
            {tag.name}
          </span>
        )}
        <span className="absolute right-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-black uppercase text-brand-foreground">
          {item.kind === "series" ? "Series" : "Movie"}
        </span>
        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <Play className="size-8 fill-white text-white drop-shadow" />
        </span>
      </div>
      <p className="mt-2 truncate text-[13px] text-muted-foreground group-hover:text-foreground">{item.title}</p>
      <p className="truncate text-[11px] text-muted-foreground/70">{[item.year, item.genre.join(", ")].filter(Boolean).join(" · ")}</p>
    </>
  );
  const tour = first ? { "data-tour": "first-poster" } : {};
  return item.source === "upload" ? (
    <Link to="/luganda/$id" params={{ id: item.id }} aria-label={item.title} className="group block min-w-0" {...tour}>{body}</Link>
  ) : (
    <Link to="/luganda/narabox/$kind/$id" params={{ kind: item.naraboxKind ?? "movies", id: item.id }} aria-label={item.title} className="group block min-w-0" {...tour}>{body}</Link>
  );
}
