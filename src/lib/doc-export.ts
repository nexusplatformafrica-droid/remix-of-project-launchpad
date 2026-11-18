import { Marked, marked, type Token, type Tokens } from "marked";

/** Developer-guide helpers: fill in the live domain and export to MD / HTML / DOC / DOCX. */

export function fillDoc(md: string, origin: string) {
  const host = origin.replace(/^https?:\/\//, "");
  return md.replaceAll("{{ORIGIN}}", origin).replaceAll("{{HOST}}", host);
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

export type TocEntry = { id: string; text: string; depth: number };

export function docToc(md: string): TocEntry[] {
  return marked
    .lexer(md)
    .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth <= 2)
    .slice(1)
    .map((h) => ({ id: slugify(h.text), text: h.text.replace(/`/g, ""), depth: h.depth }));
}

/** Markdown → HTML with heading ids (our own static guide, not user input). */
export function docToHtml(md: string): string {
  const m = new Marked({ gfm: true });
  m.use({
    renderer: {
      heading({ tokens, depth, text }) {
        return `<h${depth} id="${slugify(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  return m.parse(md, { async: false }) as string;
}

const PRINT_CSS = `
body{font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;font-size:11pt;max-width:820px;margin:24px auto;padding:0 16px}
h1{font-size:20pt;margin:28px 0 10px;border-bottom:2px solid #3b5bdb;padding-bottom:4px;page-break-after:avoid}
h2{font-size:14pt;margin:20px 0 8px;page-break-after:avoid}
table{border-collapse:collapse;width:100%;margin:10px 0;page-break-inside:avoid}
th,td{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top;font-size:10pt}
th{background:#eef1fb}
pre{background:#f4f5f8;border:1px solid #ddd;padding:10px;white-space:pre-wrap;word-break:break-word;font-size:9pt;page-break-inside:avoid}
code{font-family:Consolas,"Courier New",monospace;font-size:9.5pt}
@page{size:A4;margin:14mm}
`;

export function docStandaloneHtml(md: string, title: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${docToHtml(md)}</body></html>`;
}

/** Word 97-2003 compatible .doc (HTML package Word opens natively). */
export function docLegacyBlob(md: string, title: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>${PRINT_CSS}</style></head><body>${docToHtml(md)}</body></html>`;
  return new Blob(["\ufeff", html], { type: "application/msword" });
}

/** Real .docx built from the markdown structure. */
export async function docxBlob(md: string, title: string): Promise<Blob> {
  const d = await import("docx");
  const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, LevelFormat, AlignmentType } = d;
  const CONTENT = 9026; // A4 with 1" margins, DXA
  const border = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
  const borders = { top: border, bottom: border, left: border, right: border };

  type Fmt = { bold?: boolean; italics?: boolean; code?: boolean };
  const runs = (tokens: Token[] | undefined, fmt: Fmt = {}): InstanceType<typeof TextRun>[] => {
    const out: InstanceType<typeof TextRun>[] = [];
    for (const t of tokens ?? []) {
      const any = t as Token & { tokens?: Token[]; text?: string };
      if (t.type === "strong") out.push(...runs(any.tokens, { ...fmt, bold: true }));
      else if (t.type === "em") out.push(...runs(any.tokens, { ...fmt, italics: true }));
      else if (t.type === "codespan") out.push(new TextRun({ text: decode(any.text ?? ""), font: "Consolas", bold: !!fmt.bold, size: 19 }));
      else if (t.type === "br") out.push(new TextRun({ text: "", break: 1 }));
      else if (any.tokens?.length) out.push(...runs(any.tokens, fmt));
      else out.push(new TextRun({ text: decode(any.text ?? ""), bold: !!fmt.bold, italics: !!fmt.italics, font: fmt.code ? "Consolas" : "Arial" }));
    }
    return out;
  };

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  for (const t of marked.lexer(md)) {
    if (t.type === "heading") {
      const h = t as Tokens.Heading;
      children.push(new Paragraph({ heading: h.depth === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: runs(h.tokens) }));
    } else if (t.type === "paragraph") {
      children.push(new Paragraph({ spacing: { after: 120 }, children: runs((t as Tokens.Paragraph).tokens) }));
    } else if (t.type === "code") {
      const lines = (t as Tokens.Code).text.split("\n");
      children.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "F4F5F8", color: "auto" },
          border: { top: border, bottom: border, left: border, right: border },
          spacing: { before: 80, after: 160 },
          children: lines.map((line, i) => new TextRun({ text: line, font: "Consolas", size: 17, break: i ? 1 : 0 })),
        }),
      );
    } else if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        const inner = item.tokens.flatMap((x) => ((x as Tokens.Text).tokens ? (x as Tokens.Text).tokens! : [x]));
        children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs(inner) }));
      }
    } else if (t.type === "table") {
      const tb = t as Tokens.Table;
      const cols = tb.header.length;
      const w = Math.floor(CONTENT / cols);
      const widths = Array.from({ length: cols }, (_, i) => (i === cols - 1 ? CONTENT - w * (cols - 1) : w));
      const row = (cells: Tokens.TableCell[], head: boolean) =>
        new TableRow({
          tableHeader: head,
          children: cells.map(
            (c, i) =>
              new TableCell({
                borders,
                width: { size: widths[i] ?? w, type: WidthType.DXA },
                ...(head ? { shading: { fill: "EEF1FB", type: ShadingType.CLEAR, color: "auto" } } : {}),
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: runs(c.tokens, { bold: head }) })],
              }),
          ),
        });
      children.push(
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          columnWidths: widths,
          rows: [row(tb.header, true), ...tb.rows.map((r) => row(r, false))],
        }),
        new Paragraph({ children: [] }),
      );
    }
  }

  const doc = new d.Document({
    title,
    creator: "MOVIE MAX",
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: "1F3A93" }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  return d.Packer.toBlob(doc);
}

function decode(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
