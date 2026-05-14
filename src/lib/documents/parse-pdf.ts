import pdf from "pdf-parse/lib/pdf-parse";

export async function parsePdf(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text.trim();
}
