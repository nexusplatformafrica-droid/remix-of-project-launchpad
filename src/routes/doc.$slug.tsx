import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { DocArticle } from "@/components/dev/DocArticle";
import { docPage } from "@/components/dev/doc-data";

const parent = getRouteApi("/doc");

export const Route = createFileRoute("/doc/$slug")({
  loader: ({ params }) => {
    const page = docPage(params.slug);
    if (!page) throw notFound();
    return { title: page.title };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — MOVIE MAX API Guide` : "Page not found — MOVIE MAX API Guide";
    const d = loaderData ? `${loaderData.title}: MOVIE MAX Content API developer guide with examples on our own domain.` : "This guide page does not exist.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => <p className="mx-auto max-w-[820px] text-muted-foreground">This guide page does not exist.</p>,
  component: SlugPage,
});

function SlugPage() {
  const { slug } = Route.useParams();
  return <DocArticle slug={slug} origin={parent.useLoaderData()} />;
}
