"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LayoutList, Loader2, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractFilterFieldMeta } from "@/lib/contractFilterTypes";

type CustomViewsDropdownProps = {
  zohoModule?: string;
  selectedCustomViewId: string | null;
  onSelect: (customViewId: string | null) => void;
  className?: string;
};

export function CustomViewsDropdown({
  zohoModule = "Contracts",
  selectedCustomViewId,
  onSelect,
  className,
}: CustomViewsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<ContractFilterFieldMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const filtersPath =
          zohoModule === "Contracts" ? "/api/contracts/filters"
          : `/api/${encodeURIComponent(zohoModule.toLowerCase())}/filters`;
        const res = await fetch(filtersPath, { cache: "no-store" });
        const data = (await res.json()) as {
          fields?: ContractFilterFieldMeta[];
          error?: string;
        };
        if (!res.ok && !data.fields?.length) {
          throw new Error(data.error ?? "Failed to load custom views");
        }
        if (cancelled) return;
        const customViews = (data.fields ?? []).filter(
          (f) => f.dataType === "custom_view" && f.customViewId,
        );
        setViews(customViews);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load custom views");
          setViews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [zohoModule]);

  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (!selectedCustomViewId) return "All Contracts";
    return (
      views.find((v) => v.customViewId === selectedCustomViewId)?.label ?? "Custom view"
    );
  }, [selectedCustomViewId, views]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return views;
    return views.filter(
      (v) =>
        v.label.toLowerCase().includes(q) ||
        (v.groupLabel?.toLowerCase().includes(q) ?? false),
    );
  }, [views, query]);

  function selectView(id: string | null) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "crm-custom-view-trigger inline-flex h-10 max-w-full items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
          open || selectedCustomViewId ?
            "border-blue-500/50 bg-blue-500/10 text-crm-text"
          : "border-crm-border bg-crm-panel text-crm-text hover:bg-crm-panel-muted",
        )}
      >
        <LayoutList className="size-4 shrink-0 text-blue-500" aria-hidden />
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-crm-text-muted transition",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ?
        <div
          className="crm-custom-view-menu absolute left-0 top-[calc(100%+0.4rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-crm-border bg-crm-panel shadow-xl"
          role="listbox"
          aria-label="Custom views"
        >
          <div className="border-b border-crm-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-crm-text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search views…"
                className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel-muted py-2 pl-8 pr-8 text-sm text-crm-text outline-none focus:border-blue-500"
              />
              {query ?
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-crm-text-muted hover:text-crm-text"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              : null}
            </div>
          </div>

          <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain p-1.5">
            {loading ?
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-crm-text-muted">
                <Loader2 className="size-4 animate-spin" />
                Loading views…
              </div>
            : error ?
              <p className="px-3 py-6 text-center text-sm text-red-500">{error}</p>
            : <>
                <label
                  className={cn(
                    "crm-custom-view-option flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                    !selectedCustomViewId ?
                      "bg-blue-500/12 ring-1 ring-blue-500/30"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!selectedCustomViewId}
                    onChange={() => selectView(null)}
                    className="size-4 shrink-0 rounded border-crm-border accent-blue-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-crm-text">
                    All Contracts
                  </span>
                  {!selectedCustomViewId ?
                    <Check className="size-3.5 shrink-0 text-blue-500" aria-hidden />
                  : null}
                </label>

                {filtered.length === 0 ?
                  <p className="px-3 py-6 text-center text-sm text-crm-text-muted">
                    No views match your search.
                  </p>
                : filtered.map((view) => {
                    const showGroup = view.groupLabel && view.groupLabel !== lastGroup;
                    if (view.groupLabel) lastGroup = view.groupLabel;
                    const checked = selectedCustomViewId === view.customViewId;
                    return (
                      <div key={view.apiName}>
                        {showGroup ?
                          <p className="crm-custom-view-group px-2">{view.groupLabel}</p>
                        : null}
                        <label
                          className={cn(
                            "crm-custom-view-option flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                            checked ?
                              "bg-blue-500/12 ring-1 ring-blue-500/30"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              selectView(checked ? null : (view.customViewId ?? null))
                            }
                            className="size-4 shrink-0 rounded border-crm-border accent-blue-500"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-crm-text">
                            {view.label}
                          </span>
                          {view.favorite ?
                            <Star
                              className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
                              aria-label="Favorite"
                            />
                          : null}
                          {checked ?
                            <Check className="size-3.5 shrink-0 text-blue-500" aria-hidden />
                          : null}
                        </label>
                      </div>
                    );
                  })
                }
              </>
            }
          </div>
        </div>
      : null}
    </div>
  );
}
