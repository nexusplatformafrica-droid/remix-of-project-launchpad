import { createFileRoute } from "@tanstack/react-router";
import { isAllowedUgFile } from "@/lib/ug-music-rules";

/** Downloads a UgMuziki song as a file with a clean name (only UgMuziki song files allowed). */
export const Route = createFileRoute("/api/public/song")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const src = params.get("src") ?? "";
        const name = (params.get("name") ?? "song.mp3").replace(/[^\w.\- ()]+/g, "_").slice(0, 120);
        if (!isAllowedUgFile(src)) return new Response("Song not allowed", { status: 403 });

        const range = request.headers.get("range");
        const upstream = await fetch(src, {
          headers: { "user-agent": "Mozilla/5.0", ...(range ? { range } : {}) },
        });
        if (!upstream.ok && upstream.status !== 206) return new Response("Song unavailable", { status: 502 });

        const headers = new Headers({
          "content-type": "audio/mpeg",
          "content-disposition": `attachment; filename="${name.endsWith(".mp3") ? name : `${name}.mp3`}"`,
          "cache-control": "public, max-age=86400",
          "accept-ranges": "bytes",
        });
        for (const h of ["content-length", "content-range"]) {
          const v = upstream.headers.get(h);
          if (v) headers.set(h, v);
        }
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
