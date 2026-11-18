import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { beginUpload, dismissUpload, getUploadTasks, updateUpload, useUploadDraft } from "@/lib/upload-session";

describe("uploads across navigation", () => {
  it("retains progress after the uploader leaves and attaches the completion", () => {
    const id = beginUpload("admin-a", "movie.mp4", 1024);
    updateUpload(id, { loaded: 512, percent: 50 });
    dismissUpload(id);
    expect(getUploadTasks().find((task) => task.id === id)?.percent).toBe(50);
    updateUpload(id, { loaded: 1024, percent: 100, status: "complete" });
    expect(getUploadTasks().find((task) => task.id === id)?.status).toBe("complete");
    dismissUpload(id);
    expect(getUploadTasks().some((task) => task.id === id)).toBe(false);
  });
  it("keeps edited fields and the completed URL across page remounts", () => {
    const first = renderHook(() => useUploadDraft("test:admin-a:form", { title: "", video: "" }));
    act(() => first.result.current[1]({ title: "My movie", video: "" }));
    const attach = first.result.current[1];
    first.unmount();
    act(() => attach((form) => ({ ...form, video: "https://media.example/movie.mp4" })));
    const second = renderHook(() => useUploadDraft("test:admin-a:form", { title: "", video: "" }));
    expect(second.result.current[0]).toEqual({ title: "My movie", video: "https://media.example/movie.mp4" });
    second.unmount();
    const other = renderHook(() => useUploadDraft("test:admin-b:form", { title: "", video: "" }));
    expect(other.result.current[0].video).toBe("");
  });
});