import { Queue } from "bullmq";

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(
    new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"
  ),
};

export const scrapeQueue = new Queue("scrape", { connection });
export const extractQueue = new Queue("extract", { connection });
