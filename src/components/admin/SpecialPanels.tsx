import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Target, Radio, LifeBuoy } from "lucide-react";
import { getSetting, money, saveSetting, timeAgo } from "@/lib/admin";
import { goalProgress, paymentProblems, type TxLike } from "@/lib/admin-insights";
import { Empty, Panel, paypalBtn, softField } from "./ui";

type Profile = { id: string; display_name?: string | null; email?: string | null; phone?: string | null; msisdn?: string | null; last_seen?: string | null };

const nameOf = (p?: Profile) => p?.display_name ?? p?.email ?? p?.phone ?? "Unknown user";
const phoneOf = (p?: Profile) => (p?.phone ?? p?.msisdn ?? "").replace(/\D/g, "");

function WaButton({ phone, text }: { phone: string; text: string }) {
  if (!phone) return null;
  return (
    <a
      href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Message on WhatsApp"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground"
    >
      <MessageCircle className="size-3.5" />
    </a>
  );
}

/** Monthly revenue target saved in app settings, with progress and the daily pace still needed. */
export function RevenueGoal({ tx }: { tx: TxLike[] }) {
  const qc = useQueryClient();
  const goalQ = useQuery({ queryKey: ["revenue-goal"], queryFn: () => getSetting<{ amount: number }>("revenue_goal", { amount: 0 }) });
  const [edit, setEdit] = useState<string | null>(null);
  const goal = Number(goalQ.data?.amount) || 0;
  const g = goalProgress(tx, goal);
  const save = useMutation({
    mutationFn: async () => {
      const n = Math.round(Number(edit));
      if (!n || n <= 0) throw new Error("Enter a goal amount in UGX");
      await saveSetting("revenue_goal", { amount: n });
    },
    onSuccess: () => {
      toast.success("Monthly goal saved");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["revenue-goal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const month = new Date().toLocaleDateString(undefined, { month: "long" });

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Target className="size-4 text-paypal-blue" /> {month} revenue goal
        </span>
      }
      action={
        edit == null ? (
          <button type="button" onClick={() => setEdit(goal ? String(goal) : "")} className="rounded-full bg-paypal-mist px-2.5 py-1 text-[11px] font-bold text-paypal-navy ring-1 ring-black/5">
            {goal ? "Change goal" : "Set goal"}
          </button>
        ) : null
      }
    >
      {edit != null ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <input className={`${softField} h-10`} inputMode="numeric" placeholder="Goal in UGX, e.g. 2000000" value={edit} onChange={(e) => setEdit(e.target.value)} />
          <button type="submit" disabled={save.isPending} className={paypalBtn}>
            Save
          </button>
        </form>
      ) : goal ? (
        <div>
          <div className="flex items-end justify-between gap-2">
            <span className="text-[20px] font-black leading-none">{money(g.earned)}</span>
            <span className="text-[12px] opacity-70">of {money(goal)} · {g.percent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-paypal-gradient" style={{ width: `${Math.max(2, g.percent)}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] opacity-70">
            {g.percent >= 100 ? "Goal reached — well done!" : `${money(g.perDayNeeded)} a day needed · ${g.daysLeft} days left`}
          </p>
        </div>
      ) : (
        <Empty>Set a monthly target to track progress every day.</Empty>
      )}
    </Panel>
  );
}

/** People active on the site in the last 5 minutes. */
export function OnlineNow({ profiles }: { profiles: Profile[] }) {
  const now = Date.now();
  const online = profiles.filter((p) => p.last_seen && now - new Date(p.last_seen).getTime() < 5 * 60_000);
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Radio className="size-4 text-paypal-blue" /> Online now
        </span>
      }
      action={<span className="text-[11px] opacity-60">{online.length} in the last 5 min</span>}
    >
      {online.length === 0 ? (
        <Empty>Nobody is online right now.</Empty>
      ) : (
        <ul className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
          {online.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2.5 py-1.5 text-[12.5px]">
              <span className="size-2 shrink-0 rounded-full bg-whatsapp" />
              <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(p)}</span>
              <span className="shrink-0 text-[11px] opacity-60">{timeAgo(p.last_seen)}</span>
              <WaButton phone={phoneOf(p)} text={`Hi ${nameOf(p)}, thanks for watching MOVIE MAX! Need any help?`} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** People who tried to pay several times this week without success — reach out and help them finish. */
export function PaymentProblems({ tx, profiles }: { tx: TxLike[]; profiles: Profile[] }) {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const list = paymentProblems(tx, 7, 2);
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <LifeBuoy className="size-4 text-paypal-blue" /> Stuck payments · help them pay
        </span>
      }
      action={<span className="text-[11px] opacity-60">2+ tries, no success · 7 days</span>}
    >
      {list.length === 0 ? (
        <Empty>Nobody is stuck paying this week.</Empty>
      ) : (
        <ul className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
          {list.map((x) => {
            const p = byId.get(x.user_id);
            return (
              <li key={x.user_id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2.5 py-1.5 text-[12.5px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{nameOf(p)}</span>
                  <span className="block truncate text-[11px] opacity-65">
                    {x.attempts} tries · last {timeAgo(x.last)}
                  </span>
                </span>
                <WaButton phone={phoneOf(p)} text={`Hi ${nameOf(p)}, we saw your MOVIE MAX payment didn't go through. Can we help you finish it? Reply here.`} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
