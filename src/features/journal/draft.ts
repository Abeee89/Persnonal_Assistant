import type { JournalView } from "./service";

export const PROMPT_KEYS = [
  "whatHappened",
  "accomplished",
  "wentWell",
  "didNotGoWell",
  "learned",
  "improveTomorrow",
  "gratitude",
] as const;

export type PromptKey = (typeof PROMPT_KEYS)[number];

export interface EditorDraft {
  date: string;
  contentJson: string;
  mood: number | null;
  energyLevel: number | null;
  private: boolean;
  prompts: Record<PromptKey, string>;
  attachmentIds: string[];
}

export function draftFrom(view: JournalView, attachmentIds: string[] = []): EditorDraft {
  return {
    date: view.date,
    contentJson: view.contentJson,
    mood: view.mood,
    energyLevel: view.energyLevel,
    private: view.private,
    attachmentIds,
    prompts: {
      whatHappened: view.whatHappened ?? "",
      accomplished: view.accomplished ?? "",
      wentWell: view.wentWell ?? "",
      didNotGoWell: view.didNotGoWell ?? "",
      learned: view.learned ?? "",
      improveTomorrow: view.improveTomorrow ?? "",
      gratitude: view.gratitude ?? "",
    },
  };
}

export function emptyDraft(date: string, contentJson: string): EditorDraft {
  return {
    date,
    contentJson,
    mood: null,
    energyLevel: null,
    private: false,
    attachmentIds: [],
    prompts: {
      whatHappened: "",
      accomplished: "",
      wentWell: "",
      didNotGoWell: "",
      learned: "",
      improveTomorrow: "",
      gratitude: "",
    },
  };
}

export function draftPayload(draft: EditorDraft) {
  const nullIfEmpty = (value: string) => (value.trim() === "" ? null : value);
  return {
    date: draft.date,
    type: "daily" as const,
    mood: draft.mood,
    energyLevel: draft.energyLevel,
    contentJson: draft.contentJson,
    whatHappened: nullIfEmpty(draft.prompts.whatHappened),
    accomplished: nullIfEmpty(draft.prompts.accomplished),
    wentWell: nullIfEmpty(draft.prompts.wentWell),
    didNotGoWell: nullIfEmpty(draft.prompts.didNotGoWell),
    learned: nullIfEmpty(draft.prompts.learned),
    improveTomorrow: nullIfEmpty(draft.prompts.improveTomorrow),
    gratitude: nullIfEmpty(draft.prompts.gratitude),
    notes: null,
    private: draft.private,
    status: "draft" as const,
    tags: [] as string[],
    attachmentIds: draft.attachmentIds,
  };
}
