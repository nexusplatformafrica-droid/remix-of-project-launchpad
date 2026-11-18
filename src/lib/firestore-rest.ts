/**
 * Read-only Firestore access over the public REST endpoint, for server routes
 * (no Firebase SDK session needed). Converts typed Firestore values to JSON.
 */
const BASE =
  "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents";
const KEY = "AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";

type FsValue = {
  stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean;
  timestampValue?: string; nullValue?: null; arrayValue?: { values?: FsValue[] };
  mapValue?: { fields?: Record<string, FsValue> };
};

export function fromFirestoreValue(v: FsValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) {
    const values = v.arrayValue?.values ?? [];
    return values.map(fromFirestoreValue);
  }
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue?.fields);
  return null;
}

export function fromFirestoreFields(fields: Record<string, FsValue> | undefined) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields ?? {})) out[k] = fromFirestoreValue(val);
  return out;
}

const cache = new Map<string, { at: number; rows: Record<string, unknown>[] }>();

/** Every document in a collection (cached 5 minutes to protect the daily quota). */
export async function listCollection(name: string, maxPages = 20): Promise<Record<string, unknown>[]> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.rows;
  const rows: Record<string, unknown>[] = [];
  let token = "";
  try {
    for (let i = 0; i < maxPages; i++) {
      const url = `${BASE}/${name}?key=${KEY}&pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Library unavailable (${res.status})`);
      const json = (await res.json()) as {
        documents?: { name: string; fields?: Record<string, FsValue> }[];
        nextPageToken?: string;
      };
      for (const d of json.documents ?? []) {
        rows.push({ ...fromFirestoreFields(d.fields), id: d.name.split("/").pop() });
      }
      if (!json.nextPageToken) break;
      token = json.nextPageToken;
    }
  } catch (e) {
    if (hit) return hit.rows; // serve the last good copy when Firestore is out of quota
    throw e;
  }
  cache.set(name, { at: Date.now(), rows });
  return rows;
}
