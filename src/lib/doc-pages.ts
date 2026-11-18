import { marked, type Tokens } from "marked";
import { slugify, type TocEntry } from "./doc-export";

/** One guide page per top-level (#) section, so the docs read page by page. */
export type DocPage = { slug: string; title: string; number: string; md: string; sections: TocEntry[] };

export function splitDoc(md: string): DocPage[] {
  const lines = md.split("\n");
  const pages: { title: string; body: string[] }[] = [];
  let intro: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    if (!inFence && /^# \d+\./.test(line)) {
      pages.push({ title: line.slice(2).trim(), body: [line] });
      continue;
    }
    if (pages.length) pages[pages.length - 1]!.body.push(line);
    else intro.push(line);
  }
  // Drop the guide title; keep the tagline lines on the first page.
  intro = intro.filter((l) => !/^# /.test(l));
  return pages.map((p, i) => {
    const m = p.title.match(/^(\d+)\.\s*(.*)$/);
    const title = m?.[2] ?? p.title;
    const body = i === 0 ? [p.body[0]!, "", ...intro, ...p.body.slice(1)] : p.body;
    const pageMd = body.join("\n");
    const sections = marked
      .lexer(pageMd)
      .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2)
      .map((h) => ({ id: slugify(h.text), text: h.text.replace(/`/g, ""), depth: 2 }));
    return { slug: i === 0 ? "overview" : slugify(title.replace(/&/g, "and")), title, number: m?.[1] ?? String(i + 1), md: pageMd, sections };
  });
}
