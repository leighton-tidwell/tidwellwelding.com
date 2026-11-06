// Pure upload rules shared by the quote form and the server. No Convex
// imports: the browser bundle loads this file too.

export const CNC_TYPE = "CNC plasma cutting / signs";

/** Drawing and CAD formats a CNC job can upload, on top of photos. */
export const CAD_EXTENSIONS = [".dxf", ".dwg", ".svg", ".pdf", ".ai", ".eps"];

/** Photo extensions, for uploads that arrive without an image content type. */
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
];

/** Video extensions, for clips that arrive without a video content type. */
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".3gp", ".avi"];

export const MAX_UPLOAD_FILES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_CAD_BYTES = 25 * 1024 * 1024;
/**
 * Video is phone footage, so the cap has to clear what a phone actually
 * produces: 30 seconds of 4K/30 HEVC is around 190 MB, and 1080p/30 runs
 * about 2 MB a second. 200 MB takes either of those without an argument and
 * still refuses the multi-minute recording nobody needs to price a gate.
 */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type FileKind = "image" | "cad" | "video";

const CAP_BYTES: Record<FileKind, number> = {
  image: MAX_IMAGE_BYTES,
  cad: MAX_CAD_BYTES,
  video: MAX_VIDEO_BYTES,
};

/** The file input's accept attribute for a job type. */
export const uploadAccept = (jobType: string) =>
  jobType === CNC_TYPE
    ? ["image/*", ...CAD_EXTENSIONS].join(",")
    : "image/*,video/*";

/** What a file counts as for this job type, or null when it is not allowed:
 * photos for every job, video for every job but CNC, drawings and CAD files
 * for CNC only. A CNC part is cut from a drawing, so footage of it buys the
 * shop nothing and the file input there stays drawings and photos. */
export function fileKind(
  jobType: string,
  file: { name: string; type?: string },
): FileKind | null {
  const name = file.name.toLowerCase();
  const type = file.type ?? "";
  if (
    jobType === CNC_TYPE &&
    CAD_EXTENSIONS.some((ext) => name.endsWith(ext))
  ) {
    return "cad";
  }
  if (
    type.startsWith("image/") ||
    IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
  ) {
    return "image";
  }
  if (
    jobType !== CNC_TYPE &&
    (type.startsWith("video/") ||
      VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext)))
  ) {
    return "video";
  }
  return null;
}

type UploadFile = { name: string; type?: string; size: number };

const overCap = (file: UploadFile, kind: FileKind) => {
  const cap = CAP_BYTES[kind];
  return file.size > cap
    ? `${file.name} is over ${cap / 1024 / 1024} MB.`
    : null;
};

/** Null when the file fits the job type and its size cap, else the reason. */
export function rejectFile(jobType: string, file: UploadFile): string | null {
  const kind = fileKind(jobType, file);
  if (!kind) return `${file.name} is not a file type this job takes.`;
  return overCap(file, kind);
}

/** The competitor quote slot takes one photo or PDF on any job type. */
export const COMPETITOR_ACCEPT = "image/*,.pdf";

/** Null when the competitor quote is a photo or PDF under its size cap. */
export function rejectCompetitorFile(file: UploadFile): string | null {
  if (file.name.toLowerCase().endsWith(".pdf")) return overCap(file, "cad");
  if (fileKind("", file) !== "image") {
    return `${file.name} is not a photo or PDF.`;
  }
  return overCap(file, "image");
}
