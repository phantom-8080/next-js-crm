"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_VISIBLE_API_NAMES,
  loadVisibleApiNames,
  saveVisibleApiNames,
} from "@/lib/contractColumns";

const listeners = new Set<() => void>();

const serverSnapshot: string[] = [...DEFAULT_VISIBLE_API_NAMES];

let clientSnapshot: string[] | null = null;

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getServerSnapshot() {
  return serverSnapshot;
}

function getClientSnapshot() {
  if (clientSnapshot === null) {
    clientSnapshot = loadVisibleApiNames();
  }
  return clientSnapshot;
}

function notifyVisibleColumnsChanged(clearCache = true) {
  if (clearCache) clientSnapshot = null;
  listeners.forEach((listener) => listener());
}

export function useContractVisibleColumns() {
  const visibleApiNames = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const setVisibleApiNames = useCallback((apiNames: string[]) => {
    saveVisibleApiNames(apiNames);
    clientSnapshot = [...apiNames];
    notifyVisibleColumnsChanged(false);
  }, []);

  return { visibleApiNames, setVisibleApiNames };
}
