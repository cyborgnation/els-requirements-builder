import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrapeTargets, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeQueue } from "@/lib/jobs/queue";

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
        type: "crawl",
        status: "queued",
        customerId,
        payload: { targetId, url: target.url },
      })
      .returning();

    await scrapeQueue.add(
      "crawl",
      { jobId: job.id, targetId, customerId },
      { jobId: job.id, removeOnComplete: 100, removeOnFail: 200 }
    );

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
