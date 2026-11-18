import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Crown, LogIn, LogOut, Shield, Tv, User as UserIcon } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { Icon3D } from "@/components/Icon3D";
import { useIsAdmin } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { db as supabase } from "@/lib/db";
import { fdb } from "@/lib/fdb";
import { listAllEpisodes, listLuoTitles, type LuoLanguage } from "@/lib/luo";
import logoSrc from "@/assets/moviemax-logo.png";
import { InstallAppButton } from "./InstallAppButton";
import { Button } from "@/components/ui/button";
const logoAsset = { url: logoSrc };

/** Floating glass pill nav: LUO · LUGANDA · SUBSCRIBE · LOGIN */
export function FloatNav({ onSearch }: { onSearch?: () => void } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const warm = (language: LuoLanguage) => () => {
    void queryClient.prefetchQuery({
      queryKey: ["luo-titles", language],
      queryFn: () => listLuoTitles(language),
      staleTime: 30 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["luo-all-episodes"],
      queryFn: listAllEpisodes,
      staleTime: 60 * 1000,
    });
  };
  const { isAdmin, user } = useIsAdmin();
  const { openSubscribe } = useSubscription();
  const [authOpen, setAuthOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const staffQ = useQuery({
    queryKey: ["my-staff-role", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await fdb.from("user_roles").select("*").eq("user_id", user.id).maybeSingle();
      return data?.role === "staff";
    },
  });
  const isStaff = !!staffQ.data;

  const pill = (active: boolean) =>
    `grid h-8 place-items-center rounded-full px-3.5 text-[12px] font-black uppercase tracking-wide transition ${
      active
        ? "bg-brand text-brand-foreground shadow-[0_4px_18px_-4px_var(--brand)]"
        : "text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
    }`;

  return (
    <>
      <div className="search-glow w-full min-w-0 max-w-full rounded-b-2xl p-[1.5px] sm:rounded-full lg:w-auto lg:shrink-0">
      <div className="flex min-w-0 items-center justify-between gap-1 max-[380px]:gap-0.5 rounded-b-2xl bg-background/85 px-1.5 max-[380px]:px-1 py-1.5 backdrop-blur-xl sm:gap-1 sm:rounded-full sm:px-1 sm:py-1 lg:justify-start">
        {/* Brand stays inside the floating navigation on every screen. */}
         <Link to="/" aria-label="MOVIE MAX home" className="flex size-10 max-[380px]:size-9 max-[340px]:size-8 min-w-0 shrink-0 items-center justify-center gap-1 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-1">
           <img src={logoAsset.url} alt="" className="size-8 shrink-0 object-contain" />
           <span className="brand-logo-text hidden whitespace-nowrap text-[12px] font-extrabold leading-none sm:inline sm:text-[15px]">
             MOVIE MAX
           </span>
        </Link>
        <Link
          to="/"
          className={`${pill(pathname === "/" || pathname.startsWith("/watch") || pathname.startsWith("/search"))} hidden lg:grid`}
        >
          Moviebox
        </Link>
        <Link
          to="/luo"
          data-tour="luo-tab"
          onMouseEnter={warm("luo")}
          onTouchStart={warm("luo")}
          className={`${pill(pathname.startsWith("/luo"))} hidden lg:grid`}
        >
          Luo
        </Link>
        <Link
          to="/luganda"
          onMouseEnter={warm("luganda")}
          onTouchStart={warm("luganda")}
          className={`${pill(pathname.startsWith("/luganda"))} hidden lg:grid`}
        >
          Luganda
        </Link>
        <Link
          to="/teso"
          className={`${pill(pathname.startsWith("/teso"))} hidden lg:grid`}
        >
          Teso
        </Link>
        {onSearch && (
          <Button variant="ghost"
            type="button"
            aria-label="Search"
            onClick={onSearch}
            className="grid size-10 max-[380px]:size-9 max-[340px]:size-8 shrink-0 place-items-center rounded-full bg-foreground/12 p-0 text-foreground transition hover:bg-foreground/25 sm:size-8 lg:hidden"
          >
            <Icon3D name="search" className="size-4" />
          </Button>
        )}
        <InstallAppButton />
        <Button
          type="button"
          onClick={openSubscribe}
          className="subscribe-original grid h-10 max-[380px]:h-9 max-[340px]:h-8 shrink-0 place-items-center rounded-full px-2 max-[380px]:px-1.5 max-[380px]:text-[10px] max-[340px]:px-1 max-[340px]:text-[9px] text-[11px] font-bold uppercase tracking-normal text-vip-foreground transition hover:brightness-105 sm:h-8 sm:px-3.5 sm:text-[12px]"
        >
          <span className="flex items-center gap-1">
            <Crown className="size-3.5" />
            <span>Subscribe</span>
          </span>
        </Button>

        <a
          href="https://livetv.luofilm.site/"
          target="_blank"
          rel="noopener"
          aria-label="Live TV"
          className="grid size-10 max-[380px]:size-9 max-[340px]:size-8 shrink-0 place-items-center rounded-full bg-livetv p-0 text-[12px] font-bold uppercase text-livetv-foreground transition hover:brightness-110 sm:h-8 sm:w-auto sm:px-3.5"
        >
          <span className="flex items-center gap-1">
            <Tv className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">Live TV</span>
          </span>
        </a>

        <Link
          to="/developer"
          aria-label="Developer dashboard"
          className={`grid size-10 max-[380px]:size-9 max-[340px]:size-8 shrink-0 place-items-center rounded-full bg-devnav p-0 text-[12px] font-bold uppercase text-devnav-foreground transition hover:brightness-110 sm:h-8 sm:w-auto sm:px-3.5 ${
            pathname.startsWith("/developer") || pathname.startsWith("/doc") ? "ring-2 ring-foreground/70" : ""
          }`}
        >
          <span className="flex items-center gap-1">
            <Code2 className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </span>
        </Link>

        {user ? (
          <div className="relative shrink-0">
            <Button variant="ghost"
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Account"
              className="grid size-10 max-[380px]:size-9 max-[340px]:size-8 place-items-center rounded-full bg-foreground/15 p-0 text-foreground transition hover:bg-foreground/25 sm:size-8"
            >
              <UserIcon className="size-4" />
            </Button>
            {menu && (
              <div
                className="fixed right-2 top-14 z-50 w-48 lg:absolute lg:right-0 lg:top-10 overflow-hidden rounded-xl bg-card/95 p-1 shadow-2xl ring-1 ring-border backdrop-blur-xl"
                onMouseLeave={() => setMenu(false)}
              >
                <p className="truncate px-3 py-2 text-[11px] text-muted-foreground">{user.email}</p>
                <Link
                  to="/profile"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground hover:bg-foreground/10"
                >
                  <UserIcon className="size-4" /> My profile
                </Link>
                {(isAdmin || isStaff) && (
                  <Link
                    to="/admin"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground hover:bg-foreground/10"
                  >
                    <Shield className="size-4" /> Admin panel
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    void supabase.auth.signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground hover:bg-foreground/10"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setAuthOpen(true)}
            aria-label="Login"
            className="grid size-10 max-[380px]:size-9 max-[340px]:size-8 shrink-0 place-items-center rounded-full bg-foreground p-0 text-[12px] font-black uppercase tracking-wide text-background transition hover:opacity-90 sm:h-8 sm:w-auto sm:px-3.5"
          >
            <span className="flex items-center gap-1">
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">Login</span>
            </span>
          </Button>
        )}
      </div>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
