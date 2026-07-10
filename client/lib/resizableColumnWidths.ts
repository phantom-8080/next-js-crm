const MIN_COLUMN_WIDTH_PX = 72;
const MAX_COLUMN_WIDTH_PX = 640;

export function clampColumnWidthPx(width: number) {
  return Math.min(MAX_COLUMN_WIDTH_PX, Math.max(MIN_COLUMN_WIDTH_PX, Math.round(width)));
}

export function loadColumnWidthOverrides(storageKey: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        out[key] = clampColumnWidthPx(value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveColumnWidthOverrides(
  storageKey: string,
  overrides: Record<string, number>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(overrides));
  } catch {
    // ignore quota / private mode
  }
}
