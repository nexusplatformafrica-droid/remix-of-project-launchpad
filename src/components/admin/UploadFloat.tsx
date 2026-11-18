import { useNavigate } from "@tanstack/react-router";
import { UploadCloud, CheckCircle2, AlertCircle, X, Pencil, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { dismissUpload, useUploadTasks } from "@/lib/upload-session";
import { formatBytes } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export function UploadFloat() {
  const { user } = useAuth();
  const tasks = useUploadTasks().filter((task) => task.owner === user?.id);
  const navigate = useNavigate();
  if (!tasks.length) return null;
  return (
    <aside aria-label="Upload progress" className="fixed bottom-24 right-3 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg lg:bottom-5 lg:right-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><UploadCloud className="size-4 text-primary" />Uploads</h2>
      <div className="max-h-52 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <div key={task.id}>
            <div className="flex items-center gap-2">
              {task.status === "complete" ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : task.status === "error" ? <AlertCircle className="size-4 shrink-0 text-destructive" /> : null}
              <p className="min-w-0 flex-1 truncate text-xs font-medium" title={task.name}>{task.name}</p>
              {task.status !== "uploading" && <Button variant="ghost" size="icon" className="size-6" aria-label={`Dismiss ${task.name}`} onClick={() => dismissUpload(task.id)}><X /></Button>}
            </div>
            <progress aria-label={`${task.name} progress`} className="mt-2 h-2 w-full accent-primary" value={task.percent} max={100} />
            <p className="mt-1 text-xs text-muted-foreground">{task.status === "error" ? task.error : task.status === "complete" ? "Upload complete" : `${task.percent}% · ${formatBytes(task.loaded)} / ${formatBytes(task.size)}`}</p>
          </div>
        ))}
      </div>
      <Button size="sm" className="mt-3 w-full" onClick={async () => {
        await navigate({ to: "/admin", search: { upload: true } });
        window.dispatchEvent(new Event("open-upload-editor"));
      }}>
        {tasks.every((task) => task.status === "complete") ? <><Pencil />Edit & publish</> : <><Eye />View upload</>}
      </Button>
    </aside>
  );
}