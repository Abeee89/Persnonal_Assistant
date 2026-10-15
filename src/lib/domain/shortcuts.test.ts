import { describe, expect, it } from "vitest";
import { isEditableTarget, matchesShortcut, type KeyLike } from "./shortcuts";

function ev(overrides: Partial<KeyLike> & { key: string }): KeyLike {
  return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides };
}

describe("matchesShortcut", () => {
  it("matches Mod+key with Ctrl or Cmd", () => {
    expect(matchesShortcut(ev({ key: "n", ctrlKey: true }), "Mod+N")).toBe(true);
    expect(matchesShortcut(ev({ key: "N", metaKey: true }), "Mod+N")).toBe(true);
  });

  it("does not match the bare key or a different key", () => {
    expect(matchesShortcut(ev({ key: "n" }), "Mod+N")).toBe(false);
    expect(matchesShortcut(ev({ key: "j", ctrlKey: true }), "Mod+N")).toBe(false);
  });

  it("rejects Alt and unexpected Shift combinations", () => {
    expect(matchesShortcut(ev({ key: "n", ctrlKey: true, altKey: true }), "Mod+N")).toBe(false);
    expect(matchesShortcut(ev({ key: "N", ctrlKey: true, shiftKey: true }), "Mod+N")).toBe(false);
  });

  it("matches the help key, which needs Shift on US layouts", () => {
    expect(matchesShortcut(ev({ key: "?", shiftKey: true }), "?")).toBe(true);
    expect(matchesShortcut(ev({ key: "/" }), "?")).toBe(false);
  });

  it("never treats a bare key as a Mod combo", () => {
    expect(matchesShortcut(ev({ key: "?", ctrlKey: true }), "?")).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("treats text fields and selects as editable", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
  });

  it("treats contenteditable regions as editable", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("treats buttons, bodies and null as not editable", () => {
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget({ tagName: "BODY" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});
