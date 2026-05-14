"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/types";
import { toast } from "sonner";
import type { Customer } from "@/lib/db/schema";

interface CustomerFormProps {
  customer?: Customer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      state: formData.get("state") as string,
      agencyName: (formData.get("agencyName") as string) || null,
      contactName: (formData.get("contactName") as string) || null,
      contactEmail: (formData.get("contactEmail") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/customers", {
        method: customer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer ? { id: customer.id, ...data } : data),
      });

      if (!res.ok) throw new Error("Failed to save customer");

      const saved = await res.json();
      toast.success(customer ? "Customer updated" : "Customer created");
      router.push(`/customers/${saved.id}`);
      router.refresh();
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Agency / Customer Name *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={customer?.name}
            placeholder="e.g. Montana Fish, Wildlife & Parks"
          />
        </div>

        <div>
          <Label htmlFor="state">State *</Label>
          <Select name="state" defaultValue={customer?.state} required>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="agencyName">Agency Division</Label>
          <Input
            id="agencyName"
            name="agencyName"
            defaultValue={customer?.agencyName ?? ""}
            placeholder="e.g. Wildlife Division"
          />
        </div>

        <div>
          <Label htmlFor="contactName">Primary Contact</Label>
          <Input
            id="contactName"
            name="contactName"
            defaultValue={customer?.contactName ?? ""}
            placeholder="Contact name"
          />
        </div>

        <div>
          <Label htmlFor="contactEmail">Contact Email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={customer?.contactEmail ?? ""}
            placeholder="contact@agency.gov"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={customer?.notes ?? ""}
            placeholder="Additional notes about this customer..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : customer ? "Update Customer" : "Create Customer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
