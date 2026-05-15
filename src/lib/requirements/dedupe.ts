import type { Requirement } from "@/lib/db/schema";
import type { ExtractedRequirement, MatrixMetadata } from "@/types";

export const SIMILARITY_THRESHOLD = 0.7;

const SPECIES_WEIGHT = 0.7;
const SEASON_WEIGHT = 0.3;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "by", "at", "as", "is", "are", "was", "were", "be", "from", "any",
  "all", "season", "license", "permit",
]);

export interface DedupableRequirement {
  category: string;
  species_opportunity: string;
  season_type: string;
}

export function dedupableFromExtracted(
  r: ExtractedRequirement
): DedupableRequirement {
  return {
    category: r.category,
    species_opportunity: r.species_opportunity ?? "",
    season_type: r.season_type ?? "",
  };
}

export function dedupableFromRow(r: Requirement): DedupableRequirement {
  const m = (r.metadata as MatrixMetadata & { species_opportunity?: string } | null) ?? {};
  return {
    category: r.category,
    species_opportunity: m.species_opportunity ?? r.subcategory ?? "",
    season_type: m.season_type ?? "",
  };
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

export function requirementSimilarity(
  a: DedupableRequirement,
  b: DedupableRequirement
): number {
  if (a.category !== b.category) return 0;
  const speciesA = tokenize(a.species_opportunity);
  const speciesB = tokenize(b.species_opportunity);
  const seasonA = tokenize(a.season_type);
  const seasonB = tokenize(b.season_type);

  const speciesScore = jaccard(speciesA, speciesB);
  const seasonScore = jaccard(seasonA, seasonB);

  return speciesScore * SPECIES_WEIGHT + seasonScore * SEASON_WEIGHT;
}

export function isDuplicate(
  a: DedupableRequirement,
  b: DedupableRequirement
): boolean {
  return requirementSimilarity(a, b) >= SIMILARITY_THRESHOLD;
}

export function findDuplicate<T>(
  target: DedupableRequirement,
  candidates: T[],
  extract: (c: T) => DedupableRequirement
): T | null {
  let best: T | null = null;
  let bestScore = SIMILARITY_THRESHOLD;
  for (const candidate of candidates) {
    const score = requirementSimilarity(target, extract(candidate));
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export interface SourceTrackedMetadata {
  sourceDocumentIds?: string[];
  alternateSpecies?: string[];
  alternateSeasonTypes?: string[];
  [key: string]: unknown;
}

export function buildInitialMetadata(
  base: Record<string, unknown> | null | undefined,
  documentId: string | null
): SourceTrackedMetadata {
  const out: SourceTrackedMetadata = { ...(base ?? {}) };
  out.sourceDocumentIds = documentId ? [documentId] : [];
  return out;
}

export function mergeMetadata(
  existingMetadata: unknown,
  existingDocumentId: string | null,
  incomingMetadata: unknown,
  incomingDocumentId: string | null,
  incoming: { species_opportunity?: string; season_type?: string }
): SourceTrackedMetadata {
  const existing = (existingMetadata as SourceTrackedMetadata | null) ?? {};
  const incomingMeta = (incomingMetadata as SourceTrackedMetadata | null) ?? {};

  const sourceIds = new Set<string>([
    ...(existing.sourceDocumentIds ?? []),
    ...(incomingMeta.sourceDocumentIds ?? []),
  ]);
  if (existingDocumentId) sourceIds.add(existingDocumentId);
  if (incomingDocumentId) sourceIds.add(incomingDocumentId);

  const existingSpecies =
    (existing as { species_opportunity?: string }).species_opportunity ?? "";
  const altSpecies = new Set<string>([
    ...(existing.alternateSpecies ?? []),
    ...(incomingMeta.alternateSpecies ?? []),
  ]);
  if (
    incoming.species_opportunity &&
    incoming.species_opportunity !== existingSpecies
  ) {
    altSpecies.add(incoming.species_opportunity);
  }

  const existingSeason =
    (existing as { season_type?: string }).season_type ?? "";
  const altSeasons = new Set<string>([
    ...(existing.alternateSeasonTypes ?? []),
    ...(incomingMeta.alternateSeasonTypes ?? []),
  ]);
  if (incoming.season_type && incoming.season_type !== existingSeason) {
    altSeasons.add(incoming.season_type);
  }

  return {
    ...existing,
    sourceDocumentIds: Array.from(sourceIds),
    alternateSpecies: altSpecies.size > 0 ? Array.from(altSpecies) : undefined,
    alternateSeasonTypes:
      altSeasons.size > 0 ? Array.from(altSeasons) : undefined,
  };
}
