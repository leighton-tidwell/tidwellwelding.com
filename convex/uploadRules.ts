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

export const MAX_UPLOAD_FILES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_CAD_BYTES = 25 * 1024 * 1024;

type FileKind = "image" | "cad";

/** The file input's accept attribute for a job type. */
export const uploadAccept = (jobType: string) =>
  jobType === CNC_TYPE ? ["image/*", ...CAD_EXTENSIONS].join(",") : "image/*";

/** What a file counts as for this job type, or null when it is not allowed:
 * photos for every job, drawings and CAD files for CNC only. */
export function fileKind(
  jobType: string,
  file: { name: string; type?: string },
): FileKind | null {
  const name = file.name.toLowerCase();
  if (
    jobType === CNC_TYPE &&
    CAD_EXTENSIONS.some((ext) => name.endsWith(ext))
  ) {
    return "cad";
  }
  return (file.type ?? "").startsWith("image/") ||
    IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
    ? "image"
    : null;
}

/** Null when the file fits the job type and its size cap, else the reason. */
export function rejectFile(
  jobType: string,
  file: { name: string; type?: string; size: number },
): string | null {
  const kind = fileKind(jobType, file);
  if (!kind) return `${file.name} is not a file type this job takes.`;
  const cap = kind === "cad" ? MAX_CAD_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    return `${file.name} is over ${cap / 1024 / 1024} MB.`;
  }
  return null;
}
