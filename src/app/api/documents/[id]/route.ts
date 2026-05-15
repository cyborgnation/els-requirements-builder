import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(documents).where(eq(documents.id, id));

  if (doc.storagePath) {
    try {
      await unlink(doc.storagePath);
    } catch {
      // file may already be gone — not fatal
    }
  }

  return NextResponse.json({ ok: true });
}
