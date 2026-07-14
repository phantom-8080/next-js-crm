"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, ChevronDown, Filter, Loader2, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSidebarFieldsSkeleton } from "@/components/LoadingShimmer";
import {
  buildSearchParamFromFieldFilters,
  selectionsFromCheckboxState,
} from "@/lib/buildContractFilterCriteria";
import {
  criteriaApiNameForFilterField,
  getKnownLookupFieldConfig,
  isLookupLikeDataType,
  isUserLikeDataType,
  looksLikeZohoId,
} from "@/lib/resolveFilterValues";
import {
  createSavedFilterId,
  loadSavedFilters,
  persistSavedFilters,
  type SavedFilterPreset,
} from "@/lib/savedFilters";
import type {
  ContractFieldFilterSelection,
  ContractFilterApplyPayload,
  ContractFilterFieldMeta,
  ContractFilterOption,
  ContractFilterSection,
} from "@/lib/contractFilterTypes";

function FilterSectionGroup({
  section,
  filterSearch,
  fieldSelections,
  manualDrafts,
  zohoModule,
  onToggleFieldValue,
  onManualChange,
  getManualDraft,
}: {
  section: ContractFilterSection;
  filterSearch: string;
  fieldSelections: Map<string, Set<string>>;
  manualDrafts: Map<string, ManualFilterDraft>;
  zohoModule: string;
  onToggleFieldValue: (apiName: string, value: string) => void;
  onManualChange: (apiName: string, field: ContractFilterFieldMeta, patch: Partial<ManualFilterDraft>) => void;
  getManualDraft: (apiName: string, field: ContractFilterFieldMeta) => ManualFilterDraft;
}) {
  const [open, setOpen] = useState(section.id === "fields");
  const q = filterSearch.trim().toLowerCase();

  const visibleFields = useMemo(() => {
    if (!q) return section.fields;
    return section.fields.filter(
      (f) =>
        f.dataType !== "custom_view" &&
        (f.label.toLowerCase().includes(q) ||
          f.apiName.toLowerCase().includes(q) ||
          (f.groupLabel?.toLowerCase().includes(q) ?? false) ||
          f.options.some((o) => o.label.toLowerCase().includes(q))),
    );
  }, [section.fields, q]);

  if (visibleFields.length === 0) return null;

  let lastGroup: string | undefined;

  return (
    <section className="border-b border-crm-border/80 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full cursor-pointer items-center gap-2 px-2 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
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
          {visibleFields.map((field) => {
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
                  zohoModule={zohoModule}
                  selectedValues={fieldSelections.get(field.apiName) ?? new Set()}
                  onToggleValue={(value) => onToggleFieldValue(field.apiName, value)}
                  manualDraft={getManualDraft(field.apiName, field)}
                  onManualChange={(patch) => onManualChange(field.apiName, field, patch)}
                />
              </div>
            );
          })}
        </div>
      : null}
    </section>
  );
}

type ManualFilterDraft = {
  operator: string;
  value: string;
  value2: string;
  /** Display name when `value` is a Zoho lookup/user id. */
  displayLabel?: string;
};

function defaultOperator(field: ContractFilterFieldMeta) {
  const contains = field.operators.find((op) => op.id === "contains");
  if (contains) return "contains";
  return field.operators[0]?.id ?? "equals";
}

function isDateType(dataType: string) {
  return dataType === "date" || dataType === "datetime";
}

function fieldUsesIdSuggestions(field: ContractFilterFieldMeta) {
  const known = getKnownLookupFieldConfig(field.apiName);
  return (
    isLookupLikeDataType(field.dataType) ||
    isUserLikeDataType(field.dataType) ||
    known?.kind === "user" ||
    known?.kind === "lookup" ||
    Boolean(field.lookupModule)
  );
}

const MIN_SUGGESTION_CHARS = 3;

function FilterValueSuggestionInput({
  field,
  zohoModule,
  value,
  displayLabel,
  onChange,
  placeholder,
}: {
  field: ContractFilterFieldMeta;
  zohoModule: string;
  value: string;
  displayLabel?: string;
  onChange: (patch: Pick<ManualFilterDraft, "value" | "displayLabel">) => void;
  placeholder: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ContractFilterOption[]>([]);
  const [inputText, setInputText] = useState(() => displayLabel || value);

  useEffect(() => {
    setInputText(displayLabel || value);
  }, [displayLabel, value]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onDocPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  function fetchSuggestions(q: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const params = new URLSearchParams({
      module: zohoModule,
      field: field.apiName,
      q,
      dataType: field.dataType,
    });
    if (field.lookupModule) params.set("lookupModule", field.lookupModule);

    void fetch(`/api/field-suggestions?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as {
          suggestions?: ContractFilterOption[];
        };
        if (controller.signal.aborted) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) setSuggestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  function scheduleFetch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < MIN_SUGGESTION_CHARS) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 250);
  }

  function handleFocus() {
    setOpen(true);
    const q = inputText.trim();
    if (q.length >= MIN_SUGGESTION_CHARS) {
      fetchSuggestions(q);
    } else {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
    }
  }

  function handleChange(next: string) {
    setInputText(next);
    setOpen(true);
    const useIds = fieldUsesIdSuggestions(field);
    if (useIds && looksLikeZohoId(value) && displayLabel && next === displayLabel) {
      onChange({ value, displayLabel });
    } else {
      onChange({ value: next, displayLabel: undefined });
    }
    scheduleFetch(next.trim());
  }

  function handleSelect(opt: ContractFilterOption) {
    const useIds = fieldUsesIdSuggestions(field);
    setInputText(opt.label);
    setOpen(false);
    if (useIds && opt.value !== opt.label) {
      onChange({ value: opt.value, displayLabel: opt.label });
    } else {
      onChange({ value: opt.value, displayLabel: undefined });
    }
  }

  const trimmedInput = inputText.trim();
  const needsMoreChars = trimmedInput.length > 0 && trimmedInput.length < MIN_SUGGESTION_CHARS;

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={inputText}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
      />
      {open ?
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-48 overflow-y-auto rounded-lg border border-crm-border bg-crm-panel shadow-lg">
          {trimmedInput.length < MIN_SUGGESTION_CHARS ?
            <p className="px-3 py-2 text-xs text-crm-text-muted">
              {needsMoreChars ?
                `Type at least ${MIN_SUGGESTION_CHARS} characters…`
              : `Type ${MIN_SUGGESTION_CHARS}+ characters for suggestions`}
            </p>
          : loading ?
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-crm-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          : suggestions.length === 0 ?
            <p className="px-3 py-2 text-xs text-crm-text-muted">No suggestions</p>
          : suggestions.map((opt) => (
              <button
                key={`${opt.value}::${opt.label}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className="flex w-full cursor-pointer px-3 py-2 text-left text-sm text-crm-text transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
              >
                <span className="min-w-0 truncate">{opt.label}</span>
              </button>
            ))
          }
        </div>
      : null}
    </div>
  );
}

function FieldFilterSection({
  field,
  zohoModule,
  selectedValues,
  onToggleValue,
  manualDraft,
  onManualChange,
}: {
  field: ContractFilterFieldMeta;
  zohoModule: string;
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
  const useSuggestions = !hasCheckbox && !isDateType(field.dataType);

  return (
    <section className="border-b border-crm-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                {useSuggestions ?
                  <FilterValueSuggestionInput
                    field={field}
                    zohoModule={zohoModule}
                    value={manualDraft.value}
                    displayLabel={manualDraft.displayLabel}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    onChange={(patch) => onManualChange(patch)}
                  />
                : <input
                    type="date"
                    value={manualDraft.value}
                    onChange={(e) => onManualChange({ value: e.target.value, displayLabel: undefined })}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                  />
                }
              </label>
              {manualDraft.operator === "between" ?
                <label className="block">
                  <span className="mb-1 block text-xs text-crm-text-muted">To</span>
                  {useSuggestions ?
                    <FilterValueSuggestionInput
                      field={field}
                      zohoModule={zohoModule}
                      value={manualDraft.value2}
                      placeholder="To…"
                      onChange={(patch) =>
                        onManualChange({
                          value2: patch.value,
                        })
                      }
                    />
                  : <input
                      type="date"
                      value={manualDraft.value2}
                      onChange={(e) => onManualChange({ value2: e.target.value })}
                      className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                    />
                  }
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
  filtersApiUrl?: string;
  /** Zoho CRM module API name used for field suggestions. */
  zohoModule?: string;
  filterPanelId?: string;
  filterAriaLabel?: string;
  /** When set, sidebar uses this metadata instead of fetching from the API. */
  filterMetaOverride?: {
    sections: ContractFilterSection[];
    fields: ContractFilterFieldMeta[];
  };
  /** True when client-side field filters are applied (static list mode). */
  listFiltersActive?: boolean;
};

function emptyManualDraft(field: ContractFilterFieldMeta): ManualFilterDraft {
  return { operator: defaultOperator(field), value: "", value2: "", displayLabel: undefined };
}

export default function SideBar({
  open,
  onClose,
  onApplyFilters,
  searchCriteria = null,
  customViewId = null,
  filteredTotal = null,
  applyLoading = false,
  filtersApiUrl = "/api/contracts/filters",
  zohoModule = "Contracts",
  filterPanelId = "contracts-filters",
  filterAriaLabel = "Contract filters",
  filterMetaOverride,
  listFiltersActive = false,
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
  const [savedFilters, setSavedFilters] = useState<SavedFilterPreset[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);

  useEffect(() => {
    setSavedFilters(loadSavedFilters(zohoModule));
  }, [zohoModule]);

  useEffect(() => {
    // Custom views are applied from the toolbar dropdown (not the sidebar).
    // When a cvid-only view is active, clear sidebar drafts so Apply Filter is not shown.
    if (searchCriteria == null && customViewId != null) {
      setFieldSelections(new Map());
      setManualDrafts(new Map());
      setSelectedCustomViewId(null);
      setActiveSavedFilterId(null);
      return;
    }
    if (searchCriteria == null && customViewId == null && !listFiltersActive) {
      setFieldSelections(new Map());
      setManualDrafts(new Map());
      setSelectedCustomViewId(null);
      setActiveSavedFilterId(null);
    }
  }, [searchCriteria, customViewId, listFiltersActive]);

  useEffect(() => {
    if (filterMetaOverride) {
      setSections(filterMetaOverride.sections);
      setFieldMeta(filterMetaOverride.fields);
      setMetaLoading(false);
      setMetaError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch(filtersApiUrl);
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
  }, [filtersApiUrl, filterMetaOverride]);

  const hasCheckboxFilters = [...fieldSelections.values()].some((s) => s.size > 0);
  const hasManualFilters = [...manualDrafts.entries()].some(([apiName, draft]) => {
    const field = fieldMeta.find((f) => f.apiName === apiName);
    if (field?.dataType === "custom_view") return false;
    if (draft.operator === "between") {
      return draft.value.trim() && draft.value2.trim();
    }
    return draft.value.trim().length > 0;
  });
  /** Sidebar chrome only — dropdown custom views do not count as sidebar filters. */
  const hasActiveFilter = Boolean(searchCriteria || listFiltersActive);

  const displaySections = useMemo(() => {
    const titles: Record<string, string> = {
      fields: "Filter By Fields",
      subforms: "Filter By Subforms",
      related_modules: "Filter By Related Modules",
    };

    const sourceSections =
      sections.length > 0 ?
        sections
      : (() => {
          if (fieldMeta.length === 0) return [] as ContractFilterSection[];
          const bySection = new Map<string, ContractFilterFieldMeta[]>();
          for (const field of fieldMeta) {
            if (field.dataType === "custom_view") continue;
            const id = field.section ?? "fields";
            const list = bySection.get(id) ?? [];
            list.push(field);
            bySection.set(id, list);
          }
          return [...bySection.entries()].map(([id, fields]) => ({
            id: id as ContractFilterSection["id"],
            title: titles[id] ?? id,
            fields,
          }));
        })();

    // Custom views live in the toolbar dropdown — keep only field filters here.
    return sourceSections
      .filter((section) => section.id !== "system_defined")
      .map((section) => ({
        ...section,
        title: titles[section.id] ?? section.title,
        fields: section.fields.filter((f) => f.dataType !== "custom_view"),
      }))
      .filter((section) => section.fields.length > 0);
  }, [fieldMeta, sections]);

  const hasVisibleSections = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (displaySections.length === 0) return false;
    if (!q) return true;
    return displaySections.some((section) =>
      section.fields.some(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.apiName.toLowerCase().includes(q) ||
          (f.groupLabel?.toLowerCase().includes(q) ?? false) ||
          f.options.some((o) => o.label.toLowerCase().includes(q)),
      ),
    );
  }, [displaySections, filterSearch]);

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
    setActiveSavedFilterId(null);
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
    setActiveSavedFilterId(null);
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

  function buildApplyPayloadFromState(
    nextCheckboxes: Map<string, Set<string>>,
    nextDrafts: Map<string, ManualFilterDraft>,
    nextCustomViewId: string | null,
    zohoSelections?: ContractFieldFilterSelection[],
  ): ContractFilterApplyPayload {
    const hasBoxes = [...nextCheckboxes.values()].some((s) => s.size > 0);
    const hasManual = [...nextDrafts.entries()].some(([apiName, draft]) => {
      const field = fieldMeta.find((f) => f.apiName === apiName);
      if (field?.dataType === "custom_view") return false;
      if (draft.operator === "between") {
        return Boolean(draft.value.trim() && draft.value2.trim());
      }
      return draft.value.trim().length > 0;
    });

    if (nextCustomViewId && !hasBoxes && !hasManual) {
      return {
        criteria: null,
        customViewId: nextCustomViewId,
        fieldSelections: [],
      };
    }

    const selections: ContractFieldFilterSelection[] = [
      ...selectionsFromCheckboxState(nextCheckboxes),
    ];
    const displaySelections: ContractFieldFilterSelection[] = [
      ...selectionsFromCheckboxState(nextCheckboxes),
    ];

    for (const field of fieldMeta) {
      if (field.dataType === "custom_view") continue;
      if (field.hasOptions && field.options.length > 0) continue;
      const draft = nextDrafts.get(field.apiName);
      if (!draft?.value.trim()) continue;

      const criteriaValue = draft.value.trim();
      const displayValue = (draft.displayLabel ?? draft.value).trim();

      if (draft.operator === "between") {
        if (!draft.value2.trim()) continue;
        selections.push({
          apiName: criteriaApiNameForFilterField(field.apiName, field.dataType, zohoModule),
          operator: "between",
          values: [criteriaValue, draft.value2.trim()],
        });
        displaySelections.push({
          apiName: field.apiName,
          operator: "between",
          values: [displayValue, draft.value2.trim()],
        });
      } else {
        // Lookup "contains" with a picked suggestion id → exact match on that record.
        const operator =
          draft.operator === "contains" &&
          fieldUsesIdSuggestions(field) &&
          looksLikeZohoId(criteriaValue) ?
            "equals"
          : draft.operator;
        selections.push({
          apiName: criteriaApiNameForFilterField(field.apiName, field.dataType, zohoModule),
          operator,
          values: [criteriaValue],
        });
        displaySelections.push({
          apiName: field.apiName,
          operator: draft.operator,
          values: [displayValue],
        });
      }
    }

    return {
      criteria: buildSearchParamFromFieldFilters(zohoSelections ?? selections),
      customViewId: null,
      fieldSelections: displaySelections,
    };
  }

  /**
   * Zoho lookup filters cannot use text `contains`. Resolve partial names to matching
   * record/user ids, then filter with `in` / `equals`.
   */
  async function resolveLookupContainsSelections(
    selections: ContractFieldFilterSelection[],
  ): Promise<ContractFieldFilterSelection[]> {
    const resolved: ContractFieldFilterSelection[] = [];

    for (const selection of selections) {
      if (selection.operator !== "contains") {
        resolved.push(selection);
        continue;
      }

      const field = fieldMeta.find(
        (f) =>
          f.apiName === selection.apiName ||
          criteriaApiNameForFilterField(f.apiName, f.dataType, zohoModule) === selection.apiName,
      );

      if (!field || !fieldUsesIdSuggestions(field)) {
        resolved.push(selection);
        continue;
      }

      const raw = selection.values[0]?.trim() ?? "";
      if (!raw) continue;

      if (looksLikeZohoId(raw)) {
        resolved.push({ ...selection, operator: "equals", values: [raw] });
        continue;
      }

      const params = new URLSearchParams({
        module: zohoModule,
        field: field.apiName,
        q: raw,
        dataType: field.dataType,
      });
      if (field.lookupModule) params.set("lookupModule", field.lookupModule);

      try {
        const res = await fetch(`/api/field-suggestions?${params.toString()}`);
        const data = (await res.json()) as { suggestions?: ContractFilterOption[] };
        const q = raw.toLowerCase();
        const ids = [
          ...new Set(
            (Array.isArray(data.suggestions) ? data.suggestions : [])
              .filter((opt) => String(opt.label ?? "").toLowerCase().includes(q))
              .map((opt) => String(opt.value ?? "").trim())
              .filter(Boolean),
          ),
        ];

        if (ids.length === 0) {
          resolved.push({
            apiName: selection.apiName,
            operator: "equals",
            values: ["0000000000000000000"],
          });
        } else if (ids.length === 1) {
          resolved.push({ apiName: selection.apiName, operator: "equals", values: ids });
        } else {
          resolved.push({ apiName: selection.apiName, operator: "in", values: ids });
        }
      } catch {
        resolved.push(selection);
      }
    }

    return resolved;
  }

  function clearFilters() {
    if (applyLoading) return;
    setFieldSelections(new Map());
    setManualDrafts(new Map());
    setSelectedCustomViewId(null);
    setActiveSavedFilterId(null);
    setSaveOpen(false);
    setSaveName("");
    applyClosePending.current = false;
    onApplyFilters({ criteria: null, customViewId: null, fieldSelections: [] });
  }

  async function buildZohoSelectionsFromState(
    nextCheckboxes: Map<string, Set<string>>,
    nextDrafts: Map<string, ManualFilterDraft>,
  ): Promise<ContractFieldFilterSelection[]> {
    const baseSelections: ContractFieldFilterSelection[] = [
      ...selectionsFromCheckboxState(nextCheckboxes),
    ];
    for (const field of fieldMeta) {
      if (field.dataType === "custom_view") continue;
      if (field.hasOptions && field.options.length > 0) continue;
      const draft = nextDrafts.get(field.apiName);
      if (!draft?.value.trim()) continue;
      if (draft.operator === "between") {
        if (!draft.value2.trim()) continue;
        baseSelections.push({
          apiName: criteriaApiNameForFilterField(field.apiName, field.dataType, zohoModule),
          operator: "between",
          values: [draft.value.trim(), draft.value2.trim()],
        });
      } else {
        const criteriaValue = draft.value.trim();
        const operator =
          draft.operator === "contains" &&
          fieldUsesIdSuggestions(field) &&
          looksLikeZohoId(criteriaValue) ?
            "equals"
          : draft.operator;
        baseSelections.push({
          apiName: criteriaApiNameForFilterField(field.apiName, field.dataType, zohoModule),
          operator,
          values: [criteriaValue],
        });
      }
    }

    const needsLookupContainsResolve = baseSelections.some((s) => {
      if (s.operator !== "contains") return false;
      const field = fieldMeta.find(
        (f) =>
          f.apiName === s.apiName ||
          criteriaApiNameForFilterField(f.apiName, f.dataType, zohoModule) === s.apiName,
      );
      return Boolean(field && fieldUsesIdSuggestions(field) && !looksLikeZohoId(s.values[0] ?? ""));
    });

    return needsLookupContainsResolve ?
        resolveLookupContainsSelections(baseSelections)
      : baseSelections;
  }

  async function applyFilters() {
    if (applyLoading) return;

    const zohoSelections = await buildZohoSelectionsFromState(fieldSelections, manualDrafts);

    applyClosePending.current = true;
    setSelectedCustomViewId(null);
    // Field filters replace the toolbar custom view (Zoho list is cvid OR criteria).
    onApplyFilters(
      buildApplyPayloadFromState(fieldSelections, manualDrafts, null, zohoSelections),
    );
  }

  function snapshotCurrentFilters(): SavedFilterPreset | null {
    const checkboxSelections = selectionsFromCheckboxState(fieldSelections);
    const manualFilters = [...manualDrafts.entries()]
      .map(([apiName, draft]) => {
        const field = fieldMeta.find((f) => f.apiName === apiName);
        if (field?.dataType === "custom_view") return null;
        if (field?.hasOptions && (field.options?.length ?? 0) > 0) return null;
        if (!draft.value.trim()) return null;
        if (draft.operator === "between" && !draft.value2.trim()) return null;
        return {
          apiName,
          operator: draft.operator,
          value: draft.value.trim(),
          value2: draft.value2.trim() || undefined,
          displayLabel: draft.displayLabel?.trim() || undefined,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (!selectedCustomViewId && checkboxSelections.length === 0 && manualFilters.length === 0) {
      return null;
    }

    const name = saveName.trim() || "Untitled filter";
    return {
      id: createSavedFilterId(),
      name,
      createdAt: Date.now(),
      customViewId: selectedCustomViewId,
      checkboxSelections,
      manualFilters,
    };
  }

  function saveCurrentFilters() {
    const preset = snapshotCurrentFilters();
    if (!preset) return;
    const next = [preset, ...savedFilters.filter((p) => p.name !== preset.name)];
    setSavedFilters(next);
    persistSavedFilters(zohoModule, next);
    setActiveSavedFilterId(preset.id);
    setSaveOpen(false);
    setSaveName("");
  }

  function deleteSavedFilter(id: string) {
    const next = savedFilters.filter((p) => p.id !== id);
    setSavedFilters(next);
    persistSavedFilters(zohoModule, next);
    if (activeSavedFilterId === id) setActiveSavedFilterId(null);
  }

  async function applySavedFilter(preset: SavedFilterPreset) {
    if (applyLoading) return;

    const nextCheckboxes = new Map<string, Set<string>>();
    for (const selection of preset.checkboxSelections) {
      if (!selection.apiName || selection.values.length === 0) continue;
      nextCheckboxes.set(selection.apiName, new Set(selection.values));
    }

    const nextDrafts = new Map<string, ManualFilterDraft>();
    for (const manual of preset.manualFilters) {
      const field = fieldMeta.find((f) => f.apiName === manual.apiName);
      nextDrafts.set(manual.apiName, {
        operator: manual.operator || (field ? defaultOperator(field) : "contains"),
        value: manual.value,
        value2: manual.value2 ?? "",
        displayLabel: manual.displayLabel,
      });
    }

    setFieldSelections(nextCheckboxes);
    setManualDrafts(nextDrafts);
    setSelectedCustomViewId(preset.customViewId);
    setActiveSavedFilterId(preset.id);

    const zohoSelections = await buildZohoSelectionsFromState(nextCheckboxes, nextDrafts);
    applyClosePending.current = true;
    onApplyFilters(
      buildApplyPayloadFromState(
        nextCheckboxes,
        nextDrafts,
        preset.customViewId,
        zohoSelections,
      ),
    );
  }

  const hasFieldValueFilters = hasCheckboxFilters || hasManualFilters;
  /** Apply only for sidebar field filters — custom views apply immediately via the dropdown. */
  const canApplyFilters = hasFieldValueFilters;
  /** Save only when at least one field has a concrete value. */
  const canSaveCurrent = hasFieldValueFilters;

  useEffect(() => {
    if (saveOpen && !canSaveCurrent) {
      setSaveOpen(false);
      setSaveName("");
    }
  }, [saveOpen, canSaveCurrent]);

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
        id={filterPanelId}
        aria-label={filterAriaLabel}
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
              className="cursor-pointer rounded-lg p-2 text-crm-text-muted transition hover:bg-zinc-100 hover:text-crm-text dark:hover:bg-zinc-800 md:hidden"
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
          {savedFilters.length > 0 ?
            <div className="border-b border-crm-border/80 px-2 py-2">
              <p className="column-heading px-2 pb-1.5 text-xs text-crm-text-muted">Saved filters</p>
              <div className="space-y-1">
                {savedFilters.map((preset) => {
                  const clauseCount =
                    preset.checkboxSelections.length +
                    preset.manualFilters.length +
                    (preset.customViewId ? 1 : 0);
                  const active = activeSavedFilterId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-lg px-1 py-0.5",
                        active ? "bg-blue-500/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => applySavedFilter(preset)}
                        disabled={applyLoading || metaLoading || Boolean(metaError)}
                        className={cn(
                          "min-w-0 flex-1 cursor-pointer rounded-md px-2 py-1.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                          active ? "font-medium text-blue-400" : "text-crm-text",
                        )}
                        title={`Apply “${preset.name}” (${clauseCount} condition${clauseCount === 1 ? "" : "s"})`}
                      >
                        <span className="block truncate">{preset.name}</span>
                        <span className="block text-[11px] text-crm-text-muted">
                          {clauseCount} condition{clauseCount === 1 ? "" : "s"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedFilter(preset.id)}
                        className="cursor-pointer rounded-md p-1.5 text-crm-text-muted opacity-70 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        aria-label={`Delete saved filter ${preset.name}`}
                        title="Delete saved filter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          : null}

          <div className="px-1 py-2">
            {metaLoading ?
              <FilterSidebarFieldsSkeleton rows={14} />
            : metaError ?
              <p className="px-2 py-4 text-sm text-red-400">{metaError}</p>
            : displaySections.length === 0 ?
              <p className="px-2 py-4 text-sm text-crm-text-muted">No filter fields available.</p>
            : !hasVisibleSections ?
              <p className="px-2 py-4 text-sm text-crm-text-muted">No matching filter fields.</p>
            : displaySections.map((section) => (
                <FilterSectionGroup
                  key={section.id}
                  section={section}
                  filterSearch={filterSearch}
                  fieldSelections={fieldSelections}
                  manualDrafts={manualDrafts}
                  zohoModule={zohoModule}
                  onToggleFieldValue={toggleFieldValue}
                  onManualChange={updateManualDraft}
                  getManualDraft={getManualDraft}
                />
              ))
            }
          </div>
        </div>

        {(canApplyFilters || hasActiveFilter || saveOpen) && (
          <div className="shrink-0 space-y-2 border-t border-crm-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {saveOpen ?
              <div className="space-y-2 rounded-lg border border-crm-border bg-crm-panel p-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-crm-text-muted">Filter name</span>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveCurrentFilters();
                      }
                      if (e.key === "Escape") {
                        setSaveOpen(false);
                        setSaveName("");
                      }
                    }}
                    placeholder="e.g. Active Carvana sites"
                    autoFocus
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel-muted px-3 text-sm text-crm-text outline-none focus:border-blue-500"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveCurrentFilters}
                    disabled={!canSaveCurrent}
                    className="h-8 flex-1 cursor-pointer rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveOpen(false);
                      setSaveName("");
                    }}
                    className="h-8 cursor-pointer rounded-lg border border-crm-border bg-crm-panel-muted px-3 text-sm text-crm-text transition hover:bg-crm-panel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            : null}

            {canApplyFilters ?
              <button
                type="button"
                onClick={applyFilters}
                disabled={applyLoading}
                aria-busy={applyLoading}
                className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applyLoading ?
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Applying…
                  </>
                : "Apply Filter"}
              </button>
            : null}

            {canSaveCurrent && !saveOpen ?
              <button
                type="button"
                onClick={() => setSaveOpen(true)}
                disabled={applyLoading}
                className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-crm-border bg-crm-panel text-sm text-crm-text transition hover:bg-crm-panel-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bookmark className="h-3.5 w-3.5" aria-hidden />
                Save filter
              </button>
            : null}

            {(canApplyFilters || hasActiveFilter) ?
              <button
                type="button"
                onClick={clearFilters}
                disabled={applyLoading}
                className="h-8 w-full cursor-pointer rounded-lg border border-crm-border bg-crm-panel-muted text-sm text-crm-text transition hover:bg-crm-panel disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            : null}
          </div>
        )}
      </aside>
    </>
  );
}
