import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CustomerForm } from "@/components/customers/customer-form";

export default async function EditCustomerPage({
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E293B]">Edit Customer</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">{customer.name}</p>
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
