/**
 * Canonical URL helper
 *
 * Rule: all internal, non-file URLs must end with a trailing slash.
 * - Keeps "/" as-is
 * - Skips file-like paths (".png", ".xml", etc.)
 * - Preserves query string and hash
 */

export function withTrailingSlash(input: string): string {
  if (!input) return input;

  // Only normalize internal paths.
  if (!input.startsWith("/")) return input;

  // Preserve hash + query
  const [pathAndQuery, hash] = input.split("#", 2);
  const [path, query] = pathAndQuery.split("?", 2);

  if (path === "/") {
    return "/" + (query ? `?${query}` : "") + (hash ? `#${hash}` : "");
  }

  // Skip file-like paths
  if (path.includes(".")) {
    return path + (query ? `?${query}` : "") + (hash ? `#${hash}` : "");
  }

  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return normalizedPath + (query ? `?${query}` : "") + (hash ? `#${hash}` : "");
}
