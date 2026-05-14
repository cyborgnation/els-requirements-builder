import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Customer</h1>
        <p className="text-sm text-gray-500">
          Add a new DNR agency to track requirements for
        </p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <CustomerForm />
      </div>
    </div>
  );
}
