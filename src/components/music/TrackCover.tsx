import { useState } from "react";
import { DEFAULT_TRACK_COVER, trackCover, type Track } from "@/lib/music";

/**
 * Track artwork. When a track has no cover (or it fails to load), the site
 * logo shows small and centered (contained) instead of zoomed to fill the frame.
 */
export function TrackCover({
  track,
  alt = "",
  className = "",
  eager = false,
}: {
  track: Pick<Track, "cover_url">;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const fallback = !track.cover_url || broken;
  return (
    <img
      src={fallback ? DEFAULT_TRACK_COVER : trackCover(track)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setBroken(true)}
      className={`${className} ${fallback ? "object-contain p-[14%]" : "object-cover"}`}
    />
  );
}
