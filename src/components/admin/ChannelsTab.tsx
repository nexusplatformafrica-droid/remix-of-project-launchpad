import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { deleteChannel, listChannels, saveChannel } from "@/lib/music";
import { withinUploadLimit } from "@/lib/music-rules";
import { Empty, Panel, goldBtn, softField } from "./ui";

/** Admin: add TV channels. Logos/videos go to the upload backend (max 300 MB each). */
export function ChannelsTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["tv-channels"], queryFn: listChannels });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [stream, setStream] = useState("");
  const [drmKey, setDrmKey] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);

  const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !withinUploadLimit(f.size)) { toast.error("Each upload must be 300 MB or smaller"); e.target.value = ""; return; }
    setter(f);
  };

  const save = async () => {
    if (!name.trim()) return void toast.error("Enter the channel name");
    if (!stream.trim() && !video) return void toast.error("Add a live stream link or upload a video");
    try {
      setPct(0);
      const logo_url = logo ? await uploadFile("channels", logo) : "";
      const stream_url = video ? await uploadFile("channels", video, (p) => setPct(p.percent)) : stream.trim() + (drmKey.trim() ? `#clearkey=${drmKey.trim().replace(/\s+/g, "")}` : "");
      await saveChannel({ name: name.trim(), category: category.trim(), logo_url: logo_url ?? "", stream_url });
      toast.success("Channel added");
      setName(""); setCategory(""); setStream(""); setDrmKey(""); setLogo(null); setVideo(null);
      void qc.invalidateQueries({ queryKey: ["tv-channels"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add channel");
    } finally {
      setPct(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Add TV channel">
        <div className="grid gap-3">
          <input className={softField} placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={softField} placeholder="Group (e.g. News, Sports)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className={softField} placeholder="Live stream link (.m3u8, .ts, .mpd or .mp4)" value={stream} onChange={(e) => setStream(e.target.value)} />
          <input className={softField} placeholder="Protected .mpd key, if any (KID:KEY)" value={drmKey} onChange={(e) => setDrmKey(e.target.value)} />
          <label className="text-[12px] opacity-70">Or upload a video (max 300 MB)<input type="file" accept="video/*" onChange={pick(setVideo)} className={softField} /></label>
          <label className="text-[12px] opacity-70">Channel picture (max 300 MB)<input type="file" accept="image/*" onChange={pick(setLogo)} className={softField} /></label>
          <button type="button" disabled={pct !== null} onClick={save} className={goldBtn}>{pct !== null ? `Uploading ${pct}%` : "Add channel"}</button>
        </div>
      </Panel>
      <Panel title={`Channels (${data.length})`}>
        {data.length === 0 ? <Empty>No channels yet.</Empty> : (
          <ul className="grid gap-2">
            {data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white/60 p-2 ring-1 ring-black/5">
                {c.logo_url ? <img src={c.logo_url} alt="" className="h-10 w-16 rounded object-cover" /> : <div className="h-10 w-16 rounded bg-black/10" />}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.name}</span>
                <button type="button" aria-label="Delete" onClick={async () => { await deleteChannel(c.id); void qc.invalidateQueries({ queryKey: ["tv-channels"] }); }} className="grid size-8 place-items-center rounded-full hover:bg-black/5"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
