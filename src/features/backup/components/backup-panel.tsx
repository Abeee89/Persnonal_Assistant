"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface Preview {
  version: number;
  strategyNote: string;
  tables: { table: string; incoming: number; existing: number }[];
  attachmentsIncoming: number;
}

interface ImportResponse {
  ok: boolean;
  data?: { preview: Preview } | { report: { strategy: string; inserted: Record<string, number>; attachmentsWritten: number }; safetyCopy: string };
  error?: { message: string };
}

type Phase = "idle" | "previewing" | "ready" | "applying" | "done";

export function BackupPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [strategy, setStrategy] = useState<"replace" | "merge">("replace");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(withPreview: boolean, withStrategy: "replace" | "merge") {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("strategy", withStrategy);
    const url = withPreview ? "/api/import?preview=1" : "/api/import";
    const response = await fetch(url, { method: "POST", body });
    const json = (await response.json()) as ImportResponse;
    if (!response.ok || !json.ok || !json.data) {
      throw new Error(json.error?.message ?? "Import failed.");
    }
    return json.data;
  }

  async function startPreview(selected: File) {
    setFile(selected);
    setPreview(null);
    setError(null);
    setMessage(null);
    setPhase("previewing");
    try {
      const data = await send(true, strategy);
      if (data && "preview" in data) {
        setPreview(data.preview);
        setPhase("ready");
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
      setPhase("idle");
    }
  }

  async function apply() {
    setError(null);
    setPhase("applying");
    try {
      const data = await send(false, strategy);
      if (data && "report" in data) {
        setMessage(
          `Restored using ${data.report.strategy}. ${String(data.report.inserted["activities"] ?? 0)} activities, ` +
            `${String(data.report.attachmentsWritten)} files. Safety copy kept.`,
        );
        setPhase("done");
        router.refresh();
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
      setPhase("ready");
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="export-heading" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="export-heading" className="text-sm font-medium">
          Export
        </h2>
        <p className="text-sm text-muted-foreground">
          ZIP is the recommended full backup: it includes every table, your attachments and a checksum manifest.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?format=zip" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            Download ZIP
          </a>
          <a href="/api/export?format=json" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
            JSON only
          </a>
          <a href="/api/export?format=csv" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
            CSV (zip)
          </a>
        </div>
      </section>

      <section aria-labelledby="import-heading" className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="import-heading" className="text-sm font-medium">
          Restore
        </h2>
        <p className="text-sm text-muted-foreground">
          A safety copy of your current data is written before anything changes.
        </p>

        <input
          type="file"
          accept=".zip,application/zip"
          aria-label="Backup archive"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              void startPreview(selected);
            }
            event.target.value = "";
          }}
          className="block text-sm"
        />

        {phase === "previewing" ? <p className="text-sm text-muted-foreground">Checking the archive…</p> : null}

        {preview ? (
          <div className="space-y-3">
            <p className="text-sm">{preview.strategyNote}</p>
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Restore strategy</legend>
              {(["replace", "merge"] as const).map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={strategy === option}
                    onChange={() => {
                      setStrategy(option);
                    }}
                  />
                  {option === "replace" ? "Replace everything" : "Merge (keep existing)"}
                </label>
              ))}
            </fieldset>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-1.5">Table</th>
                    <th className="px-3 py-1.5 text-right">In backup</th>
                    <th className="px-3 py-1.5 text-right">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.tables
                    .filter((row) => row.incoming > 0 || row.existing > 0)
                    .map((row) => (
                      <tr key={row.table} className="border-t border-border">
                        <td className="px-3 py-1">{row.table}</td>
                        <td className="px-3 py-1 text-right tabular-nums">{row.incoming}</td>
                        <td className="px-3 py-1 text-right tabular-nums">{row.existing}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {preview.attachmentsIncoming} attachment{preview.attachmentsIncoming === 1 ? "" : "s"} in the archive.
            </p>
            <button
              type="button"
              disabled={phase === "applying"}
              onClick={() => {
                void apply();
              }}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium",
                strategy === "replace" ? "bg-danger text-white" : "bg-primary text-primary-foreground",
                phase === "applying" && "opacity-60",
              )}
            >
              {phase === "applying" ? "Restoring…" : strategy === "replace" ? "Replace my data" : "Merge into my data"}
            </button>
          </div>
        ) : null}

        {message ? (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
