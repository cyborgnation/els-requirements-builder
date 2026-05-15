import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL_SCHEMA } from "./prompts";
import type { ExtractedRequirement } from "@/types";

export interface AIProviderInterface {
  name: string;
  extractRequirements(text: string): Promise<ExtractedRequirement[]>;
}

class ClaudeProvider implements AIProviderInterface {
  name = "claude";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async extractRequirements(text: string): Promise<ExtractedRequirement[]> {
    // Streaming is required: non-streaming requests get dropped at the ~3-minute
    // network idle timeout when the model takes long enough to generate up to
    // max_tokens, even though token usage is still billed.
    const t0 = Date.now();
    let firstEventAt: number | null = null;
    let eventCount = 0;
    const stream = this.client.messages.stream({
      model: "claude-sonnet-4-6",
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
        {
          role: "user",
          content: `Extract all species/opportunity matrix rows from the following regulatory text. Create one row per species + season type combination, capturing dates, fees, eligibility, licensing, lottery, and restrictions for each.\n\n---\n\n${text}`,
        },
      ],
    });

    let inputJsonChars = 0;
    let lastEventAt = t0;
    stream.on("streamEvent", (ev) => {
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
        const input = block.input as {
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
        if (!Array.isArray(input.rows)) return [];
        return input.rows.map((r) => ({
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
        }));
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
    } else {
      throw new Error(`Unknown AI provider: ${name}`);
    }
  }
  return providers[name];
}
