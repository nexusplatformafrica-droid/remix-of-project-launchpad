import { useRef, useSyncExternalStore } from "react";

export type UploadTask = {
  id: string; owner: string; name: string; size: number; loaded: number;
  percent: number; started: number; status: "uploading" | "complete" | "error"; error?: string;
};
let tasks: UploadTask[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emptyTasks: UploadTask[] = [];
export const useUploadTasks = () => useSyncExternalStore(subscribe, () => tasks, () => emptyTasks);
export const getUploadTasks = () => tasks;
export function beginUpload(owner: string, name: string, size: number) {
  const id = crypto.randomUUID();
  tasks = [...tasks, { id, owner, name, size, loaded: 0, percent: 0, started: Date.now(), status: "uploading" }];
  emit();
  return id;
}
export function updateUpload(id: string, patch: Partial<UploadTask>) {
  tasks = tasks.map((task) => task.id === id ? { ...task, ...patch } : task);
  emit();
}
export function dismissUpload(id: string) {
  tasks = tasks.filter((task) => task.id !== id || task.status === "uploading");
  emit();
}

/** In-tab drafts deliberately outlive route components; files are never persisted in browser storage. */
const drafts = new Map<string, unknown>();
export function useUploadDraft<T>(key: string, initial: T): [T, (value: T | ((previous: T) => T)) => void] {
  const fallback = useRef(initial).current;
  const value = useSyncExternalStore(subscribe, () => (drafts.has(key) ? drafts.get(key) : fallback) as T, () => fallback);
  const set = (next: T | ((previous: T) => T)) => {
    const previous = (drafts.has(key) ? drafts.get(key) : initial) as T;
    drafts.set(key, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
    emit();
  };
  return [value, set];
}