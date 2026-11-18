import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Ban, ChevronDown, CircleCheck, Music2, Sparkles, Trash2 } from "lucide-react";
import { adminFeatureTrack, deleteArtist, listArtists, listTracks, setArtistStatus, setArtistVerified, type Artist, type Track } from "@/lib/music";
import { TrackCover } from "@/components/music/TrackCover";
import { Panel } from "./ui";

/** Manage artists: block/unblock, delete with all their content, feature their songs on the music hero. */
export function ArtistsTab() {
  const qc = useQueryClient();
  const artists = useQuery({ queryKey: ["admin-artists"], queryFn: listArtists });
  const tracks = useQuery({ queryKey: ["music-tracks"], queryFn: listTracks });
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-artists"] });
    void qc.invalidateQueries({ queryKey: ["music-tracks"] });
    void qc.invalidateQueries({ queryKey: ["music-hero-active"] });
    void qc.invalidateQueries({ queryKey: ["music-hero-slides"] });
  };

  const run = async (key: string, job: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await job();
      toast.success(done);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleBlock = (a: Artist) =>
    run(`block-${a.id}`, () => setArtistStatus(a.id, a.status === "blocked" ? "active" : "blocked"),
      a.status === "blocked" ? `${a.stage_name} is active again` : `${a.stage_name} is blocked — their music is hidden`);

  const toggleVerify = (a: Artist) =>
    run(`ver-${a.id}`, () => setArtistVerified(a.id, !a.verified), a.verified ? `${a.stage_name} is no longer verified` : `${a.stage_name} is verified`);

  const remove = (a: Artist) => {
    if (!confirm(`Delete ${a.stage_name} and ALL their songs, listens and hero slides? This cannot be undone.`)) return;
    void run(`del-${a.id}`, () => deleteArtist(a.id), `${a.stage_name} deleted with all their content`);
  };

  const feature = (t: Track) =>
    run(`feat-${t.id}`, () => adminFeatureTrack(t), `"${t.title}" is now on the music hero`);

  const rows = artists.data ?? [];
  const allTracks = tracks.data ?? [];

  return (
    <Panel>
      <h3 className="mb-3 text-[15px] font-black">Artists ({rows.length})</h3>
      {artists.isLoading ? (
        <p className="text-[13px] opacity-60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] opacity-60">No artists registered yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((a) => {
            const mine = allTracks.filter((t) => t.artist_id === a.id);
            const blocked = a.status === "blocked";
            const open = openId === a.id;
            return (
              <li key={a.id} className="rounded-xl bg-white/60 ring-1 ring-black/5">
                <div className="flex items-center gap-3 p-2.5">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-black/10 text-sm font-black">{a.stage_name[0]?.toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{a.stage_name}</p>
                    <p className="truncate text-[11px] opacity-60">{[a.country, a.email || a.whatsapp, `${mine.length} song${mine.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${blocked ? "bg-red-100 text-red-700" : "bg-[oklch(0.9_0.08_150)] text-[oklch(0.45_0.12_150)]"}`}>
                    {blocked ? "Blocked" : "Active"}
                  </span>
                  <button
                    onClick={() => toggleBlock(a)}
                    disabled={busy === `block-${a.id}`}
                    className="grid size-8 place-items-center rounded-full bg-black/5 hover:bg-black/10 disabled:opacity-40"
                    title={blocked ? "Unblock artist" : "Block artist"}
                    aria-label={blocked ? "Unblock artist" : "Block artist"}
                  >
                    {blocked ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
                  </button>
                  <button
                    onClick={() => toggleVerify(a)}
                    disabled={busy === `ver-${a.id}`}
                    className={`grid size-8 place-items-center rounded-full disabled:opacity-40 ${a.verified ? "bg-primary text-primary-foreground" : "bg-black/5 hover:bg-black/10"}`}
                    title={a.verified ? "Remove verified badge" : "Mark as verified"}
                    aria-label={a.verified ? "Remove verified badge" : "Mark as verified"}
                  >
                    <BadgeCheck className="size-4" />
                  </button>
                  <button
                    onClick={() => remove(a)}
                    disabled={busy === `del-${a.id}`}
                    className="grid size-8 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                    title="Delete artist and all their content"
                    aria-label="Delete artist and all their content"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <button onClick={() => setOpenId(open ? null : a.id)} aria-label="Show songs" className="grid size-8 place-items-center rounded-full bg-black/5 hover:bg-black/10">
                    <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {open && (
                  <div className="border-t border-black/5 p-2.5">
                    {mine.length === 0 ? (
                      <p className="text-[12px] opacity-60">No songs uploaded.</p>
                    ) : (
                      <ul className="grid gap-1.5">
                        {mine.map((t) => (
                          <li key={t.id} className="flex items-center gap-2.5 rounded-lg bg-white/70 p-2 ring-1 ring-black/5">
                            <TrackCover track={t} className="h-9 w-14 rounded-md" />
                            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{t.title}</span>
                            <button
                              onClick={() => feature(t)}
                              disabled={busy === `feat-${t.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                            >
                              <Sparkles className="size-3" /> Feature on hero
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11px] opacity-60">
        <Music2 className="size-3" /> Blocking hides all of the artist's music from the music page and their public profile. Deleting removes everything permanently.
      </p>
    </Panel>
  );
}
