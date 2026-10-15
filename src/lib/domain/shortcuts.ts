export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Matches a combo such as "Mod+N" or "?" against a keyboard event.
 * "Mod" means Cmd on macOS and Ctrl elsewhere. Shift is rejected unless the combo
 * is "?", which needs Shift on US layouts.
 */
export function matchesShortcut(event: KeyLike, combo: string): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1] ?? "";
  const needsMod = parts.includes("Mod");
  const modDown = event.metaKey || event.ctrlKey;
  if (event.altKey || needsMod !== modDown) {
    return false;
  }
  if (event.shiftKey && key !== "?") {
    return false;
  }
  return event.key.toLowerCase() === key.toLowerCase();
}

export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

/** True when keys should type into a field rather than trigger single-key shortcuts. */
export function isEditableTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) {
    return false;
  }
  const node = target as TargetLike;
  if (node.isContentEditable === true) {
    return true;
  }
  const tag = node.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
