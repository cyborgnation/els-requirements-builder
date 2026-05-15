import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id));

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/customers");
  return NextResponse.json({ ok: true });
}
