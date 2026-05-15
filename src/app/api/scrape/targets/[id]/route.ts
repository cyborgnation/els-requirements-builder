import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrapeTargets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await db
    .delete(scrapeTargets)
    .where(eq(scrapeTargets.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
