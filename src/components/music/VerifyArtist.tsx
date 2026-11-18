import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2 } from "lucide-react";
import { MomoPayButton, momoFailState, type MomoState } from "@/components/auth/MomoPayButton";
import { payArtistVerification, type Artist } from "@/lib/music";
import { VERIFY_UGX } from "@/lib/music-rules";
import { countryFromPhone, COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";

const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary";

/** Pay UGX 5,000 on mobile money; the badge is granted only once the money is confirmed. */
export function VerifyArtist({ artist, onDone }: { artist: Artist; onDone: () => void }) {
  const [phone, setPhone] = useState(artist.whatsapp ?? "");
  const [state, setState] = useState<MomoState>("idle");
  const detected = countryFromPhone(phone.replace(/[^0-9]/g, "")) ?? DEFAULT_COUNTRY;
  const networkName = COUNTRIES.find((c) => c.code === detected.code)?.providers?.[0] ?? null;

  if (artist.verified)
    return (
      <section className="flex items-center gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
        <BadgeCheck className="size-6 fill-primary text-primary-foreground" />
        <p className="text-sm font-bold">Your account is verified</p>
      </section>
    );

  const pay = async () => {
    if (!phone.trim()) return void toast.error("Enter your mobile money number");
    setState("waiting");
    try {
      await payArtistVerification(artist, phone.trim());
      setState("success");
      toast.success("You are now a verified artist");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setState(momoFailState(msg));
      toast.error(msg);
    }
  };

  return (
    <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5">
      <h3 className="flex items-center gap-2 font-black"><BadgeCheck className="size-5 text-primary" /> Get verified — UGX {VERIFY_UGX.toLocaleString()}</h3>
      <p className="text-sm text-muted-foreground">Pay once and the verified badge shows next to your name everywhere fans see you.</p>
      <input className={field} inputMode="tel" placeholder="Mobile money number 07…" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <MomoPayButton name={networkName} logo="" checking={false} state={state} onClick={pay} />
      {state === "waiting" && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Approve the prompt on your phone…</p>}
    </section>
  );
}
