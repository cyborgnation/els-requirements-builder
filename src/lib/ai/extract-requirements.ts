import { getProvider } from "./provider";
import type { ExtractedRequirement } from "@/types";

const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;

export async function extractRequirementsFromText(
  text: string,
  providerName: string = "claude"
): Promise<ExtractedRequirement[]> {
  const provider = getProvider(providerName);
  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  const allRequirements: ExtractedRequirement[] = [];

  for (const chunk of chunks) {
    const requirements = await provider.extractRequirements(chunk);
    allRequirements.push(...requirements);
  }

  return deduplicateRequirements(allRequirements);
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

  for (const req of requirements) {
    const isDuplicate = unique.some(
      (existing) =>
        existing.category === req.category &&
        titleSimilarity(existing.title, req.title) > 0.8
    );

    if (!isDuplicate) {
      unique.push(req);
    }
  }

  return unique;
}

function titleSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;

  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);

  return intersection.size / union.size;
}
