import Anthropic from "@anthropic-ai/sdk";
import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
  type ChatSession,
  type FunctionDeclaration,
  type Part,
} from "@google/generative-ai";
import {
  CRAWL_SYSTEM_PROMPT,
  EXTRACTION_TOOL_SCHEMA,
  FETCH_PAGE_TOOL_SCHEMA,
  FINISH_TOOL_SCHEMA,
} from "./prompts";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TurnResult {
  toolCalls: ToolCall[];
  shouldStop: boolean;
}

export interface CrawlChat {
  supportsInlineExtraction: boolean;
  sendInitial(content: string): Promise<TurnResult>;
  sendToolResults(results: { id: string; content: string; isError?: boolean }[]): Promise<TurnResult>;
}

const GEMINI_CRAWL_TOOLS: FunctionDeclaration[] = [
  {
    name: FETCH_PAGE_TOOL_SCHEMA.name,
    description: FETCH_PAGE_TOOL_SCHEMA.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: { type: SchemaType.STRING, description: "Absolute URL on the same host as the starting URL." },
        reason: { type: SchemaType.STRING, description: "Brief note on why you're fetching this page." },
      },
      required: ["url"],
    },
  },
  {
    name: EXTRACTION_TOOL_SCHEMA.name,
    description: EXTRACTION_TOOL_SCHEMA.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        rows: {
          type: SchemaType.ARRAY,
          description: "One entry per species/opportunity + season type combination",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              category: { type: SchemaType.STRING, description: "Top-level activity type: Hunting, Fishing, Trapping, Licensing, or General" },
              species_opportunity: { type: SchemaType.STRING, description: "Species or license opportunity name" },
              season_type: { type: SchemaType.STRING, description: "Season or activity sub-type" },
              dates: { type: SchemaType.STRING, description: "All open/closed season dates and deadlines" },
              eligibility: { type: SchemaType.STRING, description: "Who may participate" },
              residency_age_rule: { type: SchemaType.STRING, description: "Residency definition and age-tier rules" },
              required_licenses: { type: SchemaType.STRING, description: "All licenses, permits, stamps, and tags required" },
              fees: { type: SchemaType.STRING, description: "All fees with resident vs nonresident breakdown" },
              lottery_window: { type: SchemaType.STRING, description: "Application window, draw system, preference points" },
              key_restrictions: { type: SchemaType.STRING, description: "Bag limits, weapon rules, harvest reporting, zone rules" },
              source_urls: { type: SchemaType.STRING, description: "Source URLs" },
              notes: { type: SchemaType.STRING, description: "Ambiguities, gaps, or stakeholder questions" },
              confidence: { type: SchemaType.NUMBER, description: "Confidence 0.0-1.0" },
            },
            required: [
              "category", "species_opportunity", "season_type", "dates",
              "eligibility", "residency_age_rule", "required_licenses", "fees",
              "lottery_window", "key_restrictions", "source_urls", "notes", "confidence",
            ],
          },
        },
      },
      required: ["rows"],
    },
  },
  {
    name: FINISH_TOOL_SCHEMA.name,
    description: FINISH_TOOL_SCHEMA.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reason: { type: SchemaType.STRING, description: "Short summary of why the crawl is stopping." },
      },
      required: ["reason"],
    },
  },
];

export function createCrawlChat(provider: string, model: string): CrawlChat {
  if (provider === "gemini") return new GeminiCrawlChat(model);
  if (provider === "claude") return new ClaudeCrawlChat(model);
  throw new Error(`Unknown crawl chat provider: ${provider}`);
}

class ClaudeCrawlChat implements CrawlChat {
  supportsInlineExtraction = true;
  private client: Anthropic;
  private model: string;
  private messages: Anthropic.MessageParam[] = [];

  constructor(model: string) {
    this.client = new Anthropic();
    this.model = model;
  }

  async sendInitial(content: string): Promise<TurnResult> {
    this.messages.push({ role: "user", content });
    return this.doTurn();
  }

  async sendToolResults(results: { id: string; content: string; isError?: boolean }[]): Promise<TurnResult> {
    this.messages.push({
      role: "user",
      content: results.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.id,
        content: r.content,
        is_error: r.isError,
      })),
    });
    return this.doTurn();
  }

  private async doTurn(): Promise<TurnResult> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8000,
      system: [
        { type: "text", text: CRAWL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        { name: FETCH_PAGE_TOOL_SCHEMA.name, description: FETCH_PAGE_TOOL_SCHEMA.description, input_schema: FETCH_PAGE_TOOL_SCHEMA.input_schema },
        { name: EXTRACTION_TOOL_SCHEMA.name, description: EXTRACTION_TOOL_SCHEMA.description, input_schema: EXTRACTION_TOOL_SCHEMA.input_schema },
        { name: FINISH_TOOL_SCHEMA.name, description: FINISH_TOOL_SCHEMA.description, input_schema: FINISH_TOOL_SCHEMA.input_schema, cache_control: { type: "ephemeral" } },
      ],
      messages: this.messages,
    });

    const response = await stream.finalMessage();
    console.log(`[crawl:claude] stop=${response.stop_reason} usage=${JSON.stringify(response.usage)}`);

    this.messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return { toolCalls: [], shouldStop: true };
    }

    const toolCalls = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    return { toolCalls, shouldStop: toolCalls.length === 0 };
  }
}

class GeminiCrawlChat implements CrawlChat {
  supportsInlineExtraction = false;
  private model: string;
  private chat: ChatSession | null = null;

  constructor(model: string) {
    this.model = model;
  }

  private getChat(): ChatSession {
    if (!this.chat) {
      const key = process.env.GOOGLE_AI_API_KEY;
      if (!key) throw new Error("GOOGLE_AI_API_KEY is not set");
      const client = new GoogleGenerativeAI(key);
      const genModel = client.getGenerativeModel({
        model: this.model,
        systemInstruction: CRAWL_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: GEMINI_CRAWL_TOOLS }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingMode.AUTO },
        },
      });
      this.chat = genModel.startChat();
    }
    return this.chat;
  }

  async sendInitial(content: string): Promise<TurnResult> {
    const result = await this.getChat().sendMessage(content);
    return this.parseTurn(result.response);
  }

  async sendToolResults(results: { id: string; content: string; isError?: boolean }[]): Promise<TurnResult> {
    const parts: Part[] = results.map((r) => ({
      functionResponse: {
        name: r.id,
        response: { result: r.content },
      },
    }));
    const payloadSize = JSON.stringify(parts).length;
    console.log(`[crawl:gemini] sending ${results.length} tool results (${payloadSize} chars)`);
    const result = await this.getChat().sendMessage(parts, { timeout: 120_000 });
    return this.parseTurn(result.response);
  }

  private parseTurn(response: { candidates?: Array<{ content?: { parts?: Part[] }; finishReason?: string }> }): TurnResult {
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.log(`[crawl:gemini] no content. finishReason=${candidate?.finishReason ?? "none"}`);
      return { toolCalls: [], shouldStop: true };
    }

    const toolCalls: ToolCall[] = [];
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.name,
          name: part.functionCall.name,
          input: (part.functionCall.args ?? {}) as Record<string, unknown>,
        });
      }
    }

    console.log(`[crawl:gemini] toolCalls=${toolCalls.length} names=[${toolCalls.map((t) => t.name).join(",")}] finishReason=${candidate.finishReason ?? "?"}`);
    return { toolCalls, shouldStop: toolCalls.length === 0 };
  }
}
