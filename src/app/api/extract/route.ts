import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, requirements, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractRequirementsFromText } from "@/lib/ai/extract-requirements";

export async function POST(request: NextRequest) {
  const { documentId, customerId, provider = "claude" } = await request.json();

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

    const extracted = await extractRequirementsFromText(doc.rawText, provider);

    if (extracted.length > 0) {
      await db.insert(requirements).values(
        extracted.map((r) => ({
          customerId,
          documentId,
          category: r.category,
          subcategory: r.subcategory ?? null,
          title: r.title,
          description: r.description,
          rawSourceText: r.rawSourceText,
          confidence: r.confidence,
          status: r.confidence < 0.6 ? "needs_review" : "pending",
          metadata: r.metadata ?? null,
        }))
      );
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
        result: { requirementsCount: extracted.length },
      })
      .where(eq(jobs.id, job.id));

    return NextResponse.json({
      job,
      requirementsCount: extracted.length,
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
