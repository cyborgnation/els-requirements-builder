"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Requirement } from "@/lib/db/schema";

interface MatrixMeta {
  species_opportunity?: string;
  season_type?: string;
  dates?: string;
}

function meta(req: Requirement): MatrixMeta {
  return (req.metadata ?? {}) as MatrixMeta;
}

interface FindDuplicatesDialogProps {
  customerId: string;
}

export function FindDuplicatesDialog({
  customerId,
}: FindDuplicatesDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Requirement[][]>([]);
  const [merging, setMerging] = useState<string | null>(null);

  async function loadGroups() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/requirements/duplicates?customerId=${customerId}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(data.groups);
    } catch {
      toast.error("Failed to load duplicates");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await loadGroups();
    } else {
      setGroups([]);
    }
  }

  async function mergeGroup(group: Requirement[]) {
    const [keep, ...rest] = group;
    setMerging(keep.id);
    try {
      const res = await fetch("/api/requirements/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepId: keep.id,
          mergeIds: rest.map((r) => r.id),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        `Merged ${rest.length} duplicate${rest.length === 1 ? "" : "s"}`
      );
      await loadGroups();
      router.refresh();
    } catch {
      toast.error("Merge failed");
    } finally {
      setMerging(null);
    }
  }

  async function mergeAll() {
    setMerging("all");
    try {
      for (const group of groups) {
        const [keep, ...rest] = group;
        const res = await fetch("/api/requirements/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keepId: keep.id,
            mergeIds: rest.map((r) => r.id),
          }),
        });
        if (!res.ok) throw new Error();
      }
      toast.success(
        `Merged ${groups.length} group${groups.length === 1 ? "" : "s"}`
      );
      await loadGroups();
      router.refresh();
    } catch {
      toast.error("Some merges failed");
    } finally {
      setMerging(null);
    }
  }

  const confidenceLabel = (c: number | null) =>
    c == null ? "—" : `${Math.round(c * 100)}%`;

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
        onClick={() => handleOpenChange(true)}
      >
        <Combine className="h-4 w-4" aria-hidden="true" />
        Find Duplicates
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>
                Duplicate Requirements
                {!loading && groups.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-[#64748B]">
                    {groups.length} group{groups.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              {!loading && groups.length > 1 && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer"
                  disabled={merging !== null}
                  onClick={mergeAll}
                >
                  {merging === "all" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Combine className="h-3.5 w-3.5" />
                  )}
                  Merge all
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning requirements…
            </div>
          ) : groups.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#64748B]">
              No duplicates found.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#64748B]">
                Each group will collapse into its highest-confidence row.
                Source documents from the others are preserved in metadata.
              </p>

              {groups.map((group) => {
                const [keep] = group;
                return (
                  <div
                    key={keep.id}
                    className="rounded-lg border border-[#E2E8F0] bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="outline">{keep.category}</Badge>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-[#003DA5] text-white hover:bg-[#003090] cursor-pointer"
                        disabled={merging !== null}
                        onClick={() => mergeGroup(group)}
                      >
                        {merging === keep.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Combine className="h-3.5 w-3.5" />
                        )}
                        Merge {group.length}
                      </Button>
                    </div>

                    <ul className="space-y-2">
                      {group.map((r, idx) => {
                        const m = meta(r);
                        return (
                          <li
                            key={r.id}
                            className={`rounded border p-3 text-sm ${
                              idx === 0
                                ? "border-green-300 bg-green-50"
                                : "border-[#E2E8F0]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[#1E293B]">
                                {m.species_opportunity ??
                                  r.subcategory ??
                                  r.title}
                              </span>
                              <span className="text-xs text-[#64748B]">
                                {idx === 0 ? "keep · " : ""}
                                {confidenceLabel(r.confidence)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              {m.season_type ?? "—"}
                              {m.dates ? ` · ${m.dates}` : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
