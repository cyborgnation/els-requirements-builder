import { createCrawlChat } from "./crawl-chat";
import { extractRequirementsFromText } from "./extract-requirements";
import { EXTRACTION_TOOL_SCHEMA, FETCH_PAGE_TOOL_SCHEMA, FINISH_TOOL_SCHEMA } from "./prompts";
import type { FetchedPage } from "@/lib/scraper/fetch-page";
import { normalizeHost } from "@/lib/scraper/fetch-page";
import type { ExtractedRequirement } from "@/types";

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_TURNS = 40;

export interface CrawlProgress {
  pagesFetched: number;
  turns: number;
  rowsFound: number;
  currentUrl: string | null;
  visited: string[];
  status: "running" | "completed" | "stopped";
  stopReason?: string;
}

export interface CrawlResult {
  rows: ExtractedRequirement[];
  visited: string[];
  pagesFetched: number;
  turns: number;
  pageTexts: { url: string; title: string; text: string }[];
  stopReason: string;
}

export interface CrawlAgentOptions {
  startUrl: string;
  fetchPage: (url: string) => Promise<FetchedPage>;
  onProgress?: (p: CrawlProgress) => void;
  maxPages?: number;
  maxTurns?: number;
  provider?: string;
  model?: string;
}

type RecordRowsInput = {
  rows?: Array<{
    category: string;
    species_opportunity: string;
    season_type: string;
    dates: string;
    eligibility: string;
    residency_age_rule: string;
    required_licenses: string;
    fees: string;
    lottery_window: string;
    key_restrictions: string;
    source_urls: string;
    notes: string;
    confidence: number;
  }>;
};

export async function crawlAgent(opts: CrawlAgentOptions): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  const targetHost = normalizeHost(opts.startUrl);
  const provider = opts.provider ?? "gemini";
  const model = opts.model ?? (provider === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-4-6");

  const chat = createCrawlChat(provider, model);

  const visited = new Set<string>();
  const pageTexts: { url: string; title: string; text: string }[] = [];
  const rows: ExtractedRequirement[] = [];
  let pagesFetched = 0;
  let turns = 0;
  let stopReason = "max_turns_reached";
  let currentUrl: string | null = null;

  const emit = (status: CrawlProgress["status"] = "running") => {
    opts.onProgress?.({
      pagesFetched,
      turns,
      rowsFound: rows.length,
      currentUrl,
      visited: Array.from(visited),
      status,
      stopReason: status === "running" ? undefined : stopReason,
    });
  };

  emit();

  const initialMessage = `Start crawling at: ${opts.startUrl}\n\nThe site host is ${targetHost}. Only links on this host will be allowed. Page budget: ${maxPages}. Turn budget: ${maxTurns}. Begin by fetching the starting URL.`;
  let turnResult = await chat.sendInitial(initialMessage);
  turns++;
  console.log(`[crawl] turn=${turns} toolCalls=${turnResult.toolCalls.length}`);

  while (turns < maxTurns) {
    if (turnResult.shouldStop && turnResult.toolCalls.length === 0) {
      stopReason = "model_ended_turn";
      break;
    }

    const toolResults: { id: string; content: string; isError?: boolean }[] = [];
    let finishCalled = false;

    for (const call of turnResult.toolCalls) {
      if (call.name === FETCH_PAGE_TOOL_SCHEMA.name) {
        const url = (String(call.input.url || "")).trim();
        const result = await runFetchPage({
          url,
          targetHost,
          visited,
          pagesFetched,
          maxPages,
          fetchPage: opts.fetchPage,
        });
        if (result.ok) {
          pagesFetched++;
          visited.add(result.normalizedUrl);
          pageTexts.push({ url: result.normalizedUrl, title: result.title, text: result.text });
          currentUrl = result.normalizedUrl;
        }
        toolResults.push({ id: call.id, content: result.content, isError: !result.ok });
        emit();
      } else if (call.name === EXTRACTION_TOOL_SCHEMA.name) {
        const input = call.input as RecordRowsInput;
        const added = ingestRows(input, rows);
        toolResults.push({ id: call.id, content: `Recorded ${added} new row(s). Total rows so far: ${rows.length}.` });
        emit();
      } else if (call.name === FINISH_TOOL_SCHEMA.name) {
        const reason = String(call.input.reason || "finish_called");
        stopReason = reason;
        finishCalled = true;
        toolResults.push({ id: call.id, content: "Crawl ended." });
      } else {
        toolResults.push({ id: call.id, content: `Unknown tool: ${call.name}`, isError: true });
      }
    }

    if (finishCalled) break;

    if (pagesFetched >= maxPages && toolResults.length > 0) {
      toolResults[toolResults.length - 1].content +=
        `\n\n[SYSTEM] Page budget exhausted (${pagesFetched}/${maxPages}). Call \`finish\` now.`;
    }

    turns++;
    turnResult = await chat.sendToolResults(toolResults);
    console.log(`[crawl] turn=${turns} toolCalls=${turnResult.toolCalls.length}`);
  }

  if (!chat.supportsInlineExtraction && pageTexts.length > 0 && rows.length === 0) {
    console.log(`[crawl] post-crawl extraction on ${pageTexts.length} pages`);
    const combinedText = pageTexts
      .map((p) => `=== ${p.url} ===\n${p.title}\n\n${p.text}`)
      .join("\n\n---\n\n");
    const extracted = await extractRequirementsFromText(combinedText, provider, model);
    rows.push(...extracted);
    console.log(`[crawl] post-crawl extraction found ${extracted.length} rows`);
  }

  const deduped = dedupeRows(rows);
  emit("completed");

  return {
    rows: deduped,
    visited: Array.from(visited),
    pagesFetched,
    turns,
    pageTexts,
    stopReason,
  };
}

async function runFetchPage(args: {
  url: string;
  targetHost: string;
  visited: Set<string>;
  pagesFetched: number;
  maxPages: number;
  fetchPage: (url: string) => Promise<FetchedPage>;
}): Promise<
  | { ok: true; normalizedUrl: string; title: string; text: string; content: string }
  | { ok: false; content: string }
> {
  if (!args.url) {
    return { ok: false, content: "Missing `url` parameter." };
  }
  if (args.pagesFetched >= args.maxPages) {
    return { ok: false, content: `Page budget exhausted (${args.pagesFetched}/${args.maxPages}). Call \`finish\` now.` };
  }

  let normalized: string;
  try {
    const u = new URL(args.url);
    u.hash = "";
    normalized = u.toString();
  } catch {
    return { ok: false, content: `Invalid URL: ${args.url}` };
  }

  if (normalizeHost(normalized) !== args.targetHost) {
    return { ok: false, content: `URL is off-host (allowed host: ${args.targetHost}). Only same-host URLs may be fetched.` };
  }

  if (args.visited.has(normalized)) {
    return { ok: false, content: `Already visited: ${normalized}. Pick a different URL.` };
  }

  try {
    const page = await args.fetchPage(normalized);
    const linkSummary = page.links.length
      ? page.links.map((l) => `- ${l.href}${l.anchor ? `  ("${l.anchor}")` : ""}`).join("\n")
      : "(no same-host links found)";
    const content = `URL: ${page.url}\nTitle: ${page.title}\n\n--- PAGE TEXT ---\n${page.text}\n\n--- LINKS (same host) ---\n${linkSummary}`;
    return { ok: true, normalizedUrl: normalized, title: page.title, text: page.text, content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, content: `Fetch failed: ${msg}` };
  }
}

function ingestRows(input: RecordRowsInput, target: ExtractedRequirement[]): number {
  if (!Array.isArray(input.rows)) return 0;
  let added = 0;
  for (const r of input.rows) {
    target.push({
      category: r.category as ExtractedRequirement["category"],
      species_opportunity: r.species_opportunity,
      season_type: r.season_type,
      dates: r.dates,
      eligibility: r.eligibility,
      residency_age_rule: r.residency_age_rule,
      required_licenses: r.required_licenses,
      fees: r.fees,
      lottery_window: r.lottery_window,
      key_restrictions: r.key_restrictions,
      source_urls: r.source_urls,
      notes: r.notes,
      confidence: r.confidence,
    });
    added++;
  }
  return added;
}

function dedupeRows(rows: ExtractedRequirement[]): ExtractedRequirement[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.category}||${r.species_opportunity.toLowerCase().trim()}||${r.season_type.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
