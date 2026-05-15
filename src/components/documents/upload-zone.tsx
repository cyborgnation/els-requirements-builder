"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface OpStatus {
  step: "uploading" | "extracting";
  label: string;
  elapsed: number;
}

export function UploadZone({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [opStatus, setOpStatus] = useState<OpStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startStep(step: OpStatus["step"], label: string) {
    if (timerRef.current) clearInterval(timerRef.current);
    setOpStatus({ step, label, elapsed: 0 });
    timerRef.current = setInterval(() => {
      setOpStatus((prev) => prev ? { ...prev, elapsed: prev.elapsed + 1 } : null);
    }, 1000);
  }

  function clearOp() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setOpStatus(null);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const uploadFiles = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        // Step 1 — upload & parse text
        startStep("uploading", `Uploading ${file.name}…`);
        let documentId: string;
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("customerId", customerId);
          const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Upload failed");
          }
          const doc = await res.json();
          documentId = doc.id;
          if (!doc.rawText) {
            toast.error(`${file.name}: could not extract text`);
            continue;
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
          clearOp();
          return;
        }

        // Step 2 — extract requirements
        startStep("extracting", `Extracting requirements from ${file.name}…`);
        try {
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId, customerId }),
          });
          if (!res.ok) throw new Error("Extraction failed");
          const data = await res.json();
          toast.success(`${file.name} — ${data.requirementsCount} requirement${data.requirementsCount !== 1 ? "s" : ""} extracted`);
        } catch {
          toast.error(`${file.name}: extraction failed`);
        }
      }

      clearOp();
      router.refresh();
    },
    [customerId, router]
  );

  const busy = opStatus !== null;

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150 ${
          busy
            ? "border-[#CBD5E1] bg-[#F8FAFC] opacity-60 pointer-events-none"
            : dragging
            ? "border-[#003DA5] bg-[#EFF6FF]"
            : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8] hover:bg-white"
        }`}
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF]">
          <Upload
            className={`h-5 w-5 ${dragging ? "text-[#003DA5]" : "text-[#64748B]"}`}
            aria-hidden="true"
          />
        </div>
        <p className="text-sm font-medium text-[#475569]">
          Drag & drop PDF or text files here
        </p>
        <p className="mt-1 text-xs text-[#94A3B8]">PDF, TXT · requirements extracted automatically</p>
        <label className="mt-3 inline-block">
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.text"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            type="button"
            className="cursor-pointer border-[#E2E8F0] text-[#475569] hover:border-[#003DA5] hover:text-[#003DA5]"
          >
            Browse Files
          </Button>
        </label>
      </div>

      {/* Operation status */}
      {opStatus && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-800 truncate">{opStatus.label}</p>
            <div className="mt-1.5 flex gap-1.5">
              <StepDot active={opStatus.step === "uploading"} done={opStatus.step === "extracting"} label="Upload" />
              <StepDot active={opStatus.step === "extracting"} done={false} label="Extract" />
            </div>
          </div>
          <span className="shrink-0 tabular-nums text-sm text-blue-500">{opStatus.elapsed}s</span>
        </div>
      )}
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      active ? "bg-blue-200 text-blue-800" :
      done   ? "bg-green-100 text-green-700" :
               "bg-gray-100 text-gray-400"
    }`}>
      {done ? "✓" : active ? "●" : "○"} {label}
    </span>
  );
}
