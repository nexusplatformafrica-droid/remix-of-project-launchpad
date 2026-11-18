import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import homeIconSrc from "@/assets/home.svg";
import moviesIconSrc from "@/assets/movies.svg";
import seriesIconSrc from "@/assets/series.svg";
import animationIconSrc from "@/assets/animation.svg";
import tvIconSrc from "@/assets/tv.svg";
import musicIconSrc from "@/assets/music.svg";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { listAllEpisodes, listLuoTitles, type LuoLanguage } from "@/lib/luo";

/** Classic flat bottom bar (7 tabs) matching the desktop sidebar's dark style and bundled icons. Mobile only. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const queryClient = useQueryClient();

  const warm = (language: LuoLanguage) => () => {
    void queryClient.prefetchQuery({ queryKey: ["luo-titles", language], queryFn: () => listLuoTitles(language), staleTime: 30_000 });
    void queryClient.prefetchQuery({ queryKey: ["luo-all-episodes"], queryFn: listAllEpisodes, staleTime: 60_000 });
  };

  const item = (active: boolean) =>
    `relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium leading-none transition-colors ${
      active ? "text-sidebar-foreground" : "text-sidebar-foreground/60"
    }`;

  const Body = ({ icon, label, active }: { icon: ReactNode; label: string; active: boolean }) => (
    <>
      {active && <span className="absolute inset-x-2 top-0 h-[2px] rounded-b-full bg-sidebar-primary" />}
      <span className="relative">{icon}</span>
      <span className="relative">{label}</span>
    </>
  );

  const imgIcon = (src: string, active: boolean, cls = "size-6") => (
    <img src={src} alt="" className={`${cls} shrink-0 object-contain brightness-0 invert ${active ? "opacity-100" : "opacity-65"}`} />
  );

  const openProfile = () => {
    if (!user) return setAuthOpen(true);
    document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <nav className="pointer-events-auto flex h-14 w-full items-center justify-between rounded-t-xl border-t border-sidebar-border bg-card px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_oklch(0_0_0/0.4)]">
        <Link to="/" className={item(pathname === "/")}>
          <Body icon={imgIcon(homeIconSrc, pathname === "/")} label="Home" active={pathname === "/"} />
        </Link>
        <Link to="/category/$slug" params={{ slug: "movies" }} className={item(pathname.startsWith("/category"))}>
          <Body icon={imgIcon(moviesIconSrc, pathname.startsWith("/category"))} label="Eng" active={pathname.startsWith("/category")} />
        </Link>
        <Link to="/luo" data-tour="luo-tab" onTouchStart={warm("luo")} className={item(pathname.startsWith("/luo"))}>
          <Body icon={imgIcon(tvIconSrc, pathname.startsWith("/luo"))} label="Luo" active={pathname.startsWith("/luo")} />
        </Link>
        <Link to="/luganda" onTouchStart={warm("luganda")} className={item(pathname.startsWith("/luganda"))}>
          <Body icon={imgIcon(seriesIconSrc, pathname.startsWith("/luganda"))} label="Luganda" active={pathname.startsWith("/luganda")} />
        </Link>
        <Link to="/teso" onTouchStart={warm("teso")} className={item(pathname.startsWith("/teso"))}>
          <Body icon={imgIcon(animationIconSrc, pathname.startsWith("/teso"))} label="Teso" active={pathname.startsWith("/teso")} />
        </Link>
        <Link to="/music" className={item(pathname.startsWith("/music"))}>
          <Body icon={imgIcon(musicIconSrc, pathname.startsWith("/music"))} label="Music" active={pathname.startsWith("/music")} />
        </Link>
        {user ? (
          <Link to="/profile" className={item(pathname.startsWith("/profile"))}>
            <Body icon={<User className="size-6 shrink-0 text-sidebar-foreground opacity-100" />} label="Profile" active={pathname.startsWith("/profile")} />
          </Link>
        ) : (
          <button type="button" onClick={openProfile} className={item(false)}>
            <Body icon={<User className="size-6 shrink-0 text-sidebar-foreground opacity-65" />} label="Profile" active={false} />
          </button>
        )}
      </nav>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
