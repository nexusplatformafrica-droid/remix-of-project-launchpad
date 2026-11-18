import { Link } from "@tanstack/react-router";
import { BookOpen, KeyRound, LayoutDashboard, Menu, MessageSquareText, Moon, Sun } from "lucide-react";
import logoSrc from "@/assets/moviemax-logo.png";
import type { DevTheme } from "@/hooks/useDevTheme";

/** Top bar shared by the developer guide and the developer dashboard. */
export function DevHeader({
  theme,
  onToggleTheme,
  onMenu,
  onChat,
  chatOpen,
  active,
}: {
  theme: DevTheme;
  onToggleTheme: () => void;
  onMenu?: () => void;
  onChat?: () => void;
  chatOpen?: boolean;
  active: "doc" | "dashboard";
}) {
  const tab = (on: boolean) =>
    `inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-bold transition ${
      on ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  const icon = "grid size-9 place-items-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-muted hover:text-foreground";
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1680px] items-center gap-3 px-3 sm:px-5">
        {onMenu && (
          <button type="button" onClick={onMenu} aria-label="Open guide menu" className={`${icon} lg:hidden`}>
            <Menu className="size-4" />
          </button>
        )}
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="MOVIE MAX home">
          <img src={logoSrc} alt="MOVIE MAX" className="h-7 w-auto" />
        </Link>
        <span className="hidden rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-brand sm:inline">
          Developers
        </span>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <Link to="/doc" className={tab(active === "doc")}>
            <BookOpen className="size-4" /> Docs
          </Link>
          <Link to="/developer" className={tab(active === "dashboard")}>
            <LayoutDashboard className="size-4" /> Dashboard
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/developer"
            className="hidden h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-[13px] font-black text-brand-foreground shadow-[0_6px_20px_-8px_var(--brand)] transition hover:opacity-90 sm:inline-flex"
          >
            <KeyRound className="size-4" /> Get API key
          </Link>
          <Link to="/developer" aria-label="Dashboard" className={`${icon} md:hidden`}>
            <LayoutDashboard className="size-4" />
          </Link>
          {onChat && (
            <button
              type="button"
              onClick={onChat}
              aria-label={chatOpen ? "Hide assistant" : "Ask the assistant"}
              aria-pressed={chatOpen}
              className={`${icon} ${chatOpen ? "bg-muted text-foreground" : ""}`}
            >
              <MessageSquareText className="size-4" />
            </button>
          )}
          <button type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className={icon}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
