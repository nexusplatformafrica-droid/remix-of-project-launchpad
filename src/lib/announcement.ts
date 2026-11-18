/** Site-wide announcement bar the admin publishes from the dashboard (app_settings/site_announcement). */
export type AnnouncementStyle = "info" | "promo" | "warning";
export type Announcement = {
  id: string;
  on: boolean;
  text: string;
  style: AnnouncementStyle;
  linkText?: string | undefined;
  linkUrl?: string | undefined;
  /** ISO date; the bar disappears by itself after this moment. */
  until?: string | null;
};

export const ANNOUNCEMENT_KEY = "site_announcement";

/** The announcement to show right now, or null when off, empty or expired. */
export function liveAnnouncement(a: Partial<Announcement> | null | undefined, now = Date.now()): Announcement | null {
  if (!a || !a.on || !a.id || !String(a.text ?? "").trim()) return null;
  if (a.until && new Date(a.until).getTime() <= now) return null;
  const style: AnnouncementStyle = a.style === "promo" || a.style === "warning" ? a.style : "info";
  const linkUrl = typeof a.linkUrl === "string" && /^(https:\/\/|\/)/.test(a.linkUrl.trim()) ? a.linkUrl.trim() : undefined;
  return {
    id: a.id,
    on: true,
    text: String(a.text).trim().slice(0, 220),
    style,
    linkText: linkUrl ? String(a.linkText ?? "").trim().slice(0, 30) || "Open" : undefined,
    linkUrl,
    until: a.until ?? null,
  };
}
