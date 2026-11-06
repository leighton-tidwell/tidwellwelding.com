import { describe, expect, test } from "vitest";
import {
  CNC_TYPE,
  rejectCompetitorFile,
  rejectFile,
  uploadAccept,
} from "./uploadRules";

describe("upload rules", () => {
  test("CNC takes drawings, CAD files and photos", () => {
    for (const name of ["a.dxf", "a.DWG", "a.svg", "a.pdf", "a.ai", "a.eps"]) {
      expect(rejectFile(CNC_TYPE, { name, type: "", size: 1000 })).toBeNull();
    }
    expect(
      rejectFile(CNC_TYPE, { name: "a.jpg", type: "image/jpeg", size: 1000 }),
    ).toBeNull();
    expect(uploadAccept(CNC_TYPE)).toBe("image/*,.dxf,.dwg,.svg,.pdf,.ai,.eps");
  });

  test("other job types take photos only", () => {
    expect(
      rejectFile("Fabrication (new build)", {
        name: "a.dxf",
        type: "",
        size: 1000,
      }),
    ).toBe("a.dxf is not a file type this job takes.");
    expect(
      rejectFile("Fabrication (new build)", {
        name: "a.mp4",
        type: "video/mp4",
        size: 1000,
      }),
    ).not.toBeNull();
    expect(uploadAccept("Fabrication (new build)")).toBe("image/*");
  });

  test("size caps: 10 MB for photos, 25 MB for CAD files", () => {
    const mb = 1024 * 1024;
    expect(
      rejectFile(CNC_TYPE, {
        name: "a.png",
        type: "image/png",
        size: 10 * mb + 1,
      }),
    ).toBe("a.png is over 10 MB.");
    expect(
      rejectFile(CNC_TYPE, { name: "a.dxf", type: "", size: 20 * mb }),
    ).toBeNull();
    expect(
      rejectFile(CNC_TYPE, { name: "a.dxf", type: "", size: 25 * mb + 1 }),
    ).toBe("a.dxf is over 25 MB.");
  });

  test("the competitor quote slot takes one photo or PDF", () => {
    const mb = 1024 * 1024;
    expect(
      rejectCompetitorFile({ name: "bid.PDF", type: "", size: 20 * mb }),
    ).toBeNull();
    expect(
      rejectCompetitorFile({ name: "bid.jpg", type: "image/jpeg", size: 1000 }),
    ).toBeNull();
    expect(
      rejectCompetitorFile({ name: "bid.dxf", type: "", size: 1000 }),
    ).toBe("bid.dxf is not a photo or PDF.");
    expect(
      rejectCompetitorFile({ name: "bid.pdf", type: "", size: 25 * mb + 1 }),
    ).toBe("bid.pdf is over 25 MB.");
  });
});
