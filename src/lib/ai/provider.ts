import Anthropic from "@anthropic-ai/sdk";
import {
  GoogleGenerativeAI,
  type FunctionDeclaration,
} from "@google/generative-ai";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_TOOL_SCHEMA,
  getGeminiFunctionDeclaration,
} from "./prompts";
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
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [
        {
          name: EXTRACTION_TOOL_SCHEMA.name,
          description: EXTRACTION_TOOL_SCHEMA.description,
          input_schema: EXTRACTION_TOOL_SCHEMA.input_schema,
        },
      ],
      tool_choice: { type: "tool", name: "record_requirements" },
      messages: [
        {
          role: "user",
          content: `Extract all business and functional requirements from the following text. Be thorough — identify every distinct rule, fee, date, eligibility criterion, and system requirement.\n\n---\n\n${text}`,
        },
      ],
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "record_requirements") {
        const input = block.input as {
          requirements: Array<{
            category: string;
            subcategory?: string;
            title: string;
            description: string;
            raw_source_text: string;
            confidence: number;
            metadata?: Record<string, unknown>;
          }>;
        };
        return input.requirements.map((r) => ({
          category: r.category as ExtractedRequirement["category"],
          subcategory: r.subcategory,
          title: r.title,
          description: r.description,
          rawSourceText: r.raw_source_text,
          confidence: r.confidence,
          metadata: r.metadata,
        }));
      }
    }

    return [];
  }
}

class GeminiProvider implements AIProviderInterface {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  async extractRequirements(text: string): Promise<ExtractedRequirement[]> {
    const model = this.client.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: [
        {
          functionDeclarations: [
            getGeminiFunctionDeclaration() as FunctionDeclaration,
          ],
        },
      ],
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `Extract all business and functional requirements from the following text. Be thorough — identify every distinct rule, fee, date, eligibility criterion, and system requirement.\n\n---\n\n${text}`
    );

    const response = result.response;
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
      const call = calls[0];
      if (call.name === "record_requirements") {
        const args = call.args as {
          requirements: Array<{
            category: string;
            subcategory?: string;
            title: string;
            description: string;
            raw_source_text: string;
            confidence: number;
            metadata?: Record<string, unknown>;
          }>;
        };
        return args.requirements.map((r) => ({
          category: r.category as ExtractedRequirement["category"],
          subcategory: r.subcategory,
          title: r.title,
          description: r.description,
          rawSourceText: r.raw_source_text,
          confidence: r.confidence,
          metadata: r.metadata,
        }));
      }
    }

    return [];
  }
}

const providers: Record<string, AIProviderInterface> = {};

export function getProvider(name: string): AIProviderInterface {
  if (!providers[name]) {
    switch (name) {
      case "claude":
        providers[name] = new ClaudeProvider();
        break;
      case "gemini":
        providers[name] = new GeminiProvider();
        break;
      default:
        throw new Error(`Unknown AI provider: ${name}`);
    }
  }
  return providers[name];
}
