"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "crm-pinned-columns-contracts-v1";

function loadPinnedApiNames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  } catch {
    return [];
  }
}

function savePinnedApiNames(apiNames: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(apiNames));
}

export function usePinnedColumns() {
  const [pinnedApiNames, setPinnedApiNamesState] = useState<string[]>([]);

  useEffect(() => {
    setPinnedApiNamesState(loadPinnedApiNames());
  }, []);

  const setPinnedApiNames = useCallback((apiNames: string[]) => {
    const unique = [...new Set(apiNames.filter(Boolean))];
    setPinnedApiNamesState(unique);
    savePinnedApiNames(unique);
  }, []);

  const togglePinned = useCallback((apiName: string) => {
    setPinnedApiNamesState((prev) => {
      const next =
        prev.includes(apiName) ? prev.filter((name) => name !== apiName) : [...prev, apiName];
      savePinnedApiNames(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (apiName: string) => pinnedApiNames.includes(apiName),
    [pinnedApiNames],
  );

  return { pinnedApiNames, setPinnedApiNames, togglePinned, isPinned };
}
