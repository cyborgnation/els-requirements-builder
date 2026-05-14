"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function UploadZone({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("customerId", customerId);

          const res = await fetch("/api/documents/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Upload failed");
          }
        }
        toast.success(`Uploaded ${files.length} file(s)`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload failed"
        );
      } finally {
        setUploading(false);
      }
    },
    [customerId, router]
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <p className="mb-2 text-sm text-gray-600">
        {uploading
          ? "Uploading..."
          : "Drag & drop PDF or text files here, or click to browse"}
      </p>
      <label>
        <input
          type="file"
          multiple
          accept=".pdf,.txt,.text"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFiles(e.target.files);
            }
          }}
        />
        <Button variant="outline" size="sm" disabled={uploading} type="button">
          Browse Files
        </Button>
      </label>
    </div>
  );
}
