import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, requirements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { exportToGoogleSheets } from "@/lib/export/google-sheets";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 }
    );
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId));

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const reqs = await db
    .select()
    .from(requirements)
    .where(eq(requirements.customerId, customerId));

  if (reqs.length === 0) {
    return NextResponse.json(
      { error: "No requirements to export" },
      { status: 400 }
    );
  }

  try {
    const url = await exportToGoogleSheets(customer.name, reqs);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
