import Anthropic from "@anthropic-ai/sdk";
import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
} from "@google/generative-ai";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL_SCHEMA } from "./prompts";
import type { ExtractedRequirement } from "@/types";

export interface AIProviderInterface {
  name: string;
  extractRequirements(text: string, model: string): Promise<ExtractedRequirement[]>;
}

function mapRows(rows: Array<Record<string, unknown>>): ExtractedRequirement[] {
  return rows.map((r) => ({
    category: String(r.category) as ExtractedRequirement["category"],
    species_opportunity: String(r.species_opportunity),
    season_type: String(r.season_type),
    dates: String(r.dates),
    eligibility: String(r.eligibility),
    residency_age_rule: String(r.residency_age_rule),
    required_licenses: String(r.required_licenses),
    fees: String(r.fees),
    lottery_window: String(r.lottery_window),
    key_restrictions: String(r.key_restrictions),
    source_urls: String(r.source_urls),
    notes: String(r.notes),
    confidence: Number(r.confidence),
  }));
}

const USER_PROMPT = `Extract all species/opportunity matrix rows from the following regulatory text. Create one row per species + season type combination, capturing dates, fees, eligibility, licensing, lottery, and restrictions for each.\n\n---\n\n`;

class ClaudeProvider implements AIProviderInterface {
  name = "claude";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async extractRequirements(text: string, model: string): Promise<ExtractedRequirement[]> {
    const t0 = Date.now();
    let firstEventAt: number | null = null;
    let eventCount = 0;
    const stream = this.client.messages.stream({
      model,
      max_tokens: 16000,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [
        {
          name: EXTRACTION_TOOL_SCHEMA.name,
          description: EXTRACTION_TOOL_SCHEMA.description,
          input_schema: EXTRACTION_TOOL_SCHEMA.input_schema,
        },
      ],
      tool_choice: { type: "tool", name: "record_matrix_rows" },
      messages: [
        { role: "user", content: USER_PROMPT + text },
      ],
    });

    let inputJsonChars = 0;
    let lastEventAt = t0;
    stream.on("streamEvent", () => {
      eventCount++;
      lastEventAt = Date.now();
      if (firstEventAt === null) {
        firstEventAt = lastEventAt;
        console.log(`[claude] first event after ${firstEventAt - t0}ms (text=${text.length} chars)`);
      }
    });
    stream.on("inputJson", (partial) => {
      inputJsonChars += partial.length;
    });
    stream.on("error", (err) => {
      console.error(`[claude] stream error after ${Date.now() - t0}ms, events=${eventCount}:`, err);
    });

    const heartbeat = setInterval(() => {
      const sinceLast = Date.now() - lastEventAt;
      console.log(`[claude] heartbeat t=${Date.now() - t0}ms events=${eventCount} inputJsonChars=${inputJsonChars} sinceLastEvent=${sinceLast}ms`);
    }, 5000);

    let response;
    try {
      response = await stream.finalMessage();
    } finally {
      clearInterval(heartbeat);
    }
    console.log(`[claude] finalMessage in ${Date.now() - t0}ms, events=${eventCount}, inputJsonChars=${inputJsonChars}, stop=${response.stop_reason}, usage=${JSON.stringify(response.usage)}`);

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "record_matrix_rows") {
        const input = block.input as { rows?: Array<Record<string, unknown>> };
        if (!Array.isArray(input.rows)) return [];
        return mapRows(input.rows);
      }
    }

    return [];
  }
}

class GeminiProvider implements AIProviderInterface {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor() {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY is not set");
    this.client = new GoogleGenerativeAI(key);
  }

  async extractRequirements(text: string, model: string): Promise<ExtractedRequirement[]> {
    const genModel = this.client.getGenerativeModel({
      model,
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      tools: [
        {
          functionDeclarations: [
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
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: ["record_matrix_rows"],
        },
      },
    });

    const t0 = Date.now();
    console.log(`[gemini] starting extraction with ${model} (${text.length} chars)`);

    const result = await genModel.generateContent(USER_PROMPT + text);
    const response = result.response;
    console.log(`[gemini] done in ${Date.now() - t0}ms`);

    const candidate = response.candidates?.[0];
    if (!candidate) return [];

    for (const part of candidate.content.parts) {
      if (part.functionCall?.name === "record_matrix_rows") {
        const args = part.functionCall.args as { rows?: Array<Record<string, unknown>> };
        if (!Array.isArray(args.rows)) return [];
        return mapRows(args.rows);
      }
    }

    return [];
  }
}

const providers: Record<string, AIProviderInterface> = {};

export function getProvider(name: string): AIProviderInterface {
  if (!providers[name]) {
    if (name === "claude") {
      providers[name] = new ClaudeProvider();
    } else if (name === "gemini") {
      providers[name] = new GeminiProvider();
    } else {
      throw new Error(`Unknown AI provider: ${name}`);
    }
  }
  return providers[name];
}
