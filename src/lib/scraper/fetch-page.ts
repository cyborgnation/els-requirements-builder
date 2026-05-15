import type { BrowserContext } from "playwright";
import { extractMainContent } from "./parsers/generic";
import { extractTables } from "./parsers/table-extractor";

export interface PageLink {
  href: string;
  anchor: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  links: PageLink[];
}

export interface FetchPageOptions {
  sameHostAs: string;
  maxTextChars?: number;
  maxLinks?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_TEXT = 20000;
const DEFAULT_MAX_LINKS = 50;
const DEFAULT_TIMEOUT = 30000;

export function normalizeHost(input: string): string {
  try {
    const host = new URL(input).host.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return input.toLowerCase().replace(/^www\./, "");
  }
}

export async function fetchPage(
  context: BrowserContext,
  url: string,
  opts: FetchPageOptions
): Promise<FetchedPage> {
  const maxText = opts.maxTextChars ?? DEFAULT_MAX_TEXT;
  const maxLinks = opts.maxLinks ?? DEFAULT_MAX_LINKS;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const targetHost = normalizeHost(opts.sameHostAs);

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    const title = await page.title();
    const html = await page.content();
    const rawAnchors = await page.$$eval("a[href]", (els) =>
      els
        .map((el) => {
          const a = el as HTMLAnchorElement;
          return { href: a.href, anchor: (a.textContent || "").trim() };
        })
        .filter((l) => l.href && !l.href.startsWith("javascript:"))
    );

    const text = buildPageText(html, maxText);
    const links = filterLinks(rawAnchors, targetHost, maxLinks);

    return { url, title, text, links };
  } finally {
    await page.close();
  }
}

function buildPageText(html: string, maxChars: number): string {
  const mainText = extractMainContent(html);
  const tables = extractTables(html);

  let text = mainText;
  if (tables.length > 0) {
    text += "\n\n--- TABLES ---\n\n";
    tables.forEach((table, i) => {
      text += `Table ${i + 1}:\n`;
      for (const row of table) {
        text += Object.entries(row)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ");
        text += "\n";
      }
      text += "\n";
    });
  }

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + `\n\n[truncated at ${maxChars} chars]`;
  }
  return text;
}

function filterLinks(
  raw: PageLink[],
  targetHost: string,
  max: number
): PageLink[] {
  const seen = new Set<string>();
  const out: PageLink[] = [];

  for (const link of raw) {
    let normalized: string;
    try {
      const u = new URL(link.href);
      u.hash = "";
      normalized = u.toString();
      if (normalizeHost(normalized) !== targetHost) continue;
    } catch {
      continue;
    }

    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const anchor = link.anchor.replace(/\s+/g, " ").slice(0, 200);
    out.push({ href: normalized, anchor });

    if (out.length >= max) break;
  }
  return out;
}
