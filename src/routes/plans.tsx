import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { DEFAULT_PLANS, money, type PlansSetting } from "@/lib/admin";

const TITLE = "MOVIE MAX Membership Plans & Prices — Watch Translated Movies in Uganda";
const DESC =
  "MOVIE MAX VIP and SVIP plans: daily, weekly, monthly and yearly passes to watch and download Luo, Luganda translated and original movies, series and live TV. Pay with Mobile Money, card or PayPal.";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/plans" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/plans" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "MOVIE MAX membership",
          description: DESC,
          brand: { "@type": "Brand", name: "MOVIE MAX" },
          offers: [...DEFAULT_PLANS.vip, ...DEFAULT_PLANS.svip].map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: p.price,
            priceCurrency: "UGX",
            availability: "https://schema.org/InStock",
            url: "https://luofilm.site/plans",
          })),
        }),
      },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<PlansSetting>(DEFAULT_PLANS);
  useEffect(() => {
    void import("@/lib/admin").then((m) => m.getPlans()).then((r) => r && setPlans(r)).catch(() => {});
  }, []);
  const open = () => window.dispatchEvent(new Event("luofilm:open-subscribe"));
  const group = (label: string, list: PlansSetting["vip"]) => (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground"><Crown className="size-5 text-primary" />{label}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {list.map((p) => (
          <button key={p.id} onClick={open} className="rounded-xl bg-card p-4 text-left ring-1 ring-border transition hover:ring-primary">
            <div className="font-semibold text-foreground">{p.name}</div>
            <div className="mt-1 text-2xl font-black text-primary">{money(p.price)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.note}</div>
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14"><TopBar /></div>
        <main className="mx-auto max-w-4xl px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground lg:text-3xl">MOVIE MAX membership plans</h1>
          <p className="mt-2 text-sm text-muted-foreground">{DESC}</p>
          {group("VIP", plans.vip)}
          {group("SVIP Premium", plans.svip)}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
