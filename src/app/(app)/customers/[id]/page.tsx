import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  customers,
  documents,
  requirements,
  scrapeTargets,
} from "@/lib/db/schema";
import { eq, and, count, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DocumentList } from "@/components/documents/document-list";
import { UploadZone } from "@/components/documents/upload-zone";
import { ScrapeTargetList } from "@/components/documents/scrape-target-list";
import { US_STATES } from "@/types";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id));

  if (!customer) notFound();

  const customerDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.customerId, id))
    .orderBy(desc(documents.createdAt));

  const customerScrapeTargets = await db
    .select()
    .from(scrapeTargets)
    .where(eq(scrapeTargets.customerId, id))
    .orderBy(desc(scrapeTargets.createdAt));

  const [reqCount] = await db
    .select({ count: count() })
    .from(requirements)
    .where(eq(requirements.customerId, id));

  const [pendingCount] = await db
    .select({ count: count() })
    .from(requirements)
    .where(
      and(eq(requirements.customerId, id), eq(requirements.status, "pending"))
    );

  const stateLabel = US_STATES.find((s) => s.value === customer.state)?.label;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.name}
            </h1>
            <Badge
              variant={
                customer.status === "active" ? "default" : "secondary"
              }
            >
              {customer.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {stateLabel ?? customer.state}
            {customer.agencyName ? ` — ${customer.agencyName}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/requirements/${customer.id}`}>
            <Button variant="outline">
              View Requirements ({reqCount.count})
            </Button>
          </Link>
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {customer.contactName ?? "No contact"}
            </p>
            <p className="text-sm text-gray-500">
              {customer.contactEmail ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{customerDocs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">
              {pendingCount.count}
            </p>
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {customer.notes}
            </p>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Documents</h2>
        <UploadZone customerId={customer.id} />
        <div className="mt-4">
          <DocumentList documents={customerDocs} customerId={customer.id} />
        </div>
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Scrape Targets</h2>
        <ScrapeTargetList
          targets={customerScrapeTargets}
          customerId={customer.id}
        />
      </div>
    </div>
  );
}
