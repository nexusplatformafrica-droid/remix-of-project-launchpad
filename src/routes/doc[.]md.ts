import { createFileRoute } from "@tanstack/react-router";
import guide from "@/content/moviemax-api.md?raw";

/** The full developer guide as plain Markdown — for ChatGPT, Claude and other AI agents to read. */
export const Route = createFileRoute("/doc.md")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const first = (v: string) => (v.split(",")[0] ?? v).trim();
        const origin = `${first(request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", ""))}://${first(request.headers.get("x-forwarded-host") ?? url.host)}`;
        const md = guide.replaceAll("{{ORIGIN}}", origin).replaceAll("{{HOST}}", origin.replace(/^https?:\/\//, ""));
        return new Response(md, {
          headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=600", "access-control-allow-origin": "*" },
        });
      },
    },
  },
});
