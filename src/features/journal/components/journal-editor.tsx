"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveJournalAction } from "../actions";
import { PendingAttachments } from "@/features/attachments/components/pending-attachments";
import type { AttachmentView } from "@/features/attachments/service";
import { cn } from "@/lib/cn";

export const AUTOSAVE_DELAY_MS = 1500;

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

import { PROMPT_KEYS, draftPayload, type EditorDraft, type PromptKey } from "../draft";

const PROMPT_LABELS: Record<PromptKey, string> = {
  whatHappened: "What happened today?",
  accomplished: "What did I accomplish?",
  wentWell: "What went well?",
  didNotGoWell: "What did not go well?",
  learned: "What did I learn?",
  improveTomorrow: "What should I improve tomorrow?",
  gratitude: "Gratitude",
};
const MOOD_LABEL = ["Very low", "Low", "Okay", "Good", "Great"];

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved — will retry on next change",
};

export function JournalEditor({
  initial,
  initialAttachments,
}: {
  initial: EditorDraft;
  initialAttachments: AttachmentView[];
}) {
  const [draft, setDraft] = useState<EditorDraft>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<EditorDraft>(initial);
  const dirty = useRef(false);

  const persist = useCallback(async () => {
    if (!dirty.current) {
      return;
    }
    dirty.current = false;
    setSaveState("saving");
    const result = await saveJournalAction(draftPayload(latest.current));
    if (result.ok) {
      setSaveState("saved");
    } else {
      dirty.current = true;
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(
    (next: EditorDraft) => {
      latest.current = next;
      dirty.current = true;
      setSaveState("pending");
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        void persist();
      }, AUTOSAVE_DELAY_MS);
    },
    [persist],
  );

  const update = useCallback(
    (mutate: (prev: EditorDraft) => EditorDraft) => {
      const next = mutate(latest.current);
      setDraft(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: JSON.parse(initial.contentJson) as JSONContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Journal entry",
        class:
          "min-h-[12rem] max-w-prose mx-auto outline-none text-[17px] leading-[1.7] focus-visible:outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      update((prev) => ({ ...prev, contentJson: JSON.stringify(instance.getJSON()) }));
    },
  });

  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [persist]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap items-center gap-3 text-sm">
          <legend className="sr-only">Mood</legend>
          <span className="text-muted-foreground">Mood</span>
          <div role="radiogroup" aria-label="Mood" className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.mood === value}
                aria-label={`${String(value)} — ${MOOD_LABEL[value - 1] ?? ""}`}
                onClick={() => {
                  update((prev) => ({ ...prev, mood: prev.mood === value ? null : value }));
                }}
                className={cn(
                  "size-8 rounded-md border border-border text-xs tabular-nums",
                  draft.mood === value ? "bg-accent font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {SAVE_LABEL[saveState]}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
        {editor ? <EditorContent editor={editor} /> : <p className="text-sm text-muted-foreground">Loading editor…</p>}
      </div>

      <div className="grid gap-5">
        {PROMPT_KEYS.map((key) => (
          <label key={key} className="block text-sm font-medium">
            {PROMPT_LABELS[key]}
            <textarea
              rows={2}
              maxLength={5000}
              value={draft.prompts[key]}
              onChange={(event) => {
                const value = event.target.value;
                update((prev) => ({ ...prev, prompts: { ...prev.prompts, [key]: value } }));
              }}
              className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        ))}
      </div>

      <PendingAttachments
        entityType="journal"
        initial={initialAttachments}
        onChange={(ids) => {
          update((prev) => ({ ...prev, attachmentIds: ids }));
        }}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.private}
          onChange={(event) => {
            const checked = event.target.checked;
            update((prev) => ({ ...prev, private: checked }));
          }}
        />
        Keep private (excluded from future AI features)
      </label>
    </div>
  );
}
