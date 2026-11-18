import { createFileRoute } from "@tanstack/react-router";
import { callUploadBackend, lastRefusal, verifyUploader } from "@/lib/r2-upload.server";
import { MAX_UPLOAD_BYTES } from "@/lib/music-rules";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
const ACTIONS = new Set(["single", "create", "sign", "complete", "abort"]);
// Any signed-in user may write to these folders; capped folders reject files over 300 MB.
const FOLDERS = ["media/admin", "media/channels", "media/artists"] as const;
const CAPPED = new Set(["media/channels", "media/artists"]);

// Verifies the Firebase sign-in token (signature only, no database reads), then
// asks the upload backend for presigned R2 URLs. File bytes never pass through here.
export const Route = createFileRoute("/api/public/admin-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const who = await verifyUploader(request);
        if (!who) return json({ error: `Upload refused: ${lastRefusal || "unknown"}` }, 403);
        const action = new URL(request.url).searchParams.get("action") ?? "";
        if (!ACTIONS.has(action)) return json({ error: "Unknown action" }, 400);
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
        const allowed: readonly string[] = FOLDERS;
        if (action === "single" || action === "create") {
          const folder = typeof body["folder"] === "string" ? body["folder"] : "media/admin";
          if (!allowed.includes(folder)) return json({ error: "Invalid upload location" }, 403);
          const size = Number(body["size"]);
          if (CAPPED.has(folder) && !(size > 0 && size <= MAX_UPLOAD_BYTES)) return json({ error: "Files must be 300 MB or smaller" }, 400);
          body = { filename: body["filename"], folder };
        } else if (typeof body["key"] !== "string" || !allowed.some((f) => (body["key"] as string).startsWith(`${f}/`))) {
          return json({ error: "Invalid upload" }, 400);
        }
        try { return await callUploadBackend(action, body); }
        catch { return json({ error: "Upload backend unreachable" }, 502); }
      },
    },
  },
});
