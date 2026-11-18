/**
 * Live TV player: one <video> that plays HLS (.m3u8), MPEG-TS/FLV (.ts),
 * DASH (.mpd) and plain files. Engines load only in the browser and the
 * player falls through to the next engine when one cannot play the link.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { clearKeyProtection, engineOrder, mpegtsType, splitClearKey, type StreamEngine } from "@/lib/stream-kind";

type Stop = () => void;

async function attach(engine: StreamEngine, video: HTMLVideoElement, link: string, fail: () => void): Promise<Stop> {
  const { url, keys } = splitClearKey(link);
  if (engine === "hls") {
    const Hls = (await import("hls.js")).default;
    // hls.js wherever the browser allows it; built-in HLS (iPhone Safari) otherwise.
    if (!Hls.isSupported()) {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) throw new Error("unsupported");
      video.src = url;
      return () => video.removeAttribute("src");
    }
    const hls = new Hls({ lowLatencyMode: true });
    hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && fail());
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }
  if (engine === "mpegts") {
    const mpegts = (await import("mpegts.js")).default;
    if (!mpegts.isSupported()) throw new Error("unsupported");
    const player = mpegts.createPlayer(
      { type: mpegtsType(url), isLive: true, url },
      { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false },
    );
    player.on(mpegts.Events.ERROR, fail);
    player.attachMediaElement(video);
    player.load();
    return () => {
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    };
  }
  if (engine === "dash") {
    const { MediaPlayer } = await import("dashjs");
    const player = MediaPlayer().create();
    // dash.js reports many recoverable errors; only give up after repeated ones.
    let errors = 0;
    player.on("error" as any, () => { if (++errors >= 4) fail(); });
    player.on("playbackError" as any, fail);
    player.updateSettings({
      streaming: {
        retryAttempts: { MPD: 8, MediaSegment: 6, InitializationSegment: 6 },
        buffer: { fastSwitchEnabled: true },
        delay: { liveDelayFragmentCount: 4 },
        utcSynchronization: { enabled: true, useManifestDateHeaderTimeSource: true },
        gaps: { jumpGaps: true, jumpLargeGaps: true },
      },
    } as any);
    if (Object.keys(keys).length) player.setProtectionData(clearKeyProtection(keys) as any);
    player.initialize(video, url, true);
    return () => player.reset();
  }
  video.src = url;
  return () => video.removeAttribute("src");
}

export function LivePlayer({ src, title, className }: { src: string; title?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    const engines = engineOrder(splitClearKey(src).url);
    let index = -1;
    let stop: Stop | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    setState("loading");

    const next = async (from = index) => {
      if (disposed || from !== index) return;
      clearTimeout(timer);
      try { stop?.(); } catch { /* ignore */ }
      stop = undefined;
      video.load();
      index += 1;
      const engine = engines[index];
      if (!engine) return setState("failed");
      // An engine that shows nothing within 15 s hands over to the next one.
      const mine = index;
      timer = setTimeout(() => void next(mine), engine === "dash" ? 30000 : 15000);
      try {
        stop = await attach(engine, video, src, () => void next(mine));
        if (disposed) stop();
        else void video.play().catch(() => {});
      } catch {
        void next(mine);
      }
    };

    const onPlaying = () => { clearTimeout(timer); setState("playing"); };
    // Only a real src (native file or Safari HLS) reports through the element; engines report themselves.
    const onNativeError = () => { if (video.currentSrc && !video.currentSrc.startsWith("blob:")) void next(index); };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onPlaying);
    video.addEventListener("error", onNativeError);
    void next();

    return () => {
      disposed = true;
      clearTimeout(timer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onPlaying);
      video.removeEventListener("error", onNativeError);
      try { stop?.(); } catch { /* ignore */ }
    };
  }, [src, attempt]);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-card ${className ?? ""}`}>
      <video ref={ref} controls autoPlay playsInline aria-label={title ? `Live: ${title}` : "Live TV"} className="size-full bg-card" />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {state === "failed" && (
        <div className="absolute inset-0 grid place-items-center bg-background/90 px-6 text-center">
          <div className="max-w-sm">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <p className="mt-3 text-sm font-semibold">This channel can't be played right now</p>
            <p className="mt-1 text-xs text-muted-foreground">The stream may be offline or blocked by its owner.</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <RotateCw className="size-4" /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
