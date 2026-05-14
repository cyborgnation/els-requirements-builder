import { Worker } from "bullmq";

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(
    new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"
  ),
};

const scrapeWorker = new Worker(
  "scrape",
  async (job) => {
    console.log(`[scrape] Processing job ${job.id}`, job.data);
    // Scrape logic runs inline in the API route for now
    // Move here for production with proper concurrency limits
  },
  { connection, concurrency: 2 }
);

const extractWorker = new Worker(
  "extract",
  async (job) => {
    console.log(`[extract] Processing job ${job.id}`, job.data);
    // Extract logic runs inline in the API route for now
    // Move here for production with proper concurrency limits
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
