"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ScrapeTarget } from "@/lib/db/schema";

interface ScrapeTargetListProps {
  targets: ScrapeTarget[];
  customerId: string;
}

interface JobStatus {
  status: "queued" | "running" | "completed" | "failed";
  result?: {
    pagesFetched?: number;
    turns?: number;
    rowsFound?: number;
    currentUrl?: string | null;
    visited?: string[];
    status?: string;
    stopReason?: string;
    documentId?: string;
  } | null;
  errorMessage?: string | null;
}

const POLL_INTERVAL_MS = 1500;

export function ScrapeTargetList({ targets, customerId }: ScrapeTargetListProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setAdding(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_target", customerId, url, label: label || null }),
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

  async function handleCrawl(targetId: string, targetUrl: string) {
    const toastId = `crawl-${targetId}`;
    const host = (() => {
      try {
        return new URL(targetUrl).hostname;
      } catch {
        return targetUrl;
      }
    })();

    setActiveTarget(targetId);
    const cancel = { cancelled: false };
    cancelRef.current = cancel;
    toast.loading(`Queued crawl of ${host}`, { id: toastId });

    let jobId: string;
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scrape", targetId, customerId }),
      });
      if (!res.ok) throw new Error("Failed to enqueue crawl");
      const data = (await res.json()) as { jobId: string };
      jobId = data.jobId;
    } catch {
      toast.error("Failed to start crawl", { id: toastId });
      setActiveTarget(null);
      return;
    }

    let lastStatus: JobStatus["status"] = "queued";
    while (!cancel.cancelled) {
      await sleep(POLL_INTERVAL_MS);
      if (cancel.cancelled) return;

      let job: JobStatus;
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error();
        job = (await res.json()) as JobStatus;
      } catch {
        toast.error("Lost connection to crawl job", { id: toastId });
        setActiveTarget(null);
        return;
      }

      lastStatus = job.status;

      if (job.status === "queued") {
        toast.loading(`Queued crawl of ${host}`, { id: toastId });
        continue;
      }

      if (job.status === "running") {
        const p = job.result ?? {};
        const parts: string[] = [];
        parts.push(`Crawling ${host}`);
        if (typeof p.pagesFetched === "number") {
          parts.push(`${p.pagesFetched} page${p.pagesFetched === 1 ? "" : "s"}`);
        }
        if (typeof p.rowsFound === "number") {
          parts.push(`${p.rowsFound} row${p.rowsFound === 1 ? "" : "s"}`);
        }
        const main = parts.join(" · ");
        const current = p.currentUrl ? `\n${truncate(p.currentUrl, 64)}` : "";
        toast.loading(main + current, { id: toastId });
        continue;
      }

      if (job.status === "completed") {
        const rows = job.result?.rowsFound ?? 0;
        const pages = job.result?.pagesFetched ?? 0;
        toast.success(
          `Crawled ${pages} page${pages === 1 ? "" : "s"} · ${rows} requirement${rows === 1 ? "" : "s"} extracted`,
          { id: toastId }
        );
        setActiveTarget(null);
        router.refresh();
        return;
      }

      if (job.status === "failed") {
        toast.error(job.errorMessage || "Crawl failed", { id: toastId });
        setActiveTarget(null);
        router.refresh();
        return;
      }
    }

    if (cancel.cancelled && lastStatus !== "completed") {
      toast.dismiss(toastId);
    }
  }

  async function handleDelete(targetId: string, label: string | null, url: string) {
    const name = label || url;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(targetId);
    try {
      const res = await fetch(`/api/scrape/targets/${targetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Scrape target deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete scrape target");
    } finally {
      setDeleting(null);
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
          {adding ? "Adding…" : "Add Target"}
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
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={activeTarget !== null}
                        onClick={() => handleCrawl(target.id, target.url)}
                      >
                        {activeTarget === target.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Crawling…
                          </span>
                        ) : (
                          "Crawl & Extract"
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={activeTarget !== null || deleting === target.id}
                        onClick={() => handleDelete(target.id, target.label, target.url)}
                      >
                        {deleting === target.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
