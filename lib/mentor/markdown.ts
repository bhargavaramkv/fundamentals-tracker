/**
 * A tiny markdown parser for the archived V1 reports: headings, bullet lists, fenced code, paragraphs, and inline
 * **bold** and `code`. It produces a token tree and never HTML; the component renders tokens as React elements, so all
 * text is escaped by React and nothing is ever injected as markup.
 */

export type Inline = { t: "text" | "bold" | "code"; text: string };
export type Block =
  | { t: "heading"; level: 1 | 2 | 3; inline: Inline[] }
  | { t: "list"; items: Inline[][] }
  | { t: "code"; text: string }
  | { t: "paragraph"; inline: Inline[] };

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ t: "text", text: src.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: "bold", text: m[1] } : { t: "code", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", text: src.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: Inline[][] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ t: "paragraph", inline: parseInline(para.join(" ")) });
    if (list) blocks.push({ t: "list", items: list });
    para = [];
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      blocks.push({ t: "code", text: code.join("\n") });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ t: "heading", level: h[1].length as 1 | 2 | 3, inline: parseInline(h[2].trim()) });
      continue;
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (para.length) flush();
      (list ??= []).push(parseInline(li[1]));
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return blocks;
}
