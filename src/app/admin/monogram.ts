/** Two-letter mark for the workspace badge: the first letters of its first
 * two words ("Tidwell Specialty Welding" gives "TS"). */
export function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
