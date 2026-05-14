import Link from "next/link";
import { db } from "@/lib/db";
import { customers, documents, requirements } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const [customerCount] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.status, "active"));

  const [docCount] = await db.select({ count: count() }).from(documents);

  const [reqCount] = await db.select({ count: count() }).from(requirements);

  const [pendingReqCount] = await db
    .select({ count: count() })
    .from(requirements)
    .where(eq(requirements.status, "pending"));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            ELS Requirements Builder Overview
          </p>
        </div>
        <Link href="/customers/new">
          <Button>New Customer</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{customerCount.count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{docCount.count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{reqCount.count}</p>
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
              {pendingReqCount.count}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
