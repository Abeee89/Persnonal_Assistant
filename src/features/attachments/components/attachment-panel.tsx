"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { deleteAttachmentAction } from "../actions";
import type { AttachmentView } from "../service";
import type { AttachmentEntityType } from "../types";

export const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export interface AttachmentPanelProps {
  entityType: AttachmentEntityType;
  entityId: string;
  initial: AttachmentView[];
}

interface UploadResponse {
  ok: boolean;
  data?: AttachmentView;
  error?: { message: string };
}

async function uploadOne(file: File, entityType: AttachmentEntityType, entityId: string): Promise<AttachmentView> {
  const body = new FormData();
  body.append("file", file);
  body.append("entityType", entityType);
  body.append("entityId", entityId);
  const response = await fetch("/api/attachments", { method: "POST", body });
  const json = (await response.json()) as UploadResponse;
  if (!response.ok || !json.ok || !json.data) {
    throw new Error(json.error?.message ?? "Upload failed. Please try again.");
  }
  return json.data;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({ entityType, entityId, initial }: AttachmentPanelProps) {
  const [items, setItems] = useState<AttachmentView[]>(initial);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) {
      return;
    }
    setUploading(true);
    setMessage(null);
    const added: AttachmentView[] = [];
    const failures: string[] = [];
    for (const file of list) {
      try {
        added.push(await uploadOne(file, entityType, entityId));
      } catch (error: unknown) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }
    setItems((prev) => [...prev, ...added]);
    setUploading(false);
    if (failures.length > 0) {
      setMessage(failures.join(" "));
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAttachmentAction({ id, entityType, entityId });
      if (result.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <section aria-labelledby="attachments-heading" className="space-y-3">
      <h2 id="attachments-heading" className="text-sm font-medium">
        Attachments
      </h2>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground",
          dragging && "border-primary bg-accent/40",
        )}
      >
        <p>Drop JPG, PNG, WEBP or PDF files here</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            input.current?.click();
          }}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-foreground hover:bg-accent disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          aria-label="Choose files to attach"
          onChange={(event) => {
            void handleFiles(event.target.files ?? []);
            event.target.value = "";
          }}
        />
      </div>

      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-2">
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by our own protected route
                <img src={item.url} alt={item.originalName} className="size-12 rounded object-cover" loading="lazy" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded bg-muted text-xs font-medium">PDF</span>
              )}
              <div className="min-w-0 flex-1">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm hover:underline">
                  {item.originalName}
                </a>
                <p className="text-xs text-muted-foreground">{formatSize(item.sizeBytes)}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  remove(item.id);
                }}
                className="text-xs text-danger hover:underline disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
