import { describe, expect, test } from "vitest";
import {
  CNC_TYPE,
  MAX_VIDEO_BYTES,
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
    // A CNC part is cut from a drawing, so the video kind stops at CNC.
    expect(
      rejectFile(CNC_TYPE, { name: "a.mp4", type: "video/mp4", size: 1000 }),
    ).toBe("a.mp4 is not a file type this job takes.");
  });

  test("other job types take photos and video, not drawings (issue #20)", () => {
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
    ).toBeNull();
    // A phone that hands over no content type still gets its clip through.
    for (const name of ["clip.MOV", "clip.m4v", "clip.webm", "clip.3gp"]) {
      expect(
        rejectFile("Fabrication (new build)", { name, type: "", size: 1000 }),
      ).toBeNull();
    }
    expect(uploadAccept("Fabrication (new build)")).toBe("image/*,video/*");
  });

  test("video has a 200 MB cap of its own", () => {
    const mb = 1024 * 1024;
    const clip = (size: number) => ({
      name: "weld.mov",
      type: "video/quicktime",
      size,
    });
    expect(MAX_VIDEO_BYTES).toBe(200 * mb);
    // 30 seconds of 4K/30 off a phone, the case the cap exists for.
    expect(rejectFile("Repair / welding", clip(190 * mb))).toBeNull();
    expect(rejectFile("Repair / welding", clip(200 * mb + 1))).toBe(
      "weld.mov is over 200 MB.",
    );
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
    // The video kind does not reach this slot: it is the other shop's paper.
    expect(
      rejectCompetitorFile({ name: "bid.mp4", type: "video/mp4", size: 1000 }),
    ).toBe("bid.mp4 is not a photo or PDF.");
    expect(
      rejectCompetitorFile({ name: "bid.pdf", type: "", size: 25 * mb + 1 }),
    ).toBe("bid.pdf is over 25 MB.");
  });
});
