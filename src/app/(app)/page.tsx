import Link from "next/link";
import { db } from "@/lib/db";
import { customers, documents, requirements } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, FileText, ListChecks, Clock, Plus } from "lucide-react";

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

  const stats = [
    {
      label: "Active Customers",
      value: customerCount.count,
      icon: Building2,
      iconColor: "text-[#003DA5]",
      iconBg: "bg-[#EFF6FF]",
    },
    {
      label: "Documents",
      value: docCount.count,
      icon: FileText,
      iconColor: "text-[#0056CC]",
      iconBg: "bg-[#EFF6FF]",
    },
    {
      label: "Total Requirements",
      value: reqCount.count,
      icon: ListChecks,
      iconColor: "text-[#003DA5]",
      iconBg: "bg-[#EFF6FF]",
    },
    {
      label: "Pending Review",
      value: pendingReqCount.count,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      valueColor: "text-amber-600",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            ELS Requirements Builder Overview
          </p>
        </div>
        <Link href="/customers/new">
          <Button className="gap-2 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Customer
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="border-[#E2E8F0] bg-white shadow-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#64748B]">
                      {stat.label}
                    </p>
                    <p
                      className={`mt-2 text-3xl font-semibold ${stat.valueColor ?? "text-[#1E293B]"}`}
                    >
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.iconBg}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${stat.iconColor}`}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
