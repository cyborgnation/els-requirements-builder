import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirements } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ids, status, reviewerNotes, title, description, category } = body;

  // Bulk update
  if (Array.isArray(ids) && ids.length > 0) {
    if (!status) return NextResponse.json({ error: "status is required for bulk update" }, { status: 400 });
    await db.update(requirements).set({ status, updatedAt: new Date() }).where(inArray(requirements.id, ids));
    return NextResponse.json({ ok: true, count: ids.length });
  }

  // Single update
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

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
  // Bulk delete via JSON body
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await db.delete(requirements).where(inArray(requirements.id, body.ids));
      return NextResponse.json({ ok: true, count: body.ids.length });
    }
  }

  // Single delete via query param
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.delete(requirements).where(eq(requirements.id, id));
  return NextResponse.json({ ok: true });
}
