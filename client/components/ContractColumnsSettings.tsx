"use client";

import { useEffect, useMemo, useState } from "react";
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
              <p className="text-xs text-crm-text-muted">
                {loading ?
                  <ShimmerBar className="mt-0.5 h-3 w-52" />
                : source === "zoho" ?
                  `${catalog.length} fields from Zoho CRM`
                : source === "fallback" ?
                  `${catalog.length} fields (limited list)`
                : "Select CRM fields to show in the table"}
              </p>
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
          : filtered.length === 0 ?
            <p className="px-3 py-8 text-center text-sm text-crm-text-muted">
              {catalog.length === 0 ?
                "No fields available."
              : "No fields match your search."}
            </p>
          : <ul className="space-y-0.5">
              {filtered.map((field) => {
                const checked = isFieldChecked(field.apiName);
                return (
                  <li key={field.apiName}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                        checked && "bg-zinc-100 dark:bg-zinc-800/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(field.apiName)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-crm-border bg-crm-panel accent-blue-500"
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
                );
              })}
            </ul>
          }
        </div>

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
