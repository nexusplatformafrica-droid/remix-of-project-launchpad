/** Preserve the browser's byte request; never turn an ordinary GET into a partial file. */
export function movieRequestRange(range: string | null, probe = false) {
  return probe ? "bytes=0-0" : range;
}

/** Only the exact resource may be resumed; equal resolution does not mean equal bytes. */
export function exactMovieSource<T extends { id: string }>(sources: T[], resourceId: string) {
  return sources.find((source) => source.id === resourceId);
}

export function validMovieContentRange(value: string | null) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  return [start, end, total].every(Number.isSafeInteger) && start <= end && end < total;
}