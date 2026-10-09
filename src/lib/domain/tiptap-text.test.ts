import { describe, expect, it } from "vitest";
import { EMPTY_DOC, extractPlainText } from "./tiptap-text";

const doc = (...blocks: unknown[]) => JSON.stringify({ type: "doc", content: blocks });

describe("extractPlainText", () => {
  it("joins paragraphs with newlines", () => {
    const json = doc(
      { type: "paragraph", content: [{ type: "text", text: "Today I learned" }] },
      { type: "paragraph", content: [{ type: "text", text: "Next.js routing" }] },
    );
    expect(extractPlainText(json)).toBe("Today I learned\nNext.js routing");
  });

  it("keeps marked text (bold, link) as plain words", () => {
    const json = doc({
      type: "paragraph",
      content: [
        { type: "text", text: "Build " },
        { type: "text", text: "Next.js", marks: [{ type: "bold" }] },
        { type: "text", text: " dashboard" },
      ],
    });
    expect(extractPlainText(json)).toBe("Build Next.js dashboard");
  });

  it("walks nested lists", () => {
    const json = doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "item one" }] }],
        },
      ],
    });
    expect(extractPlainText(json)).toBe("item one");
  });

  it("ignores attributes and image sources (never leaks URLs as text)", () => {
    const json = doc({ type: "image", attrs: { src: "/api/files/abc" } });
    expect(extractPlainText(json)).toBe("");
  });

  it("returns empty string for invalid or non-object JSON", () => {
    expect(extractPlainText("not json")).toBe("");
    expect(extractPlainText("[1,2]")).toBe("");
    expect(extractPlainText("null")).toBe("");
  });

  it("collapses whitespace and drops empty lines", () => {
    const json = doc({ type: "paragraph", content: [{ type: "text", text: "  a   b  " }] }, { type: "paragraph" });
    expect(extractPlainText(json)).toBe("a b");
  });

  it("empty template document yields no text", () => {
    expect(extractPlainText(EMPTY_DOC)).toBe("");
  });
});
