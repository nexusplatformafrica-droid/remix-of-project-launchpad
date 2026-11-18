import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logoSrc from "@/assets/moviemax-logo.png";

/** Outside AI agents that open with the question and a link to the full guide — no setup needed. */
const AGENTS = [
  { id: "moviemax", label: "MOVIE MAX AI" },
  { id: "chatgpt", label: "ChatGPT", url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: "claude", label: "Claude", url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  { id: "perplexity", label: "Perplexity", url: (q: string) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
  { id: "copilot", label: "Copilot", url: (q: string) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}` },
  { id: "grok", label: "Grok", url: (q: string) => `https://grok.com/?q=${encodeURIComponent(q)}` },
] as const;

const SUGGESTIONS = [
  "How do I get an API key?",
  "Show a JavaScript example that searches titles",
  "How do I play a movie in a <video> tag?",
  "What are the rate limits on each plan?",
];

export default function DocChat({ origin, page, onClose }: { origin: string; page: string; onClose?: (() => void) | undefined }) {
  const [agent, setAgent] = useState<(typeof AGENTS)[number]["id"]>("moviemax");
  const [draft, setDraft] = useState("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/doc-chat", body: { page } }), [page]);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onError: (e) => {
      let msg = e.message;
      try {
        msg = (JSON.parse(e.message) as { error?: string }).error ?? msg;
      } catch {
        /* plain text */
      }
      toast.error(msg || "The assistant could not answer — check your connection.");
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const href = extHref(q);
    if (href) {
      window.open(href, "_blank", "noopener");
      return;
    }
    if (busy) return;
    void sendMessage({ text: q });
  };

  const onSubmit = (m: PromptInputMessage) => ask(m.text ?? "");
  const ext = AGENTS.find((a) => a.id === agent);
  /** Link that opens the outside agent with the question and the full guide address. */
  function extHref(q: string): string | null {
    const a = AGENTS.find((x) => x.id === agent);
    if (!a || !("url" in a)) return null;
    const prompt = `I'm building an app with the MOVIE MAX Content API. Read the full developer guide at ${origin}/doc.md (base address ${origin}/api/public/v1) and answer: ${q.trim() || "How do I get started?"}`;
    return a.url(prompt);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-background ring-1 ring-border">
          <img src={logoSrc} alt="" className="w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black leading-tight text-foreground">API Assistant</p>
          <p className="truncate text-[11px] text-muted-foreground">Answers from this guide · {origin.replace(/^https?:\/\//, "")}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])} aria-label="New chat" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <RotateCcw className="size-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close assistant" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none]">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAgent(a.id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold transition ${
              agent === a.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.label}
            {"url" in a && <ExternalLink className="size-3" />}
          </button>
        ))}
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-4 py-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="items-stretch text-left"
              title=""
              description=""
            >
              <div className="space-y-3">
                <p className="text-[15px] font-black text-foreground">Ask anything about the API</p>
                <p className="text-[12px] text-muted-foreground">
                  {agent === "moviemax"
                    ? "Answers come straight from this guide, with examples for your domain."
                    : `Your question opens in ${AGENTS.find((a) => a.id === agent)?.label} with this guide attached — no setup.`}
                </p>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) =>
                    ext && "url" in ext ? (
                      <a key={s} href={extHref(s) ?? "#"} target="_blank" rel="noopener" className="rounded-xl bg-muted px-3 py-2 text-left text-[13px] font-semibold text-foreground transition hover:bg-accent">
                        {s}
                      </a>
                    ) : (
                      <button key={s} type="button" onClick={() => ask(s)} className="rounded-xl bg-muted px-3 py-2 text-left text-[13px] font-semibold text-foreground transition hover:bg-accent">
                        {s}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className={m.role === "user" ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : "bg-transparent p-0"}>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "assistant" ? (
                        <MessageResponse key={i} className="text-[13.5px] leading-relaxed">{p.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap text-[13.5px]">{p.text}</p>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer className="text-[13px]">Reading the guide…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        {ext && "url" in ext ? (
          <div className="rounded-xl bg-background p-2 ring-1 ring-border">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    ask(draft);
                    setDraft("");
                  }
                }
              }}
              placeholder={`Ask ${ext.label}…`}
              rows={2}
              className="min-h-12 w-full resize-none bg-transparent px-1 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex justify-end">
              <a
                href={extHref(draft) ?? "#"}
                target="_blank"
                rel="noopener"
                onClick={() => window.setTimeout(() => setDraft(""), 300)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12.5px] font-bold text-background transition hover:opacity-90"
              >
                Ask in {ext.label} <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <PromptInput onSubmit={onSubmit} className="bg-background">
            <PromptInputTextarea placeholder="Ask about endpoints, keys, examples…" className="min-h-12 text-[13.5px]" />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        )}
      </div>
    </div>
  );
}
