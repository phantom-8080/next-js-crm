"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "crm-theme-v1";
export const THEME_COOKIE_NAME = "crm-theme-v1";

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

function readThemeFromQuery(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    return isThemeMode(q) ? q : null;
  } catch {
    return null;
  }
}

function readThemeFromCookie(): ThemeMode | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]*)`),
    );
    const value = match ? decodeURIComponent(match[1]) : null;
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

function readThemeFromStorage(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Query (new-tab handoff) > localStorage > cookie > light */
export function resolveTheme(): ThemeMode {
  return (
    readThemeFromQuery() ??
    readThemeFromStorage() ??
    readThemeFromCookie() ??
    "light"
  );
}

export function applyThemeToDocument(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function persistTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // iframe / private mode may block storage
  }
  try {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {
    // ignore cookie failures
  }
}

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = resolveTheme();
    setThemeState(initial);
    applyThemeToDocument(initial);
    persistTheme(initial);

    // Drop ?theme= after applying so refreshes use storage / cookie.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("theme")) {
        url.searchParams.delete("theme");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch {
      // ignore
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = isThemeMode(event.newValue) ? event.newValue : "light";
      setThemeState(next);
      applyThemeToDocument(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    persistTheme(next);
    applyThemeToDocument(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      persistTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
