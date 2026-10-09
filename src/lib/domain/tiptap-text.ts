/**
 * Deterministic plain-text extraction from a TipTap (ProseMirror) JSON document.
 * Used for FTS, previews and exports (SDD §06 §6). Only text nodes contribute;
 * block boundaries become single newlines. Unknown nodes are walked, never trusted.
 */

interface PmNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
]);

function isNode(value: unknown): value is PmNode {
  return typeof value === "object" && value !== null;
}

function walk(node: PmNode, out: string[]): void {
  if (typeof node.text === "string") {
    out.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content as unknown[]) {
      if (isNode(child)) {
        walk(child, out);
      }
    }
  }
  if (typeof node.type === "string" && BLOCK_TYPES.has(node.type)) {
    out.push("\n");
  }
}

export function extractPlainText(json: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return "";
  }
  if (!isNode(parsed)) {
    return "";
  }
  const parts: string[] = [];
  walk(parsed, parts);
  return parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
