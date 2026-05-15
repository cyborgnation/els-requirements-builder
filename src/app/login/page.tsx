"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Invalid password. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC]">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#003DA5]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8 text-white"
              aria-hidden="true"
            >
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1E293B]">
            ELS Requirements Builder
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            DNR Electronic Licensing Systems
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#1E293B]"
              >
                Team Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your team password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="h-11"
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
