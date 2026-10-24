export type Inline =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "pairs"; rows: { label: string; value: Inline[] }[] }
  | { type: "note"; title: string | null; body: Inline[][] }
  | { type: "highlight"; title: string; items: Inline[][] };

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function isAllowedHref(href: string): boolean {
  if (href.includes("\\")) return false;
  if (href.startsWith("//")) return false;
  if (href.startsWith("/")) return true;
  if (href.startsWith("https://")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("tel:")) return true;
  return false;
}

export function parseInlines(text: string): Inline[] {
  const inlines: Inline[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    const [full, linkText, href] = match;
    if (!isAllowedHref(href)) continue;
    if (match.index > lastIndex) {
      inlines.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    inlines.push({ type: "link", text: linkText, href });
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    inlines.push({ type: "text", text: text.slice(lastIndex) });
  }
  if (inlines.length === 0) inlines.push({ type: "text", text: "" });
  return inlines;
}

const PAIR_PATTERN = /^([^:/]{1,40}):\s+(.+)$/;

export function parsePageContent(text: string): {
  lead: Inline[] | null;
  blocks: Block[];
  sections: { id: string; title: string }[];
  wordCount: number;
} {
  const normalized = text.replace(/\r\n/g, "\n");
  const rawBlocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  const sections: { id: string; title: string }[] = [];
  let h2Count = 0;
  let h3Count = 0;

  for (const raw of rawBlocks) {
    const lines = raw.split("\n");

    if (lines[0].startsWith(">! ")) {
      const title = lines[0].slice(3);
      const items = lines
        .slice(1)
        .map((line) => parseInlines(line.startsWith("- ") ? line.slice(2) : line));
      blocks.push({ type: "highlight", title, items });
      continue;
    }

    if (lines.every((l) => l.startsWith(">"))) {
      const stripped = lines.map((l) => (l.startsWith("> ") ? l.slice(2) : l.slice(1)));
      if (stripped.length >= 2) {
        blocks.push({
          type: "note",
          title: stripped[0],
          body: stripped.slice(1).map((l) => parseInlines(l)),
        });
      } else {
        blocks.push({ type: "note", title: null, body: [parseInlines(stripped[0])] });
      }
      continue;
    }

    const isUnordered = lines.every((l) => /^- /.test(l));
    const isOrdered = !isUnordered && lines.every((l) => /^\d+\. /.test(l));
    if (isUnordered || isOrdered) {
      const itemTexts = lines.map((l) =>
        isOrdered ? l.replace(/^\d+\. /, "") : l.replace(/^- /, ""),
      );
      if (isUnordered && itemTexts.every((t) => PAIR_PATTERN.test(t))) {
        const rows = itemTexts.map((t) => {
          const m = t.match(PAIR_PATTERN)!;
          return { label: m[1], value: parseInlines(m[2]) };
        });
        blocks.push({ type: "pairs", rows });
      } else {
        blocks.push({
          type: "list",
          ordered: isOrdered,
          items: itemTexts.map((t) => parseInlines(t)),
        });
      }
      continue;
    }

    if (lines[0].startsWith("## ")) {
      h2Count += 1;
      h3Count = 0;
      const title = lines[0].slice(3);
      const id = `section-${h2Count}`;
      blocks.push({ type: "heading", level: 2, text: title, id });
      sections.push({ id, title });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) blocks.push({ type: "paragraph", inlines: parseInlines(rest) });
      continue;
    }

    if (lines[0].startsWith("### ")) {
      h3Count += 1;
      const title = lines[0].slice(4);
      const id = `section-${h2Count}-${h3Count}`;
      blocks.push({ type: "heading", level: 3, text: title, id });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) blocks.push({ type: "paragraph", inlines: parseInlines(rest) });
      continue;
    }

    blocks.push({ type: "paragraph", inlines: parseInlines(lines.join("\n")) });
  }

  let lead: Inline[] | null = null;
  if (blocks.length > 0 && blocks[0].type === "paragraph") {
    lead = blocks[0].inlines;
    blocks.shift();
  }

  const trimmed = normalized.trim();
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

  return { lead, blocks, sections, wordCount };
}

export function parseFaqContent(text: string): {
  lead: Inline[] | null;
  groups: {
    id: string;
    title: string;
    questions: { id: string; question: string; answer: Block[] }[];
  }[];
} {
  const { lead, blocks } = parsePageContent(text);

  const groups: {
    id: string;
    title: string;
    questions: { id: string; question: string; answer: Block[] }[];
  }[] = [];
  let currentGroup: (typeof groups)[number] | null = null;
  let currentQuestion:
    | { id: string; question: string; answer: Block[] }
    | null = null;

  for (const block of blocks) {
    if (block.type === "heading" && block.level === 2) {
      currentGroup = { id: block.id, title: block.text, questions: [] };
      groups.push(currentGroup);
      currentQuestion = null;
      continue;
    }
    if (block.type === "heading" && block.level === 3) {
      if (!currentGroup) {
        currentGroup = { id: "group-1", title: "", questions: [] };
        groups.push(currentGroup);
      }
      currentQuestion = { id: block.id, question: block.text, answer: [] };
      currentGroup.questions.push(currentQuestion);
      continue;
    }
    if (currentQuestion) currentQuestion.answer.push(block);
  }

  return { lead, groups };
}
