"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Search, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColumnSettingsFieldsSkeleton, ShimmerBar } from "@/components/LoadingShimmer";
import { cn } from "@/lib/utils";
import {
  filterCatalogForRecordView,
  normalizeContractFieldApiName,
  normalizeVisibleApiNames,
  type CrmFieldMeta,
} from "@/lib/contractColumns";

type FieldOption = CrmFieldMeta & { visible?: boolean };

type ColumnDragState = {
  key: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  x: number;
  y: number;
};

function ColumnDropPlaceholder({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <li
      aria-hidden
      className={cn(
        "min-h-[3.25rem] list-none rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/[0.04]",
        className,
      )}
      style={style}
    />
  );
}

function insertColumnBefore(
  order: string[],
  draggedKey: string,
  beforeKey: string | null,
): string[] {
  const normalized = [...normalizeVisibleApiNames(order)];
  const from = normalized.indexOf(draggedKey);
  if (from === -1) return normalized;
  normalized.splice(from, 1);

  if (beforeKey === null) {
    normalized.push(draggedKey);
    return normalized;
  }

  const to = normalized.indexOf(beforeKey);
  if (to === -1) {
    normalized.push(draggedKey);
    return normalized;
  }
  normalized.splice(to, 0, draggedKey);
  return normalized;
}

function resolveDropBeforeKey(
  clientY: number,
  draggingKey: string,
  selectedKeysInListOrder: string[],
): string | null {
  const candidates = selectedKeysInListOrder.filter((key) => key !== draggingKey);
  for (const key of candidates) {
    const el = document.querySelector(`[data-column-key="${CSS.escape(key)}"]`);
    if (!el || el.getAttribute("data-drag-source") === "true") continue;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    if (clientY < rect.top + rect.height / 2) return key;
  }
  return null;
}

type ContractColumnsSettingsProps = {
  open: boolean;
  onClose: () => void;
  visibleApiNames: string[];
  onApply: (apiNames: string[]) => void;
  onFieldsLoaded?: (fields: CrmFieldMeta[], meta: { source: string; count: number }) => void;
};

export function ContractColumnsSettings({
  open,
  onClose,
  visibleApiNames,
  onApply,
  onFieldsLoaded,
}: ContractColumnsSettingsProps) {
  const [catalog, setCatalog] = useState<FieldOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState<"zoho" | "fallback" | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(visibleApiNames);
  const [dragState, setDragState] = useState<ColumnDragState | null>(null);
  const [dropBeforeKey, setDropBeforeKey] = useState<string | null>(null);
  const dragStateRef = useRef<ColumnDragState | null>(null);
  const dropBeforeKeyRef = useRef<string | null>(null);

  const searchActive = search.trim().length > 0;
  const draggingKey = dragState?.key ?? null;

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      setDraft(normalizeVisibleApiNames(visibleApiNames));
      setSearch("");
    }, 0);
  }, [open, visibleApiNames]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadFields() {
      setLoading(true);
      setWarning(null);
      setSource(null);
      setCatalog([]);
      try {
        const res = await fetch("/api/contracts/fields", { cache: "no-store" });
        const data = (await res.json()) as {
          fields?: FieldOption[];
          warning?: string;
          error?: string;
          source?: "zoho" | "fallback";
          count?: number;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load fields");
        const fields = data.fields ?? [];
        if (!cancelled) {
          setCatalog(fields);
          setWarning(data.warning ?? null);
          setSource(data.source ?? null);
          onFieldsLoaded?.(fields, {
            source: data.source ?? "fallback",
            count: data.count ?? fields.length,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setWarning(err instanceof Error ? err.message : "Failed to load fields");
          setCatalog([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFields();
    return () => {
      cancelled = true;
    };
  }, [open, onFieldsLoaded]);

  const pickerCatalog = useMemo(() => filterCatalogForRecordView(catalog), [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickerCatalog;
    return pickerCatalog.filter(
      (f) =>
        f.apiName.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q) ||
        f.dataType.toLowerCase().includes(q),
    );
  }, [pickerCatalog, search]);

  const orderedForPicker = useMemo(() => {
    const selectedOrder = normalizeVisibleApiNames(draft);
    const rank = new Map(selectedOrder.map((name, index) => [name, index]));

    return [...filtered].sort((a, b) => {
      const aKey = normalizeContractFieldApiName(a.apiName);
      const bKey = normalizeContractFieldApiName(b.apiName);
      const aRank = rank.get(aKey);
      const bRank = rank.get(bKey);
      const aSelected = aRank !== undefined;
      const bSelected = bRank !== undefined;

      if (aSelected && bSelected) return aRank - bRank;
      if (aSelected) return -1;
      if (bSelected) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [draft, filtered]);

  const selectedKeysInListOrder = useMemo(
    () =>
      orderedForPicker
        .filter((field) => {
          const canonical = normalizeContractFieldApiName(field.apiName);
          return draft.some((name) => normalizeContractFieldApiName(name) === canonical);
        })
        .map((field) => normalizeContractFieldApiName(field.apiName)),
    [draft, orderedForPicker],
  );

  const firstUnselectedIndex = useMemo(() => {
    if (searchActive) return -1;
    return orderedForPicker.findIndex((field) => !isFieldChecked(field.apiName));
  }, [orderedForPicker, searchActive, draft]);

  const draggingField = useMemo(() => {
    if (!draggingKey) return null;
    return (
      orderedForPicker.find(
        (field) => normalizeContractFieldApiName(field.apiName) === draggingKey,
      ) ?? null
    );
  }, [draggingKey, orderedForPicker]);

  const updateDropTarget = useCallback(
    (clientY: number, activeDragKey: string) => {
      const next = resolveDropBeforeKey(clientY, activeDragKey, selectedKeysInListOrder);
      dropBeforeKeyRef.current = next;
      setDropBeforeKey(next);
    },
    [selectedKeysInListOrder],
  );

  const finishColumnDrag = useCallback(() => {
    const active = dragStateRef.current;
    if (active) {
      const before = dropBeforeKeyRef.current;
      setDraft((prev) => insertColumnBefore(prev, active.key, before));
    }
    dragStateRef.current = null;
    dropBeforeKeyRef.current = null;
    setDragState(null);
    setDropBeforeKey(null);
  }, []);

  const cancelColumnDrag = useCallback(() => {
    dragStateRef.current = null;
    dropBeforeKeyRef.current = null;
    setDragState(null);
    setDropBeforeKey(null);
  }, []);

  useEffect(() => {
    if (!draggingKey) return;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const onPointerMove = (e: PointerEvent) => {
      const active = dragStateRef.current;
      if (!active) return;
      const next: ColumnDragState = {
        ...active,
        x: e.clientX,
        y: e.clientY,
      };
      dragStateRef.current = next;
      setDragState(next);
      updateDropTarget(e.clientY, active.key);
    };

    const endDrag = () => {
      finishColumnDrag();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelColumnDrag();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [draggingKey, cancelColumnDrag, finishColumnDrag, updateDropTarget]);

  function beginColumnDrag(e: ReactPointerEvent<HTMLLIElement>, canonical: string) {
    if (searchActive) return;
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
    if (e.button !== 0) return;

    const row = e.currentTarget;
    const rect = row.getBoundingClientRect();
    const next: ColumnDragState = {
      key: canonical,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      x: e.clientX,
      y: e.clientY,
    };
    dragStateRef.current = next;
    dropBeforeKeyRef.current = null;
    setDragState(next);
    setDropBeforeKey(null);
    row.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function isFieldChecked(apiName: string) {
    const canonical = normalizeContractFieldApiName(apiName);
    return draft.some((name) => normalizeContractFieldApiName(name) === canonical);
  }

  function toggle(apiName: string) {
    const canonical = normalizeContractFieldApiName(apiName);
    setDraft((prev) => {
      const normalizedPrev = normalizeVisibleApiNames(prev);
      if (normalizedPrev.includes(canonical)) {
        return normalizedPrev.filter((name) => name !== canonical);
      }
      return [...normalizedPrev, canonical];
    });
  }

  function handleApply() {
    const next = normalizeVisibleApiNames(draft);
    if (next.length === 0) return;
    onApply(next);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close column settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-settings-title"
        className="relative flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-crm-border bg-crm-panel-muted shadow-2xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-crm-border px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-blue-500/15 p-2">
              <Settings2 className="h-5 w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 id="column-settings-title" className="section-heading text-lg">
                Manage columns
              </h2>
              <div className="text-xs text-crm-text-muted">
                {loading ?
                  <ShimmerBar className="mt-0.5 h-3 w-52" />
                : source === "zoho" ?
                  `${catalog.length} fields from Zoho CRM · drag selected to reorder`
                : source === "fallback" ?
                  `${catalog.length} fields (limited list) · drag selected to reorder`
                : "Select fields · drag selected rows to reorder"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-crm-text-muted transition hover:bg-zinc-100 hover:text-crm-text dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-crm-border p-3 sm:px-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-crm-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
              placeholder="Search by label or API name…"
              className="h-10 w-full rounded-xl border border-crm-border bg-crm-panel pl-10 pr-3 text-sm text-crm-text outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {warning ?
            <p className="mt-2 text-xs text-amber-400/90">{warning}</p>
          : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
          {loading ?
            <ColumnSettingsFieldsSkeleton />
          : orderedForPicker.length === 0 ?
            <p className="px-3 py-8 text-center text-sm text-crm-text-muted">
              {catalog.length === 0 ? "No fields available." : "No fields match your search."}
            </p>
          : <ul className="space-y-0.5">
              {orderedForPicker.map((field, index) => {
                const checked = isFieldChecked(field.apiName);
                const canonical = normalizeContractFieldApiName(field.apiName);
                const canReorder = checked && !searchActive;
                const isDragging = draggingKey === canonical;
                const showDropSlot =
                  Boolean(draggingKey) &&
                  dropBeforeKey === canonical &&
                  dropBeforeKey !== draggingKey;

                return (
                  <Fragment key={field.apiName}>
                    {showDropSlot ?
                      <ColumnDropPlaceholder
                        className="mb-0.5"
                        style={dragState ? { minHeight: dragState.height } : undefined}
                      />
                    : null}
                    {index === firstUnselectedIndex && firstUnselectedIndex > 0 ?
                      <li
                        aria-hidden
                        role="separator"
                        className="my-2 border-t border-crm-border"
                      />
                    : null}
                    <li
                      data-column-key={canonical}
                      data-reorderable={canReorder ? "" : undefined}
                      data-drag-source={isDragging ? "true" : undefined}
                      onPointerDown={(e) => {
                        if (!canReorder) return;
                        beginColumnDrag(e, canonical);
                      }}
                      onLostPointerCapture={() => {
                        if (dragStateRef.current?.key === canonical) finishColumnDrag();
                      }}
                      className={cn(
                        "relative touch-none rounded-lg",
                        canReorder && !isDragging && "cursor-grab select-none",
                        isDragging && "pointer-events-none m-0 h-0 overflow-hidden opacity-0",
                      )}
                    >
                      <label
                        className={cn(
                          "flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                          checked && "bg-zinc-100 dark:bg-zinc-800/40",
                          canReorder ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(field.apiName)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-crm-border bg-crm-panel accent-blue-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-crm-text">
                            {field.label}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-crm-text-muted">
                            {field.apiName}
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-crm-text-muted">
                            {field.dataType}
                          </span>
                        </span>
                      </label>
                    </li>
                  </Fragment>
                );
              })}
              {draggingKey && dropBeforeKey === null ?
                <ColumnDropPlaceholder
                  className="mt-0.5"
                  style={dragState ? { minHeight: dragState.height } : undefined}
                />
              : null}
            </ul>
          }
        </div>

        {dragState && draggingField ?
          <div
            className="pointer-events-none fixed z-[200] flex items-start gap-3 rounded-lg border border-crm-border bg-crm-panel px-3 py-2.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
            style={{
              left: dragState.x - dragState.offsetX,
              top: dragState.y - dragState.offsetY,
              width: dragState.width,
              minHeight: dragState.height,
            }}
          >
            <input
              type="checkbox"
              checked
              readOnly
              tabIndex={-1}
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-crm-border bg-crm-panel accent-blue-500"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-crm-text">{draggingField.label}</span>
              <span className="mt-0.5 block font-mono text-xs text-crm-text-muted">
                {draggingField.apiName}
              </span>
            </span>
          </div>
        : null}

        <div className="flex shrink-0 flex-col gap-2 border-t border-crm-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5">
          <p className="text-xs text-crm-text-muted sm:mr-auto sm:self-center">
            {draft.length} column{draft.length === 1 ? "" : "s"} selected
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer border-crm-border bg-crm-panel text-crm-text hover:bg-crm-panel-muted"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            disabled={draft.length === 0}
            onClick={handleApply}
          >
            Apply columns
          </Button>
        </div>
      </div>
    </div>
  );
}
