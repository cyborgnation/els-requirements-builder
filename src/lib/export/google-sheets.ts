import { google } from "googleapis";
import type { Requirement } from "@/lib/db/schema";
import { REQUIREMENT_CATEGORIES } from "@/types";

export async function exportToGoogleSheets(
  customerName: string,
  requirements: Requirement[]
): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      ),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `${customerName} — ELS Requirements`,
      },
      sheets: [
        { properties: { title: "All Requirements" } },
        ...REQUIREMENT_CATEGORIES.map((cat) => ({
          properties: { title: cat.label },
        })),
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  const headers = [
    "Title",
    "Category",
    "Subcategory",
    "Description",
    "Source Text",
    "Confidence",
    "Status",
    "Reviewer Notes",
  ];

  const toRow = (r: Requirement) => [
    r.title,
    REQUIREMENT_CATEGORIES.find((c) => c.value === r.category)?.label ??
      r.category,
    r.subcategory ?? "",
    r.description,
    r.rawSourceText ?? "",
    r.confidence ? `${Math.round(r.confidence * 100)}%` : "",
    r.status,
    r.reviewerNotes ?? "",
  ];

  const allRows = [headers, ...requirements.map(toRow)];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "All Requirements!A1",
    valueInputOption: "RAW",
    requestBody: { values: allRows },
  });

  for (const cat of REQUIREMENT_CATEGORIES) {
    const catReqs = requirements.filter((r) => r.category === cat.value);
    if (catReqs.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${cat.label}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers, ...catReqs.map(toRow)],
        },
      });
    }
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
