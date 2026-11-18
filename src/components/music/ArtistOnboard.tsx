import { useState } from "react";
import { toast } from "sonner";
import { Mic2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { registerArtist } from "@/lib/music";

const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary";
const COUNTRIES = ["Uganda", "Kenya", "Tanzania", "Rwanda", "South Sudan", "DR Congo", "Burundi", "Nigeria", "Ghana", "South Africa", "Other"];

/** Floating onboarding shown before a user can upload music. */
export function ArtistOnboard({ open, onOpenChange, userId, email, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; userId: string; email?: string | null; onDone: () => void;
}) {
  const [f, setF] = useState({ stage_name: "", management: "", country: "Uganda", email: email ?? "", whatsapp: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.stage_name.trim()) return void toast.error("Enter your stage name");
    if (!f.email.trim() && !f.whatsapp.trim()) return void toast.error("Add an email or WhatsApp number");
    setBusy(true);
    try {
      await registerArtist(userId, { ...f, stage_name: f.stage_name.trim() });
      toast.success("Welcome! You're now an artist on MOVIE MAX");
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Mic2 className="size-6" /></div>
          <DialogTitle className="text-center">Become an artist</DialogTitle>
          <DialogDescription className="text-center">Upload your music and earn UGX 1 for every different listener.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Stage name *</span><input className={field} value={f.stage_name} onChange={set("stage_name")} maxLength={60} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Crew or management</span><input className={field} value={f.management} onChange={set("management")} maxLength={80} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Country</span>
            <select className={field} value={f.country} onChange={set("country")}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Email</span><input type="email" className={field} value={f.email} onChange={set("email")} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">WhatsApp</span><input inputMode="tel" className={field} value={f.whatsapp} onChange={set("whatsapp")} placeholder="07XX XXX XXX" /></label>
          <button disabled={busy} className="mt-1 rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Register as artist"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
