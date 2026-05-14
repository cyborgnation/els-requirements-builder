import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { customers, requirements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { RequirementsTable } from "@/components/requirements/requirements-table";

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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/customers" className="hover:underline">
              Customers
            </Link>
            <span>/</span>
            <Link
              href={`/customers/${customer.id}`}
              className="hover:underline"
            >
              {customer.name}
            </Link>
            <span>/</span>
            <span>Requirements</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Requirements — {customer.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/customers/${customer.id}`}>
            <Button variant="outline">Back to Customer</Button>
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
      <Button type="submit" variant="outline">
        Export to Google Sheets
      </Button>
    </form>
  );
}
