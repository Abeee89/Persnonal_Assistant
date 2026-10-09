const MAX_NAME_LENGTH = 150;

function isPrintable(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x20 && (code < 0x7f || code > 0x9f);
}

/**
 * Display-only name: basename only, control characters removed, whitespace
 * collapsed, length capped. Never used to build a filesystem path.
 */
export function sanitizeOriginalName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const spaced = base.replace(/\s+/g, " ");
  const printable = Array.from(spaced).filter(isPrintable).join("");
  const collapsed = printable.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  if (collapsed === "" || collapsed === "." || collapsed === "..") {
    return "file";
  }
  return collapsed;
}
