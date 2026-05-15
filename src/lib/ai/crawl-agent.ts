import Anthropic from "@anthropic-ai/sdk";
import {
  CRAWL_SYSTEM_PROMPT,
  EXTRACTION_TOOL_SCHEMA,
  FETCH_PAGE_TOOL_SCHEMA,
  FINISH_TOOL_SCHEMA,
} from "./prompts";
import type { FetchedPage } from "@/lib/scraper/fetch-page";
import { normalizeHost } from "@/lib/scraper/fetch-page";
import type { ExtractedRequirement } from "@/types";

const MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_TURNS = 40;
const MAX_TOKENS_PER_TURN = 8000;

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
  const client = new Anthropic();

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

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Start crawling at: ${opts.startUrl}\n\nThe site host is ${targetHost}. Only links on this host will be allowed. Page budget: ${maxPages}. Turn budget: ${maxTurns}. Begin by fetching the starting URL.`,
    },
  ];

  emit();

  while (turns < maxTurns) {
    turns++;
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS_PER_TURN,
      system: [
        {
          type: "text",
          text: CRAWL_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: FETCH_PAGE_TOOL_SCHEMA.name,
          description: FETCH_PAGE_TOOL_SCHEMA.description,
          input_schema: FETCH_PAGE_TOOL_SCHEMA.input_schema,
        },
        {
          name: EXTRACTION_TOOL_SCHEMA.name,
          description: EXTRACTION_TOOL_SCHEMA.description,
          input_schema: EXTRACTION_TOOL_SCHEMA.input_schema,
        },
        {
          name: FINISH_TOOL_SCHEMA.name,
          description: FINISH_TOOL_SCHEMA.description,
          input_schema: FINISH_TOOL_SCHEMA.input_schema,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const response = await stream.finalMessage();
    console.log(
      `[crawl] turn=${turns} stop=${response.stop_reason} usage=${JSON.stringify(response.usage)}`
    );

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      stopReason = "model_ended_turn_without_finish";
      break;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      stopReason = "no_tool_use";
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let finishCalled = false;

    for (const block of toolUses) {
      if (block.name === FETCH_PAGE_TOOL_SCHEMA.name) {
        const input = block.input as { url?: string };
        const url = (input.url || "").trim();
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
          pageTexts.push({
            url: result.normalizedUrl,
            title: result.title,
            text: result.text,
          });
          currentUrl = result.normalizedUrl;
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.content,
          is_error: !result.ok,
        });
        emit();
      } else if (block.name === EXTRACTION_TOOL_SCHEMA.name) {
        const input = block.input as RecordRowsInput;
        const added = ingestRows(input, rows);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Recorded ${added} new row(s). Total rows so far: ${rows.length}.`,
        });
        emit();
      } else if (block.name === FINISH_TOOL_SCHEMA.name) {
        const input = block.input as { reason?: string };
        stopReason = input.reason || "finish_called";
        finishCalled = true;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Crawl ended.",
        });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (finishCalled) break;

    if (pagesFetched >= maxPages) {
      messages.push({
        role: "user",
        content: `Page budget exhausted (${pagesFetched}/${maxPages}). Record any remaining rows you can and call \`finish\` to end the crawl.`,
      });
    }
  }

  if (turns >= maxTurns && stopReason === "max_turns_reached") {
    stopReason = "max_turns_reached";
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
  | { ok: false; content: string; normalizedUrl?: string; title?: string; text?: string }
> {
  if (!args.url) {
    return { ok: false, content: "Missing `url` parameter." };
  }
  if (args.pagesFetched >= args.maxPages) {
    return {
      ok: false,
      content: `Page budget exhausted (${args.pagesFetched}/${args.maxPages}). Call \`finish\` now.`,
    };
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
    return {
      ok: false,
      content: `URL is off-host (allowed host: ${args.targetHost}). Only same-host URLs may be fetched.`,
    };
  }

  if (args.visited.has(normalized)) {
    return {
      ok: false,
      content: `Already visited: ${normalized}. Pick a different URL.`,
    };
  }

  try {
    const page = await args.fetchPage(normalized);
    const linkSummary = page.links.length
      ? page.links
          .map((l) => `- ${l.href}${l.anchor ? `  (“${l.anchor}”)` : ""}`)
          .join("\n")
      : "(no same-host links found)";
    const content = `URL: ${page.url}
Title: ${page.title}

--- PAGE TEXT ---
${page.text}

--- LINKS (same host) ---
${linkSummary}`;
    return { ok: true, normalizedUrl: normalized, title: page.title, text: page.text, content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, content: `Fetch failed: ${msg}`, normalizedUrl: normalized };
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
