import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { NaraboxLibrary } from "@/components/luo/NaraboxLibrary";

export const Route = createFileRoute("/luganda/")({
  head: () => {
    const title =
      "MOVIE MAX Watch and Download Luganda Translated Movies by Your Favourite VJ — Movies for VJ Junior, VJ Ice P, VJ Jingo, VJ Mark and All Other Lugandan VJs";
    const description =
      "Watch and download Luganda translated movies and series from your favourite VJs — VJ Junior, VJ Ice P, VJ Jingo, VJ Mark and all other Lugandan VJs. Movies, series, animation, comedy, action and every genre, free in HD.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/luganda" },
        { property: "og:site_name", content: "MOVIE MAX" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "/luganda" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            inLanguage: "lg",
          }),
        },
      ],
    };
  },
  validateSearch: (search: Record<string, unknown>): { vj?: string } =>
    typeof search["vj"] === "string" && search["vj"] ? { vj: search["vj"] } : {},
  component: LugandaPage,
});

function LugandaPage() {
  const { vj = "" } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <NaraboxLibrary key={vj} vj={vj} />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
