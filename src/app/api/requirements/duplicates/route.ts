import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { dedupableFromRow, isDuplicate } from "@/lib/requirements/dedupe";
import type { Requirement } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(requirements)
    .where(eq(requirements.customerId, customerId));

  const dedupable = rows.map((r) => ({ row: r, key: dedupableFromRow(r) }));
  const assigned = new Set<string>();
  const groups: Requirement[][] = [];

  for (let i = 0; i < dedupable.length; i++) {
    const head = dedupable[i];
    if (assigned.has(head.row.id)) continue;
    const group: Requirement[] = [head.row];
    const groupKeys = [head.key];
    assigned.add(head.row.id);

    for (let j = i + 1; j < dedupable.length; j++) {
      const candidate = dedupable[j];
      if (assigned.has(candidate.row.id)) continue;
      if (groupKeys.some((k) => isDuplicate(k, candidate.key))) {
        group.push(candidate.row);
        groupKeys.push(candidate.key);
        assigned.add(candidate.row.id);
      }
    }

    if (group.length > 1) {
      group.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      groups.push(group);
    }
  }

  return NextResponse.json({ groups });
}
