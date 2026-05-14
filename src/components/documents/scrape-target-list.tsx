"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { ScrapeTarget } from "@/lib/db/schema";

interface ScrapeTargetListProps {
  targets: ScrapeTarget[];
  customerId: string;
}

export function ScrapeTargetList({
  targets,
  customerId,
}: ScrapeTargetListProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [scraping, setScraping] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setAdding(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_target",
          customerId,
          url,
          label: label || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add target");
      toast.success("Scrape target added");
      setUrl("");
      setLabel("");
      router.refresh();
    } catch {
      toast.error("Failed to add scrape target");
    } finally {
      setAdding(false);
    }
  }

  async function handleScrape(targetId: string) {
    setScraping(targetId);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scrape",
          targetId,
          customerId,
        }),
      });
      if (!res.ok) throw new Error("Failed to start scrape");
      toast.success("Scraping started");
      router.refresh();
    } catch {
      toast.error("Failed to start scrape");
    } finally {
      setScraping(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="https://wildlife.state.gov/regulations"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
          className="flex-1"
        />
        <Input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-48"
        />
        <Button type="submit" disabled={adding}>
          {adding ? "Adding..." : "Add Target"}
        </Button>
      </form>

      {targets.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Last Scraped</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell className="max-w-64 truncate font-mono text-sm">
                    {target.url}
                  </TableCell>
                  <TableCell>{target.label ?? "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {target.lastScrapedAt
                      ? new Date(target.lastScrapedAt).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={scraping === target.id}
                      onClick={() => handleScrape(target.id)}
                    >
                      {scraping === target.id ? "Scraping..." : "Scrape Now"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
