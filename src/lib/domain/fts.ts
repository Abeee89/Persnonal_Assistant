/**
 * Builds a safe FTS5 MATCH expression from free text. Every token is quoted, so
 * user input can never inject FTS operators (AND, OR, NEAR, column filters, *).
 * The last token gets a prefix match so results appear while typing.
 * Returns null when the input has no searchable tokens.
 */
export function buildMatchQuery(input: string, maxTokens = 8): string | null {
  const tokens = input
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, maxTokens);
  if (tokens.length === 0) {
    return null;
  }
  return tokens
    .map((token, index) => {
      const quoted = `"${token.replace(/"/g, '""')}"`;
      return index === tokens.length - 1 ? `${quoted}*` : quoted;
    })
    .join(" ");
}

export interface SnippetSegment {
  text: string;
  match: boolean;
}

/**
 * Splits a snippet that uses `start`/`end` markers into plain segments. The UI renders
 * each segment as text (highlighted when `match`), so no HTML is ever injected.
 */
export function splitSnippet(snippet: string, start = "<", end = ">"): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let index = 0;
  while (index < snippet.length) {
    const open = snippet.indexOf(start, index);
    if (open === -1) {
      segments.push({ text: snippet.slice(index), match: false });
      break;
    }
    const close = snippet.indexOf(end, open + start.length);
    if (close === -1) {
      segments.push({ text: snippet.slice(index), match: false });
      break;
    }
    if (open > index) {
      segments.push({ text: snippet.slice(index, open), match: false });
    }
    segments.push({ text: snippet.slice(open + start.length, close), match: true });
    index = close + end.length;
  }
  return segments.filter((segment) => segment.text.length > 0);
}
