import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E293B]">New Customer</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          Add a new DNR agency to track requirements for
        </p>
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <CustomerForm />
      </div>
    </div>
  );
}
