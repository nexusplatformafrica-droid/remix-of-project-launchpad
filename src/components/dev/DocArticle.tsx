import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DOC_PAGES } from "./doc-data";
import { docToHtml, fillDoc } from "@/lib/doc-export";

/** One guide page with breadcrumb and previous/next links. */
export function DocArticle({ slug, origin }: { slug: string; origin: string }) {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  const page = DOC_PAGES[i]!;
  const html = useMemo(() => docToHtml(fillDoc(page.md, origin)), [page, origin]);
  const prev = DOC_PAGES[i - 1];
  const next = DOC_PAGES[i + 1];
  const card = "group flex flex-1 flex-col rounded-2xl p-4 ring-1 ring-border transition hover:bg-muted/60 hover:ring-brand/40";
  return (
    <div className="mx-auto max-w-[820px]">
      <p className="mb-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
        <Link to="/doc" className="hover:text-foreground">Docs</Link>
        <span className="mx-2">/</span>
        <span className="text-brand">{page.title}</span>
      </p>
      {i === 0 && (
        <div className="mb-8 rounded-2xl bg-muted/60 p-5 ring-1 ring-border">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Base address</p>
          <p className="mt-1 break-all font-mono text-[15px] font-bold text-foreground">{origin}/api/public/v1</p>
        </div>
      )}
      <article className="api-doc api-doc--page" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        {prev ? (
          <Link to="/doc/$slug" params={{ slug: prev.slug }} className={card}>
            <span className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground"><ArrowLeft className="size-3.5" /> Previous</span>
            <span className="mt-1 text-[15px] font-black text-foreground group-hover:text-brand">{prev.title}</span>
          </Link>
        ) : <span className="flex-1" />}
        {next ? (
          <Link to="/doc/$slug" params={{ slug: next.slug }} className={`${card} items-end text-right`}>
            <span className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground">Next <ArrowRight className="size-3.5" /></span>
            <span className="mt-1 text-[15px] font-black text-foreground group-hover:text-brand">{next.title}</span>
          </Link>
        ) : <span className="flex-1" />}
      </div>
    </div>
  );
}
