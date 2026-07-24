import { isExcludedContractCatalogField } from "@/lib/contracts/columns";
import { getContractsOfflineFilterMeta } from "@/lib/contracts/static";
import {
  fetchZohoCustomViews,
  fetchZohoJson,
  getZohoModuleFieldsUrl,
  getZohoModuleLayoutsUrl,
  HIDDEN_API_NAMES,
  loadContractsFieldCatalog,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";

/* ─── Resolve filter values / lookup hints ─── */

/**
 * Known lookup fields → related Zoho module (hints, not an allowlist).
 * @type {Record<string, { kind: "lookup" | "user" | "layout"; module?: string; searchFields?: string[] }>}
 */
export const KNOWN_LOOKUP_FILTER_FIELDS = {
  Vendor: { kind: "lookup", module: "Vendors", searchFields: ["Name", "Vendor_Name"] },
  // Zoho Contracts.Site is an Accounts lookup (site/location account), not a Sites module.
  Site: { kind: "lookup", module: "Accounts", searchFields: ["Account_Name", "Name"] },
  Company_Name: { kind: "lookup", module: "Accounts", searchFields: ["Account_Name", "Name"] },
  SOW_Name: { kind: "lookup", module: "Deals", searchFields: ["SOWID", "Deal_Name", "Name"] },
  SOW: { kind: "lookup", module: "Deals", searchFields: ["SOWID", "Deal_Name", "Name"] },
  OurServices: {
    kind: "lookup",
    module: "Products",
    searchFields: ["Product_Name", "Name"],
  },
  Our_Services_SubForm: {
    kind: "lookup",
    module: "Products",
    searchFields: ["Product_Name", "Name"],
  },
  Scope_of_Work: {
    kind: "lookup",
    module: "Products",
    searchFields: ["Product_Name", "Name"],
  },
  Owner: { kind: "user" },
  Contract_Owner: { kind: "user" },
  Ops_Owner: { kind: "user" },
  Sales_Owner: { kind: "user" },
  Sales_Manager: { kind: "user" },
  Sales_Associate: { kind: "user" },
  Operations_Manager: { kind: "user" },
  Layout: { kind: "layout" },
};

/** @param {string} value */
export function looksLikeZohoId(value) {
  return /^\d{6,}$/.test(String(value ?? "").trim());
}

/**
 * @param {string} apiName
 * @returns {{ kind: "lookup" | "user" | "layout"; module?: string; searchFields?: string[] } | null}
 */
export function getKnownLookupFieldConfig(apiName) {
  const key = String(apiName ?? "").trim();
  if (!key) return null;
  if (KNOWN_LOOKUP_FILTER_FIELDS[key]) return KNOWN_LOOKUP_FILTER_FIELDS[key];
  // Subform fields are stored as `SubformModule.Field` in the filter UI.
  const leaf = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  return KNOWN_LOOKUP_FILTER_FIELDS[leaf] ?? null;
}

/**
 * @param {string} dataType
 */
export function isLookupLikeDataType(dataType) {
  const type = String(dataType ?? "").toLowerCase();
  return (
    type === "lookup" ||
    type === "ownerlookup" ||
    type === "userlookup" ||
    type === "multiselectlookup" ||
    type === "multiuserlookup"
  );
}

/**
 * @param {string} dataType
 */
export function isUserLikeDataType(dataType) {
  const type = String(dataType ?? "").toLowerCase();
  return type === "ownerlookup" || type === "userlookup" || type === "multiuserlookup";
}

/**
 * Zoho Search API does not support multi-user lookup fields (e.g. Contracts.Ops_Owner).
 * Map those filters onto the searchable single-user field that holds the same role data.
 * @param {string} apiName
 * @param {string} [dataType]
 * @param {string} [module]
 */
export function criteriaApiNameForFilterField(apiName, dataType = "", module = "") {
  const name = String(apiName ?? "").trim();
  const type = String(dataType ?? "").toLowerCase();
  const mod = String(module ?? "").trim();

  if (
    (mod === "Contracts" || !mod) &&
    name === "Ops_Owner" &&
    (type === "multiuserlookup" || type === "")
  ) {
    return "Operations_Manager";
  }

  // Subform Layout (`Our_Services_SubForm.Layout`) is not valid in list filters.
  // Map onto the parent module Layout field (same Vendor / Client-Site ids).
  if (name.endsWith(".Layout") || (type === "layout" && name.includes("."))) {
    return "Layout";
  }

  // Subform service lookup is exposed in the UI as `Our_Services_SubForm.OurServices`.
  // Normalize to leaf `OurServices`; Contracts list API resolves it via the subform module.
  if (name === "OurServices" || name.endsWith(".OurServices")) {
    return "OurServices";
  }

  return name;
}

/* ─── Filter operators by data type ─── */

/** @typedef {{ id: string; label: string }} FilterOperator */

/** @type {Record<string, FilterOperator[]>} */
const OPERATORS_BY_DATA_TYPE = {
  picklist: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  multiselectpicklist: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  layout: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  text: [
    { id: "contains", label: "contains" },
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
    { id: "in", label: "is any of" },
  ],
  email: [
    { id: "contains", label: "contains" },
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  phone: [
    { id: "contains", label: "contains" },
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  website: [
    { id: "contains", label: "contains" },
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  textarea: [
    { id: "contains", label: "contains" },
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  boolean: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
  ],
  integer: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  bigint: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  double: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  currency: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  percent: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  date: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "greater_equal", label: "on or after" },
    { id: "less_equal", label: "on or before" },
    { id: "between", label: "between" },
  ],
  datetime: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "greater_equal", label: "on or after" },
    { id: "less_equal", label: "on or before" },
    { id: "between", label: "between" },
  ],
  ownerlookup: [
    { id: "equals", label: "is" },
    { id: "contains", label: "contains" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  userlookup: [
    { id: "equals", label: "is" },
    { id: "contains", label: "contains" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  multiuserlookup: [
    { id: "equals", label: "is" },
    { id: "contains", label: "contains" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  lookup: [
    { id: "equals", label: "is" },
    { id: "contains", label: "contains" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
};

const DEFAULT_OPERATORS = [
  { id: "contains", label: "contains" },
  { id: "equals", label: "is" },
  { id: "not_equal", label: "is not" },
  { id: "starts_with", label: "starts with" },
];

/** @param {string} dataType */
export function getOperatorsForDataType(dataType) {
  const key = String(dataType ?? "text").toLowerCase();
  return OPERATORS_BY_DATA_TYPE[key] ?? DEFAULT_OPERATORS;
}

/* ─── Filter metadata cache / Zoho load ─── */

const FILTER_META_CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { sections: import("@/lib/contracts/filterTypes").ContractFilterSection[]; fields: import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" | "offline-demo"; cachedAt: number }>} */
const filterMetaCacheByModule = new Map();

/** Clear cached filter metadata (e.g. after layout/option mapping changes). */
export function clearFilterMetaCache() {
  filterMetaCacheByModule.clear();
}

// Bust cache when operator lists / layout options change (dev HMR + deploys).
clearFilterMetaCache();


const RELATED_LOOKUP_TYPES = new Set([
  "lookup",
  "ownerlookup",
  "userlookup",
  "multiselectlookup",
  "multiuserlookup",
]);

/** @type {import("@/lib/contracts/filterTypes").ContractFilterSectionId[]} */
export const FILTER_SECTION_ORDER = [
  "system_defined",
  "fields",
  "subforms",
  "related_modules",
];

/** @type {Record<import("@/lib/contracts/filterTypes").ContractFilterSectionId, string>} */
export const FILTER_SECTION_TITLES = {
  system_defined: "Custom Views",
  fields: "Filter By Fields",
  subforms: "Filter By Subforms",
  related_modules: "Filter By Related Modules",
};


/**
 * @param {unknown} candidate
 * @returns {string | undefined}
 */
function moduleApiFromLookupCandidate(candidate) {
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const obj = /** @type {Record<string, unknown>} */ (candidate);
    for (const key of ["api_name", "module", "name"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} layout
 * @returns {import("@/lib/contracts/filterTypes").ContractFilterOption | null}
 */
function mapLayoutOption(layout) {
  const id = layout.id != null ? String(layout.id).trim() : "";
  const label = String(
    layout.display_label ?? layout.name ?? layout.display_value ?? id,
  ).trim();
  if (!id && !label) return null;
  // Zoho search criteria for Layout expects the layout id when available.
  return {
    value: id || label,
    label: label || id,
  };
}

/**
 * @param {Record<string, unknown>} field
 * @returns {import("@/lib/contracts/filterTypes").ContractFilterOption[]}
 */
function mapPickListOptions(field) {
  const dataType = String(field.data_type ?? "text").toLowerCase();

  if (dataType === "layout" && Array.isArray(field.layouts)) {
    return field.layouts
      .map((layout) =>
        layout && typeof layout === "object" ?
          mapLayoutOption(/** @type {Record<string, unknown>} */ (layout))
        : null,
      )
      .filter(Boolean);
  }

  if (dataType === "boolean") {
    return [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ];
  }

  if (!Array.isArray(field.pick_list_values)) return [];

  return field.pick_list_values
    .filter((opt) => opt.actual_value && opt.actual_value !== "-None-")
    .map((opt) => ({
      value: opt.actual_value,
      label: opt.display_value ?? opt.actual_value,
    }));
}

/**
 * Load every module layout (Vendor, Client-Site, …) — field metadata often only has one.
 * @param {string} module
 * @returns {Promise<import("@/lib/contracts/filterTypes").ContractFilterOption[]>}
 */
async function loadModuleLayoutOptions(module) {
  const { res, body } = await fetchZohoJson(getZohoModuleLayoutsUrl(module));
  if (!res.ok || !Array.isArray(body.layouts)) return [];

  /** @type {Map<string, import("@/lib/contracts/filterTypes").ContractFilterOption>} */
  const byValue = new Map();

  for (const raw of body.layouts) {
    if (!raw || typeof raw !== "object") continue;
    const layout = /** @type {Record<string, unknown>} */ (raw);
    const status = String(layout.status ?? "").toLowerCase();
    if (status === "deleted" || status === "-1") continue;

    const option = mapLayoutOption(layout);
    if (!option) continue;
    if (!byValue.has(option.value)) byValue.set(option.value, option);
  }

  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} fields
 * @param {import("@/lib/contracts/filterTypes").ContractFilterOption[]} layoutOptions
 */
/**
 * Layouts that should not appear in filter checkboxes (e.g. Fleet).
 * @param {import("@/lib/contracts/filterTypes").ContractFilterOption} option
 */
function isHiddenLayoutFilterOption(option) {
  const label = String(option?.label ?? "").trim().toLowerCase();
  return label === "fleet";
}

/**
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} fields
 * @param {import("@/lib/contracts/filterTypes").ContractFilterOption[]} layoutOptions
 */
function applyLayoutOptionsToFields(fields, layoutOptions) {
  const visible = layoutOptions.filter((opt) => !isHiddenLayoutFilterOption(opt));
  if (!visible.length) return;
  for (const field of fields) {
    // Only stamp parent-module layouts onto the module Layout field.
    // Subform `*.Layout` must not get Vendor / Client-Site (Contracts) ids —
    // filtering `Our_Services_SubForm.Layout` makes Zoho return HTTP 500.
    if (field.apiName === "Layout") {
      field.options = visible;
      field.hasOptions = true;
    }
  }
}

/**
 * @param {Record<string, unknown>} field
 * @returns {string | undefined}
 */
function extractLookupModule(field) {
  const dataType = String(field.data_type ?? "").toLowerCase();
  if (!RELATED_LOOKUP_TYPES.has(dataType)) return undefined;

  const lookup = field.lookup && typeof field.lookup === "object" ? field.lookup : null;
  const associated =
    field.associated_module && typeof field.associated_module === "object" ?
      field.associated_module
    : null;

  const candidates = [
    lookup && /** @type {Record<string, unknown>} */ (lookup).module,
    lookup && /** @type {Record<string, unknown>} */ (lookup).api_name,
    associated && /** @type {Record<string, unknown>} */ (associated).module,
    associated && /** @type {Record<string, unknown>} */ (associated).api_name,
  ];

  for (const candidate of candidates) {
    const moduleApi = moduleApiFromLookupCandidate(candidate);
    if (moduleApi) return moduleApi;
  }

  const known = getKnownLookupFieldConfig(String(field.api_name ?? ""));
  if (known?.kind === "lookup" && known.module) return known.module;
  return undefined;
}

/**
 * @param {Record<string, unknown>} field
 * @param {import("@/lib/contracts/filterTypes").ContractFilterSectionId} section
 * @param {{ groupLabel?: string; customViewId?: string }} [extra]
 * @returns {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta | null}
 */
function mapFilterField(field, section, extra = {}) {
  const apiName = field.api_name;
  if (!apiName || typeof apiName !== "string") return null;
  if (HIDDEN_API_NAMES.has(apiName) || apiName === "id") return null;
  if (field.filterable === false) return null;

  // Prefer the Site lookup (Accounts) over the unused Site_Name text field.
  const dataType = String(field.data_type ?? "text").toLowerCase();
  if (apiName === "Site_Name" && !RELATED_LOOKUP_TYPES.has(dataType)) {
    return null;
  }
  // Ops_Owner (multi-user) is not searchable; filter UI keeps "Ops Owner" and maps
  // criteria to Operations_Manager — hide the duplicate Operations Manager filter.
  if (apiName === "Operations_Manager") {
    return null;
  }

  const options = mapPickListOptions(field);
  const lookupModule = extractLookupModule(field);

  return {
    apiName,
    label: field.field_label ?? apiName,
    dataType,
    operators: getOperatorsForDataType(dataType),
    options,
    hasOptions: options.length > 0,
    section,
    groupLabel: extra.groupLabel,
    customViewId: extra.customViewId,
    ...(lookupModule ? { lookupModule } : {}),
  };
}

/**
 * Prefer clearer filter labels for known Contracts fields.
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta} field
 */
function applyContractsFilterLabelOverrides(field) {
  if (field.apiName === "Site") {
    field.label = "Site Name";
  }
  return field;
}

function isRelatedModuleField(field) {
  const dataType = String(field.data_type ?? "").toLowerCase();
  return RELATED_LOOKUP_TYPES.has(dataType);
}

/**
 * @param {Record<string, unknown>[]} moduleFields
 * @returns {Map<string, string>}
 */
function discoverSubformModules(moduleFields) {
  /** @type {Map<string, string>} */
  const subforms = new Map();
  for (const field of moduleFields) {
    if (String(field.data_type ?? "").toLowerCase() !== "subform") continue;
    const moduleApi = field.associated_module?.module;
    if (!moduleApi || typeof moduleApi !== "string") continue;
    const label = field.field_label ?? field.display_label ?? moduleApi;
    subforms.set(moduleApi, label);
  }
  return subforms;
}

/**
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} systemFields
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} moduleFields
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} subformFields
 * @param {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} relatedFields
 */
function assembleFilterMetaSections(systemFields, moduleFields, subformFields, relatedFields) {
  const allFields = [...systemFields, ...moduleFields, ...subformFields, ...relatedFields];
  /** @type {import("@/lib/contracts/filterTypes").ContractFilterSection[]} */
  const sections = FILTER_SECTION_ORDER.map((id) => ({
    id,
    title: FILTER_SECTION_TITLES[id],
    fields:
      id === "system_defined" ? systemFields
      : id === "fields" ? moduleFields
      : id === "subforms" ? subformFields
      : relatedFields,
  })).filter((section) => section.fields.length > 0);

  return { sections, fields: allFields };
}

/** Build filter sidebar from Contracts field catalog (same source as manage columns). */
async function buildContractsFilterMetaFromCatalog() {
  const { fields: catalog } = await loadContractsFieldCatalog();

  /** @type {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} */
  const moduleFields = [];
  for (const field of catalog) {
    if (isExcludedContractCatalogField(field)) continue;
    const dataType = String(field.dataType ?? "text").toLowerCase();
    if (dataType === "subform" || dataType === "image" || dataType === "profileimage") continue;

    const knownLookup = getKnownLookupFieldConfig(field.apiName);
    moduleFields.push(
      applyContractsFilterLabelOverrides({
        apiName: field.apiName,
        label: field.label,
        dataType,
        operators: getOperatorsForDataType(dataType),
        options: [],
        hasOptions: false,
        section: /** @type {const} */ ("fields"),
        ...(knownLookup?.module ? { lookupModule: knownLookup.module } : {}),
      }),
    );
  }
  moduleFields.sort((a, b) => a.label.localeCompare(b.label));

  const systemFields = await loadSystemDefinedFilters("Contracts").catch((err) => {
    console.error("Zoho custom views for filters failed:", err);
    return [];
  });

  const layoutOptions = await loadModuleLayoutOptions("Contracts").catch((err) => {
    console.error("Zoho layouts for filter options failed (Contracts catalog fallback):", err);
    return /** @type {import("@/lib/contracts/filterTypes").ContractFilterOption[]} */ ([]);
  });
  applyLayoutOptionsToFields(moduleFields, layoutOptions);

  const { sections, fields } = assembleFilterMetaSections(
    systemFields,
    moduleFields,
    [],
    [],
  );

  if (fields.length === 0) {
    return getContractsOfflineFilterMeta();
  }

  return { sections, fields, source: /** @type {const} */ ("fallback") };
}

async function resolveContractsFilterMetaFallback() {
  try {
    return await buildContractsFilterMetaFromCatalog();
  } catch (err) {
    console.error("Contracts catalog filter fallback failed:", err);
    return getContractsOfflineFilterMeta();
  }
}

/** Zoho Custom Views for filter metadata (live Zoho fetch). */
async function loadSystemDefinedFilters(module) {
  return fetchZohoCustomViews(module);
}

/** @returns {Promise<{ sections: import("@/lib/contracts/filterTypes").ContractFilterSection[]; fields: import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" }>} */
export async function loadModuleFilterMeta(module) {
  const cached = filterMetaCacheByModule.get(module);
  if (
    cached &&
    Date.now() - cached.cachedAt < FILTER_META_CACHE_TTL_MS &&
    cached.fields.length > 0
  ) {
    return {
      sections: cached.sections,
      fields: cached.fields,
      source: cached.source,
    };
  }

  const zohoUrl = getZohoModuleFieldsUrl(module);

  try {
    const { res, body } = await fetchZohoJson(zohoUrl);

    if (!res.ok || !Array.isArray(body.fields)) {
      throw new Error("Invalid fields response");
    }

    const systemFields = await loadSystemDefinedFilters(module).catch((err) => {
      console.error("Zoho custom views for filters failed:", err);
      return [];
    });

    /** @type {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} */
    const moduleFields = [];
    /** @type {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} */
    const relatedFields = [];

    for (const raw of body.fields) {
      if (isRelatedModuleField(raw)) {
        if (
          module === "Contracts" &&
          isExcludedContractCatalogField({
            apiName: String(raw.api_name ?? ""),
            label: String(raw.field_label ?? raw.api_name ?? ""),
            dataType: String(raw.data_type ?? "text"),
          })
        ) {
          continue;
        }
        const mapped = mapFilterField(raw, "related_modules");
        if (mapped) relatedFields.push(applyContractsFilterLabelOverrides(mapped));
      } else if (String(raw.data_type ?? "").toLowerCase() === "subform") {
        continue;
      } else {
        if (
          module === "Contracts" &&
          isExcludedContractCatalogField({
            apiName: String(raw.api_name ?? ""),
            label: String(raw.field_label ?? raw.api_name ?? ""),
            dataType: String(raw.data_type ?? "text"),
          })
        ) {
          continue;
        }
        const mapped = mapFilterField(raw, "fields");
        if (mapped) moduleFields.push(applyContractsFilterLabelOverrides(mapped));
      }
    }

    moduleFields.sort((a, b) => a.label.localeCompare(b.label));
    relatedFields.sort((a, b) => a.label.localeCompare(b.label));

    /** @type {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} */
    const subformFields = [];
    const subformModules = discoverSubformModules(body.fields);

    await Promise.all(
      [...subformModules.entries()].map(async ([moduleApi, groupLabel]) => {
        try {
          const subUrl = getZohoModuleFieldsUrl(moduleApi);
          const { res: subRes, body: subBody } = await fetchZohoJson(subUrl);
          if (!subRes.ok || !Array.isArray(subBody.fields)) return;

          for (const raw of subBody.fields) {
            const mapped = mapFilterField(raw, "subforms", { groupLabel });
            if (!mapped) continue;
            // Parent-list filters cannot use subform Layout; Zoho returns 500.
            if (mapped.apiName === "Layout" || mapped.dataType === "layout") continue;
            mapped.apiName = `${moduleApi}.${mapped.apiName}`;
            subformFields.push(mapped);
          }
        } catch (err) {
          console.error(`Zoho subform fields failed (${moduleApi}):`, err);
        }
      }),
    );

    subformFields.sort((a, b) => {
      const g = (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "");
      return g !== 0 ? g : a.label.localeCompare(b.label);
    });

    const layoutOptions = await loadModuleLayoutOptions(module).catch((err) => {
      console.error(`Zoho layouts for filter options failed (${module}):`, err);
      return /** @type {import("@/lib/contracts/filterTypes").ContractFilterOption[]} */ ([]);
    });
    applyLayoutOptionsToFields(moduleFields, layoutOptions);

    const allFields = [...systemFields, ...moduleFields, ...subformFields, ...relatedFields];

    if (allFields.length === 0) {
      throw new Error("No filterable fields from Zoho metadata");
    }

    const { sections, fields } = assembleFilterMetaSections(
      systemFields,
      moduleFields,
      subformFields,
      relatedFields,
    );

    const result = { sections, fields, source: /** @type {const} */ ("zoho") };
    filterMetaCacheByModule.set(module, { ...result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error("Zoho filter metadata request failed:", err);
  }

  if (module === "Contracts") {
    const fallback = await resolveContractsFilterMetaFallback();
    filterMetaCacheByModule.set(module, { ...fallback, cachedAt: Date.now() });
    return fallback;
  }

  const fallback = getContractsOfflineFilterMeta();
  filterMetaCacheByModule.set(module, { ...fallback, cachedAt: Date.now() });
  return fallback;
}

/** @returns {Promise<{ sections: import("@/lib/contracts/filterTypes").ContractFilterSection[]; fields: import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" }>} */
export async function loadContractsFilterMeta() {
  return loadModuleFilterMeta("Contracts");
}

/* ─── Create Zoho custom view ─── */

/** Default columns shown in a new Contracts custom view. */
const DEFAULT_CONTRACT_VIEW_FIELDS = [
  "Name",
  "Contract_Status",
  "Vendor",
  "Company_Name",
  "Site",
  "Contract_Start_Date",
  "Contract_End_Date",
];

/** Map UI operators → Zoho custom-view comparators. */
const VIEW_COMPARATOR = {
  equals: "equal",
  equal: "equal",
  not_equal: "not_equal",
  starts_with: "starts_with",
  contains: "contains",
  not_contains: "not_contains",
  in: "in",
  between: "between",
  greater_than: "greater_than",
  greater_equal: "greater_equal",
  less_than: "less_than",
  less_equal: "less_equal",
};

/**
 * @typedef {{ apiName: string; operator: string; values: string[] }} CustomViewCondition
 */

/** @param {string} apiName */
function isLayoutCriteriaField(apiName) {
  const name = String(apiName ?? "").trim();
  return name === "Layout" || name.endsWith(".Layout");
}

/**
 * Zoho create-custom-view expects Layout values as `{ id }` (string id → INTERNAL_ERROR).
 * @param {string[]} values
 * @param {string} comparator
 */
function formatLayoutCriteriaValue(values, comparator) {
  const asObjects = values.map((id) => ({ id }));
  if (comparator === "in" || comparator === "between" || values.length > 1) {
    return asObjects;
  }
  return asObjects[0];
}

/**
 * Build create-view conditions from sidebar field selections / drafts.
 * @param {import("@/lib/contracts/filterTypes").ContractFieldFilterSelection[]} selections
 * @param {string} [module]
 * @returns {CustomViewCondition[]}
 */
export function conditionsFromFieldFilterSelections(selections, module = "Contracts") {
  /** @type {CustomViewCondition[]} */
  const conditions = [];
  for (const selection of selections ?? []) {
    const apiName = criteriaApiNameForFilterField(
      String(selection?.apiName ?? "").trim(),
      isLayoutCriteriaField(selection?.apiName) ? "layout" : "",
      module,
    );
    const values = (selection?.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!apiName || values.length === 0) continue;
    const operator =
      selection.operator ||
      (values.length > 1 ? "in" : "equals");
    conditions.push({ apiName, operator, values });
  }
  return conditions;
}

/**
 * @param {CustomViewCondition[]} conditions
 * @returns {Record<string, unknown> | null}
 */
export function buildZohoCustomViewCriteria(conditions) {
  /** @type {Record<string, unknown>[]} */
  const group = [];

  for (const condition of conditions) {
    const apiName = criteriaApiNameForFilterField(
      String(condition.apiName ?? "").trim(),
      isLayoutCriteriaField(condition.apiName) ? "layout" : "",
      "Contracts",
    );
    const values = (condition.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!apiName || values.length === 0) continue;

    const operator = condition.operator || (values.length > 1 ? "in" : "equals");
    const comparator = VIEW_COMPARATOR[operator] ?? operator;

    let value;
    if (isLayoutCriteriaField(apiName)) {
      value = formatLayoutCriteriaValue(values, comparator);
    } else if (
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
      comparator,
      field: { api_name: apiName },
      type: "value",
      value,
    });
  }

  if (group.length === 0) return null;
  if (group.length === 1) return group[0];
  return { group_operator: "AND", group };
}

/**
 * Create a Zoho CRM custom view for Contracts (or another module).
 * Requires OAuth scope: ZohoCRM.settings.custom_views.CREATE (or .ALL / settings.ALL)
 *
 * @param {{
 *   module?: string;
 *   name: string;
 *   accessType?: "only_to_me" | "public";
 *   conditions: CustomViewCondition[];
 *   displayFields?: string[];
 * }} input
 */
export async function createZohoCustomView(input) {
  const module = input.module?.trim() || "Contracts";
  const name = String(input.name ?? "").trim();
  if (!name) {
    const err = new Error("View name is required");
    err.status = 400;
    throw err;
  }

  const criteria = buildZohoCustomViewCriteria(input.conditions ?? []);
  if (!criteria) {
    const err = new Error("Add at least one filter condition");
    err.status = 400;
    throw err;
  }

  const accessType = input.accessType === "public" ? "public" : "only_to_me";
  const fieldNames =
    input.displayFields?.filter(Boolean).length ?
      input.displayFields.filter(Boolean)
    : DEFAULT_CONTRACT_VIEW_FIELDS;

  const payload = {
    custom_views: [
      {
        name,
        access_type: accessType,
        fields: fieldNames.map((api_name) => ({ api_name })),
        criteria,
      },
    ],
  };

  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}`;
  const { res, body } = await fetchZohoJson(url, { method: "POST", body: payload });

  if (!res.ok) {
    const code = String(body?.code ?? "");
    let message = body?.message ?? body?.error ?? "Failed to create custom view in Zoho CRM";
    if (code === "OAUTH_SCOPE_MISMATCH") {
      message =
        "Zoho OAuth is missing custom-view create permission. Add scope ZohoCRM.settings.custom_views.CREATE (or ZohoCRM.settings.ALL), regenerate the refresh token, and update ZOHO_REFRESH_TOKEN.";
    }
    const err = new Error(message);
    err.status = res.status;
    err.details = body;
    throw err;
  }

  const row =
    (Array.isArray(body?.custom_views) && body.custom_views[0]) ||
    (Array.isArray(body?.data) && body.data[0]) ||
    null;
  const id =
    row?.details?.id != null ? String(row.details.id)
    : row?.id != null ? String(row.id)
    : "";

  if (!id) {
    const err = new Error("Zoho created the view but did not return an id");
    err.status = 502;
    err.details = body;
    throw err;
  }

  clearFilterMetaCache();

  return {
    id,
    name,
    accessType,
    raw: body,
  };
}
