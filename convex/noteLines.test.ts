import { describe, expect, it } from "vitest";
import { clipNote, noteFits, wrapEmail, wrapNote } from "./noteLines";

// 8pt Helvetica: "i" is 1.776pt wide and "W" is 7.552pt, so a 100pt line
// (96pt after the end-of-line slack) holds 54 of one and 12 of the other.

describe("wrapNote", () => {
  it("breaks by printed width, not by character count", () => {
    expect(wrapNote("i".repeat(54), 100)).toEqual(["i".repeat(54)]);
    expect(wrapNote("W".repeat(13), 100)).toEqual(["W".repeat(12), "W"]);
  });

  it("breaks between words and drops the space at the break", () => {
    expect(wrapNote("WWWWWWW WWWWWWW WWW", 100)).toEqual([
      "WWWWWWW",
      "WWWWWWW WWW",
    ]);
  });

  it("starts a new line where the writer pressed Enter, blank lines included", () => {
    expect(wrapNote("Gate hung.\n\nOwner approved.", 258)).toEqual([
      "Gate hung.",
      "",
      "Owner approved.",
    ]);
  });

  it("gives an empty note no lines", () => {
    expect(wrapNote("", 258)).toEqual([]);
  });

  it("measures a character it has no width for as the widest glyph", () => {
    // 8pt each, so twelve fill 96pt and the thirteenth wraps.
    expect(wrapNote("字".repeat(13), 100)).toEqual(["字".repeat(12), "字"]);
  });
});

describe("clipNote", () => {
  const box = { lines: 2, width: 100 };

  it("leaves a note that fits untouched", () => {
    expect(clipNote("WWWW WWWW", box)).toBe("WWWW WWWW");
  });

  it("cuts a note at the last character that still fits the box", () => {
    const clipped = clipNote("W".repeat(40), box);

    expect(clipped).toBe("W".repeat(24));
    expect(noteFits(clipped, box)).toBe(true);
    expect(noteFits(`${clipped}W`, box)).toBe(false);
  });

  it("stops a third line being started with Enter", () => {
    expect(clipNote("one\ntwo\nthree", box)).toBe("one\ntwo");
  });
});

describe("wrapEmail", () => {
  // 8pt Helvetica in a 100pt cell: "bob@" is 20.9pt and each "m" 6.7pt.

  it("keeps an address that fits on one line", () => {
    expect(wrapEmail("bob@mmmm.com", 100, 8)).toEqual(["bob@mmmm.com"]);
  });

  it("breaks before the last dot that no longer fits", () => {
    expect(wrapEmail("bob@mmmmmmmm.mm.com", 100, 8)).toEqual([
      "bob@mmmmmmmm.mm",
      ".com",
    ]);
  });

  it("breaks after the @ when the domain needs a line to itself", () => {
    expect(wrapEmail("bob@mmmmmmmmmmmm.com", 100, 8)).toEqual([
      "bob@",
      "mmmmmmmmmmmm",
      ".com",
    ]);
  });
});
