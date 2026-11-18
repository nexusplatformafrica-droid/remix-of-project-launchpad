import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Crown, LogIn, LogOut, Monitor, Shield, Share2, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { AuthModal } from "@/components/auth/AuthModal";
import { fdb } from "@/lib/fdb";
import { fullDate, money } from "@/lib/admin";
import { referralLink, syncReferrals } from "@/lib/referrals";
import { listDevices } from "@/lib/devices";
import { getArtist } from "@/lib/music";
import { ArtistProfile } from "@/components/music/ArtistProfile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — LuoFilm" },
      { name: "description", content: "Manage your LuoFilm account, subscription, devices and referrals." },
      { property: "og:title", content: "My Profile — LuoFilm" },
      { property: "og:description", content: "Manage your LuoFilm account, subscription, devices and referrals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

const card = "rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5";

function ProfilePage() {
  const { user, profile, isAdmin, loading, signOut, refresh } = useAuth();
  const { subscribed, deviceLimit, openSubscribe } = useSubscription();
  const qc = useQueryClient();
  const [authOpen, setAuthOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(String(profile?.["display_name"] ?? profile?.["name"] ?? ""));
    setPhone(String(profile?.["phone"] ?? ""));
  }, [profile]);

  const { data: staff } = useQuery({
    queryKey: ["my-staff-role", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await fdb.from("user_roles").select("*").eq("user_id", user!.id).maybeSingle();
      return ["staff", "editor", "admin"].includes(String(data?.role ?? ""));
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["my-subs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await fdb.from("luo_subscriptions").select("*").eq("user_id", user!.id);
      return [...(data ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },
  });

  const { data: refs } = useQuery({
    queryKey: ["my-referrals", user?.id],
    enabled: !!user,
    queryFn: () => syncReferrals(user!.id),
  });

  const { data: artist } = useQuery({
    queryKey: ["artist", user?.id],
    enabled: !!user,
    queryFn: () => getArtist(user!.id),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["my-devices", user?.id],
    enabled: !!user,
    queryFn: () => listDevices(user!.id).catch(() => []),
  });

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">Loading…</div>;

  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <UserIcon className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-black">Your profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to see your account, subscription and devices.</p>
        <button onClick={() => setAuthOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">
          <LogIn className="size-4" /> Sign in
        </button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );

  const live = subs.find(
    (s) => String(s["status"] ?? "").toLowerCase() === "active" && (!s["expires_at"] || new Date(String(s["expires_at"])) > new Date()),
  );
  const showAdmin = isAdmin || !!staff;
  const link = referralLink(user.id);
  const displayName = name || user.email?.split("@")[0] || "Viewer";

  const save = async () => {
    setSaving(true);
    try {
      await fdb.from("profiles").update({ name, display_name: name, phone }).eq("id", user.id);
      toast.success("Profile saved");
      refresh();
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch {
      toast.error("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-28 pt-20 sm:px-6 lg:pb-12">
      <section className={`${card} grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4`}>
        {profile?.["avatar_url"] ? (
          <img src={String(profile["avatar_url"])} alt="" className="size-16 shrink-0 rounded-full object-cover sm:size-20" />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground sm:size-20">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black sm:text-2xl">{displayName}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${subscribed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {subscribed ? "VIP member" : "Free account"}
            </span>
            {showAdmin && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">{isAdmin ? "Admin" : "Staff"}</span>}
          </div>
        </div>
      </section>

      {artist?.status === "active" && <ArtistProfile artist={artist} />}

      {showAdmin && (
        <Link to="/admin" className="flex items-center justify-between gap-3 rounded-2xl bg-primary p-4 font-bold text-primary-foreground shadow-lg">
          <span className="flex items-center gap-3"><Shield className="size-5" /> Open admin panel</span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-black"><Crown className="size-4" /> Subscription</h2>
        {live ? (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <Info label="Plan" value={String(live["plan_name"] ?? "VIP")} />
            <Info label="Expires" value={fullDate(live["expires_at"] as string)} />
            <Info label="Devices" value={String(deviceLimit)} />
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">You don't have an active plan.</p>
        )}
        <button onClick={openSubscribe} className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground sm:w-auto sm:px-6">
          {live ? "Extend plan" : "Subscribe now"}
        </button>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-black">Account details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-muted px-3 py-2.5 outline-none ring-1 ring-border focus:ring-primary" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="w-full rounded-xl bg-muted px-3 py-2.5 outline-none ring-1 ring-border focus:ring-primary" />
          </label>
        </div>
        <button disabled={saving} onClick={save} className="mt-3 w-full rounded-full bg-foreground py-2.5 text-sm font-bold text-background disabled:opacity-60 sm:w-auto sm:px-6">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </section>

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-black"><Share2 className="size-4" /> Invite friends</h2>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
          <Info label="Invited" value={String(refs?.total ?? 0)} />
          <Info label="Subscribed" value={String(refs?.subscribed ?? 0)} />
          <Info label="Days earned" value={String(refs?.daysEarned ?? 0)} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input readOnly value={link} className="min-w-0 truncate rounded-xl bg-muted px-3 py-2.5 text-sm ring-1 ring-border" />
          <button
            onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
            aria-label="Copy invite link"
          >
            <Copy className="size-4" />
          </button>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-black"><Monitor className="size-4" /> Devices ({devices.length})</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No devices recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {devices.map((d, i) => (
              <li key={String((d as Record<string, unknown>)["id"] ?? i)} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{String((d as Record<string, unknown>)["label"] ?? (d as Record<string, unknown>)["name"] ?? "Device")}</span>
                <span className="shrink-0 text-muted-foreground">{fullDate(String((d as Record<string, unknown>)["last_seen"] ?? "") || null)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {subs.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-black">Payment history</h2>
          <ul className="divide-y divide-border text-sm">
            {subs.slice(0, 10).map((s, i) => (
              <li key={String(s["id"] ?? i)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
                <span className="min-w-0 truncate">{String(s["plan_name"] ?? "Plan")} · <span className="text-muted-foreground">{fullDate(s["created_at"] as string)}</span></span>
                <span className="shrink-0 font-semibold">{money(Number(s["amount"] ?? 0), String(s["currency"] ?? "UGX"))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button onClick={() => void signOut()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-3 font-bold text-destructive ring-1 ring-border">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-bold">{value}</p>
    </div>
  );
}
