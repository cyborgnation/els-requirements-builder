import Link from "next/link";
import { db } from "@/lib/db";
import { customers, documents, requirements } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { US_STATES } from "@/types";

export default async function CustomersPage() {
  const allCustomers = await db
    .select({
      customer: customers,
      docCount: sql<number>`(SELECT COUNT(*) FROM documents WHERE documents.customer_id = ${customers.id})`.as(
        "doc_count"
      ),
      reqCount: sql<number>`(SELECT COUNT(*) FROM requirements WHERE requirements.customer_id = ${customers.id})`.as(
        "req_count"
      ),
    })
    .from(customers)
    .orderBy(customers.createdAt);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">
            Manage DNR agency customers and their requirements
          </p>
        </div>
        <Link href="/customers/new">
          <Button>New Customer</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-center">Documents</TableHead>
              <TableHead className="text-center">Requirements</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-gray-500"
                >
                  No customers yet.{" "}
                  <Link
                    href="/customers/new"
                    className="text-blue-600 underline"
                  >
                    Create your first customer
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              allCustomers.map(({ customer, docCount, reqCount }) => {
                const stateLabel = US_STATES.find(
                  (s) => s.value === customer.state
                )?.label;
                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{stateLabel ?? customer.state}</TableCell>
                    <TableCell className="text-gray-500">
                      {customer.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{docCount}</TableCell>
                    <TableCell className="text-center">{reqCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          customer.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {customer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
