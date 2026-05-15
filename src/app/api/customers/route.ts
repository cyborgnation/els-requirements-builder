import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const result = await db
    .select()
    .from(customers)
    .orderBy(customers.createdAt);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, state, agencyName, contactName, contactEmail, notes } = body;

  if (!name || !state) {
    return NextResponse.json(
      { error: "Name and state are required" },
      { status: 400 }
    );
  }

  const [customer] = await db
    .insert(customers)
    .values({ name, state, agencyName, contactName, contactEmail, notes })
    .returning();

  revalidatePath("/customers");

  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const [customer] = await db
    .update(customers)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);

  return NextResponse.json(customer);
}
