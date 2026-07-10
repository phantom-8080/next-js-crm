"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  clampColumnWidthPx,
  loadColumnWidthOverrides,
  saveColumnWidthOverrides,
} from "@/lib/resizableColumnWidths";

export type ResizableColumnRef = { apiName: string; dataType?: string };

function pruneOverridesForColumns(
  overrides: Record<string, number>,
  visibleApiNamesKey: string,
): Record<string, number> {
  const allowed = new Set(visibleApiNamesKey.split("\0").filter(Boolean));
  const next: Record<string, number> = {};
  for (const [apiName, width] of Object.entries(overrides)) {
    if (allowed.has(apiName)) {
      next[apiName] = width;
    }
  }
  return next;
}

export function useResizableColumnWidths(
  storageKey: string,
  columns: ResizableColumnRef[],
  getDefaultWidthPx: (col: ResizableColumnRef) => number,
) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const visibleApiNames = useMemo(
    () => columns.map((c) => c.apiName).join("\0"),
    [columns],
  );

  useEffect(() => {
    const loaded = loadColumnWidthOverrides(storageKey);
    setOverrides(pruneOverridesForColumns(loaded, visibleApiNames));
  }, [storageKey, visibleApiNames]);

  const getWidthPx = useCallback(
    (col: ResizableColumnRef) => {
      const override = overrides[col.apiName];
      if (override != null) return override;
      return getDefaultWidthPx(col);
    },
    [overrides, getDefaultWidthPx],
  );

  const columnSizeStyle = useCallback(
    (col: ResizableColumnRef): CSSProperties => {
      const width = getWidthPx(col);
      return { width, minWidth: width, maxWidth: width };
    },
    [getWidthPx],
  );

  const tableMinWidthPx = useMemo(
    () =>
      Math.max(
        640,
        columns.reduce((sum, col) => sum + getWidthPx(col), 0),
      ),
    [columns, getWidthPx],
  );

  const setColumnWidth = useCallback(
    (apiName: string, widthPx: number, options?: { persist?: boolean }) => {
      const clamped = clampColumnWidthPx(widthPx);
      setOverrides((prev) => {
        const next = { ...prev, [apiName]: clamped };
        if (options?.persist !== false) {
          saveColumnWidthOverrides(storageKey, next);
        }
        return next;
      });
    },
    [storageKey],
  );

  const beginColumnResize = useCallback(
    (apiName: string, clientX: number, col: ResizableColumnRef) => {
      const startX = clientX;
      const startWidth = getWidthPx(col);

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        setColumnWidth(apiName, startWidth + delta, { persist: false });
      };

      const onUp = () => {
        document.body.classList.remove("crm-col-resizing");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        setOverrides((prev) => {
          saveColumnWidthOverrides(storageKey, prev);
          return prev;
        });
      };

      document.body.classList.add("crm-col-resizing");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [getWidthPx, setColumnWidth, storageKey],
  );

  return {
    columnSizeStyle,
    tableMinWidthPx,
    beginColumnResize,
  };
}
