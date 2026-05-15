"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentList } from "@/components/documents/document-list";
import { ScrapeTargetList } from "@/components/documents/scrape-target-list";
import type { Document, ScrapeTarget } from "@/lib/db/schema";

interface SourcesPanelProps {
  customerId: string;
  documents: Document[];
  targets: ScrapeTarget[];
}

export function SourcesPanel({ customerId, documents, targets }: SourcesPanelProps) {
  const [open, setOpen] = useState(false);
  const total = documents.length + targets.length;

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC] transition-colors duration-150 rounded-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Database className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
          <span className="font-medium text-[#1E293B]">Sources</span>
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#475569]">
            {total}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#64748B]">
          <span>{documents.length} document{documents.length !== 1 ? "s" : ""} · {targets.length} URL{targets.length !== 1 ? "s" : ""}</span>
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-6 border-t border-[#E2E8F0] px-5 py-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#64748B] uppercase tracking-wide">
              Upload Documents
            </h3>
            <UploadZone customerId={customerId} />
            {documents.length > 0 && (
              <div className="mt-4">
                <DocumentList documents={documents} customerId={customerId} />
              </div>
            )}
          </div>

          <div className="border-t border-[#E2E8F0] pt-5">
            <h3 className="mb-3 text-sm font-semibold text-[#64748B] uppercase tracking-wide">
              Scrape URLs
            </h3>
            <ScrapeTargetList targets={targets} customerId={customerId} />
          </div>
        </div>
      )}
    </div>
  );
}
