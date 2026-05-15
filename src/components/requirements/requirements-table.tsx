"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { REQUIREMENT_CATEGORIES } from "@/types";
import type { Requirement } from "@/lib/db/schema";

interface MatrixMeta {
  species_opportunity?: string;
  season_type?: string;
  dates?: string;
  eligibility?: string;
  residency_age_rule?: string;
  required_licenses?: string;
  fees?: string;
  lottery_window?: string;
  key_restrictions?: string;
  source_urls?: string;
  notes?: string;
}

function meta(req: Requirement): MatrixMeta {
  return (req.metadata ?? {}) as MatrixMeta;
}

interface RequirementsTableProps {
  requirements: Requirement[];
  customerId: string;
}

export function RequirementsTable({ requirements, customerId }: RequirementsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const filtered = requirements.filter((r) => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory;
    const m = meta(r);
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.fees ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.dates ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.key_restrictions ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.title.localeCompare(b.title);
  });

  const filteredIds = sorted.map((r) => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));
  const selectedCount = [...selected].filter((id) => filteredIds.includes(id)).length;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

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

  async function bulkUpdateStatus(status: string) {
    const ids = [...selected].filter((id) => filteredIds.includes(id));
    if (ids.length === 0) return;
    setBulkLoading(status);
    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${ids.length} requirement${ids.length !== 1 ? "s" : ""} ${status}`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to update requirements");
    } finally {
      setBulkLoading(null);
    }
  }

  async function bulkDelete() {
    const ids = [...selected].filter((id) => filteredIds.includes(id));
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} requirement${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkLoading("delete");
    try {
      const res = await fetch("/api/requirements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${ids.length} requirement${ids.length !== 1 ? "s" : ""}`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to delete requirements");
    } finally {
      setBulkLoading(null);
    }
  }

  async function saveEdit() {
    if (!editReq) return;
    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editReq.id, reviewerNotes: editNotes, status: "modified" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notes saved");
      setEditReq(null);
      router.refresh();
    } catch {
      toast.error("Failed to save notes");
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "approved": return "default" as const;
      case "rejected": return "destructive" as const;
      case "modified": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const confidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const pct = Math.round(confidence * 100);
    const color =
      confidence >= 0.8 ? "text-green-700 bg-green-50" :
      confidence >= 0.6 ? "text-yellow-700 bg-yellow-50" :
      "text-red-700 bg-red-50";
    return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>{pct}%</span>;
  };

  const categoryCounts = REQUIREMENT_CATEGORIES.map((c) => ({
    ...c,
    count: requirements.filter((r) => r.category === c.value).length,
  }));

  return (
    <div className="space-y-3">
      {/* Search + filter row */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search species, dates, fees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-gray-500">
          {sorted.length} of {requirements.length} rows
        </span>
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v); clearSelection(); }}>
        <TabsList>
          <TabsTrigger value="all">All ({requirements.length})</TabsTrigger>
          {categoryCounts.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label} ({c.count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              disabled={bulkLoading !== null}
              onClick={() => bulkUpdateStatus("approved")}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {bulkLoading === "approved" ? "Approving…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={bulkLoading !== null}
              onClick={() => bulkUpdateStatus("rejected")}
            >
              <XCircle className="h-3.5 w-3.5" />
              {bulkLoading === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={bulkLoading !== null}
              onClick={bulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bulkLoading === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </div>
          <button
            className="ml-auto text-xs text-blue-600 hover:underline cursor-pointer"
            onClick={clearSelection}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-6" />
              <TableHead className="w-24">Category</TableHead>
              <TableHead className="w-44">Species / Opportunity</TableHead>
              <TableHead className="w-36">Season Type</TableHead>
              <TableHead className="w-64">Dates</TableHead>
              <TableHead className="w-48">Fees</TableHead>
              <TableHead className="w-20 text-center">Confidence</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-gray-500">
                  No requirements found. Upload documents or scrape URLs to get started.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((req) => {
                const m = meta(req);
                const isExpanded = expanded === req.id;
                const isSelected = selected.has(req.id);
                const species = m.species_opportunity ?? req.subcategory ?? "—";
                const seasonType = m.season_type ?? "—";
                const dates = m.dates ?? req.description ?? "—";
                const fees = m.fees ?? "—";
                return (
                  <Fragment key={req.id}>
                    <TableRow
                      className={`cursor-pointer transition-colors duration-100 ${isSelected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => setExpanded(isExpanded ? null : req.id)}
                    >
                      <TableCell className="px-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(req.id)}
                          aria-label={`Select ${req.title}`}
                        />
                      </TableCell>
                      <TableCell className="text-gray-400 align-top">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline">{req.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm align-top whitespace-normal">
                        <CellText value={species} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 align-top whitespace-normal">
                        <CellText value={seasonType} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 align-top whitespace-normal">
                        <CellText value={dates} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 align-top whitespace-normal">
                        <CellText value={fees} />
                      </TableCell>
                      <TableCell className="text-center align-top">
                        {confidenceBadge(req.confidence)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditReq(req); setEditNotes(req.reviewerNotes ?? ""); }}
                          >
                            Notes
                          </Button>
                          {req.status !== "approved" && (
                            <Button size="sm" onClick={() => updateStatus(req.id, "approved")}>
                              Approve
                            </Button>
                          )}
                          {req.status !== "rejected" && (
                            <Button size="sm" variant="destructive" onClick={() => updateStatus(req.id, "rejected")}>
                              Reject
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className={isSelected ? "bg-blue-50" : "bg-slate-50"}>
                        <TableCell colSpan={10} className="px-10 py-4 whitespace-normal">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <DetailField label="Eligibility" value={m.eligibility} />
                            <DetailField label="Residency / Age Rule" value={m.residency_age_rule} />
                            <DetailField label="Required Licenses / Permits" value={m.required_licenses} />
                            <DetailField label="Fees" value={m.fees} />
                            <DetailField label="Lottery / Application Window" value={m.lottery_window} />
                            <DetailField label="Key Restrictions / Limits" value={m.key_restrictions} />
                            <DetailField label="Source URLs" value={m.source_urls} />
                            <DetailField label="Notes / Gaps" value={m.notes} />
                            {req.reviewerNotes && (
                              <DetailField label="Reviewer Notes" value={req.reviewerNotes} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editReq} onOpenChange={() => setEditReq(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reviewer Notes</DialogTitle>
          </DialogHeader>
          {editReq && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{editReq.title}</p>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this requirement..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={saveEdit}>Save Notes</Button>
                <Button variant="default" onClick={() => { updateStatus(editReq.id, "approved"); setEditReq(null); }}>
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => { updateStatus(editReq.id, "rejected"); setEditReq(null); }}>
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

function CellText({ value }: { value: string }) {
  const hasContent = value && value !== "—";
  return (
    <div className="group/cell relative">
      <p className="line-clamp-2 break-words">{value}</p>
      {hasContent && (
        <div
          role="tooltip"
          className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1 max-w-sm rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity duration-100 delay-150 group-hover/cell:visible group-hover/cell:opacity-100 whitespace-normal break-words"
        >
          {value}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string }) {
  if (!value || value === "None" || value === "Not applicable" || value === "N/A") return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-800 break-words whitespace-normal">{value}</dd>
    </div>
  );
}
