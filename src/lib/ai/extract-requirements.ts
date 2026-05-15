import { getProvider } from "./provider";
import {
  dedupableFromExtracted,
  findDuplicate,
} from "@/lib/requirements/dedupe";
import type { ExtractedRequirement } from "@/types";

export function buildRequirementInserts(
  extracted: ExtractedRequirement[],
  customerId: string,
  documentId: string
) {
  return extracted.map((r) => ({
    customerId,
    documentId,
    category: r.category,
    subcategory: r.species_opportunity,
    title: `${r.species_opportunity} — ${r.season_type}`,
    description: r.dates,
    rawSourceText: r.source_urls,
    confidence: r.confidence,
    status: (r.confidence < 0.6 ? "needs_review" : "pending") as string,
    metadata: {
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
    },
  }));
}

const CHUNK_SIZE = 60000;
const CHUNK_OVERLAP = 1000;

export async function extractRequirementsFromText(
  text: string,
  providerName: string = "claude"
): Promise<ExtractedRequirement[]> {
  const provider = getProvider(providerName);
  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  console.log(`[extract] text=${text.length} chars, chunks=${chunks.length}, sizes=[${chunks.map((c) => c.length).join(",")}]`);

  const results = await Promise.all(
    chunks.map(async (chunk, i) => {
      const t0 = Date.now();
      console.log(`[extract] chunk ${i} START (${chunk.length} chars)`);
      try {
        const rows = await provider.extractRequirements(chunk);
        console.log(`[extract] chunk ${i} DONE in ${Date.now() - t0}ms, rows=${rows.length}`);
        return rows;
      } catch (err) {
        console.error(`[extract] chunk ${i} FAILED after ${Date.now() - t0}ms:`, err);
        throw err;
      }
    })
  );
  return deduplicateRequirements(results.flat());
}

function chunkText(
  text: string,
  maxChars: number,
  overlap: number
): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    if (end < text.length) {
      const lastNewline = text.lastIndexOf("\n", end);
      const lastPeriod = text.lastIndexOf(". ", end);
      const breakPoint = Math.max(lastNewline, lastPeriod);
      if (breakPoint > start + maxChars * 0.5) {
        end = breakPoint + 1;
      }
    } else {
      end = text.length;
    }

    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

function deduplicateRequirements(
  requirements: ExtractedRequirement[]
): ExtractedRequirement[] {
  const unique: ExtractedRequirement[] = [];
  for (const r of requirements) {
    const match = findDuplicate(
      dedupableFromExtracted(r),
      unique,
      dedupableFromExtracted
    );
    if (!match) unique.push(r);
  }
  return unique;
}
