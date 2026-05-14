import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { parsePdf } from "@/lib/documents/parse-pdf";
import { parseText } from "@/lib/documents/parse-text";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const customerId = formData.get("customerId") as string;

  if (!file || !customerId) {
    return NextResponse.json(
      { error: "File and customerId are required" },
      { status: 400 }
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  const allowedTypes = [".pdf", ".txt", ".text"];
  if (!allowedTypes.includes(ext)) {
    return NextResponse.json(
      { error: "Only PDF and text files are supported" },
      { status: 400 }
    );
  }

  const fileType = ext === ".pdf" ? "pdf" : "txt";
  const fileId = uuidv4();
  const storagePath = path.join(STORAGE_PATH, customerId, `${fileId}${ext}`);

  await mkdir(path.dirname(storagePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storagePath, buffer);

  let rawText: string | null = null;
  try {
    if (fileType === "pdf") {
      rawText = await parsePdf(buffer);
    } else {
      rawText = parseText(buffer);
    }
  } catch {
    // text extraction failed — document still saved, will need manual handling
  }

  const [doc] = await db
    .insert(documents)
    .values({
      customerId,
      filename: file.name,
      fileType,
      storagePath,
      rawText,
      status: rawText ? "pending" : "error",
      errorMessage: rawText ? null : "Failed to extract text from file",
    })
    .returning();

  return NextResponse.json(doc, { status: 201 });
}
