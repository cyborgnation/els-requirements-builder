import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirements } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  dedupableFromRow,
  mergeMetadata,
  type SourceTrackedMetadata,
} from "@/lib/requirements/dedupe";

export async function POST(request: NextRequest) {
  const { keepId, mergeIds } = await request.json();

  if (!keepId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
    return NextResponse.json(
      { error: "keepId and non-empty mergeIds are required" },
      { status: 400 }
    );
  }

  if (mergeIds.includes(keepId)) {
    return NextResponse.json(
      { error: "keepId cannot also be in mergeIds" },
      { status: 400 }
    );
  }

  const [keep] = await db
    .select()
    .from(requirements)
    .where(eq(requirements.id, keepId));

  if (!keep) {
    return NextResponse.json(
      { error: "Requirement to keep not found" },
      { status: 404 }
    );
  }

  const toMerge = await db
    .select()
    .from(requirements)
    .where(inArray(requirements.id, mergeIds));

  let metadata: SourceTrackedMetadata =
    (keep.metadata as SourceTrackedMetadata | null) ?? {};
  let maxConfidence = keep.confidence ?? 0;

  for (const r of toMerge) {
    if (r.customerId !== keep.customerId) {
      return NextResponse.json(
        { error: "All requirements must belong to the same customer" },
        { status: 400 }
      );
    }
    const incomingKey = dedupableFromRow(r);
    metadata = mergeMetadata(
      metadata,
      keep.documentId,
      r.metadata,
      r.documentId,
      {
        species_opportunity: incomingKey.species_opportunity,
        season_type: incomingKey.season_type,
      }
    );
    if ((r.confidence ?? 0) > maxConfidence) {
      maxConfidence = r.confidence ?? 0;
    }
  }

  await db
    .update(requirements)
    .set({
      metadata,
      confidence: maxConfidence,
      updatedAt: new Date(),
    })
    .where(eq(requirements.id, keepId));

  await db.delete(requirements).where(inArray(requirements.id, mergeIds));

  revalidatePath("/customers");
  revalidatePath(`/customers/${keep.customerId}`);
  revalidatePath(`/requirements/${keep.customerId}`);

  return NextResponse.json({ ok: true, mergedCount: toMerge.length });
}
