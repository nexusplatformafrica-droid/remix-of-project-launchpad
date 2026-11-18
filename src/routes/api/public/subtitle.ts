import { getMovieRelay, relayRequestUrl } from "@/lib/movie-relay";
import { isWorkerd, socketFetch } from "@/lib/socket-fetch";
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOSTS = [".aoneroom.com", ".hakunaymatata.com", ".inmoviebox.com"];

function srtToVtt(input: string) {
  if (input.trimStart().startsWith("WEBVTT")) return input;
  return `WEBVTT\n\n${input.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

export const Route = createFileRoute("/api/public/subtitle")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("url");
        const filename = params.get("dl");
        if (!target) return new Response("Missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
          return new Response("Host not allowed", { status: 403 });
        }

        let upstream = isWorkerd()
          ? await socketFetch(parsed.toString(), { headers: { "user-agent": "Mozilla/5.0" } }).catch(() => null)
          : null;
        if (!upstream?.ok) upstream = await fetch(parsed.toString()).catch(() => null);
        // MovieBox's CDN refuses some hosting networks; retry through the movie relay.
        if (!upstream?.ok) {
          upstream = await fetch(relayRequestUrl(await getMovieRelay(), parsed.toString()), {
            headers: { "user-agent": "Mozilla/5.0" },
          }).catch(() => null);
        }
        if (!upstream?.ok) return new Response("Subtitle unavailable", { status: 502 });

        return new Response(srtToVtt(await upstream.text()), {
          headers: {
            "content-type": "text/vtt; charset=utf-8",
            "cache-control": "public, max-age=3600",
            ...(filename
              ? {
                  "content-disposition": `attachment; filename="${filename
                    .replace(/[^\w.\- ]+/g, "_")
                    .slice(0, 120)}"`,
                }
              : {}),
          },
        });
      },
    },
  },
});
