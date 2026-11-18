import { useEffect, useRef, useState } from "react";
import { Download, Maximize, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { kindOf, recordListen, type Track } from "@/lib/music";
import { TrackCover } from "@/components/music/TrackCover";

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Floating bottom player with custom controls; counts one listen per signed-in user per song. */
export function MusicPlayer({ track, userId, onClose }: { track: Track; userId?: string | undefined; onClose: () => void }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const counted = useRef<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const isVideo = kindOf(track) === "video";

  const [src, setSrc] = useState(track.audio_url);
  const retried = useRef(false);

  useEffect(() => {
    counted.current = null;
    retried.current = false;
    setSrc(track.audio_url);
    setTime(0);
    setDuration(0);
    setPlaying(true);
  }, [track.id, track.audio_url]);

  /** UgMuziki: if the usual file name fails, read the real file from the song page once. */
  const onMediaError = () => {
    if (retried.current || track.source !== "ugmuziki" || !track.external_url) return;
    retried.current = true;
    void import("@/lib/ug-music.functions")
      .then(({ resolveUgSong }) => resolveUgSong({ data: { pageUrl: track.external_url! } }))
      .then((url) => url && url !== src && setSrc(url))
      .catch(() => {});
  };

  const count = (kind: "play" | "download") => {
    if (!userId || counted.current === track.id) return;
    counted.current = track.id;
    void recordListen(track, userId, kind).catch(() => {});
  };

  const toggle = () => {
    const m = mediaRef.current;
    if (!m) return;
    if (m.paused) void m.play();
    else m.pause();
  };
  const seek = (v: number) => {
    const m = mediaRef.current;
    if (!m || !Number.isFinite(m.duration)) return;
    m.currentTime = v;
    setTime(v);
  };
  const changeVolume = (v: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.volume = v;
    m.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  };
  const toggleMute = () => {
    const m = mediaRef.current;
    if (!m) return;
    m.muted = !m.muted;
    setMuted(m.muted);
  };
  const fullscreen = () => {
    const el = isVideo ? mediaRef.current : boxRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
  };

  const mediaProps = {
    ref: mediaRef as never,
    src,
    onError: onMediaError,
    autoPlay: true,
    playsInline: true,
    onPlay: () => {
      setPlaying(true);
      count("play");
    },
    onPause: () => setPlaying(false),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => setTime(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => setDuration(e.currentTarget.duration),
    onEnded: () => setPlaying(false),
  };

  const iconBtn = "grid size-10 shrink-0 place-items-center rounded-full bg-muted transition hover:bg-muted/70";

  return (
    <div ref={boxRef} className="fixed inset-x-2 bottom-16 z-50 rounded-2xl bg-card p-3 shadow-2xl ring-1 ring-border lg:bottom-4 lg:left-[calc(var(--sidebar-w)+1rem)] lg:right-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
        <TrackCover track={track} className="size-12 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">{track.stage_name}</p>
        </div>
        <a href={track.download_url ?? track.audio_url} download onClick={() => count("download")} className={iconBtn} aria-label="Download"><Download className="size-4" /></a>
        <button onClick={onClose} className={iconBtn} aria-label="Close player"><X className="size-4" /></button>
      </div>

      {isVideo && (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-background">
          <video key={`${track.id}-${src}`} {...mediaProps} onClick={toggle} className="max-h-[45vh] w-full" />
        </div>
      )}

      {/* Custom control bar (shared by audio and video) */}
      <div className="mt-3 flex items-center gap-2 sm:gap-3">
        <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
        </button>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className={`${iconBtn} hidden sm:grid`}>
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          aria-label="Volume"
          className="hidden h-1.5 w-20 cursor-pointer accent-primary sm:block"
        />
        {isVideo && (
          <button onClick={fullscreen} aria-label="Fullscreen" className={iconBtn}><Maximize className="size-4" /></button>
        )}
      </div>

      {!isVideo && <audio key={`${track.id}-${src}`} {...mediaProps} className="hidden" />}
    </div>
  );
}
