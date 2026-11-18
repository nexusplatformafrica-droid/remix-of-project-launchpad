import { useEffect, useState } from "react";
import { Download, Play, X } from "lucide-react";
import keyArt from "@/assets/moviemax-tv-key-art.jpg";
import movieMaxLogo from "@/assets/moviemax-logo.png";
import tvApk from "@/assets/MovieMax-TV.apk.asset.json";
import { WHATSAPP_PROMPT_CLOSED_EVENT } from "@/components/youku/WhatsAppPrompt";
import { TOUR_STATE_EVENT } from "@/components/luo/DownloadTour";

export const MOVIEMAX_TV_URL = "https://livetv.luofilm.site/";
export const MOVIEMAX_TV_APK = tvApk.url;
const FIRST_SHOW_MS = 2500;
const SHOW_DELAY_MS = 1000;
const AUTO_EXIT_MS = 9000;

/** Floating MOVIE MAX TV introduction, shown on every visit, after the tour and WhatsApp prompt. */
export function MovieMaxTvPrompt() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let tourActive = false;
    let shown = false;
    const show = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (shown || tourActive || document.querySelector(".wa-prompt")) return;
        shown = true;
        setOpen(true);
      }, delay);
    };
    const onWhatsAppClosed = () => show(SHOW_DELAY_MS);
    const onTour = (event: Event) => {
      tourActive = (event as CustomEvent<{ active?: boolean }>).detail?.active === true;
      if (!tourActive) show(SHOW_DELAY_MS);
    };
    window.addEventListener(WHATSAPP_PROMPT_CLOSED_EVENT, onWhatsAppClosed);
    window.addEventListener(TOUR_STATE_EVENT, onTour);
    // Shows on every visit; waits while the tour or the WhatsApp prompt is on screen.
    show(FIRST_SHOW_MS);
    return () => {
      window.removeEventListener(WHATSAPP_PROMPT_CLOSED_EVENT, onWhatsAppClosed);
      window.removeEventListener(TOUR_STATE_EVENT, onTour);
      window.clearTimeout(timer);
    };
  }, []);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 400);
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(close, AUTO_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[66] grid place-items-center px-3 transition-opacity duration-300 sm:px-6 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <aside
        role="dialog"
        aria-label="MOVIE MAX TV — watch free"
        className={`pointer-events-auto relative w-full max-w-[400px] overflow-hidden rounded-xl bg-tvpromo text-tvpromo-foreground shadow-2xl transition-all duration-400 md:max-w-4xl ${
          leaving ? "scale-95 opacity-0" : "animate-enter"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close MOVIE MAX TV banner"
          className="absolute top-2.5 right-2.5 z-30 grid size-9 place-items-center rounded-full bg-tvpromo-accent-foreground/70 text-tvpromo-foreground transition hover:bg-tvpromo-accent-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="relative md:aspect-[16/9]">
          {/* Artwork: full width on desktop, top strip on phones */}
          <img
            src={keyArt}
            alt="Actors, footballers and Luo film stars on MOVIE MAX TV"
            width={1920}
            height={1088}
            decoding="async"
            className="block aspect-[16/10] w-full object-cover object-[78%_center] md:absolute md:inset-0 md:aspect-auto md:size-full md:object-right"
          />

          {/* Curved brand panel */}
          <div
            aria-hidden
            className="absolute top-1/2 right-[48%] hidden aspect-square h-[160%] -translate-y-1/2 rounded-full bg-tvpromo md:block"
          />
          <div
            aria-hidden
            className="relative -mt-10 h-10 rounded-t-[50%] bg-tvpromo md:hidden"
          />

          <div className="relative z-10 flex flex-col px-5 pb-6 md:absolute md:inset-y-0 md:left-0 md:w-[46%] md:justify-center md:px-9 md:pb-0">
            <div className="flex w-fit items-stretch overflow-hidden rounded-full shadow-lg">
              <span className="flex items-center gap-1.5 bg-tvpromo-accent-foreground py-1.5 pr-3 pl-2 md:py-2 md:pl-2.5">
                <img src={movieMaxLogo} alt="" width={28} height={28} className="size-6 object-contain md:size-7" />
                <span className="text-sm font-black tracking-tight md:text-base">MOVIE MAX</span>
              </span>
              <span className="flex items-center bg-tvpromo-accent px-3 text-sm font-black text-tvpromo-accent-foreground md:px-4 md:text-base">
                TV
              </span>
            </div>

            <h2 className="mt-4 text-[34px] leading-[0.95] font-black tracking-tight md:mt-5 md:text-[52px]">
              Watch it all.
              <span className="block font-extrabold">It's free.</span>
            </h2>

            <p className="mt-3 max-w-xs text-sm leading-snug font-semibold md:text-base">
              Top footballers, favourite actors and Luo movies — live on MOVIE MAX TV.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={MOVIEMAX_TV_URL}
                target="_blank"
                rel="noopener"
                onClick={close}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-tvpromo-accent px-5 text-sm font-black text-tvpromo-accent-foreground uppercase shadow-md transition hover:brightness-105"
              >
                <Play className="size-4 fill-current" /> Watch now
              </a>
              <a
                href={MOVIEMAX_TV_APK}
                download="MovieMax-TV.apk"
                onClick={close}
                className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-tvpromo-foreground px-4 text-sm font-black uppercase transition hover:bg-tvpromo-foreground hover:text-tvpromo"
              >
                <Download className="size-4" /> Download app
              </a>
            </div>

            <p className="mt-4 text-[11px] leading-tight opacity-85 md:mt-6 md:text-xs">
              Free to watch. Android app download. No subscription needed.
            </p>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-tvpromo-foreground/15">
            <div className="tv-promo-timer h-full bg-tvpromo-accent" />
          </div>
        </div>
      </aside>
    </div>
  );
}
