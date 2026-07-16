"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractFilterFieldMeta } from "@/lib/contractFilterTypes";
import { getOperatorsForDataType } from "@/lib/zohoFilterOperators";

type CustomViewsDropdownProps = {
  zohoModule?: string;
  selectedCustomViewId: string | null;
  onSelect: (customViewId: string | null) => void;
  className?: string;
  /** Increment to reload views after creating one elsewhere (e.g. sidebar save). */
  refreshKey?: number;
};

type CreateCondition = {
  apiName: string;
  operator: string;
  value: string;
};

export function CustomViewsDropdown({
  zohoModule = "Contracts",
  selectedCustomViewId,
  onSelect,
  className,
  refreshKey = 0,
}: CustomViewsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<ContractFilterFieldMeta[]>([]);
  const [filterFields, setFilterFields] = useState<ContractFilterFieldMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [createName, setCreateName] = useState("");
  const [accessType, setAccessType] = useState<"only_to_me" | "public">("only_to_me");
  const [condition, setCondition] = useState<CreateCondition>({
    apiName: "Contract_Status",
    operator: "equals",
    value: "Active",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  async function loadViews() {
    setLoading(true);
    setError(null);
    try {
      // Live Zoho list — not the cached /api/contracts/filters payload.
      const viewsPath =
        zohoModule === "Contracts" ? "/api/contracts/custom-views"
        : `/api/${encodeURIComponent(zohoModule.toLowerCase())}/custom-views`;
      const viewsRes = await fetch(viewsPath, { cache: "no-store" });
      const viewsData = (await viewsRes.json()) as {
        views?: ContractFilterFieldMeta[];
        error?: string;
      };
      if (!viewsRes.ok && !viewsData.views?.length) {
        throw new Error(viewsData.error ?? "Failed to load custom views");
      }
      setViews(
        (viewsData.views ?? []).filter((f) => f.dataType === "custom_view" && f.customViewId),
      );

      // Field options for "Create custom view" form (separate from view list cache).
      const filtersPath =
        zohoModule === "Contracts" ? "/api/contracts/filters"
        : `/api/${encodeURIComponent(zohoModule.toLowerCase())}/filters`;
      const filtersRes = await fetch(filtersPath, { cache: "no-store" });
      const filtersData = (await filtersRes.json()) as {
        fields?: ContractFilterFieldMeta[];
      };
      if (filtersRes.ok) {
        setFilterFields(
          (filtersData.fields ?? []).filter(
            (f) =>
              f.dataType !== "custom_view" &&
              f.section !== "system_defined" &&
              !["subform", "fileupload", "image"].includes(f.dataType),
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load custom views");
      setViews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadViews();
  }, [zohoModule, refreshKey]);

  // Refresh from Zoho every time the dropdown opens so new CRM views appear immediately.
  useEffect(() => {
    if (open && mode === "list") {
      void loadViews();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setMode("list");
        setCreateError(null);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setMode("list");
        setCreateError(null);
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
    if (open && mode === "list") {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, mode]);

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

  const selectedField = useMemo(
    () => filterFields.find((f) => f.apiName === condition.apiName),
    [filterFields, condition.apiName],
  );

  const operators = useMemo(() => {
    if (!selectedField) return [{ id: "equals", label: "is" }];
    return getOperatorsForDataType(selectedField.dataType);
  }, [selectedField]);

  function selectView(id: string | null) {
    onSelect(id);
    setOpen(false);
    setQuery("");
    setMode("list");
    setListError(null);
  }

  function canDeleteView(view: ContractFilterFieldMeta) {
    if (!view.customViewId || view.systemDefined) return false;
    // Only user-created views (Created By Me). Public shared system views stay protected.
    return /created by me/i.test(view.groupLabel ?? "");
  }

  async function deleteView(view: ContractFilterFieldMeta) {
    const id = view.customViewId;
    if (!id || !canDeleteView(view) || deletingId) return;
    const ok = window.confirm(`Delete custom view “${view.label}” from Zoho CRM?`);
    if (!ok) return;

    setDeletingId(id);
    setListError(null);
    try {
      const res = await fetch(`/api/contracts/custom-views?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete custom view");
      }
      if (selectedCustomViewId === id) {
        onSelect(null);
      }
      await loadViews();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to delete custom view");
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() {
    setMode("create");
    setCreateError(null);
    setCreateName("");
    setAccessType("only_to_me");
    const statusField = filterFields.find((f) => f.apiName === "Contract_Status");
    setCondition({
      apiName: statusField?.apiName ?? filterFields[0]?.apiName ?? "Contract_Status",
      operator: "equals",
      value:
        statusField?.options?.find((o) => /active/i.test(o.value) || /active/i.test(o.label))
          ?.value ??
        statusField?.options?.[0]?.value ??
        "Active",
    });
  }

  async function createView() {
    const name = createName.trim();
    if (!name) {
      setCreateError("Enter a view name");
      return;
    }
    if (!condition.apiName || !condition.value.trim()) {
      setCreateError("Add a filter condition");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/contracts/custom-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          accessType,
          conditions: [
            {
              apiName: condition.apiName,
              operator: condition.operator || "equals",
              values: [condition.value.trim()],
            },
          ],
        }),
      });
      const data = (await res.json()) as {
        id?: string;
        customViewId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create custom view");
      }
      const newId = data.customViewId ?? data.id ?? null;
      await loadViews();
      if (newId) {
        onSelect(newId);
      }
      setOpen(false);
      setMode("list");
      setQuery("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create custom view");
    } finally {
      setCreating(false);
    }
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
          className="crm-custom-view-menu absolute left-0 top-[calc(100%+0.4rem)] z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-crm-border bg-crm-panel shadow-xl"
          role="listbox"
          aria-label="Custom views"
        >
          {mode === "list" ?
            <>
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

              <div className="max-h-[min(20rem,45vh)] overflow-y-auto overscroll-contain p-1.5">
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

                    {listError ?
                      <p className="mb-2 rounded-lg border border-red-300/50 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                        {listError}
                      </p>
                    : null}

                    {filtered.length === 0 ?
                      <p className="px-3 py-6 text-center text-sm text-crm-text-muted">
                        No views match your search.
                      </p>
                    : filtered.map((view) => {
                        const showGroup = view.groupLabel && view.groupLabel !== lastGroup;
                        if (view.groupLabel) lastGroup = view.groupLabel;
                        const checked = selectedCustomViewId === view.customViewId;
                        const deletable = canDeleteView(view);
                        const isDeleting = deletingId === view.customViewId;
                        return (
                          <div key={view.apiName}>
                            {showGroup ?
                              <p className="crm-custom-view-group px-2">{view.groupLabel}</p>
                            : null}
                            <div
                              className={cn(
                                "crm-custom-view-option group flex items-center gap-1 rounded-lg px-1 py-0.5 transition",
                                checked ?
                                  "bg-blue-500/12 ring-1 ring-blue-500/30"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                              )}
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-1.5 py-1.5">
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
                              {deletable ?
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteView(view);
                                  }}
                                  disabled={Boolean(deletingId)}
                                  className="mr-1 cursor-pointer rounded-md p-1.5 text-crm-text-muted opacity-70 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Delete ${view.label}`}
                                  title="Delete from Zoho CRM"
                                >
                                  {isDeleting ?
                                    <Loader2 className="size-3.5 animate-spin" />
                                  : <Trash2 className="size-3.5" />}
                                </button>
                              : null}
                            </div>
                          </div>
                        );
                      })
                    }
                  </>
                }
              </div>

              <div className="border-t border-crm-border p-2">
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-500/40 bg-blue-500/5 text-sm font-medium text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-300"
                >
                  <Plus className="size-4" aria-hidden />
                  Create custom view
                </button>
              </div>
            </>
          : <div className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-crm-text">New custom view</h3>
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setCreateError(null);
                  }}
                  className="rounded-lg p-1.5 text-crm-text-muted transition hover:bg-zinc-100 hover:text-crm-text dark:hover:bg-zinc-800"
                  aria-label="Back to views"
                >
                  <X className="size-4" />
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs text-crm-text-muted">Name</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Active vendor contracts"
                  className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel-muted px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-crm-text-muted">Share with</span>
                <select
                  value={accessType}
                  onChange={(e) =>
                    setAccessType(e.target.value === "public" ? "public" : "only_to_me")
                  }
                  className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel-muted px-2 text-sm text-crm-text outline-none focus:border-blue-500"
                >
                  <option value="only_to_me">Only me</option>
                  <option value="public">Everyone (public)</option>
                </select>
              </label>

              <div className="rounded-lg border border-crm-border bg-crm-panel-muted/60 p-2.5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-crm-text-muted">
                  Condition
                </p>
                <div className="space-y-2">
                  <select
                    value={condition.apiName}
                    onChange={(e) => {
                      const next = filterFields.find((f) => f.apiName === e.target.value);
                      const ops = getOperatorsForDataType(next?.dataType ?? "text");
                      setCondition({
                        apiName: e.target.value,
                        operator: ops[0]?.id ?? "equals",
                        value: next?.options?.[0]?.value ?? "",
                      });
                    }}
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-2 text-sm text-crm-text outline-none focus:border-blue-500"
                  >
                    {filterFields.map((f) => (
                      <option key={f.apiName} value={f.apiName}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      setCondition((prev) => ({ ...prev, operator: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-2 text-sm text-crm-text outline-none focus:border-blue-500"
                  >
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {selectedField?.options?.length ?
                    <select
                      value={condition.value}
                      onChange={(e) =>
                        setCondition((prev) => ({ ...prev, value: e.target.value }))
                      }
                      className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-2 text-sm text-crm-text outline-none focus:border-blue-500"
                    >
                      {selectedField.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  : <input
                      type="text"
                      value={condition.value}
                      onChange={(e) =>
                        setCondition((prev) => ({ ...prev, value: e.target.value }))
                      }
                      placeholder="Value"
                      className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                    />
                  }
                </div>
              </div>

              {createError ?
                <p className="rounded-lg border border-red-300/50 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {createError}
                </p>
              : null}

              <button
                type="button"
                onClick={() => void createView()}
                disabled={creating}
                className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ?
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Creating in Zoho…
                  </>
                : "Create in Zoho CRM"}
              </button>
              <p className="text-[11px] leading-snug text-crm-text-muted">
                Saves to Zoho CRM and appears in this dropdown under Created By Me.
              </p>
            </div>
          }
        </div>
      : null}
    </div>
  );
}
