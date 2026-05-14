"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import type { Document } from "@/lib/db/schema";

interface DocumentListProps {
  documents: Document[];
  customerId: string;
}

export function DocumentList({ documents, customerId }: DocumentListProps) {
  const router = useRouter();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);

  async function handleExtract(docId: string) {
    setExtracting(docId);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, customerId }),
      });
      if (!res.ok) throw new Error("Failed to start extraction");
      toast.success("Extraction started");
      router.refresh();
    } catch {
      toast.error("Failed to start extraction");
    } finally {
      setExtracting(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No documents yet. Upload files or add scrape targets above.
      </p>
    );
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "extracted":
        return "default" as const;
      case "processing":
        return "secondary" as const;
      case "error":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.filename}</TableCell>
                <TableCell>
                  <Badge variant="outline">{doc.fileType}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(doc.status)}>
                    {doc.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm text-gray-500">
                  {doc.sourceUrl ?? "Uploaded"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {doc.rawText && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        Preview
                      </Button>
                    )}
                    {(doc.status === "pending" ||
                      doc.status === "extracted") && (
                      <Button
                        size="sm"
                        disabled={extracting === doc.id}
                        onClick={() => handleExtract(doc.id)}
                      >
                        {extracting === doc.id
                          ? "Extracting..."
                          : "Extract Requirements"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.filename}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm">
            {previewDoc?.rawText}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
