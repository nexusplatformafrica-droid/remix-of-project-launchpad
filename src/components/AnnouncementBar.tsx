import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Megaphone, X } from "lucide-react";
import { getAnnouncement } from "@/lib/announcement.functions";

const DISMISS_KEY = "mm_announcement_closed";

const STYLES = {
  info: "bg-paypal-blue text-paypal-foreground",
  promo: "bg-paypal-gold text-paypal-navy",
  warning: "bg-destructive text-destructive-foreground",
} as const;

/** Thin bar at the very top of the site with the admin's current message. */
export function AnnouncementBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const q = useQuery({ queryKey: ["site-announcement"], queryFn: () => getAnnouncement(), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const [closed, setClosed] = useState<string | null>("pending");
  useEffect(() => {
    try {
      setClosed(localStorage.getItem(DISMISS_KEY));
    } catch {
      setClosed(null);
    }
  }, []);

  const a = q.data;
  if (!a || closed === "pending" || closed === a.id || path.startsWith("/admin") || path.startsWith("/watch")) return null;

  const close = () => {
    setClosed(a.id);
    try {
      localStorage.setItem(DISMISS_KEY, a.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div role="status" className={`relative z-[60] flex items-center justify-center gap-2 px-9 py-1.5 text-center text-[12.5px] font-semibold ${STYLES[a.style]}`}>
      <Megaphone className="size-3.5 shrink-0" />
      <span className="min-w-0">{a.text}</span>
      {a.linkUrl &&
        (a.linkUrl.startsWith("/") ? (
          <Link to={a.linkUrl} className="shrink-0 rounded-full bg-background/90 px-2.5 py-0.5 text-[11.5px] font-bold text-foreground">
            {a.linkText}
          </Link>
        ) : (
          <a href={a.linkUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-background/90 px-2.5 py-0.5 text-[11.5px] font-bold text-foreground">
            {a.linkText}
          </a>
        ))}
      <button type="button" onClick={close} aria-label="Close announcement" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full opacity-80 hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
