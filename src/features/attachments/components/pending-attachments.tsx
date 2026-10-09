"use client";

import { useRef, useState } from "react";
import { ACCEPT } from "./attachment-panel";
import type { AttachmentView } from "../service";

export interface PendingAttachmentsProps {
  entityType: "journal";
  initial: AttachmentView[];
  onChange: (ids: string[]) => void;
}

interface UploadResponse {
  ok: boolean;
  data?: AttachmentView;
  error?: { message: string };
}

/**
 * Journal attachments upload as `pending` before the entry exists. The entry save
 * binds them in the same transaction (SDD §08 §4 step 8).
 */
export function PendingAttachments({ entityType, initial, onChange }: PendingAttachmentsProps) {
  const [items, setItems] = useState<AttachmentView[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    setMessage(null);
    const next = [...items];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      body.append("entityType", entityType);
      const response = await fetch("/api/attachments", { method: "POST", body });
      const json = (await response.json()) as UploadResponse;
      if (!response.ok || !json.ok || !json.data) {
        setMessage(json.error?.message ?? "Upload failed. Please try again.");
        continue;
      }
      next.push(json.data);
    }
    setItems(next);
    onChange(next.map((item) => item.id));
    setUploading(false);
  }

  return (
    <section aria-labelledby="journal-attachments" className="space-y-2">
      <h2 id="journal-attachments" className="text-sm font-medium">
        Attachments
      </h2>
      <button
        type="button"
        disabled={uploading}
        onClick={() => {
          input.current?.click();
        }}
        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Add file"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="Add a file to this entry"
        onChange={(event) => {
          if (event.target.files) {
            void handleFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.id}>{item.originalName}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
