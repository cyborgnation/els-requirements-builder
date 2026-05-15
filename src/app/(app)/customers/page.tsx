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
import { Plus } from "lucide-react";

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
          <h1 className="text-2xl font-semibold text-[#1E293B]">Customers</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Manage DNR agency customers and their requirements
          </p>
        </div>
        <Link href="/customers/new">
          <Button className="gap-2 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Customer
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F8FAFC]">
              <TableHead className="font-semibold text-[#475569]">Name</TableHead>
              <TableHead className="font-semibold text-[#475569]">State</TableHead>
              <TableHead className="font-semibold text-[#475569]">Contact</TableHead>
              <TableHead className="text-center font-semibold text-[#475569]">Documents</TableHead>
              <TableHead className="text-center font-semibold text-[#475569]">Requirements</TableHead>
              <TableHead className="font-semibold text-[#475569]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-16 text-center text-[#64748B]"
                >
                  No customers yet.{" "}
                  <Link
                    href="/customers/new"
                    className="font-medium text-[#003DA5] hover:underline"
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
                  <TableRow
                    key={customer.id}
                    className="border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-[#003DA5] hover:underline cursor-pointer"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[#475569]">{stateLabel ?? customer.state}</TableCell>
                    <TableCell className="text-[#64748B]">
                      {customer.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-[#475569]">{docCount}</TableCell>
                    <TableCell className="text-center text-[#475569]">{reqCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          customer.status === "active"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          customer.status === "active"
                            ? "bg-[#DCFCE7] text-[#166534] border-0 hover:bg-[#DCFCE7]"
                            : "bg-[#F1F5F9] text-[#475569] border-0"
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
