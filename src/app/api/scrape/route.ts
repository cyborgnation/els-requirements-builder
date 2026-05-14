import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrapeTargets, documents, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeUrl } from "@/lib/scraper/scrape-url";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "add_target") {
    const { customerId, url, label } = body;
    const [target] = await db
      .insert(scrapeTargets)
      .values({ customerId, url, label })
      .returning();
    return NextResponse.json(target, { status: 201 });
  }

  if (action === "scrape") {
    const { targetId, customerId } = body;

    const [target] = await db
      .select()
      .from(scrapeTargets)
      .where(eq(scrapeTargets.id, targetId));

    if (!target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const [job] = await db
      .insert(jobs)
      .values({
        type: "scrape",
        customerId,
        payload: { targetId, url: target.url, depth: target.scrapeDepth },
      })
      .returning();

    // Run scrape inline for now (move to BullMQ worker later for production)
    try {
      await db
        .update(jobs)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(jobs.id, job.id));

      const result = await scrapeUrl(target.url);

      const [doc] = await db
        .insert(documents)
        .values({
          customerId,
          filename: new URL(target.url).hostname + ".html",
          fileType: "scraped",
          storagePath: "",
          sourceUrl: target.url,
          rawText: result.text,
          status: "pending",
        })
        .returning();

      await db
        .update(scrapeTargets)
        .set({ lastScrapedAt: new Date() })
        .where(eq(scrapeTargets.id, targetId));

      await db
        .update(jobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          result: { documentId: doc.id, textLength: result.text.length },
        })
        .where(eq(jobs.id, job.id));

      return NextResponse.json({ job, document: doc });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown scrape error";
      await db
        .update(jobs)
        .set({ status: "failed", completedAt: new Date(), errorMessage: message })
        .where(eq(jobs.id, job.id));
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
