import { Worker } from "bullmq";
import { chromium } from "playwright";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, documents, requirements, scrapeTargets } from "@/lib/db/schema";
import { fetchPage } from "@/lib/scraper/fetch-page";
import { crawlAgent, type CrawlProgress } from "@/lib/ai/crawl-agent";
import { buildRequirementInserts } from "@/lib/ai/extract-requirements";

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(
    new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"
  ),
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface ScrapeJobData {
  jobId: string;
  targetId: string;
  customerId: string;
}

const scrapeWorker = new Worker<ScrapeJobData>(
  "scrape",
  async (job) => {
    const { jobId, targetId, customerId } = job.data;
    console.log(`[scrape] job=${jobId} target=${targetId}`);

    await db
      .update(jobs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(jobs.id, jobId));

    const [target] = await db
      .select()
      .from(scrapeTargets)
      .where(eq(scrapeTargets.id, targetId));

    if (!target) {
      throw new Error(`Scrape target not found: ${targetId}`);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: USER_AGENT });

    try {
      let lastProgressWrite = 0;
      const writeProgress = async (p: CrawlProgress) => {
        const now = Date.now();
        if (p.status === "running" && now - lastProgressWrite < 750) return;
        lastProgressWrite = now;
        await db
          .update(jobs)
          .set({
            result: {
              pagesFetched: p.pagesFetched,
              turns: p.turns,
              rowsFound: p.rowsFound,
              currentUrl: p.currentUrl,
              visited: p.visited,
              status: p.status,
              stopReason: p.stopReason,
            },
          })
          .where(eq(jobs.id, jobId));
      };

      const result = await crawlAgent({
        startUrl: target.url,
        fetchPage: (url) => fetchPage(context, url, { sameHostAs: target.url }),
        onProgress: (p) => {
          writeProgress(p).catch((err) =>
            console.error(`[scrape] progress write failed:`, err)
          );
        },
      });

      const rawText = result.pageTexts
        .map((p) => `=== ${p.url} ===\n${p.title}\n\n${p.text}`)
        .join("\n\n---\n\n");

      const [doc] = await db
        .insert(documents)
        .values({
          customerId,
          filename: new URL(target.url).hostname + " (crawl).txt",
          fileType: "crawled",
          storagePath: "",
          sourceUrl: target.url,
          rawText,
          status: "extracted",
        })
        .returning();

      if (result.rows.length > 0) {
        await db
          .insert(requirements)
          .values(buildRequirementInserts(result.rows, customerId, doc.id));
      }

      await db
        .update(scrapeTargets)
        .set({ lastScrapedAt: new Date() })
        .where(eq(scrapeTargets.id, targetId));

      await db
        .update(jobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          result: {
            documentId: doc.id,
            pagesFetched: result.pagesFetched,
            turns: result.turns,
            rowsFound: result.rows.length,
            visited: result.visited,
            stopReason: result.stopReason,
            status: "completed",
          },
        })
        .where(eq(jobs.id, jobId));

      console.log(
        `[scrape] job=${jobId} done — pages=${result.pagesFetched} rows=${result.rows.length} stop=${result.stopReason}`
      );

      return {
        documentId: doc.id,
        rowsFound: result.rows.length,
        pagesFetched: result.pagesFetched,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown crawl error";
      console.error(`[scrape] job=${jobId} failed:`, err);
      await db
        .update(jobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
        })
        .where(eq(jobs.id, jobId));
      throw err;
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  },
  { connection, concurrency: 2 }
);

const extractWorker = new Worker(
  "extract",
  async (job) => {
    console.log(`[extract] Processing job ${job.id}`, job.data);
    // Extract logic still runs inline in /api/extract for file uploads.
  },
  { connection, concurrency: 1 }
);

scrapeWorker.on("completed", (job) => {
  console.log(`[scrape] Job ${job.id} completed`);
});
scrapeWorker.on("failed", (job, err) => {
  console.error(`[scrape] Job ${job?.id} failed:`, err.message);
});
extractWorker.on("completed", (job) => {
  console.log(`[extract] Job ${job.id} completed`);
});
extractWorker.on("failed", (job, err) => {
  console.error(`[extract] Job ${job?.id} failed:`, err.message);
});

console.log("Workers started: scrape, extract");
