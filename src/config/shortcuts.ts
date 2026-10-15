export interface ShortcutAction {
  id: string;
  combo: string;
  label: string;
  /** When true, the shortcut also fires while typing in a field (modifier combos only). */
  allowInInput?: boolean;
}

export const SHORTCUTS: readonly ShortcutAction[] = [
  { id: "search", combo: "Mod+K", label: "Search and quick actions", allowInInput: true },
  { id: "new-activity", combo: "Mod+N", label: "New activity", allowInInput: true },
  { id: "journal", combo: "Mod+J", label: "Open today's journal", allowInInput: true },
  { id: "new-task", combo: "Mod+T", label: "New task", allowInInput: true },
  { id: "help", combo: "?", label: "Show keyboard shortcuts" },
];
