"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSidebarFieldsSkeleton } from "@/components/LoadingShimmer";
import {
  buildCriteriaFromFieldFilters,
  selectionsFromCheckboxState,
} from "@/lib/buildContractFilterCriteria";
import type {
  ContractFieldFilterSelection,
  ContractFilterApplyPayload,
  ContractFilterFieldMeta,
  ContractFilterSection,
} from "@/lib/contractFilterTypes";

function SystemViewFilterRow({
  field,
  checked,
  onToggle,
}: {
  field: ContractFilterFieldMeta;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-crm-border bg-crm-panel accent-blue-500"
      />
      <span className="min-w-0 text-sm text-crm-text">{field.label}</span>
    </label>
  );
}

function FilterSectionGroup({
  section,
  filterSearch,
  fieldSelections,
  manualDrafts,
  selectedCustomViewId,
  onToggleFieldValue,
  onManualChange,
  getManualDraft,
  onToggleCustomView,
}: {
  section: ContractFilterSection;
  filterSearch: string;
  fieldSelections: Map<string, Set<string>>;
  manualDrafts: Map<string, ManualFilterDraft>;
  selectedCustomViewId: string | null;
  onToggleFieldValue: (apiName: string, value: string) => void;
  onManualChange: (apiName: string, field: ContractFilterFieldMeta, patch: Partial<ManualFilterDraft>) => void;
  getManualDraft: (apiName: string, field: ContractFilterFieldMeta) => ManualFilterDraft;
  onToggleCustomView: (field: ContractFilterFieldMeta) => void;
}) {
  const [open, setOpen] = useState(section.id === "fields");
  const q = filterSearch.trim().toLowerCase();

  const visibleFields = useMemo(() => {
    if (!q) return section.fields;
    return section.fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.apiName.toLowerCase().includes(q) ||
        (f.groupLabel?.toLowerCase().includes(q) ?? false) ||
        f.options.some((o) => o.label.toLowerCase().includes(q)),
    );
  }, [section.fields, q]);

  if (visibleFields.length === 0) return null;

  let lastGroup: string | undefined;

  return (
    <section className="border-b border-crm-border/80 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 px-2 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-crm-text-muted transition group-hover:text-crm-text",
            open && "rotate-180",
          )}
        />
        <span className="column-heading min-w-0 flex-1 text-left">{section.title}</span>
        <span className="text-xs tabular-nums text-crm-text-muted">{visibleFields.length}</span>
      </button>

      {open ?
        <div className="pb-2 pl-1">
          {section.id === "system_defined" ?
            visibleFields.map((field) => (
              <SystemViewFilterRow
                key={field.apiName}
                field={field}
                checked={selectedCustomViewId === field.customViewId}
                onToggle={() => onToggleCustomView(field)}
              />
            ))
          : visibleFields.map((field) => {
              const showGroup = field.groupLabel && field.groupLabel !== lastGroup;
              if (field.groupLabel) lastGroup = field.groupLabel;
              return (
                <div key={field.apiName}>
                  {showGroup ?
                    <p className="column-heading px-2 pb-1 pt-2 text-xs text-crm-text-muted">
                      {field.groupLabel}
                    </p>
                  : null}
                  <FieldFilterSection
                    field={field}
                    selectedValues={fieldSelections.get(field.apiName) ?? new Set()}
                    onToggleValue={(value) => onToggleFieldValue(field.apiName, value)}
                    manualDraft={getManualDraft(field.apiName, field)}
                    onManualChange={(patch) => onManualChange(field.apiName, field, patch)}
                  />
                </div>
              );
            })
          }
        </div>
      : null}
    </section>
  );
}

type ManualFilterDraft = {
  operator: string;
  value: string;
  value2: string;
};

function defaultOperator(field: ContractFilterFieldMeta) {
  return field.operators[0]?.id ?? "equals";
}

function isDateType(dataType: string) {
  return dataType === "date" || dataType === "datetime";
}

function FieldFilterSection({
  field,
  selectedValues,
  onToggleValue,
  manualDraft,
  onManualChange,
}: {
  field: ContractFilterFieldMeta;
  selectedValues: Set<string>;
  onToggleValue: (value: string) => void;
  manualDraft: ManualFilterDraft;
  onManualChange: (patch: Partial<ManualFilterDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasCheckbox = field.hasOptions && field.options.length > 0;
  const manualActive =
    !hasCheckbox &&
    (manualDraft.value.trim().length > 0 ||
      (manualDraft.operator === "between" && manualDraft.value2.trim().length > 0));
  const active = hasCheckbox ? selectedValues.size > 0 : manualActive;

  return (
    <section className="border-b border-crm-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between rounded-lg px-2 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            active ? "font-medium text-crm-text" : "text-crm-text",
          )}
        >
          {field.label}
          {hasCheckbox && selectedValues.size > 0 ?
            <span className="ml-1.5 text-xs text-blue-400">({selectedValues.size})</span>
          : null}
          {!hasCheckbox && manualActive ?
            <span className="ml-1.5 text-xs text-blue-400">(1)</span>
          : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-crm-text-muted transition group-hover:text-crm-text",
            open && "rotate-180",
          )}
        />
      </button>

      {open ?
        <div className="space-y-2 px-2 pb-3">
          {hasCheckbox ?
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {field.options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.has(opt.value)}
                    onChange={() => onToggleValue(opt.value)}
                    className="h-4 w-4 shrink-0 rounded border-crm-border bg-crm-panel accent-blue-500"
                  />
                  <span className="min-w-0 truncate text-sm text-crm-text">{opt.label}</span>
                </label>
              ))}
            </div>
          : <>
              <label className="block">
                <span className="mb-1 block text-xs text-crm-text-muted">Condition</span>
                <select
                  value={manualDraft.operator}
                  onChange={(e) => onManualChange({ operator: e.target.value })}
                  className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-2 text-sm text-crm-text outline-none focus:border-blue-500"
                >
                  {field.operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-crm-text-muted">Value</span>
                <input
                  type={isDateType(field.dataType) ? "date" : "text"}
                  value={manualDraft.value}
                  onChange={(e) => onManualChange({ value: e.target.value })}
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                  className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                />
              </label>
              {manualDraft.operator === "between" ?
                <label className="block">
                  <span className="mb-1 block text-xs text-crm-text-muted">To</span>
                  <input
                    type={isDateType(field.dataType) ? "date" : "text"}
                    value={manualDraft.value2}
                    onChange={(e) => onManualChange({ value2: e.target.value })}
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                  />
                </label>
              : null}
            </>
          }
        </div>
      : null}
    </section>
  );
}

type SideBarProps = {
  open: boolean;
  onClose: () => void;
  onApplyFilters: (payload: ContractFilterApplyPayload) => void;
  searchCriteria?: string | null;
  customViewId?: string | null;
  filteredTotal?: number | null;
  applyLoading?: boolean;
};

function emptyManualDraft(field: ContractFilterFieldMeta): ManualFilterDraft {
  return { operator: defaultOperator(field), value: "", value2: "" };
}

export default function SideBar({
  open,
  onClose,
  onApplyFilters,
  searchCriteria = null,
  customViewId = null,
  filteredTotal = null,
  applyLoading = false,
}: SideBarProps) {
  const applyClosePending = useRef(false);
  const [sections, setSections] = useState<ContractFilterSection[]>([]);
  const [fieldMeta, setFieldMeta] = useState<ContractFilterFieldMeta[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [fieldSelections, setFieldSelections] = useState<Map<string, Set<string>>>(() => new Map());
  const [manualDrafts, setManualDrafts] = useState<Map<string, ManualFilterDraft>>(() => new Map());
  const [selectedCustomViewId, setSelectedCustomViewId] = useState<string | null>(null);

  useEffect(() => {
    if (searchCriteria == null && customViewId == null) {
      setFieldSelections(new Map());
      setManualDrafts(new Map());
      setSelectedCustomViewId(null);
    } else if (customViewId) {
      setSelectedCustomViewId(customViewId);
    }
  }, [searchCriteria, customViewId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/contracts/filters");
        const data = (await res.json()) as {
          sections?: ContractFilterSection[];
          fields?: ContractFilterFieldMeta[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load filters");
        }
        if (!cancelled) {
          setSections(data.sections ?? []);
          setFieldMeta(data.fields ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setMetaError(err instanceof Error ? err.message : "Failed to load filters");
          setSections([]);
          setFieldMeta([]);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCheckboxFilters = [...fieldSelections.values()].some((s) => s.size > 0);
  const hasManualFilters = [...manualDrafts.entries()].some(([apiName, draft]) => {
    const field = fieldMeta.find((f) => f.apiName === apiName);
    if (field?.dataType === "custom_view") return false;
    if (draft.operator === "between") {
      return draft.value.trim() && draft.value2.trim();
    }
    return draft.value.trim().length > 0;
  });
  const hasPendingFilters =
    hasCheckboxFilters || hasManualFilters || Boolean(selectedCustomViewId);
  const hasActiveFilter = Boolean(searchCriteria || customViewId);

  const hasVisibleSections = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (sections.length === 0) return false;
    if (!q) return true;
    return sections.some((section) =>
      section.fields.some(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.apiName.toLowerCase().includes(q) ||
          (f.groupLabel?.toLowerCase().includes(q) ?? false) ||
          f.options.some((o) => o.label.toLowerCase().includes(q)),
      ),
    );
  }, [sections, filterSearch]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (applyClosePending.current && !applyLoading) {
      applyClosePending.current = false;
      onClose();
    }
  }, [applyLoading, onClose]);

  function toggleFieldValue(apiName: string, value: string) {
    setSelectedCustomViewId(null);
    setFieldSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(apiName) ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size === 0) next.delete(apiName);
      else next.set(apiName, set);
      return next;
    });
  }

  function updateManualDraft(apiName: string, field: ContractFilterFieldMeta, patch: Partial<ManualFilterDraft>) {
    setSelectedCustomViewId(null);
    setManualDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(apiName) ?? emptyManualDraft(field);
      next.set(apiName, { ...current, ...patch });
      return next;
    });
  }

  function getManualDraft(apiName: string, field: ContractFilterFieldMeta) {
    return manualDrafts.get(apiName) ?? emptyManualDraft(field);
  }

  function toggleCustomView(field: ContractFilterFieldMeta) {
    const id = field.customViewId ?? null;
    setFieldSelections(new Map());
    setManualDrafts(new Map());
    setSelectedCustomViewId((prev) => (prev === id ? null : id));
  }

  function clearFilters() {
    if (applyLoading) return;
    setFieldSelections(new Map());
    setManualDrafts(new Map());
    setSelectedCustomViewId(null);
    applyClosePending.current = false;
    onApplyFilters({ criteria: null, customViewId: null });
  }

  function applyFilters() {
    if (applyLoading) return;

    if (selectedCustomViewId && !hasCheckboxFilters && !hasManualFilters) {
      applyClosePending.current = true;
      onApplyFilters({ criteria: null, customViewId: selectedCustomViewId });
      return;
    }

    const selections: ContractFieldFilterSelection[] = [
      ...selectionsFromCheckboxState(fieldSelections),
    ];

    for (const field of fieldMeta) {
      if (field.dataType === "custom_view") continue;
      if (field.hasOptions && field.options.length > 0) continue;
      const draft = manualDrafts.get(field.apiName);
      if (!draft?.value.trim()) continue;

      if (draft.operator === "between") {
        if (!draft.value2.trim()) continue;
        selections.push({
          apiName: field.apiName,
          operator: "between",
          values: [draft.value.trim(), draft.value2.trim()],
        });
      } else {
        selections.push({
          apiName: field.apiName,
          operator: draft.operator,
          values: [draft.value.trim()],
        });
      }
    }

    const criteria = buildCriteriaFromFieldFilters(selections);
    applyClosePending.current = true;
    onApplyFilters({ criteria, customViewId: null });
  }

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[90] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        id="contracts-filters"
        aria-label="Contract filters"
        className={cn(
          "flex min-h-0 w-[min(100vw-1rem,300px)] shrink-0 flex-col overflow-hidden rounded-xl border border-crm-border bg-crm-panel-muted",
          "max-md:fixed max-md:top-2 max-md:bottom-2 max-md:left-2 max-md:z-[100] max-md:shadow-2xl max-md:transition-transform max-md:duration-300 max-md:ease-out",
          open ?
            "max-md:translate-x-0"
          : "max-md:pointer-events-none max-md:-translate-x-[calc(100%+1rem)]",
          "md:relative md:h-full md:w-[280px] md:translate-x-0 md:pointer-events-auto lg:w-[300px]",
        )}
      >
        <div className="shrink-0 border-b border-crm-border px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-blue-500/15 p-2">
                <Filter className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="section-heading text-lg">Filters</h2>
                <p className="text-xs text-crm-text-muted">
                  {hasActiveFilter && filteredTotal != null ?
                    `${filteredTotal.toLocaleString("en-US")} matching records`
                  : metaLoading ? "Loading…"
                  : `${fieldMeta.length.toLocaleString("en-US")} filterable fields`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-crm-text-muted transition hover:bg-zinc-100 hover:text-crm-text dark:hover:bg-zinc-800 md:hidden"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-crm-border p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-crm-text-muted" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search filters..."
              className="h-10 w-full rounded-xl border border-crm-border bg-crm-panel pl-10 pr-3 text-sm text-crm-text outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div
          className={[
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "[scrollbar-width:thin] [scrollbar-color:rgb(82_82_91)_transparent]",
            "[&::-webkit-scrollbar]:w-2",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-zinc-600",
            "[&::-webkit-scrollbar-thumb:hover]:bg-zinc-500",
          ].join(" ")}
        >
          <div className="px-1 py-2">
            {metaLoading ?
              <FilterSidebarFieldsSkeleton rows={14} />
            : metaError ?
              <p className="px-2 py-4 text-sm text-red-400">{metaError}</p>
            : sections.length === 0 ?
              <p className="px-2 py-4 text-sm text-crm-text-muted">No filter fields available.</p>
            : !hasVisibleSections ?
              <p className="px-2 py-4 text-sm text-crm-text-muted">No matching filter fields.</p>
            : sections.map((section) => (
                <FilterSectionGroup
                  key={section.id}
                  section={section}
                  filterSearch={filterSearch}
                  fieldSelections={fieldSelections}
                  manualDrafts={manualDrafts}
                  selectedCustomViewId={selectedCustomViewId}
                  onToggleFieldValue={toggleFieldValue}
                  onManualChange={updateManualDraft}
                  getManualDraft={getManualDraft}
                  onToggleCustomView={toggleCustomView}
                />
              ))
            }
          </div>
        </div>

        {(hasPendingFilters || hasActiveFilter) && (
          <div className="shrink-0 space-y-2 border-t border-crm-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {hasPendingFilters ?
              <button
                type="button"
                onClick={applyFilters}
                disabled={applyLoading}
                aria-busy={applyLoading}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applyLoading ?
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Applying…
                  </>
                : "Apply Filter"}
              </button>
            : null}
            <button
              type="button"
              onClick={clearFilters}
              disabled={applyLoading}
              className="h-8 w-full rounded-lg border border-crm-border bg-crm-panel-muted text-sm text-crm-text transition hover:bg-crm-panel disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
