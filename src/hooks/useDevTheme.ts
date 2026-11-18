import { useCallback, useEffect, useState } from "react";

export type DevTheme = "dark" | "light";
const KEY = "moviemax-dev-theme";

/**
 * Light/dark theme for the developer area (/doc, /developer).
 * Applied on <html> so dialogs and drawers (portals) follow it too;
 * removed again when the visitor leaves the developer area.
 */
export function useDevTheme() {
  const [theme, setTheme] = useState<DevTheme>("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("theme-light", theme === "light");
    el.classList.toggle("theme-dark", theme === "dark");
    return () => el.classList.remove("theme-light", "theme-dark");
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}
