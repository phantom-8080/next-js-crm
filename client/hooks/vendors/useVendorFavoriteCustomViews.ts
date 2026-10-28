"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getFavoriteViewsServerSnapshot,
  getFavoriteViewsSnapshot,
  subscribeFavoriteViews,
  writeFavoriteViews,
} from "@/lib/vendors/filterPersistence";

export function useVendorFavoriteCustomViews() {
  const favoriteIds = useSyncExternalStore(
    subscribeFavoriteViews,
    getFavoriteViewsSnapshot,
    getFavoriteViewsServerSnapshot,
  );
  const seededFromZohoRef = useRef(false);

  const isFavorite = useCallback(
    (customViewId: string | null | undefined) => {
      if (!customViewId) return false;
      return favoriteIds.includes(customViewId);
    },
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    (customViewId: string) => {
      const id = customViewId.trim();
      if (!id) return;
      const next =
        favoriteIds.includes(id) ?
          favoriteIds.filter((item) => item !== id)
        : [...favoriteIds, id];
      writeFavoriteViews(next);
    },
    [favoriteIds],
  );

  const mergeZohoFavorites = useCallback((zohoFavoriteIds: string[]) => {
    if (seededFromZohoRef.current) return;
    seededFromZohoRef.current = true;
    const existing = getFavoriteViewsSnapshot();
    if (existing.length > 0) return;
    const incoming = [
      ...new Set(zohoFavoriteIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (incoming.length === 0) return;
    writeFavoriteViews(incoming);
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite, mergeZohoFavorites };
}
