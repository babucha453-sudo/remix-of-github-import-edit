import { withTrailingSlash } from "@/lib/url/withTrailingSlash";

/**
 * stripMarkdown - Removes markdown syntax from text (for headings/labels)
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/\*([^*]+)\*/g, "$1") // *italic*
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url)
    .replace(/^#{1,6}\s+/gm, "") // ## headings
    .trim();
}

type ListKind = "ul" | "ol";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.includes("appointpanda.com");
}

function normalizeHref(rawHref: string): string | null {
  if (!rawHref) return null;

  let href = rawHref.trim();

  // strip surrounding punctuation common in generated text
  href = href.replace(/^[<(]+/, "").replace(/[>),.;]+$/, "");

  if (href.startsWith("/")) {
    return withTrailingSlash(href);
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      const url = new URL(href);
      // if it's our domain, convert to internal path (keeps SPA routing + canonical)
      if (url.hostname.includes("appointpanda.com")) {
        return withTrailingSlash(url.pathname + url.search + url.hash);
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  return null;
}

function buildAnchor(innerHtml: string, href: string): string {
  const internal = isInternalHref(href);

  if (internal) {
    return `<a href="${href}" class="text-primary hover:text-primary/80 underline underline-offset-2 font-medium transition-colors">${innerHtml}</a>`;
  }

  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 underline underline-offset-2 font-medium transition-colors">${innerHtml}</a>`;
}

/**
 * Converts common generated patterns into proper anchor-text links.
 * Example: "**General Dentistry:** /services/general-dentistry/" becomes a link on the bold label.
 */
function linkifyGeneratedLabelUrl(escapedText: string): string {
  let text = escapedText;

  // Pattern A: **Label:** /path
  // Pattern B: **Label** /path
  text = text.replace(
    /\*\*([^*]+?)\*\*\s*(https?:\/\/[^\s]+|\/[^\s]+)/g,
    (_, label: string, rawHref: string) => {
      const href = normalizeHref(rawHref);
      if (!href) return `**${label}** ${rawHref}`;

      const labelHtml = `<strong class="font-semibold text-foreground">${label}</strong>`;
      return buildAnchor(labelHtml, href);
    }
  );

  // Pattern C: Label: /path (no bold markers)
  text = text.replace(
    /(^|\s)([A-Z][^\n:]{2,60}:)\s*(\/[^\s]+)(?=\s|$)/g,
    (full, prefix: string, label: string, rawHref: string) => {
      const href = normalizeHref(rawHref);
      if (!href) return full;

      const labelHtml = `<strong class="font-semibold text-foreground">${label}</strong>`;
      return `${prefix}${buildAnchor(labelHtml, href)}`;
    }
  );

  return text;
}

function parseInlineMarkdownToHtml(escapedText: string): string {
  let html = escapedText;

  // First: convert the generator's "label + url" patterns into anchor-text links
  html = linkifyGeneratedLabelUrl(html);

  // Fix malformed markdown links missing '[' (common in AI output): Text](url)
  html = html.replace(
    /(^|\s)([^\s\[][^\n\]]{1,80})\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)?/g,
    (full, prefix: string, text: string, rawHref: string) => {
      const href = normalizeHref(rawHref);
      if (!href) return full;
      return `${prefix}${buildAnchor(text, href)}`;
    }
  );

  // Markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, rawHref: string) => {
    const href = normalizeHref(rawHref);
    if (!href) return text;

    return buildAnchor(text, href);
  });

  // Bold/Emphasis
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');

  // single-star emphasis used as "bold" in generated content
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<strong class="font-semibold text-foreground">$2</strong>');

  // Auto-link absolute URLs if present
  html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)(?=\s|$)/g, (full, prefix: string, rawHref: string) => {
    const href = normalizeHref(rawHref);
    if (!href) return full;
    return `${prefix}${buildAnchor(rawHref, href)}`;
  });

  // Auto-link plain internal paths if present (e.g. /nj/bergenfield/)
  html = html.replace(/(^|\s)(\/[^\s<]+)(?=\s|$)/g, (full, prefix: string, rawHref: string) => {
    // Heuristic: require at least two slashes to avoid matching fractions like 1/2
    const slashCount = (rawHref.match(/\//g) || []).length;
    if (slashCount < 2) return full;

    const href = normalizeHref(rawHref);
    if (!href) return full;

    return `${prefix}${buildAnchor(rawHref, href)}`;
  });

  return html;
}

function isUnorderedListLine(line: string): boolean {
  return /^\s*([*-]|•)\s+/.test(line);
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line);
}

function getListKind(line: string): ListKind | null {
  if (isUnorderedListLine(line)) return "ul";
  if (isOrderedListLine(line)) return "ol";
  return null;
}

function stripListMarker(line: string, kind: ListKind): string {
  if (kind === "ul") return line.replace(/^\s*([*-]|•)\s+/, "");
  return line.replace(/^\s*\d+\.\s+/, "");
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  const cells = trimmed
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  if (cells.length < 2) return false;

  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function isTableHeaderStart(lines: string[], i: number): boolean {
  const current = lines[i]?.trim() ?? "";
  const next = lines[i + 1]?.trim() ?? "";

  const pipeCount = (current.match(/\|/g) || []).length;
  if (pipeCount < 2) return false;

  return isTableSeparatorLine(next);
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const raw = trimmed.split("|").map((c) => c.trim());

  if (trimmed.startsWith("|")) raw.shift();
  if (trimmed.endsWith("|")) raw.pop();

  return raw;
}

function renderTable(headerLine: string, bodyLines: string[]): string {
  const headerCells = parseTableRow(headerLine).map(parseInlineMarkdownToHtml);
  const bodyRows = bodyLines.map((l) => parseTableRow(l).map(parseInlineMarkdownToHtml));

  let html = '<div class="not-prose overflow-x-auto my-4 rounded-xl border border-border bg-card">';
  html += '<table class="w-full min-w-[520px] text-sm">';

  html += '<thead class="bg-muted/50"><tr>';
  headerCells.forEach((cell) => {
    html += `<th class="px-4 py-3 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">${cell}</th>`;
  });
  html += "</tr></thead>";

  html += "<tbody>";
  bodyRows.forEach((cells, idx) => {
    const rowClass = idx % 2 === 0 ? "bg-background" : "bg-muted/20";
    html += `<tr class="${rowClass}">`;
    cells.forEach((cell, cellIdx) => {
      const cellClass =
        cellIdx === 0
          ? "px-4 py-3 text-foreground font-medium border-b border-border/50 align-top"
          : "px-4 py-3 text-muted-foreground border-b border-border/50 align-top";
      html += `<td class="${cellClass}">${cell}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody>";

  html += "</table></div>";
  return html;
}

/**
 * parseMarkdownToHtml - Converts markdown-style content to safe HTML.
 * Fixes the exact issues you reported:
 * - list items like "* **General Dentistry:**" become real lists (no visible stars)
 * - generated label+URL patterns become clickable anchor text (URL is removed)
 * - markdown tables render as a clean, responsive table
 * - Strips H1 headings and code fences to prevent duplication with Hero
 */
export function parseMarkdownToHtml(content: string): string {
  if (!content) return "";

  // Strip markdown code fences (```markdown ... ```) that wrap AI output
  let cleaned = content
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Strip H1 headings (# Title) - these are rendered in the Hero section
  cleaned = cleaned.replace(/^#\s+[^\n]+\n*/gm, "").trim();

  const escaped = escapeHtml(cleaned.replace(/\r\n/g, "\n").trim());
  const lines = escaped.split("\n");

  const blocks: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const raw = paragraphLines.map((l) => l.trimEnd()).join("\n").trim();
    paragraphLines = [];

    if (!raw) return;

    // Preserve soft line breaks inside a paragraph
    const rendered = raw
      .split("\n")
      .map((l) => parseInlineMarkdownToHtml(l))
      .join("<br/>");

    blocks.push(`<p class="mb-3">${rendered}</p>`);
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line => paragraph break
    if (!trimmed) {
      flushParagraph();
      i++;
      continue;
    }

    // Table block
    if (isTableHeaderStart(lines, i)) {
      flushParagraph();

      const headerLine = lines[i];
      // skip separator line
      i += 2;

      const bodyLines: string[] = [];
      while (i < lines.length) {
        const rowLine = lines[i];
        const rowTrimmed = rowLine.trim();
        if (!rowTrimmed) break;

        const pipeCount = (rowTrimmed.match(/\|/g) || []).length;
        if (pipeCount < 2) break;

        // stop if a new block starts
        if (getListKind(rowLine)) break;

        bodyLines.push(rowLine);
        i++;
      }

      blocks.push(renderTable(headerLine, bodyLines));
      continue;
    }

    // List block
    const listKind = getListKind(line);
    if (listKind) {
      flushParagraph();

      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const kindHere = getListKind(current);
        if (kindHere !== listKind) break;

        const itemText = stripListMarker(current, listKind);
        items.push(parseInlineMarkdownToHtml(itemText.trim()));
        i++;
      }

      const wrapperClass =
        listKind === "ul"
          ? "my-4 pl-6 list-disc space-y-2"
          : "my-4 pl-6 list-decimal space-y-2";

      blocks.push(
        `<${listKind} class="${wrapperClass}">${items
          .map((it) => `<li class="leading-relaxed">${it}</li>`)
          .join("")}</${listKind}>`
      );
      continue;
    }

    // normal paragraph line
    paragraphLines.push(line);
    i++;
  }

  flushParagraph();

  return blocks.join("");
}

/**
 * Simple inline renderer (no paragraphs/lists/tables) – useful for small snippets.
 */
export function parseSimpleMarkdown(content: string): string {
  if (!content) return "";
  const escaped = escapeHtml(content.replace(/\r\n/g, "\n"));
  return parseInlineMarkdownToHtml(escaped);
}
