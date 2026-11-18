import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { adminAddHeroSlide, deleteHeroSlide, listHeroSlides, uploadArtistFile } from "@/lib/music";
import { heroActive, withinUploadLimit } from "@/lib/music-rules";
import { Panel } from "./ui";

const field = "w-full rounded-xl bg-white/70 px-3 py-2.5 text-[13px] outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-black/20";

/** Admin music-page hero slides: free, no expiry, plus an overview of paid artist slides. */
export function MusicHeroTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["music-hero-slides"], queryFn: listHeroSlides });
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["music-hero-slides"] });

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !withinUploadLimit(f.size)) {
      toast.error("Picture must be 300 MB or smaller");
      e.target.value = "";
      return;
    }
    setImage(f);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return void toast.error("Add a title");
    setBusy(true);
    try {
      const image_url = image ? await uploadArtistFile(image) : "";
      await adminAddHeroSlide({ title: title.trim(), image_url, link: link.trim() });
      toast.success("Slide added to the music page hero");
      setTitle(""); setLink(""); setImage(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Panel>
        <h3 className="mb-3 text-[15px] font-black">Add a music hero slide (free)</h3>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
          <input className={field} placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <input className={field} placeholder="Link when tapped (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          <label className={`${field} flex cursor-pointer items-center gap-2 sm:col-span-2`}>
            <ImagePlus className="size-4 shrink-0" />
            <span className="truncate">{image ? image.name : "Banner picture (optional)"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={pick} />
          </label>
          <button disabled={busy} className="rounded-full bg-black px-6 py-2.5 text-[13px] font-bold text-white disabled:opacity-50 sm:w-fit">
            {busy ? "Saving…" : "Add slide"}
          </button>
        </form>
      </Panel>

      <Panel>
        <h3 className="mb-3 text-[15px] font-black">All slides ({data.length})</h3>
        {data.length === 0 ? (
          <p className="text-[13px] opacity-60">No slides yet. Paid artist features and your slides appear here.</p>
        ) : (
          <ul className="grid gap-2">
            {data.map((s) => {
              const active = heroActive(s.expires_at);
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-white/60 p-2.5 ring-1 ring-black/5">
                  {s.image_url ? <img src={s.image_url} alt="" className="h-10 w-16 rounded-lg object-cover" /> : <div className="h-10 w-16 rounded-lg bg-black/10" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{s.title}</p>
                    <p className="truncate text-[11px] opacity-60">
                      {s.kind === "admin" ? "Admin slide · never expires" : `${s.stage_name ?? "Artist"} · ${active ? `active until ${new Date(String(s.expires_at)).toLocaleDateString()}` : "expired — awaiting renewal"}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${active ? "bg-[oklch(0.9_0.08_150)] text-[oklch(0.45_0.12_150)]" : "bg-black/10 opacity-60"}`}>
                    {active ? "Live" : "Off"}
                  </span>
                  <button
                    aria-label="Delete slide"
                    onClick={async () => { if (!confirm(`Delete "${s.title}"?`)) return; await deleteHeroSlide(s.id); refresh(); }}
                    className="grid size-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
