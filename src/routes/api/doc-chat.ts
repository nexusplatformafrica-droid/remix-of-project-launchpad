import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import guide from "@/content/moviemax-api.md?raw";

/**
 * Streaming assistant for the developer guide (/doc side chat).
 * Answers only from the guide; small per-visitor limits protect AI credits.
 */
const hits = new Map<string, number[]>();
const PER_MINUTE = 12;

const body = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(30),
  page: z.string().max(80).optional(),
});

function originOf(request: Request) {
  const url = new URL(request.url);
  const first = (v: string) => (v.split(",")[0] ?? v).trim();
  const proto = first(request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", ""));
  const host = first(request.headers.get("x-forwarded-host") ?? url.host);
  return `${proto}://${host}`;
}

/** Keyless fallback used when the site runs outside Lovable hosting. */
async function freeAnswer(request: Request, messages: import("ai").ModelMessage[], instructions: string) {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const provider = createOpenAI({ baseURL: "https://text.pollinations.ai/openai", apiKey: "public" });
  const result = streamText({
    model: provider.chat("openai"),
    system: instructions,
    messages,
    abortSignal: request.signal,
  });
  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/doc-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];

        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        const now = Date.now();
        const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
        if (recent.length >= PER_MINUTE) {
          return Response.json({ error: "Too many questions — wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
        }
        recent.push(now);
        hits.set(ip, recent);

        let parsed: z.infer<typeof body>;
        try {
          parsed = body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        if (JSON.stringify(parsed.messages).length > 60_000) {
          return Response.json({ error: "Conversation is too long — start a new chat." }, { status: 400 });
        }

        const { convertToModelMessages } = await import("ai");
        const { createResponsesCall } = await import("@/lib/ai/responses");
        const origin = originOf(request);
        const doc = guide.replaceAll("{{ORIGIN}}", origin).replaceAll("{{HOST}}", origin.replace(/^https?:\/\//, ""));
        const instructions = `You are the MOVIE MAX API assistant on ${origin}/doc. Help developers use the MOVIE MAX Content API.
Answer ONLY from the developer guide below. Use the real base address ${origin}/api/public/v1 in every example, never a provider's domain.
Be concise, use Markdown and fenced code blocks. If the guide does not cover something, say so and suggest emailing nexusplatformafrica@gmail.com or WhatsApp +256795592662.
API keys come from ${origin}/developer and need a paid developer plan.
${parsed.page ? `The developer is currently reading the "${parsed.page}" page.` : ""}

--- DEVELOPER GUIDE ---
${doc}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = await convertToModelMessages(parsed.messages as any);
        if (!apiKey) {
          // Independent deployments (own Cloudflare account) have no gateway key:
          // answer through a free, keyless OpenAI-compatible service instead.
          try {
            return await freeAnswer(request, messages, instructions);
          } catch (e) {
            console.error("doc-chat free", e);
            return Response.json({ error: "The assistant is busy — try again shortly." }, { status: 502 });
          }
        }
        try {
          return await createResponsesCall(
            request,
            { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
            messages,
            instructions,
          ).response();
        } catch (e) {
          console.error("doc-chat", e);
          return Response.json({ error: "The assistant is busy — try again shortly." }, { status: 502 });
        }
      },
    },
  },
});
