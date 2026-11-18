import { saveSetting } from "./app-settings";
import { fdb } from "./fdb";
import type { LatestPick } from "./latest-rules";

export const LATEST_KEY = "latest_catalog_titles";
export async function loadLatestPicks(): Promise<LatestPick[]> {
  const { data, error } = await fdb.from("app_settings").select("*").eq("key", LATEST_KEY).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.value) ? data.value as LatestPick[] : [];
}
export const saveLatestPicks = (items: LatestPick[]) => saveSetting(LATEST_KEY, items);