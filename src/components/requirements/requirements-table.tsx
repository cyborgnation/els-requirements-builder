"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { REQUIREMENT_CATEGORIES } from "@/types";
import type { Requirement } from "@/lib/db/schema";

interface RequirementsTableProps {
  requirements: Requirement[];
  customerId: string;
}

export function RequirementsTable({
  requirements,
  customerId,
}: RequirementsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const filtered = requirements.filter((r) => {
    const matchesCategory =
      activeCategory === "all" || r.category === activeCategory;
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if ((a.confidence ?? 1) !== (b.confidence ?? 1)) {
      return (a.confidence ?? 1) - (b.confidence ?? 1);
    }
    return a.title.localeCompare(b.title);
  });

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Requirement ${status}`);
      router.refresh();
    } catch {
      toast.error("Failed to update requirement");
    }
  }

  async function saveEdit() {
    if (!editReq) return;
    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editReq.id,
          reviewerNotes: editNotes,
          status: "modified",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Requirement updated");
      setEditReq(null);
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  const categoryLabel = (cat: string) =>
    REQUIREMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  const statusVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default" as const;
      case "rejected":
        return "destructive" as const;
      case "modified":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const confidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const pct = Math.round(confidence * 100);
    const color =
      confidence >= 0.8
        ? "text-green-700 bg-green-50"
        : confidence >= 0.6
        ? "text-yellow-700 bg-yellow-50"
        : "text-red-700 bg-red-50";
    return (
      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
        {pct}%
      </span>
    );
  };

  const categoryCounts = REQUIREMENT_CATEGORIES.map((c) => ({
    ...c,
    count: requirements.filter((r) => r.category === c.value).length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search requirements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-gray-500">
          {sorted.length} of {requirements.length} requirements
        </span>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">
            All ({requirements.length})
          </TabsTrigger>
          {categoryCounts.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label} ({c.count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-36">Category</TableHead>
              <TableHead className="w-24 text-center">Confidence</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-48 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-gray-500"
                >
                  No requirements found. Upload documents and run extraction.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.title}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm text-gray-600">
                      {req.description}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {categoryLabel(req.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {confidenceBadge(req.confidence)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(req.status)}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditReq(req);
                          setEditNotes(req.reviewerNotes ?? "");
                        }}
                      >
                        Review
                      </Button>
                      {req.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatus(req.id, "approved")}
                        >
                          Approve
                        </Button>
                      )}
                      {req.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus(req.id, "rejected")}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editReq} onOpenChange={() => setEditReq(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Review Requirement</DialogTitle>
          </DialogHeader>
          {editReq && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Title
                </label>
                <p className="mt-1 font-medium">{editReq.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Category
                </label>
                <p className="mt-1">{categoryLabel(editReq.category)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <p className="mt-1 text-sm">{editReq.description}</p>
              </div>
              {editReq.rawSourceText && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Source Text
                  </label>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
                    {editReq.rawSourceText}
                  </pre>
                </div>
              )}
              {editReq.metadata != null && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Metadata
                  </label>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
                    {JSON.stringify(editReq.metadata as Record<string, unknown>, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Reviewer Notes
                </label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this requirement..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit}>Save Notes</Button>
                <Button
                  variant="default"
                  onClick={() => {
                    updateStatus(editReq.id, "approved");
                    setEditReq(null);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    updateStatus(editReq.id, "rejected");
                    setEditReq(null);
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
