import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { customers, documents, requirements, scrapeTargets } from "@/lib/db/schema";
import { eq, and, count, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadZone } from "@/components/documents/upload-zone";
import { ScrapeTargetList } from "@/components/documents/scrape-target-list";
import { DocumentList } from "@/components/documents/document-list";
import { RequirementsTable } from "@/components/requirements/requirements-table";
import { FindDuplicatesDialog } from "@/components/requirements/find-duplicates-dialog";
import { SourcesPanel } from "@/components/customers/sources-panel";
import { US_STATES } from "@/types";
import { Pencil, FileSpreadsheet, ListChecks, Database } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) notFound();

  const [customerDocs, customerTargets, allRequirements] = await Promise.all([
    db.select().from(documents).where(eq(documents.customerId, id)).orderBy(desc(documents.createdAt)),
    db.select().from(scrapeTargets).where(eq(scrapeTargets.customerId, id)).orderBy(desc(scrapeTargets.createdAt)),
    db.select().from(requirements).where(eq(requirements.customerId, id)).orderBy(desc(requirements.createdAt)),
  ]);

  const [pendingCount] = await db
    .select({ count: count() })
    .from(requirements)
    .where(and(eq(requirements.customerId, id), eq(requirements.status, "pending")));

  const stateLabel = US_STATES.find((s) => s.value === customer.state)?.label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#1E293B]">{customer.name}</h1>
            <Badge
              className={
                customer.status === "active"
                  ? "bg-[#DCFCE7] text-[#166534] border-0 hover:bg-[#DCFCE7]"
                  : "bg-[#F1F5F9] text-[#475569] border-0"
              }
            >
              {customer.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">
            {stateLabel ?? customer.state}
            {customer.agencyName ? ` — ${customer.agencyName}` : ""}
            {customer.contactName ? ` · ${customer.contactName}` : ""}
            {customer.contactEmail ? ` · ${customer.contactEmail}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={`/api/export?customerId=${customer.id}`} method="GET">
            <Button
              type="submit"
              className="gap-2 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </form>
          <FindDuplicatesDialog customerId={customer.id} />
          <Link href={`/customers/${customer.id}/edit`}>
            <Button
              variant="outline"
              className="gap-2 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 rounded-lg border border-[#E2E8F0] bg-white px-6 py-4">
        <Stat label="Requirements" value={allRequirements.length} color="text-[#1E293B]" icon={<ListChecks className="h-4 w-4" />} />
        <div className="h-8 w-px bg-[#E2E8F0]" />
        <Stat label="Pending Review" value={pendingCount.count} color="text-amber-600" />
        <div className="h-8 w-px bg-[#E2E8F0]" />
        <Stat label="Sources" value={customerDocs.length + customerTargets.length} color="text-[#475569]" icon={<Database className="h-4 w-4" />} />
      </div>

      {/* Requirements — primary content */}
      <RequirementsTable requirements={allRequirements} customerId={customer.id} />

      {/* Sources — secondary, collapsible */}
      <SourcesPanel
        customerId={customer.id}
        documents={customerDocs}
        targets={customerTargets}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-[#94A3B8]">{icon}</span>}
      <div>
        <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        <p className="text-xs text-[#64748B]">{label}</p>
      </div>
    </div>
  );
}
