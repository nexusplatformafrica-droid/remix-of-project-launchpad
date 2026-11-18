import { getFbAuth } from "./firebase";
import { MAX_UPLOAD_BYTES } from "./music-rules";

const FOLDERS = new Set(["media/admin", "media/channels", "media/artists"]);
const CAPPED = new Set(["media/channels", "media/artists"]);

export type UploadProgress = { loaded: number; total: number; percent: number };
const PART_SIZE = 16 * 1024 * 1024;
const CONCURRENCY = 12;
const MAX_RETRIES = 5;

async function api<T>(action: string, body: unknown): Promise<T> {
  const user = getFbAuth().currentUser;
  if (!user) throw new Error("You must be signed in to upload.");
  const response = await fetch(`/api/public/admin-upload?action=${action}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!response.ok) throw new Error(payload.detail || payload.error || `Upload failed (${response.status})`);
  return payload;
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt >= MAX_RETRIES || /unauthor|invalid|signed in/i.test(String(error))) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** PUT bytes straight to a presigned R2 URL with progress; resolves with the ETag. */
function put(url: string, blob: Blob, onProgress: (loaded: number) => void, contentType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve((xhr.getResponseHeader("ETag") || "").replace(/"/g, ""))
      : reject(new Error(`Storage rejected upload (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error while uploading (check bucket CORS)"));
    xhr.timeout = 180000;
    xhr.ontimeout = () => reject(new Error("Upload connection timed out; retrying part"));
    xhr.onabort = () => reject(new Error("Upload connection interrupted"));
    xhr.send(blob);
  });
}

export async function uploadToR2(folder: string, file: File, onProgress?: (p: UploadProgress) => void): Promise<string> {
  if (!FOLDERS.has(folder)) throw new Error("Invalid upload location");
  if (CAPPED.has(folder) && file.size > MAX_UPLOAD_BYTES) throw new Error("Files must be 300 MB or smaller");
  const progress = new Map<number, number>();
  const report = () => {
    let loaded = 0; progress.forEach((v) => (loaded += v));
    onProgress?.({ loaded, total: file.size, percent: Math.round((100 * loaded) / Math.max(1, file.size)) });
  };

  if (file.size <= PART_SIZE) {
    return retry(async () => {
      const { url, publicUrl } = await api<{ url: string; publicUrl: string }>("single", { filename: file.name, folder, size: file.size });
      await put(url, file, (l) => { progress.set(0, l); report(); });
      progress.set(0, file.size); report();
      return publicUrl;
    });
  }

  const created = await api<{ key: string; uploadId: string; publicUrl: string }>("create", { filename: file.name, folder, size: file.size });
  const { key, uploadId } = created;
  const total = Math.ceil(file.size / PART_SIZE);
  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  try {
    const urls = new Map<number, string>();
    for (let i = 0; i < numbers.length; i += 1000) {
      const { urls: signed } = await api<{ urls: { partNumber: number; url: string }[] }>("sign", { key, uploadId, partNumbers: numbers.slice(i, i + 1000) });
      signed.forEach((s) => urls.set(s.partNumber, s.url));
    }
    const parts: { partNumber: number; etag: string }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < numbers.length) {
        const n = numbers[next++];
        if (n === undefined) return;
        const blob = file.slice((n - 1) * PART_SIZE, Math.min(n * PART_SIZE, file.size));
        const url = urls.get(n);
        if (!url) throw new Error(`Missing upload URL for part ${n}`);
        const etag = await retry(() => {
          progress.set(n, 0); report();
          return put(url, blob, (l) => { progress.set(n, l); report(); });
        });
        if (!etag) throw new Error("Storage did not return ETag (expose ETag in bucket CORS)");
        progress.set(n, blob.size); report();
        parts.push({ partNumber: n, etag });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
    parts.sort((a, b) => a.partNumber - b.partNumber);
    const done = await api<{ publicUrl: string }>("complete", { key, uploadId, parts });
    return done.publicUrl || created.publicUrl;
  } catch (error) {
    void api("abort", { key, uploadId }).catch(() => {});
    throw error;
  }
}
