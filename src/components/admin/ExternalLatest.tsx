import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { searchAny } from "@/lib/catalog-client";
import { getHome } from "@/lib/catalog.functions";
import { getNaraboxCatalog } from "@/lib/narabox.functions";
import { loadLatestPicks, saveLatestPicks } from "@/lib/latest";
import { movieboxLatest, naraboxLatest, toggleLatest, type LatestPick } from "@/lib/latest-rules";

export function ExternalLatest() {
  const qc = useQueryClient();
  const [source, setSource] = useState<"narabox" | "moviebox">("narabox");
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const saved = useQuery({ queryKey: ["latest-catalog"], queryFn: loadLatestPicks });
  const narabox = useQuery({ queryKey: ["admin-narabox-catalog"], queryFn: () => getNaraboxCatalog(), enabled: source === "narabox", staleTime: 300_000 });
  const movies = useQuery({ queryKey: ["admin-latest-moviebox", term], enabled: source === "moviebox", queryFn: async () => {
    if (term) return searchAny(term);
    let home;
    try { const { fetchHome } = await import("@/lib/moviebox"); home = await fetchHome(); }
    catch { home = await getHome(); }
    const pool = [...(home.hero ?? []), ...(home.trending ?? []), ...(home.rows ?? []).flatMap((row) => row.items ?? [])];
    return [...new Map(pool.map((item) => [item.id, item])).values()];
  } });
  const picks = saved.data ?? [];
  const save = useMutation({ mutationFn: async (item: LatestPick) => {
    if (!saved.data) throw new Error("Latest selections are still loading");
    await saveLatestPicks(toggleLatest(saved.data, item));
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["latest-catalog"] }); toast.success("Latest updated"); },
    onError: (e: Error) => toast.error(e.message) });
  const items = source === "moviebox" ? (movies.data ?? []).map(movieboxLatest) : [
    ...(narabox.data?.movies ?? []).map((item) => naraboxLatest(item, "movies")),
    ...(narabox.data?.shows ?? []).map((item) => naraboxLatest(item, "tv-shows")),
  ].filter((item) => item.title.toLowerCase().includes(term.toLowerCase()));
  const active = source === "moviebox" ? movies : narabox;
  const card = (item: LatestPick) => {
    const selected = picks.some((p) => p.key === item.key);
    return <article key={item.key} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div className="relative aspect-[2/3] bg-muted">
        {item.poster && <img src={item.poster} alt={item.title} className="size-full object-cover" loading="lazy" />}
        <span className="absolute left-1 top-1 max-w-[90%] truncate rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{item.tag}</span>
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold" title={item.title}>{item.title}</p>
        <Button variant={selected ? "default" : "secondary"} size="sm" className="mt-2 w-full gap-1 px-1 text-[11px]"
          disabled={save.isPending || !saved.data} aria-pressed={selected} onClick={() => save.mutate(item)}>
          {selected ? <Check /> : <Star />}{selected ? "Latest" : "Mark latest"}
        </Button>
      </div>
    </article>;
  };
  return <section className="space-y-4">
    <h2 className="text-lg font-bold">Latest · External catalogs</h2>
    {saved.error && <p className="text-destructive">Could not load saved latest selections. <Button variant="ghost" onClick={() => void saved.refetch()}>Retry</Button></p>}
    <div className="flex flex-wrap gap-2">
      <Button variant={source === "narabox" ? "default" : "secondary"} onClick={() => { setSource("narabox"); setTerm(""); setInput(""); }}>Luganda · Narabox API</Button>
      <Button variant={source === "moviebox" ? "default" : "secondary"} onClick={() => { setSource("moviebox"); setTerm(""); setInput(""); }}>English · MovieBox</Button>
    </div>
    {picks.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">On home · {picks.length}</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">{picks.map(card)}</div></div>}
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(input.trim()); }}>
      <input aria-label="Search external movies" placeholder="Search movies and series" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" value={input} onChange={(e) => setInput(e.target.value)} />
      <Button type="submit" variant="secondary" size="icon" aria-label="Search catalogs"><Search /></Button>
    </form>
    {active.isLoading ? <p>Loading…</p> : active.error ? <div><p>Catalog unavailable. Please try again.</p><Button variant="secondary" onClick={() => void active.refetch()}>Retry</Button></div> : <div className="grid max-h-[640px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">{items.map(card)}</div>}
    {!active.isLoading && !active.error && !items.length && <p>No matching titles.</p>}
  </section>;
}