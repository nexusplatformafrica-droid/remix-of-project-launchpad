import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fdb } from "@/lib/fdb";
import { TeamTab } from "@/components/admin/TeamTab";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserCog, LayoutDashboard, Users, Film, Wallet, Settings, ShieldCheck, MessageCircle, Sparkles, MonitorPlay, Music2, MicVocal, LineChart, Crown, FileSpreadsheet, HeartPulse, Search, RefreshCw, Wand2 } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { useIsAdmin } from "@/hooks/useAuth";
import { assignedAdminRole } from "@/lib/admin-access";
import { Overview, type AdminTab } from "@/components/admin/Overview";
import { UsersTab } from "@/components/admin/UsersTab";
import { ContentTab } from "@/components/admin/ContentTab";
import { NotifyTab } from "@/components/admin/NotifyTab";
import { WalletTab } from "@/components/admin/WalletTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { HeroTab } from "@/components/admin/HeroTab";
import { MusicHeroTab } from "@/components/admin/MusicHeroTab";
import { ArtistsTab } from "@/components/admin/ArtistsTab";
import { ChannelsTab } from "@/components/admin/ChannelsTab";
import { InsightsTab } from "@/components/admin/InsightsTab";
import { MembersTab } from "@/components/admin/MembersTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { SystemTab } from "@/components/admin/SystemTab";
import { ToolsTab } from "@/components/admin/ToolsTab";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { SOFT_BG } from "@/components/admin/ui";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { getFbAuth } = await import("@/lib/firebase");
    const auth = getFbAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw redirect({ to: "/", replace: true });
    const { data, error } = await fdb.from("user_roles").select("*").eq("user_id", user.uid).maybeSingle();
    if (error || !assignedAdminRole(data?.role)) throw redirect({ to: "/", replace: true });
  },
  validateSearch: (search: Record<string, unknown>): { upload?: boolean } => search["upload"] === true || search["upload"] === "true" ? { upload: true } : {},
  head: () => ({
    meta: [
      { title: "Admin Dashboard — MOVIE MAX" },
      { name: "description", content: "Manage users, content, wallet and subscription settings on MOVIE MAX." },
      { property: "og:title", content: "Admin Dashboard — MOVIE MAX" },
      {
        property: "og:description",
        content: "Manage users, content, wallet and subscription settings on MOVIE MAX.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS: { k: AdminTab; t: string; i: typeof Users }[] = [
  { k: "overview", t: "Overview", i: LayoutDashboard },
  { k: "insights", t: "Insights", i: LineChart },
  { k: "tools", t: "Special tools", i: Wand2 },
  { k: "wallet", t: "Wallet", i: Wallet },
  { k: "members", t: "Members", i: Crown },
  { k: "users", t: "Users", i: Users },
  { k: "content", t: "Content", i: Film },
  { k: "hero", t: "Hero", i: Sparkles },
  { k: "mhero", t: "Music hero", i: Music2 },
  { k: "artists", t: "Artists", i: MicVocal },
  { k: "channels", t: "TV channels", i: MonitorPlay },
  { k: "notify", t: "Notify", i: MessageCircle },
  { k: "reports", t: "Reports", i: FileSpreadsheet },
  { k: "system", t: "System", i: HeartPulse },
  { k: "settings", t: "Settings", i: Settings },
  { k: "team", t: "Admins", i: UserCog },
];

// Tabs a team admin (added by the main admin) may open.
const STAFF_TABS: AdminTab[] = ["overview", "users", "content", "hero"];

function AdminPage() {
  const { isAdmin, checking, user } = useIsAdmin();
  const [tab, setTab] = useState<AdminTab>("overview");
  const { upload } = Route.useSearch();
  useEffect(() => { if (upload) setTab("content"); }, [upload]);
  useEffect(() => {
    const open = () => setTab("content");
    window.addEventListener("open-upload-editor", open);
    return () => window.removeEventListener("open-upload-editor", open);
  }, []);
  const staffQ = useQuery({
    queryKey: ["my-staff-role", user?.id],
    enabled: !!user && !isAdmin && !checking,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await fdb.from("user_roles").select("*").eq("user_id", user.id).maybeSingle();
      return data?.role === "staff";
    },
  });
  const isStaff = !isAdmin && !!staffQ.data;
  const canOpen = isAdmin || isStaff;
  const tabs = isAdmin ? TABS : TABS.filter((t) => STAFF_TABS.includes(t.k));
  const current: AdminTab = tabs.some((t) => t.k === tab) ? tab : "overview";
  const go = (t: AdminTab) => setTab(tabs.some((x) => x.k === t) ? t : "overview");
  const qc = useQueryClient();
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const refreshAll = () => void qc.invalidateQueries();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-2 pb-28 sm:px-4 lg:px-6 lg:pb-10">
          <div className={`mt-2 rounded-3xl p-3 sm:p-4 ${SOFT_BG}`}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[19px] font-black leading-tight tracking-tight">Admin dashboard</h1>
                <p className="text-[11px] opacity-60">MOVIE MAX control centre</p>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                {canOpen && (
                  <>
                    <button type="button" onClick={() => setPalette(true)} className="flex h-8 items-center gap-1.5 rounded-full bg-white/75 px-3 text-[12px] font-semibold ring-1 ring-black/5 hover:bg-white">
                      <Search className="size-3.5" /> <span className="hidden sm:inline">Find anything</span>
                      <kbd className="hidden rounded bg-black/5 px-1 text-[10px] sm:inline">Ctrl K</kbd>
                    </button>
                    <button type="button" onClick={refreshAll} aria-label="Refresh all data" className="grid size-8 place-items-center rounded-full bg-white/75 ring-1 ring-black/5 hover:bg-white">
                      <RefreshCw className="size-3.5" />
                    </button>
                  </>
                )}
                <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1.5 text-[11.5px] font-semibold ring-1 ring-black/5">
                  <ShieldCheck className="size-3.5 shrink-0 text-[oklch(0.6_0.14_150)]" />
                  <span className="max-w-[140px] truncate sm:max-w-[220px]">{user?.email ?? "not signed in"}</span>
                </span>
              </div>
            </header>

            {checking || (!isAdmin && !!user && staffQ.isLoading) ? (
              <p className="py-16 text-center text-[13px] opacity-60">Checking access…</p>
            ) : !user || !canOpen ? null : (
              <>
                <nav className="scrollbar-none -mx-1 mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-white/60 p-1 ring-1 ring-black/5">
                  {tabs.map((t) => (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => go(t.k)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold transition ${
                        current === t.k
                          ? "bg-[linear-gradient(100deg,oklch(0.96_0.05_95),oklch(0.89_0.11_78))] shadow-[0_10px_24px_-16px_oklch(0.8_0.12_75)]"
                          : "opacity-60 hover:opacity-90"
                      }`}
                    >
                      <t.i className="size-3.5" /> {t.t}
                    </button>
                  ))}
                </nav>

                <div className="mt-3">
                  {current === "overview" && <Overview go={go} limited={isStaff} />}
                  {isAdmin && current === "insights" && <InsightsTab />}
                  {isAdmin && current === "members" && <MembersTab />}
                  {isAdmin && current === "reports" && <ReportsTab />}
                  {isAdmin && current === "system" && <SystemTab />}
                  {isAdmin && current === "tools" && <ToolsTab />}
                  {current === "users" && <UsersTab />}
                  {current === "content" && <ContentTab userId={user.id} restricted={isStaff} />}
                  {current === "hero" && <HeroTab />}
                  {isAdmin && current === "mhero" && <MusicHeroTab />}
                  {isAdmin && current === "artists" && <ArtistsTab />}
                  {isAdmin && current === "channels" && <ChannelsTab />}
                  {isAdmin && current === "notify" && <NotifyTab />}
                  {isAdmin && current === "wallet" && <WalletTab />}
                  {isAdmin && current === "settings" && <SettingsTab />}
                  {isAdmin && current === "team" && <TeamTab />}
                </div>
                <CommandDialog open={palette} onOpenChange={setPalette}>
                  <CommandInput placeholder="Jump to a tool or action…" />
                  <CommandList>
                    <CommandEmpty>Nothing found.</CommandEmpty>
                    <CommandGroup heading="Tools">
                      {tabs.map((t) => (
                        <CommandItem
                          key={t.k}
                          value={t.t}
                          onSelect={() => {
                            go(t.k);
                            setPalette(false);
                          }}
                        >
                          <t.i className="mr-2 size-4" /> {t.t}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Actions">
                      <CommandItem
                        value="Upload a movie"
                        onSelect={() => {
                          go("content");
                          setPalette(false);
                        }}
                      >
                        <Film className="mr-2 size-4" /> Upload a movie
                      </CommandItem>
                      {isAdmin && (
                        <CommandItem
                          value="Withdraw money"
                          onSelect={() => {
                            go("wallet");
                            setPalette(false);
                          }}
                        >
                          <Wallet className="mr-2 size-4" /> Withdraw money
                        </CommandItem>
                      )}
                      <CommandItem
                        value="Refresh all data"
                        onSelect={() => {
                          refreshAll();
                          setPalette(false);
                        }}
                      >
                        <RefreshCw className="mr-2 size-4" /> Refresh all data
                        <CommandShortcut>⟳</CommandShortcut>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </CommandDialog>
              </>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
