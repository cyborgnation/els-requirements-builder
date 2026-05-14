import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, status, reviewerNotes, title, description, category } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (reviewerNotes !== undefined) updates.reviewerNotes = reviewerNotes;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;

  const [updated] = await db
    .update(requirements)
    .set(updates)
    .where(eq(requirements.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await db.delete(requirements).where(eq(requirements.id, id));
  return NextResponse.json({ ok: true });
}
