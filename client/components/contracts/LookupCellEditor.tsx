"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getKnownLookupFieldConfig, isUserLikeDataType } from "@/lib/contracts/filterMeta";
import { cn } from "@/lib/utils";

export type LookupSuggestion = {
  value: string;
  label: string;
};

type LookupCellEditorProps = {
  apiName: string;
  label: string;
  dataType: string;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onSelectSuggestion: (option: LookupSuggestion) => void;
  onCommit: () => void;
  onCancel: () => void;
  module?: string;
  lookupModule?: string;
};

async function fetchLookupSuggestions(params: {
  module: string;
  field: string;
  dataType: string;
  lookupModule?: string;
  query: string;
  signal: AbortSignal;
}): Promise<LookupSuggestion[]> {
  const search = new URLSearchParams({
    module: params.module,
    field: params.field,
    dataType: params.dataType,
    q: params.query,
  });
  if (params.lookupModule) search.set("lookupModule", params.lookupModule);

  const response = await fetch(`/api/field-suggestions?${search.toString()}`, {
    signal: params.signal,
  });
  const data = (await response.json().catch(() => ({}))) as {
    suggestions?: LookupSuggestion[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "Failed to load suggestions.");
  }
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

function resolveLookupModule(apiName: string, explicit?: string) {
  const fromProp = String(explicit ?? "").trim();
  if (fromProp) return fromProp;
  return getKnownLookupFieldConfig(apiName)?.module?.trim() || "";
}

export function LookupCellEditor({
  apiName,
  label,
  dataType,
  draftValue,
  onDraftChange,
  onSelectSuggestion,
  onCommit,
  onCancel,
  module = "Contracts",
  lookupModule,
}: LookupCellEditorProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<LookupSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [highlight, setHighlight] = useState(0);
  const selectingRef = useRef(false);

  const isUser = isUserLikeDataType(dataType);
  const relatedModule = resolveLookupModule(apiName, lookupModule);
  const query = draftValue.trim();

  useEffect(() => {
    const controller = new AbortController();
    const delay = isUser ? 0 : 250;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          // Await first so setState is not synchronous inside the effect body.
          const next = await fetchLookupSuggestions({
            module,
            field: apiName,
            dataType,
            lookupModule: relatedModule || undefined,
            query,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          setLoading(false);
          setOptions(next);
          setHighlight(0);
          setOpen(true);
          setError(null);
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          setLoading(false);
          setOptions([]);
          setError(err instanceof Error ? err.message : "Failed to load suggestions.");
        }
      })();
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiName, dataType, isUser, module, query, relatedModule]);

  function pick(option: LookupSuggestion) {
    selectingRef.current = true;
    onSelectSuggestion(option);
    setOpen(false);
    // Commit after selection so ID is already stored in the hook.
    window.setTimeout(() => {
      selectingRef.current = false;
      onCommit();
    }, 0);
  }

  return (
    <div ref={rootRef} className="relative z-30 w-full min-w-0">
      <input
        autoFocus
        role="combobox"
        value={draftValue}
        aria-label={`Edit ${label}`}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-8 w-full min-w-0 rounded border border-blue-500 bg-crm-panel px-1.5 text-sm text-crm-text outline-none"
        placeholder={isUser ? "Search users…" : "Type to search…"}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          onDraftChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Allow suggestion mousedown to run first.
          window.setTimeout(() => {
            if (selectingRef.current) return;
            if (rootRef.current?.contains(document.activeElement)) return;
            onCommit();
          }, 120);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && options[highlight]) {
              pick(options[highlight]);
            } else {
              onCommit();
            }
          }
        }}
      />
      {open ?
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+2px)] max-h-48 overflow-auto rounded-md border border-crm-border bg-crm-panel shadow-lg"
        >
          {loading ?
            <div className="px-2 py-1.5 text-xs text-crm-text-muted">Searching…</div>
          : null}
          {error ?
            <div className="px-2 py-1.5 text-xs text-red-400">{error}</div>
          : null}
          {!loading && !error && options.length === 0 ?
            <div className="px-2 py-1.5 text-xs text-crm-text-muted">
              {query ? "No matches" : "Start typing to search"}
            </div>
          : null}
          {options.map((option, index) => (
            <button
              key={`${option.value}-${option.label}`}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={cn(
                "flex w-full flex-col items-start px-2 py-1.5 text-left text-sm text-crm-text hover:bg-blue-500/10",
                index === highlight && "bg-blue-500/15",
              )}
              onMouseDown={(e) => {
                // Prevent input blur from committing before click.
                e.preventDefault();
              }}
              onMouseEnter={() => setHighlight(index)}
              onClick={(e) => {
                e.stopPropagation();
                pick(option);
              }}
            >
              <span className="truncate">{option.label}</span>
              <span className="truncate text-[10px] text-crm-text-muted">{option.value}</span>
            </button>
          ))}
        </div>
      : null}
    </div>
  );
}
