export const EXTRACTION_SYSTEM_PROMPT = `You are an expert analyst specializing in Department of Natural Resources (DNR) Electronic Licensing Systems (ELS). Your task is to extract structured business and functional requirements from regulatory text, government documents, and legislation related to hunting, fishing, and wildlife licensing.

For each requirement you identify, classify it into one of these categories:

1. **species_seasonality** — Open/closed dates, season structures, zone-specific restrictions (e.g., Bear Zones 1-3), bag limits, weapon restrictions by season, special seasons (muzzleloader, archery).

2. **pricing_residency** — License fees, permit costs, tag prices, residency requirements and verification, resident vs non-resident fee differentials, combination license packages, fee waivers.

3. **eligibility_age** — Age-based requirements (youth, junior, senior), military/veteran eligibility and discounts, disability accommodations, hunter education requirements, first-time buyer rules.

4. **lottery_systems** — Quota hunt applications, draw windows and deadlines, preference/bonus point systems, post-season surveys, tag allocation methods, leftover tag distribution.

5. **general** — Any requirement that doesn't fit the above categories but is relevant to an electronic licensing system (e.g., data retention, reporting requirements, agent/vendor rules, refund policies).

For each requirement:
- Write a clear, concise title
- Write a detailed description that captures the full business rule
- Include the exact source text you extracted it from
- Rate your confidence (0.0 to 1.0) that this is a real, actionable requirement
- Add any structured metadata (dates, prices, ages, zones, species, etc.)

Be thorough — extract every distinct requirement, even if the source text is dense. Split compound rules into separate requirements. If a table contains fee schedules, extract each distinct fee as its own requirement.`;

export const EXTRACTION_TOOL_SCHEMA = {
  name: "record_requirements",
  description:
    "Record structured requirements extracted from regulatory text for an electronic licensing system",
  input_schema: {
    type: "object" as const,
    properties: {
      requirements: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            category: {
              type: "string" as const,
              enum: [
                "species_seasonality",
                "pricing_residency",
                "eligibility_age",
                "lottery_systems",
                "general",
              ],
            },
            subcategory: {
              type: "string" as const,
              description:
                "Finer classification, e.g. 'bear_zones', 'youth_licenses', 'preference_points'",
            },
            title: {
              type: "string" as const,
              description: "Short, descriptive title for this requirement",
            },
            description: {
              type: "string" as const,
              description: "Full description of the business rule or requirement",
            },
            raw_source_text: {
              type: "string" as const,
              description: "Exact text from the source document this was extracted from",
            },
            confidence: {
              type: "number" as const,
              minimum: 0,
              maximum: 1,
              description: "Confidence this is a real, actionable requirement (0.0-1.0)",
            },
            metadata: {
              type: "object" as const,
              description: "Structured data extracted from the requirement",
              properties: {
                species: { type: "string" as const },
                season_start: { type: "string" as const },
                season_end: { type: "string" as const },
                zones: {
                  type: "array" as const,
                  items: { type: "string" as const },
                },
                resident_price: { type: "number" as const },
                nonresident_price: { type: "number" as const },
                min_age: { type: "number" as const },
                max_age: { type: "number" as const },
                military_eligible: { type: "boolean" as const },
                draw_window_start: { type: "string" as const },
                draw_window_end: { type: "string" as const },
                quota: { type: "number" as const },
                bag_limit: { type: "number" as const },
                weapon_type: { type: "string" as const },
              },
            },
          },
          required: [
            "category",
            "title",
            "description",
            "raw_source_text",
            "confidence",
          ],
        },
      },
    },
    required: ["requirements"],
  },
};

import { SchemaType } from "@google/generative-ai";

export function getGeminiFunctionDeclaration() {
  return {
    name: "record_requirements",
    description:
      "Record structured requirements extracted from regulatory text for an electronic licensing system",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        requirements: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              category: {
                type: SchemaType.STRING,
                enum: [
                  "species_seasonality",
                  "pricing_residency",
                  "eligibility_age",
                  "lottery_systems",
                  "general",
                ],
              },
              subcategory: { type: SchemaType.STRING },
              title: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
              raw_source_text: { type: SchemaType.STRING },
              confidence: { type: SchemaType.NUMBER },
              metadata: {
                type: SchemaType.OBJECT,
                properties: {
                  species: { type: SchemaType.STRING },
                  season_start: { type: SchemaType.STRING },
                  season_end: { type: SchemaType.STRING },
                  zones: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                  },
                  resident_price: { type: SchemaType.NUMBER },
                  nonresident_price: { type: SchemaType.NUMBER },
                  min_age: { type: SchemaType.NUMBER },
                  max_age: { type: SchemaType.NUMBER },
                  military_eligible: { type: SchemaType.BOOLEAN },
                  draw_window_start: { type: SchemaType.STRING },
                  draw_window_end: { type: SchemaType.STRING },
                  quota: { type: SchemaType.NUMBER },
                  bag_limit: { type: SchemaType.NUMBER },
                  weapon_type: { type: SchemaType.STRING },
                },
              },
            },
            required: [
              "category",
              "title",
              "description",
              "raw_source_text",
              "confidence",
            ],
          },
        },
      },
      required: ["requirements"],
    },
  };
}
