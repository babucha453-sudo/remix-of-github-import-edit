/**
 * Fetches all rows for a query that supports PostgREST range pagination.
 *
 * Important: many endpoints default to returning only the first 1,000 rows.
 * This helper iterates in chunks to retrieve the full dataset.
 */
export async function fetchAllWithRange<T>(
  fetchChunk: (from: number, to: number) => Promise<T[]>,
  options: { chunkSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const chunkSize = options.chunkSize ?? 1000;
  const maxRows = options.maxRows ?? Infinity;

  const all: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = Math.min(from + chunkSize - 1, maxRows - 1);
    if (to < from) break;

    const chunk = await fetchChunk(from, to);
    all.push(...chunk);

    if (chunk.length < chunkSize) break;
    from += chunkSize;
  }

  return all;
}
