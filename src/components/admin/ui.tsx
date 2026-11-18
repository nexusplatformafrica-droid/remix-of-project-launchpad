import type { ReactNode } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

/** Soft admin surface: pastel glass panels on a warm gradient. */
export const SOFT_BG =
  "bg-[linear-gradient(160deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_45%,oklch(0.98_0.03_80))] text-[oklch(0.28_0.03_320)]";

export const softField =
  "h-11 w-full min-w-0 rounded-2xl bg-white/70 px-4 text-sm text-[oklch(0.28_0.03_320)] outline-none ring-1 ring-black/5 transition placeholder:opacity-50 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]";


export const goldBtn =
  "h-11 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] px-5 text-sm font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-50";

/** PayPal-gold action button (navy text), used on every money action. */
export const paypalBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-paypal-gold px-4 text-[13px] font-extrabold text-paypal-navy shadow-paypal transition hover:bg-paypal-gold-hover disabled:cursor-not-allowed disabled:opacity-50";

/** Small pill chip used for filters and quick toggles. */
export const chipBtn = (on: boolean) =>
  `rounded-full px-2.5 py-1 text-[11px] font-bold transition ${on ? "bg-paypal-navy text-paypal-foreground" : "bg-white/70 opacity-70 ring-1 ring-black/5 hover:opacity-100"}`;

export const ghostBtn =
  "h-11 rounded-full bg-white/70 px-5 text-sm font-semibold ring-1 ring-black/5 transition hover:bg-white disabled:opacity-50";

export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl bg-white/60 p-3.5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.6)] ring-1 ring-black/5 backdrop-blur sm:p-4 ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "gold",
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  tone?: "gold" | "rose" | "violet" | "mint" | "paypal" | "paypalSky" | "paypalMist" | "paypalGold";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    gold: "bg-gradient-to-br from-[oklch(0.96_0.06_90)] to-[oklch(0.9_0.1_70)]",
    rose: "bg-gradient-to-br from-[oklch(0.96_0.05_20)] to-[oklch(0.9_0.09_10)]",
    violet: "bg-gradient-to-br from-[oklch(0.96_0.04_310)] to-[oklch(0.9_0.09_300)]",
    mint: "bg-gradient-to-br from-[oklch(0.96_0.05_160)] to-[oklch(0.9_0.09_170)]",
    paypal: "bg-paypal-gradient shadow-paypal",
    paypalSky: "bg-paypal-sky text-paypal-foreground shadow-paypal",
    paypalMist: "bg-paypal-mist text-paypal-navy",
    paypalGold: "bg-paypal-gold text-paypal-navy shadow-paypal",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative overflow-hidden rounded-2xl ${tones[tone]} p-3 text-left shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/50 transition ${
        onClick ? "hover:-translate-y-0.5 hover:brightness-[1.03]" : ""
      }`}
    >
      <span className="absolute -right-6 -top-6 size-20 rounded-full bg-white/30 blur-xl" />
      <div className="relative flex items-start justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
        {icon && <span className="grid size-7 place-items-center rounded-xl bg-white/25">{icon}</span>}
      </div>
      <p className="relative mt-2 truncate text-[21px] font-black leading-none">{value}</p>
      {sub && <p className="relative mt-1 truncate text-[10.5px] opacity-75">{sub}</p>}
    </button>
  );
}

export function SoftArea({
  data,
  color = "oklch(0.72 0.15 40)",
  height = 220,
  prefix = "",
}: {
  data: { day: string; value: number }[];
  color?: string;
  height?: number;
  prefix?: string;
}) {
  const id = `g-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.07)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "rgba(0,0,0,0.45)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(0,0,0,0.45)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: "none",
              boxShadow: "0 12px 30px -18px rgba(0,0,0,0.6)",
              fontSize: 12,
            }}
            formatter={(v) => [`${prefix}${Number(v).toLocaleString()}`, ""]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "on" | "off" | "warn"; children: ReactNode }) {
  const map = {
    on: "bg-[oklch(0.92_0.09_160)] text-[oklch(0.35_0.09_160)]",
    off: "bg-black/8 opacity-70",
    warn: "bg-[oklch(0.94_0.09_80)] text-[oklch(0.4_0.1_60)]",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${map[tone]}`}>{children}</span>
  );
}

/** Compact horizontal bar list for breakdowns (label · bar · value). */
export function BarList({
  rows,
  format = (n) => n.toLocaleString(),
  empty = "No data yet.",
}: {
  rows: { label: string; value: number; share: number }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="shrink-0 tabular-nums opacity-75">
              {format(r.value)} · {r.share}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-paypal-blue" style={{ width: `${Math.max(3, r.share)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny label/value cell for dense "today" strips. */
export function MiniStat({ label, value, onClick }: { label: string; value: ReactNode; onClick?: (() => void) | undefined }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="min-w-0 rounded-xl bg-white/65 px-3 py-2 text-left ring-1 ring-black/5 transition enabled:hover:bg-white"
    >
      <span className="block truncate text-[10px] font-semibold uppercase tracking-wide opacity-60">{label}</span>
      <span className="mt-0.5 block truncate text-[15px] font-black leading-tight">{value}</span>
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[12.5px] opacity-55">{children}</p>;
}
