import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { customers, requirements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { RequirementsTable } from "@/components/requirements/requirements-table";
import { ChevronRight, FileSpreadsheet } from "lucide-react";

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId));

  if (!customer) notFound();

  const allRequirements = await db
    .select()
    .from(requirements)
    .where(eq(requirements.customerId, customerId))
    .orderBy(desc(requirements.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Link href="/customers" className="hover:text-[#003DA5] hover:underline">
              Customers
            </Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <Link
              href={`/customers/${customer.id}`}
              className="hover:text-[#003DA5] hover:underline"
            >
              {customer.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="text-[#1E293B]">Requirements</span>
          </nav>
          <h1 className="mt-1.5 text-2xl font-semibold text-[#1E293B]">
            Requirements — {customer.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/customers/${customer.id}`}>
            <Button
              variant="outline"
              className="border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Back to Customer
            </Button>
          </Link>
          <ExportButton customerId={customerId} />
        </div>
      </div>

      <RequirementsTable
        requirements={allRequirements}
        customerId={customerId}
      />
    </div>
  );
}

function ExportButton({ customerId }: { customerId: string }) {
  return (
    <form action={`/api/export?customerId=${customerId}`} method="GET">
      <Button
        type="submit"
        className="gap-2 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        Export to Google Sheets
      </Button>
    </form>
  );
}
