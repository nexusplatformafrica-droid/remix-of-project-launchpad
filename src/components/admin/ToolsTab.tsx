import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Megaphone, NotebookPen, TrendingUp, Trash2 } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { getSetting, logActivity, money, saveSetting, shortDate, timeAgo } from "@/lib/admin";
import { renewalForecast } from "@/lib/admin-insights";
import { ANNOUNCEMENT_KEY, liveAnnouncement, type Announcement, type AnnouncementStyle } from "@/lib/announcement";
import { loadOverview } from "./Overview";
import { Empty, Panel, Stat, chipBtn, ghostBtn, paypalBtn, softField } from "./ui";

const title = (Icon: typeof Gift, text: string) => (
  <span className="flex items-center gap-1.5">
    <Icon className="size-4 text-paypal-blue" /> {text}
  </span>
);

/** Special tools: site announcement, free days for every member, renewal forecast, team notes. */
export function ToolsTab() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: loadOverview, staleTime: 60_000 });
  const subs = (q.data?.subs ?? []) as Parameters<typeof renewalForecast>[0];
  const f = renewalForecast(subs, 30);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label="Renewals due · 30 days" value={q.isLoading ? "…" : f.due.toLocaleString()} tone="paypal" sub={money(f.dueAmount)} icon={<TrendingUp className="size-4" />} />
        <Stat label="People who renew" value={q.isLoading ? "…" : `${Math.round(f.rate * 100)}%`} tone="paypalSky" sub="renewed within 90 days" icon={<TrendingUp className="size-4" />} />
        <Stat label="Expected renewals" value={q.isLoading ? "…" : money(f.expected)} tone="paypalGold" sub="next 30 days forecast" icon={<TrendingUp className="size-4" />} />
        <Stat label="Active members" value={q.isLoading ? "…" : subs.filter((s) => String(s.status).toLowerCase() === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())).length.toLocaleString()} tone="paypalMist" sub="can receive free days" icon={<Gift className="size-4" />} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <AnnouncementEditor />
        <GiftDays subs={subs as never} />
      </div>
      <TeamNotes />
    </div>
  );
}

const STYLE_LABEL: Record<AnnouncementStyle, string> = { info: "Info (blue)", promo: "Offer (gold)", warning: "Alert (red)" };

function AnnouncementEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-announcement"], queryFn: () => getSetting<Partial<Announcement> | null>(ANNOUNCEMENT_KEY, null) });
  const [form, setForm] = useState({ text: "", style: "info" as AnnouncementStyle, linkText: "", linkUrl: "", days: "" });
  useEffect(() => {
    if (q.data) setForm({ text: q.data.text ?? "", style: (q.data.style as AnnouncementStyle) ?? "info", linkText: q.data.linkText ?? "", linkUrl: q.data.linkUrl ?? "", days: "" });
  }, [q.data]);
  const live = liveAnnouncement(q.data ?? null);

  const save = useMutation({
    mutationFn: async (on: boolean) => {
      if (on && !form.text.trim()) throw new Error("Write the message first");
      if (form.linkUrl.trim() && !/^(https:\/\/|\/)/.test(form.linkUrl.trim())) throw new Error("Link must start with https:// or /");
      const days = Number(form.days);
      const value: Announcement = {
        // A new id makes the bar re-appear for people who closed the old one.
        id: on ? crypto.randomUUID() : (q.data?.id ?? crypto.randomUUID()),
        on,
        text: form.text.trim(),
        style: form.style,
        linkText: form.linkText.trim(),
        linkUrl: form.linkUrl.trim(),
        until: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      };
      await saveSetting(ANNOUNCEMENT_KEY, value);
      await logActivity(on ? "announcement_published" : "announcement_removed", value.text);
      return on;
    },
    onSuccess: (on) => {
      toast.success(on ? "Announcement is live (visitors see it within a few minutes)" : "Announcement removed");
      void qc.invalidateQueries({ queryKey: ["admin-announcement"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title={title(Megaphone, "Announcement bar")} action={<span className={`text-[11px] font-bold ${live ? "text-paypal-blue" : "opacity-60"}`}>{live ? `Live${live.until ? ` until ${shortDate(live.until)}` : ""}` : "Off"}</span>}>
      <div className="space-y-2">
        <textarea className={`${softField} h-auto min-h-[64px] py-2`} maxLength={220} placeholder="e.g. 🎉 New Luganda movies every day — subscribe for UGX 2,000" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STYLE_LABEL) as AnnouncementStyle[]).map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, style: s })} className={chipBtn(form.style === s)}>
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={`${softField} h-10`} placeholder="Button text (optional)" value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} />
          <input className={`${softField} h-10`} placeholder="Button link, e.g. /luganda" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
        </div>
        <input className={`${softField} h-10`} inputMode="numeric" placeholder="Show for how many days? (empty = until removed)" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" disabled={save.isPending} onClick={() => save.mutate(true)} className={`${paypalBtn} flex-1`}>
            {live ? "Update & show" : "Publish to everyone"}
          </button>
          {live && (
            <button type="button" disabled={save.isPending} onClick={() => save.mutate(false)} className={`${ghostBtn} h-11`}>
              Remove
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

type Sub = { id: string; status: string; expires_at: string | null };

function GiftDays({ subs }: { subs: Sub[] }) {
  const qc = useQueryClient();
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const active = subs.filter((s) => String(s.status).toLowerCase() === "active" && s.expires_at && new Date(s.expires_at).getTime() > Date.now());

  const gift = useMutation({
    mutationFn: async () => {
      const n = Number(days);
      if (!n || n <= 0 || n > 60) throw new Error("Choose between 1 and 60 days");
      let done = 0;
      for (const s of active) {
        const expires = new Date(new Date(s.expires_at!).getTime() + n * 86_400_000).toISOString();
        const { error } = await supabase.from("luo_subscriptions").update({ expires_at: expires }).eq("id", s.id);
        if (!error) done++;
      }
      await logActivity("members_gifted_days", `${n} days · ${done} members`, { reason: reason.trim() || null });
      return { n, done };
    },
    onSuccess: ({ n, done }) => {
      toast.success(`Added ${n} free day${n === 1 ? "" : "s"} to ${done} member${done === 1 ? "" : "s"}`);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title={title(Gift, "Free days for all members")} action={<span className="text-[11px] opacity-60">{active.length} active</span>}>
      <p className="mb-2 text-[12px] opacity-70">Say sorry after downtime or celebrate a holiday: every active member gets extra days added to their membership.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {["1", "3", "7", "14", "30"].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)} className={chipBtn(days === d)}>
            +{d} day{d === "1" ? "" : "s"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <input className={`${softField} h-10`} inputMode="numeric" placeholder="Days" value={days} onChange={(e) => setDays(e.target.value)} />
        <input className={`${softField} h-10`} placeholder="Reason (for your records, optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button
          type="button"
          disabled={gift.isPending || active.length === 0}
          onClick={() => {
            if (confirm(`Add ${days} free day(s) to all ${active.length} active members?`)) gift.mutate();
          }}
          className={`${paypalBtn} w-full`}
        >
          <Gift className="size-4" /> {gift.isPending ? "Adding days…" : `Give ${days || 0} day(s) to ${active.length} members`}
        </button>
      </div>
    </Panel>
  );
}

type Note = { id: string; text: string; done: boolean; at: string };

function TeamNotes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-notes"], queryFn: () => getSetting<Note[]>("admin_notes", []) });
  const [text, setText] = useState("");
  const notes = Array.isArray(q.data) ? q.data : [];
  const save = useMutation({
    mutationFn: (next: Note[]) => saveSetting("admin_notes", next.slice(0, 100)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title={title(NotebookPen, "Team notes & to-do")} action={<span className="text-[11px] opacity-60">{notes.filter((n) => !n.done).length} open</span>}>
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          save.mutate([{ id: crypto.randomUUID(), text: text.trim().slice(0, 300), done: false, at: new Date().toISOString() }, ...notes]);
          setText("");
        }}
      >
        <input className={`${softField} h-10`} placeholder="Add a note or task, e.g. Upload new VJ Junior movies" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={save.isPending} className={paypalBtn}>
          Add
        </button>
      </form>
      {notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul className="grid gap-1.5 md:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2.5 py-1.5 text-[12.5px]">
              <input type="checkbox" checked={n.done} aria-label="Done" className="size-4 accent-[var(--paypal-blue)]" onChange={() => save.mutate(notes.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)))} />
              <span className={`min-w-0 flex-1 ${n.done ? "line-through opacity-50" : "font-semibold"}`}>{n.text}</span>
              <span className="shrink-0 text-[10.5px] opacity-50">{timeAgo(n.at)}</span>
              <button type="button" aria-label="Delete note" onClick={() => save.mutate(notes.filter((x) => x.id !== n.id))} className="shrink-0 opacity-50 hover:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
