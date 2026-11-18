import { ClientOnly, createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { FileCode2, FileDown, FileText, FileType, KeyRound, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DevHeader } from "@/components/dev/DevHeader";
import { DOC_PAGES, DOC_SOURCE, DOC_TITLE } from "@/components/dev/doc-data";
import { useDevTheme } from "@/hooks/useDevTheme";
import { getSiteOrigin } from "@/lib/api-token.functions";
import { docLegacyBlob, docStandaloneHtml, docxBlob, downloadBlob, fillDoc } from "@/lib/doc-export";

const DocChat = lazy(() => import("@/components/dev/DocChat"));
const FILE = "MOVIEMAX-API-Guide";

export const Route = createFileRoute("/doc")({
  loader: () => getSiteOrigin(),
  component: DocLayout,
});

function DocLayout() {
  const origin = Route.useLoaderData();
  const { theme, toggle } = useDevTheme();
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = params.slug ?? "overview";
  const current = DOC_PAGES.find((p) => p.slug === slug);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [mobileChat, setMobileChat] = useState(false);

  const toggleChat = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) setChatOpen((v) => !v);
    else setMobileChat(true);
  };

  const nav = <DocNav slug={slug} origin={origin} onPick={() => setMenuOpen(false)} />;
  const chat = (onClose?: () => void) => (
    <ClientOnly fallback={<div className="h-full bg-card" />}>
      <Suspense fallback={<div className="h-full bg-card" />}>
        <DocChat origin={origin} page={current?.title ?? "Overview"} onClose={onClose} />
      </Suspense>
    </ClientOnly>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DevHeader theme={theme} onToggleTheme={toggle} onMenu={() => setMenuOpen(true)} onChat={toggleChat} chatOpen={chatOpen} active="doc" />
      <div className="mx-auto flex max-w-[1680px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[290px] shrink-0 overflow-y-auto border-r border-border bg-sidebar/40 lg:block">
          {nav}
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8 lg:px-12 xl:px-14">
          <Outlet />
        </main>
        {chatOpen && (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[400px] shrink-0 border-l border-border xl:block 2xl:w-[440px]">
            {chat(() => setChatOpen(false))}
          </aside>
        )}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[300px] overflow-y-auto bg-background p-0">
          <SheetTitle className="sr-only">Guide pages</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>
      <Sheet open={mobileChat} onOpenChange={setMobileChat}>
        <SheetContent side="right" className="w-full max-w-[440px] p-0 sm:max-w-[440px] [&>button]:hidden">
          <SheetTitle className="sr-only">API assistant</SheetTitle>
          {mobileChat && chat(() => setMobileChat(false))}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DocNav({ slug, origin, onPick }: { slug: string; origin: string; onPick: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const md = useMemo(() => fillDoc(DOC_SOURCE, origin), [origin]);
  const needle = q.trim().toLowerCase();
  const pages = needle
    ? DOC_PAGES.filter((p) => p.title.toLowerCase().includes(needle) || p.md.toLowerCase().includes(needle))
    : DOC_PAGES;

  const saveMd = () => downloadBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${FILE}.md`);
  const saveDoc = () => downloadBlob(docLegacyBlob(md, DOC_TITLE), `${FILE}.doc`);
  const saveDocx = async () => {
    setBusy(true);
    try {
      downloadBlob(await docxBlob(md, DOC_TITLE), `${FILE}.docx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the Word file");
    } finally {
      setBusy(false);
    }
  };
  const savePdf = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to save the PDF");
      return;
    }
    w.document.write(docStandaloneHtml(md, DOC_TITLE));
    w.document.close();
    toast.message("Choose “Save as PDF” in the print window");
    setTimeout(() => w.print(), 400);
  };
  const dl = "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-bold text-muted-foreground ring-1 ring-border transition hover:bg-muted hover:text-foreground disabled:opacity-60";

  return (
    <div className="flex min-h-full flex-col gap-5 p-4">
      <label className="flex h-10 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground ring-1 ring-border focus-within:ring-brand">
        <Search className="size-4 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide" className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground" />
      </label>

      <Link to="/developer" onClick={onPick} className="block rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 p-4 ring-1 ring-brand/30 transition hover:ring-brand/60">
        <span className="flex items-center gap-2 text-[13px] font-black text-foreground">
          <KeyRound className="size-4 text-brand" /> Get your API key
        </span>
        <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">Choose a plan and create keys in the developer dashboard.</span>
      </Link>

      <nav className="space-y-0.5">
        <p className="px-2 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Guide</p>
        {pages.map((p) => {
          const on = p.slug === slug;
          return (
            <div key={p.slug}>
              <Link
                to="/doc/$slug"
                params={{ slug: p.slug }}
                onClick={onPick}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-bold transition ${on ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
              >
                <span className={`grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-black ${on ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>{p.number}</span>
                {p.title}
              </Link>
              {on && p.sections.length > 0 && (
                <div className="my-1 ml-5 border-l border-border pl-3">
                  {p.sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`} onClick={onPick} className="block truncate py-1 text-[12.5px] text-muted-foreground transition hover:text-foreground">
                      {s.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {pages.length === 0 && <p className="px-2 text-[12px] text-muted-foreground">Nothing matches “{q}”.</p>}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border pt-4">
        <p className="px-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Save the full guide</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={savePdf} className={dl}><FileDown className="size-4" /> PDF</button>
          <button type="button" onClick={saveDocx} disabled={busy} className={dl}><FileText className="size-4" /> {busy ? "…" : "DOCX"}</button>
          <button type="button" onClick={saveDoc} className={dl}><FileType className="size-4" /> DOC</button>
          <button type="button" onClick={saveMd} className={dl}><FileCode2 className="size-4" /> MD</button>
        </div>
      </div>
    </div>
  );
}
