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
        <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
        <p className="text-sm text-gray-500">{customer.name}</p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
