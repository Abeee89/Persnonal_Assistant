import { describe, expect, it } from "vitest";
import { buildMatchQuery, splitSnippet } from "./fts";

describe("buildMatchQuery", () => {
  it("quotes every token and prefix-matches the last one", () => {
    expect(buildMatchQuery("Next.js dash")).toBe('"Next" "js" "dash"*');
  });

  it("neutralises FTS operators and column syntax", () => {
    const query = buildMatchQuery('OR NEAR(x) title:secret "quote" *');
    expect(query).not.toBeNull();
    expect(query).not.toMatch(/(^|\s)(OR|NEAR)(\s|\(|$)/);
    expect(query).not.toContain("title:");
    expect(query?.split(" ").every((part) => part.startsWith('"'))).toBe(true);
  });

  it("returns null when nothing searchable remains", () => {
    expect(buildMatchQuery("   ")).toBeNull();
    expect(buildMatchQuery("!!! ???")).toBeNull();
  });

  it("caps the number of tokens", () => {
    const query = buildMatchQuery("a b c d e f g h i j k");
    expect(query?.split(" ")).toHaveLength(8);
  });

  it("keeps accented letters", () => {
    expect(buildMatchQuery("café")).toBe('"café"*');
  });
});

describe("splitSnippet", () => {
  it("separates highlighted and plain text in order", () => {
    expect(splitSnippet("Build <Next>.<js> dashboard")).toEqual([
      { text: "Build ", match: false },
      { text: "Next", match: true },
      { text: ".", match: false },
      { text: "js", match: true },
      { text: " dashboard", match: false },
    ]);
  });

  it("returns a single plain segment when there are no markers", () => {
    expect(splitSnippet("plain text")).toEqual([{ text: "plain text", match: false }]);
  });

  it("treats an unclosed marker as plain text", () => {
    expect(splitSnippet("broken <marker")).toEqual([{ text: "broken <marker", match: false }]);
  });

  it("never returns HTML-like content as markup, it is just text", () => {
    const segments = splitSnippet("<script>x</script>");
    expect(segments.every((s) => typeof s.text === "string")).toBe(true);
  });
});
