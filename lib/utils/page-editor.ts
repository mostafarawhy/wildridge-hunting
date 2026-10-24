import { isAllowedHref } from "@/lib/utils/page-blocks";

export type EditResult = { text: string; selectionStart: number; selectionEnd: number };

type LineKind = "h2" | "h3" | "bullet" | "numbered";

function lineStart(text: string, pos: number): number {
  const idx = text.lastIndexOf("\n", pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function lineEnd(text: string, pos: number): number {
  const idx = text.indexOf("\n", pos);
  return idx === -1 ? text.length : idx;
}

function expandToLines(text: string, start: number, end: number): { rangeStart: number; rangeEnd: number } {
  const rangeStart = lineStart(text, start);
  let effectiveEnd = end;
  if (end > start && end > 0 && text[end - 1] === "\n") {
    effectiveEnd = end - 1;
  }
  const rangeEnd = lineEnd(text, effectiveEnd);
  return { rangeStart, rangeEnd };
}

const PREFIX_PATTERN = /^(#{2,3} |- |\d+\. )/;

function stripLinePrefix(line: string): string {
  return line.replace(PREFIX_PATTERN, "");
}

function kindPrefixMatches(line: string, kind: LineKind): boolean {
  if (kind === "h2") return /^## /.test(line);
  if (kind === "h3") return /^### /.test(line);
  if (kind === "bullet") return /^- /.test(line);
  return /^\d+\. /.test(line);
}

function applyLinePrefix(kind: LineKind, index: number): string {
  if (kind === "h2") return "## ";
  if (kind === "h3") return "### ";
  if (kind === "bullet") return "- ";
  return `${index}. `;
}

function continuesList(line: string, kind: LineKind): boolean {
  return (kind === "bullet" || kind === "numbered") && kindPrefixMatches(line, kind);
}

export function toggleLinePrefix(
  text: string,
  start: number,
  end: number,
  kind: LineKind,
): EditResult {
  const { rangeStart, rangeEnd } = expandToLines(text, start, end);
  const before = text.slice(0, rangeStart);
  const selected = text.slice(rangeStart, rangeEnd);
  const after = text.slice(rangeEnd);

  const above = rangeStart > 0 ? text.slice(lineStart(text, rangeStart - 1), rangeStart - 1) : "";
  const below = rangeEnd < text.length ? text.slice(rangeEnd + 1, lineEnd(text, rangeEnd + 1)) : "";

  const lines = selected.split("\n");
  const nonEmptyIndexes = lines
    .map((line, i) => (line.trim() !== "" ? i : -1))
    .filter((i) => i !== -1);
  const emptyTarget = nonEmptyIndexes.length === 0;

  const alreadyAll =
    !emptyTarget && nonEmptyIndexes.every((i) => kindPrefixMatches(lines[i], kind));

  const aboveNumber = kind === "numbered" ? /^(\d+)\. /.exec(above) : null;
  let counter = aboveNumber ? Number(aboveNumber[1]) : 0;

  const middle = emptyTarget
    ? applyLinePrefix(kind, counter + 1)
    : lines
        .map((line) => {
          if (line.trim() === "") return line;
          const stripped = stripLinePrefix(line);
          if (alreadyAll) return stripped;
          counter += 1;
          return applyLinePrefix(kind, counter) + stripped;
        })
        .filter((line, i, all) => !(kind === "h2" || kind === "h3") || alreadyAll || line.trim() !== "" || i === all.length - 1)
        .join(kind === "h2" || kind === "h3" ? (alreadyAll ? "\n" : "\n\n") : "\n");

  const insertedPrefix =
    !alreadyAll && above.trim() !== "" && !continuesList(above, kind) ? "\n" : "";
  const insertedSuffix =
    !alreadyAll && below.trim() !== "" && !continuesList(below, kind) ? "\n" : "";

  const middleStart = before.length + insertedPrefix.length;
  const middleEnd = middleStart + middle.length;

  return {
    text: before + insertedPrefix + middle + insertedSuffix + after,
    selectionStart: emptyTarget ? middleEnd : middleStart,
    selectionEnd: middleEnd,
  };
}

function gapBefore(before: string): string {
  if (before === "") return "";
  const trailing = before.length - before.replace(/\n+$/, "").length;
  return "\n".repeat(Math.max(0, 2 - trailing));
}

function gapAfter(after: string): string {
  if (after === "") return "";
  const leading = after.length - after.replace(/^\n+/, "").length;
  return "\n".repeat(Math.max(0, 2 - leading));
}

export function insertBlock(
  text: string,
  start: number,
  end: number,
  template: string,
  selectFrom: number,
  selectTo: number,
): EditResult {
  const pos = lineEnd(text, end);
  const before = text.slice(0, pos);
  const after = text.slice(pos);

  const prefix = gapBefore(before);
  const suffix = gapAfter(after);

  const newText = before + prefix + template + suffix + after;
  const templateStart = before.length + prefix.length;

  return {
    text: newText,
    selectionStart: templateStart + selectFrom,
    selectionEnd: templateStart + selectTo,
  };
}

export function insertLink(text: string, start: number, end: number): EditResult {
  if (end > start) {
    const selected = text.slice(start, end);
    const inserted = `[${selected}](/page)`;
    const hrefStart = start + 1 + selected.length + 2;
    const hrefEnd = hrefStart + "/page".length;
    const newText = text.slice(0, start) + inserted + text.slice(end);
    return { text: newText, selectionStart: hrefStart, selectionEnd: hrefEnd };
  }

  const inserted = "[link text](/page)";
  const textStart = start + 1;
  const textEnd = textStart + "link text".length;
  const newText = text.slice(0, start) + inserted + text.slice(start);
  return { text: newText, selectionStart: textStart, selectionEnd: textEnd };
}

export type LintCode =
  | "LIST_NEEDS_GAP"
  | "BLOCK_NEEDS_GAP"
  | "MISSING_SPACE"
  | "BAD_LINK"
  | "LINK_PLACEHOLDER"
  | "FAQ_EMPTY_CATEGORY"
  | "FAQ_TEXT_BEFORE_QUESTION"
  | "PLACEHOLDERS";

export type LintIssue = {
  line: number;
  level: "warn" | "info";
  code: LintCode;
  detail?: string;
};

const LIST_LINE_PATTERN = /^(- |\d+\. )/;
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const PLACEHOLDER_PATTERN = /\[[^\]\n]+\](?!\()/g;

export function lintPageContent(text: string, isFaq: boolean): LintIssue[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const results: LintIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (LIST_LINE_PATTERN.test(line)) {
      const prev = i > 0 ? lines[i - 1] : "";
      if (prev.trim() !== "" && !LIST_LINE_PATTERN.test(prev) && !prev.startsWith(">")) {
        results.push({ line: lineNo, level: "warn", code: "LIST_NEEDS_GAP" });
      }
    }

    if (/^(#{2,3} |>)/.test(line)) {
      const prev = i > 0 ? lines[i - 1] : "";
      const continuesBox = line.startsWith(">") && prev.startsWith(">");
      if (prev.trim() !== "" && !continuesBox) {
        results.push({ line: lineNo, level: "warn", code: "BLOCK_NEEDS_GAP" });
      }
    }

    if (/^#{2,3}[^#\s]/.test(line) || /^>![^\s]/.test(line)) {
      results.push({ line: lineNo, level: "warn", code: "MISSING_SPACE" });
    }

    LINK_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_PATTERN.exec(line)) !== null) {
      const href = m[2];
      if (!isAllowedHref(href)) {
        results.push({ line: lineNo, level: "warn", code: "BAD_LINK", detail: href });
      } else if (href === "/page" || m[1] === "link text") {
        results.push({ line: lineNo, level: "warn", code: "LINK_PLACEHOLDER" });
      }
    }
  }

  if (isFaq) {
    for (let i = 0; i < lines.length; i++) {
      if (!/^## /.test(lines[i])) continue;
      const title = lines[i].slice(3);
      let hasQuestion = false;
      let textBeforeQuestionLine: number | null = null;

      for (let j = i + 1; j < lines.length; j++) {
        if (/^## /.test(lines[j])) break;
        if (/^### /.test(lines[j])) {
          hasQuestion = true;
          break;
        }
        if (
          textBeforeQuestionLine === null &&
          lines[j].trim() !== "" &&
          !/^#{2,3} /.test(lines[j])
        ) {
          textBeforeQuestionLine = j + 1;
        }
      }

      if (!hasQuestion) {
        results.push({ line: i + 1, level: "warn", code: "FAQ_EMPTY_CATEGORY", detail: title });
      } else if (textBeforeQuestionLine !== null) {
        results.push({ line: textBeforeQuestionLine, level: "warn", code: "FAQ_TEXT_BEFORE_QUESTION" });
      }
    }
  }

  PLACEHOLDER_PATTERN.lastIndex = 0;
  const placeholderMatches = text.match(PLACEHOLDER_PATTERN);
  if (placeholderMatches && placeholderMatches.length > 0) {
    results.push({
      line: 0,
      level: "info",
      code: "PLACEHOLDERS",
      detail: String(placeholderMatches.length),
    });
  }

  return results;
}
