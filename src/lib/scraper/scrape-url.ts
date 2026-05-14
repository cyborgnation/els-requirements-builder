import { chromium } from "playwright";
import { extractMainContent } from "./parsers/generic";
import { extractTables } from "./parsers/table-extractor";

export interface ScrapeResult {
  text: string;
  tables: Record<string, string>[][];
  title: string;
  url: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const title = await page.title();
    const html = await page.content();

    const mainText = extractMainContent(html);
    const tables = extractTables(html);

    let text = mainText;
    if (tables.length > 0) {
      text += "\n\n--- EXTRACTED TABLES ---\n\n";
      tables.forEach((table, i) => {
        text += `Table ${i + 1}:\n`;
        table.forEach((row) => {
          text += Object.entries(row)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
          text += "\n";
        });
        text += "\n";
      });
    }

    return { text, tables, title, url };
  } finally {
    await browser.close();
  }
}
