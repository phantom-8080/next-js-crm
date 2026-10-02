import { buildAndCriteria, encodeZohoFiltersParam } from "@/lib/zoho";

export type ContractFilterOption = {
  value: string;
  label: string;
};

export type ContractFilterOperator = {
  id: string;
  label: string;
};

export type ContractFilterSectionId =
  | "system_defined"
  | "fields"
  | "subforms"
  | "related_modules";

export type ContractFilterFieldMeta = {
  apiName: string;
  label: string;
  dataType: string;
  operators: ContractFilterOperator[];
  options: ContractFilterOption[];
  hasOptions: boolean;
  section: ContractFilterSectionId;
  /** Subform block title / custom-view category (e.g. Created By Me). */
  groupLabel?: string;
  /** Zoho custom view id for list filters (cvid). */
  customViewId?: string;
  /** Related Zoho module API name for lookup fields (suggestions). */
  lookupModule?: string;
  /** Zoho custom view marked as favorite. */
  favorite?: boolean;
  /** Zoho default custom view for the module. */
  defaultView?: boolean;
  /** Zoho system-defined custom view (not user-deletable). */
  systemDefined?: boolean;
};

export type ContractFilterSection = {
  id: ContractFilterSectionId;
  title: string;
  fields: ContractFilterFieldMeta[];
};

/** One active filter row in the sidebar (picklist / layout multi-select). */
export type ContractFieldFilterSelection = {
  apiName: string;
  operator: string;
  values: string[];
};

export type ContractFilterApplyPayload = {
  criteria: string | null;
  customViewId: string | null;
  /** Client-side list filtering (service completions static demo). */
  fieldSelections?: ContractFieldFilterSelection[];
};

/* ─── Build criteria / filters param ─── */

/** Map UI / search operators → Zoho `filters` JSON comparators. */
const FILTERS_COMPARATOR: Record<string, string> = {
  equals: "equal",
  equal: "equal",
  not_equal: "not_equal",
  starts_with: "starts_with",
  contains: "contains",
  in: "in",
  between: "between",
  greater_than: "greater_than",
  greater_equal: "greater_equal",
  less_than: "less_than",
  less_equal: "less_equal",
  is_empty: "equal",
  is_not_empty: "not_equal",
};

function selectionAllowsEmptyValue(operator: string) {
  const op = String(operator ?? "").toLowerCase();
  return op === "is_empty" || op === "is_not_empty";
}

function isRelatedModuleEncodedSelection(selection: ContractFieldFilterSelection) {
  const apiName = String(selection.apiName ?? "");
  if (apiName.startsWith("$related.")) return true;
  const raw = selection.values?.[0];
  if (typeof raw !== "string") return false;
  try {
    const parsed = JSON.parse(raw) as { kind?: string };
    return parsed?.kind === "related_module";
  } catch {
    return false;
  }
}

export function buildCriteriaFromFieldFilters(
  selections: ContractFieldFilterSelection[],
): string | null {
  const clauses = selections
    .filter((s) => {
      if (isRelatedModuleEncodedSelection(s)) return false;
      if (selectionAllowsEmptyValue(s.operator)) return Boolean(s.apiName);
      return s.values.length > 0;
    })
    .map((s) => {
      const operator =
        s.operator ||
        (s.values.length > 1 ? "in" : "equals");
      return { apiName: s.apiName, operator, values: s.values };
    });

  return buildAndCriteria(clauses);
}

/**
 * Build Zoho Get Records `filters` JSON (supports `contains`, unlike Search API).
 * Related-module clauses are encoded with `$related.*` api names and JSON values;
 * `/api/contracts` strips and resolves them via child-module search.
 */
export function buildFiltersObjectFromFieldFilters(
  selections: ContractFieldFilterSelection[],
): { group_operator: "and"; group: unknown[] } | null {
  const group: unknown[] = [];

  for (const selection of selections) {
    if (!selection.apiName) continue;

    if (isRelatedModuleEncodedSelection(selection)) {
      const values = selection.values.map((v) => String(v).trim()).filter(Boolean);
      if (values.length === 0) continue;
      group.push({
        field: { api_name: selection.apiName },
        comparator:
          selection.operator === "not_equal" || selection.operator === "without" ?
            "not_equal"
          : "equal",
        value: values[0],
      });
      continue;
    }

    const operator =
      selection.operator ||
      (selection.values.length > 1 ? "in" : "equals");
    const allowEmpty = selectionAllowsEmptyValue(operator);
    const values = selection.values.map((v) => String(v).trim()).filter(Boolean);
    if (!allowEmpty && values.length === 0) continue;

    const comparator = FILTERS_COMPARATOR[operator] ?? operator;
    let value: unknown;
    if (operator === "is_empty") value = "${EMPTY}";
    else if (operator === "is_not_empty") value = "${EMPTY}";
    else if (
      operator === "in" ||
      operator === "between" ||
      comparator === "in" ||
      comparator === "between"
    ) {
      value = values;
    } else {
      value = values[0];
    }

    group.push({
      field: { api_name: selection.apiName },
      comparator,
      value,
    });
  }

  if (group.length === 0) return null;
  return { group_operator: "and", group };
}

/**
 * Prefer Zoho `filters` encoding so operators like `contains` work.
 * Falls back to classic search criteria only if filters cannot be built.
 */
export function buildSearchParamFromFieldFilters(
  selections: ContractFieldFilterSelection[],
): string | null {
  const filtersObj = buildFiltersObjectFromFieldFilters(selections);
  if (filtersObj) return encodeZohoFiltersParam(filtersObj);
  return buildCriteriaFromFieldFilters(selections);
}

/** @param {Map<string, Set<string>>} selectedByField */
export function selectionsFromCheckboxState(
  selectedByField: Map<string, Set<string>>,
): ContractFieldFilterSelection[] {
  const result: ContractFieldFilterSelection[] = [];
  for (const [apiName, valueSet] of selectedByField) {
    const values = [...valueSet];
    if (values.length === 0) continue;
    result.push({
      apiName,
      operator: values.length > 1 ? "in" : "equals",
      values,
    });
  }
  return result;
}

/* ─── Saved filter presets (localStorage) ─── */

export type SavedManualFilter = {
  apiName: string;
  operator: string;
  value: string;
  value2?: string;
  displayLabel?: string;
};

export type SavedFilterPreset = {
  id: string;
  name: string;
  createdAt: number;
  customViewId: string | null;
  /** Checkbox / picklist selections (apiName → values). */
  checkboxSelections: ContractFieldFilterSelection[];
  /** Free-text / lookup / date drafts. */
  manualFilters: SavedManualFilter[];
};

const STORAGE_PREFIX = "crm-saved-filters-v1:";

export function savedFiltersStorageKey(module: string) {
  return `${STORAGE_PREFIX}${module || "Contracts"}`;
}

function isSavedFilterPreset(value: unknown): value is SavedFilterPreset {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.createdAt === "number" &&
    Array.isArray(row.checkboxSelections) &&
    Array.isArray(row.manualFilters)
  );
}

export function loadSavedFilters(module: string): SavedFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(savedFiltersStorageKey(module));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedFilterPreset).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function persistSavedFilters(module: string, presets: SavedFilterPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedFiltersStorageKey(module), JSON.stringify(presets));
}

export function createSavedFilterId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
