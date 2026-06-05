import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const maxDuration = 300;
import { db } from "@/lib/db";
import { documents, requirements, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractRequirementsFromText, buildRequirementInserts } from "@/lib/ai/extract-requirements";
import {
  buildInitialMetadata,
  dedupableFromExtracted,
  dedupableFromRow,
  findDuplicate,
  mergeMetadata,
} from "@/lib/requirements/dedupe";
import type { Requirement } from "@/lib/db/schema";
import { getAISettings } from "@/lib/settings";

export async function POST(request: NextRequest) {
  const aiSettings = await getAISettings();
  const { documentId, customerId, provider = aiSettings.provider, model = aiSettings.model } = await request.json();

  if (!documentId || !customerId) {
    return NextResponse.json(
      { error: "documentId and customerId are required" },
      { status: 400 }
    );
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc || !doc.rawText) {
    return NextResponse.json(
      { error: "Document not found or has no text" },
      { status: 404 }
    );
  }

  const [job] = await db
    .insert(jobs)
    .values({
      type: "extract",
      customerId,
      documentId,
      payload: { provider },
    })
    .returning();

  try {
    await db
      .update(jobs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(jobs.id, job.id));

    await db
      .update(documents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    const extracted = await extractRequirementsFromText(doc.rawText, provider, model);

    let insertedCount = 0;
    let mergedCount = 0;

    if (extracted.length > 0) {
      const pool: Requirement[] = await db
        .select()
        .from(requirements)
        .where(eq(requirements.customerId, customerId));

      const inserts = buildRequirementInserts(extracted, customerId, documentId);

      for (let i = 0; i < extracted.length; i++) {
        const r = extracted[i];
        const insert = inserts[i];
        const match = findDuplicate(
          dedupableFromExtracted(r),
          pool,
          dedupableFromRow
        );

        if (match) {
          const incomingBetter = (r.confidence ?? 0) > (match.confidence ?? 0);
          const newConfidence = Math.max(
            r.confidence ?? 0,
            match.confidence ?? 0
          );
          const mergedMeta = mergeMetadata(
            match.metadata,
            match.documentId,
            insert.metadata,
            documentId,
            {
              species_opportunity: r.species_opportunity,
              season_type: r.season_type,
            }
          );

          const [updated] = await db
            .update(requirements)
            .set({
              title: incomingBetter ? insert.title : match.title,
              description: incomingBetter
                ? insert.description
                : match.description,
              rawSourceText: incomingBetter
                ? insert.rawSourceText
                : match.rawSourceText,
              confidence: newConfidence,
              metadata: mergedMeta,
              updatedAt: new Date(),
            })
            .where(eq(requirements.id, match.id))
            .returning();

          const idx = pool.findIndex((p) => p.id === match.id);
          if (idx >= 0) pool[idx] = updated;
          mergedCount++;
        } else {
          const [inserted] = await db
            .insert(requirements)
            .values({
              ...insert,
              metadata: buildInitialMetadata(insert.metadata, documentId),
            })
            .returning();
          pool.push(inserted);
          insertedCount++;
        }
      }
    }

    await db
      .update(documents)
      .set({ status: "extracted", updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    await db
      .update(jobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        result: {
          requirementsCount: extracted.length,
          insertedCount,
          mergedCount,
        },
      })
      .where(eq(jobs.id, job.id));

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/requirements/${customerId}`);

    return NextResponse.json({
      job,
      requirementsCount: extracted.length,
      insertedCount,
      mergedCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown extraction error";

    await db
      .update(documents)
      .set({ status: "error", errorMessage: message, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    await db
      .update(jobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
      })
      .where(eq(jobs.id, job.id));

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
