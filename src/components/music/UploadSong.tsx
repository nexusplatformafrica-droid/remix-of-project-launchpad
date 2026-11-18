import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTrack, uploadArtistFile, type Artist } from "@/lib/music";
import { withinUploadLimit } from "@/lib/music-rules";

const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary";

export function UploadSong({ open, onOpenChange, artist }: { open: boolean; onOpenChange: (v: boolean) => void; artist: Artist }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);

  const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !withinUploadLimit(f.size)) { toast.error("Each file must be 300 MB or smaller"); e.target.value = ""; return; }
    setter(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !audio) return void toast.error("Add a song title and the music file");
    try {
      setPct(0);
      const cover_url = cover ? await uploadArtistFile(cover) : "";
      const audio_url = await uploadArtistFile(audio, setPct);
      await addTrack(artist, { title: title.trim(), genre: genre.trim(), cover_url, audio_url });
      toast.success("Your song is live");
      void qc.invalidateQueries({ queryKey: ["music-tracks"] });
      setTitle(""); setGenre(""); setAudio(null); setCover(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPct(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => pct === null && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Upload your music</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Song title *</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Genre</span><input className={field} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat, Gospel…" /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Music file (audio or video, max 300 MB) *</span><input type="file" accept="audio/*,video/*" onChange={pick(setAudio)} className={field} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Cover picture</span><input type="file" accept="image/*" onChange={pick(setCover)} className={field} /></label>
          {pct !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          )}
          <button disabled={pct !== null} className="rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">
            {pct !== null ? `Uploading ${pct}%` : "Publish song"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
