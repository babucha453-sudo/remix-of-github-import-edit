/**
 * Normalize directory state slugs.
 *
 * The database uses full-name slugs (california, new-jersey, etc.)
 * but URLs use abbreviation slugs (ca, nj).
 *
 * This function normalizes both formats to the DB slug (full name).
 * URLs should use abbreviation slugs (ca, ma, ct, nj).
 */
const ABBREV_TO_FULL: Record<string, string> = {
  ca: "california",
  ma: "massachusetts",
  ct: "connecticut",
  nj: "new-jersey",
};

export function normalizeStateSlug(input?: string | null): string {
  const s = (input || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  // If it's an abbreviation, convert to full slug; otherwise keep as-is
  return ABBREV_TO_FULL[lower] ?? lower;
}
