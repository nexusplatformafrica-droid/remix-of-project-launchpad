import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { DocArticle } from "@/components/dev/DocArticle";

const parent = getRouteApi("/doc");

export const Route = createFileRoute("/doc/")({
  head: () => ({
    meta: [
      { title: "Developer API Guide — MOVIE MAX" },
      { name: "description", content: "Build on the MOVIE MAX library: search, English, Luganda VJ, Luo and Teso catalogs, play, download and subtitle links on our own domain." },
      { property: "og:title", content: "Developer API Guide — MOVIE MAX" },
      { property: "og:description", content: "Every MOVIE MAX API endpoint, API keys and plans, code examples and an AI assistant — downloadable as PDF, DOCX, DOC or Markdown." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <DocArticle slug="overview" origin={parent.useLoaderData()} />,
});
